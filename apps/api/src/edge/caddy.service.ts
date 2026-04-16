import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CustomDomainStatus, EdgeConfigApplyStatus } from '@prisma/client';
import { buildCaddyfile } from '@opendeploy/shared';
import { writeFile } from 'node:fs/promises';
import type { Env } from '../config/env';
import { OPENDEPLOY_ENV } from '../config/env.constants';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { postCaddyLoad } from './caddy-admin-post';

/** Custom hostnames appear in the edge config only in these states (verified + issuance/routing). */
const CUSTOM_DOMAIN_CADDY_STATUSES: CustomDomainStatus[] = [
  CustomDomainStatus.certificate_issuing,
  CustomDomainStatus.certificate_active,
  CustomDomainStatus.certificate_renewing,
  CustomDomainStatus.active,
];

@Injectable()
export class CaddyService {
  private readonly logger = new Logger(CaddyService.name);

  constructor(
    @Inject(OPENDEPLOY_ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async resolveEdgeNodeId(): Promise<string | null> {
    const name = this.env.EDGE_NODE_NAME;
    if (!name) {
      return null;
    }
    const node = await this.prisma.edgeNode.upsert({
      where: { name },
      create: { name, status: 'active' },
      update: {},
    });
    return node.id;
  }

  private async nextConfigVersion(edgeNodeId: string | null): Promise<number> {
    const agg = await this.prisma.edgeConfigVersion.aggregate({
      where: { edgeNodeId },
      _max: { version: true },
    });
    return (agg._max.version ?? 0) + 1;
  }

  private configHash(body: string): string {
    return createHash('sha256').update(body).digest('hex');
  }

  async applyFromDatabase(): Promise<void> {
    const platformBindings = await this.prisma.routeBinding.findMany({
      where: { status: 'attached', platformHostnameId: { not: null } },
      include: {
        platformHostname: true,
        runtimeInstance: true,
      },
    });

    const customBindings = await this.prisma.routeBinding.findMany({
      where: {
        status: 'attached',
        platformHostnameId: null,
        customDomain: {
          status: { in: CUSTOM_DOMAIN_CADDY_STATUSES },
        },
      },
      include: {
        runtimeInstance: true,
        customDomain: { select: { hostname: true } },
      },
    });

    const routes = [
      ...platformBindings.map((b) => ({
        host: b.platformHostname!.hostname,
        upstreamDial: b.runtimeInstance.upstreamDial,
      })),
      ...customBindings.map((b) => ({
        host: b.customDomain!.hostname,
        upstreamDial: b.runtimeInstance.upstreamDial,
      })),
    ];

    const body = buildCaddyfile({
      routes,
      email: this.env.CADDY_ACME_EMAIL,
    });

    if (this.env.CADDYFILE_PATH) {
      await writeFile(this.env.CADDYFILE_PATH, `${body}\n`, 'utf8');
      this.logger.log({ path: this.env.CADDYFILE_PATH }, 'caddyfile_written');
    }

    const unixSocket = this.env.CADDY_ADMIN_UNIX_SOCKET;
    const admin = this.env.CADDY_ADMIN_URL;

    let hotReloadOk = false;
    if (unixSocket || admin) {
      const res = await postCaddyLoad({
        unixSocketPath: unixSocket,
        adminUrl: admin,
        body,
      });
      if (res.statusCode < 200 || res.statusCode >= 300) {
        const redacted = res.rawBody.replace(
          /(Authorization|Bearer|token|key)([^"]*)("[\w-]+")/gi,
          '$1=***',
        );
        await this.recordConfigVersion(body, EdgeConfigApplyStatus.failed, redacted.slice(0, 2000));
        throw new Error(`caddy_reload_failed:${res.statusCode}:${redacted.slice(0, 2000)}`);
      }
      hotReloadOk = true;
      this.logger.log({ routeCount: routes.length }, 'caddy_reload_ok');
    } else {
      this.logger.warn('CADDY_ADMIN_URL and CADDY_ADMIN_UNIX_SOCKET unset; edge hot reload skipped');
    }

    const wroteFile = Boolean(this.env.CADDYFILE_PATH);
    if (hotReloadOk || wroteFile) {
      await this.recordConfigVersion(body, EdgeConfigApplyStatus.applied, null);
    }
  }

  private async recordConfigVersion(
    body: string,
    applyStatus: EdgeConfigApplyStatus,
    errorDetail: string | null,
  ): Promise<void> {
    const edgeNodeId = await this.resolveEdgeNodeId();
    const version = await this.nextConfigVersion(edgeNodeId);
    await this.prisma.edgeConfigVersion.create({
      data: {
        edgeNodeId,
        version,
        configHash: this.configHash(body),
        bodySnapshot: body,
        applyStatus,
        errorDetail,
        actorHint: 'applyFromDatabase',
      },
    });
  }

  /**
   * Re-apply a previously stored Caddyfile snapshot and append a new version row (audit trail).
   */
  async rollbackToVersion(
    version: number,
    auditCtx?: { workspaceId?: string | null; actorUserId?: string | null },
  ): Promise<void> {
    const edgeNodeId = await this.resolveEdgeNodeId();
    const row = await this.prisma.edgeConfigVersion.findFirst({
      where: {
        edgeNodeId,
        version,
        applyStatus: EdgeConfigApplyStatus.applied,
      },
    });
    if (!row) {
      throw new NotFoundException('edge_config_version_not_found');
    }

    const unixSocket = this.env.CADDY_ADMIN_UNIX_SOCKET;
    const admin = this.env.CADDY_ADMIN_URL;
    if (!unixSocket && !admin) {
      throw new Error('caddy_admin_not_configured_for_rollback');
    }

    const res = await postCaddyLoad({
      unixSocketPath: unixSocket,
      adminUrl: admin,
      body: row.bodySnapshot,
    });
    if (res.statusCode < 200 || res.statusCode >= 300) {
      const nextV = await this.nextConfigVersion(edgeNodeId);
      await this.prisma.edgeConfigVersion.create({
        data: {
          edgeNodeId,
          version: nextV,
          configHash: this.configHash(row.bodySnapshot),
          bodySnapshot: row.bodySnapshot,
          applyStatus: EdgeConfigApplyStatus.failed,
          errorDetail: res.rawBody.slice(0, 2000),
          actorHint: `rollback_failed_from_v${version}`,
        },
      });
      throw new Error(`caddy_rollback_failed:${res.statusCode}`);
    }

    const nextV = await this.nextConfigVersion(edgeNodeId);
    await this.prisma.edgeConfigVersion.create({
      data: {
        edgeNodeId,
        version: nextV,
        configHash: this.configHash(row.bodySnapshot),
        bodySnapshot: row.bodySnapshot,
        applyStatus: EdgeConfigApplyStatus.applied,
        actorHint: `rollback_from_v${version}`,
      },
    });

    await this.audit.record({
      workspaceId: auditCtx?.workspaceId,
      actorUserId: auditCtx?.actorUserId,
      action: 'edge.config.rollback',
      resource: 'edge_config_version',
      resourceId: row.id,
      metadata: { fromVersion: version, newVersion: nextV },
    });
    this.logger.log({ fromVersion: version, newVersion: nextV }, 'caddy_rollback_ok');
  }
}
