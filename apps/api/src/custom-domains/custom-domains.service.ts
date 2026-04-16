import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CertificateRecordStatus,
  CustomDomainStatus,
  DomainCheckMethod,
  DomainEventType,
  DomainFailureCode,
  EnvironmentType,
  Prisma,
  ReleaseStatus,
  RouteBindingStatus,
} from '@prisma/client';
import {
  canTransitionCustomDomain,
  classifyAcmeOrEdgeError,
  deriveApexDomain,
  isApexHostname,
  isValidCustomHostnameShape,
  collidesWithPlatformDomain,
  normalizeCustomHostname,
  productionHostname,
  suggestedBackoffMs,
  verificationTxtRecordName,
  type CustomDomainStatusName,
} from '@opendeploy/shared';
import { randomBytes } from 'node:crypto';
import type { Env } from '../config/env';
import { OPENDEPLOY_ENV } from '../config/env.constants';
import { AuditService } from '../audit/audit.service';
import { CaddyService } from '../edge/caddy.service';
import { PrismaService } from '../prisma/prisma.service';
import { DomainQueueService } from '../queue/domain-queue.service';
import { cnameMatchesPlatformTarget, resolveCnameChainLeafTarget, txtRecordsAt } from './dns-verify';
import { probePeerCertificate } from './tls-peer-cert';

function verificationToken(): string {
  return `odv1.${randomBytes(24).toString('base64url')}`;
}

@Injectable()
export class CustomDomainsService {
  private readonly logger = new Logger(CustomDomainsService.name);

  constructor(
    @Inject(OPENDEPLOY_ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly caddy: CaddyService,
    private readonly domainQueue: DomainQueueService,
  ) {}

  private async transition(
    id: string,
    to: CustomDomainStatus,
    extra?: Partial<{
      failureCode: DomainFailureCode | null;
      failureDetail: string | null;
      verifiedAt: Date | null;
      nextRetryAt: Date | null;
    }>,
  ): Promise<void> {
    const row = await this.prisma.customDomain.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('custom_domain_not_found');
    const t = canTransitionCustomDomain(row.status as CustomDomainStatusName, to as CustomDomainStatusName);
    if (!t.ok) {
      throw new BadRequestException(t.reason);
    }
    await this.prisma.customDomain.update({
      where: { id },
      data: {
        status: to,
        failureCode: extra?.failureCode !== undefined ? extra.failureCode : undefined,
        failureDetail: extra?.failureDetail !== undefined ? extra.failureDetail : undefined,
        verifiedAt: extra?.verifiedAt !== undefined ? extra.verifiedAt : undefined,
        nextRetryAt: extra?.nextRetryAt !== undefined ? extra.nextRetryAt : undefined,
      },
    });
    await this.prisma.domainEvent.create({
      data: {
        customDomainId: id,
        type: DomainEventType.status_transition,
        payloadJson: { from: row.status, to } as Prisma.InputJsonValue,
      },
    });
  }

  private async emit(id: string, type: DomainEventType, payload?: Record<string, unknown>): Promise<void> {
    await this.prisma.domainEvent.create({
      data: {
        customDomainId: id,
        type,
        payloadJson: payload ? (payload as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async listForEnvironment(workspaceId: string, projectId: string, environmentId: string) {
    const env = await this.prisma.environment.findFirst({
      where: { id: environmentId, projectId, project: { workspaceId } },
    });
    if (!env) throw new NotFoundException('environment_not_found');
    return this.prisma.customDomain.findMany({
      where: { projectId, environmentId },
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { slug: true } },
        activeCertificate: true,
        verificationChecks: { orderBy: { checkedAt: 'desc' }, take: 10 },
      },
    });
  }

  async getOne(workspaceId: string, projectId: string, environmentId: string, customDomainId: string) {
    const row = await this.prisma.customDomain.findFirst({
      where: {
        id: customDomainId,
        projectId,
        environmentId,
        project: { workspaceId },
      },
      include: {
        project: { select: { workspaceId: true, slug: true } },
        activeCertificate: true,
        verificationChecks: { orderBy: { checkedAt: 'desc' }, take: 20 },
        events: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
    if (!row) throw new NotFoundException('custom_domain_not_found');
    return row;
  }

  async addDomain(input: {
    workspaceId: string;
    projectId: string;
    environmentId: string;
    hostnameRaw: string;
    actorUserId: string;
  }) {
    const env = await this.prisma.environment.findFirst({
      where: { id: input.environmentId, projectId: input.projectId, project: { workspaceId: input.workspaceId } },
      include: { project: true },
    });
    if (!env) throw new NotFoundException('environment_not_found');
    if (env.type !== EnvironmentType.production) {
      throw new BadRequestException('custom_domains_production_only');
    }

    const hostname = normalizeCustomHostname(input.hostnameRaw);
    if (!isValidCustomHostnameShape(hostname)) {
      throw new BadRequestException('invalid_hostname');
    }
    if (isApexHostname(hostname)) {
      throw new BadRequestException('apex_not_supported_mvp');
    }
    if (collidesWithPlatformDomain(hostname, this.env.PLATFORM_PUBLIC_DOMAIN)) {
      throw new BadRequestException('hostname_collides_with_platform');
    }

    const expectedCname = productionHostname({
      projectSlug: env.project.slug,
      platformDomain: this.env.PLATFORM_PUBLIC_DOMAIN,
    });

    const token = verificationToken();
    const apex = deriveApexDomain(hostname);

    let row;
    try {
      row = await this.prisma.customDomain.create({
        data: {
          projectId: input.projectId,
          environmentId: input.environmentId,
          hostname,
          apexDomain: apex,
          status: CustomDomainStatus.awaiting_verification,
          verificationToken: token,
          createdByUserId: input.actorUserId,
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Unique constraint')) {
        throw new BadRequestException('hostname_already_claimed');
      }
      throw e;
    }

    await this.emit(row.id, DomainEventType.domain_created, { hostname });
    await this.audit.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'custom_domain.created',
      resource: 'custom_domain',
      resourceId: row.id,
      metadata: { hostname, environmentId: input.environmentId },
    });

    await this.domainQueue.enqueueVerify(row.id);
    return row;
  }

  instructionsFor(row: { hostname: string; verificationToken: string }, projectSlug: string) {
    const platformTarget = productionHostname({
      projectSlug,
      platformDomain: this.env.PLATFORM_PUBLIC_DOMAIN,
    });
    return {
      hostname: row.hostname,
      cname: {
        name: row.hostname,
        value: platformTarget,
      },
      txt: {
        name: verificationTxtRecordName(row.hostname),
        value: row.verificationToken,
      },
      platformTarget,
    };
  }

  async recheck(workspaceId: string, projectId: string, environmentId: string, customDomainId: string) {
    await this.getOne(workspaceId, projectId, environmentId, customDomainId);
    await this.domainQueue.enqueueVerify(customDomainId);
    return { ok: true as const };
  }

  async executeVerify(customDomainId: string): Promise<void> {
    const row = await this.prisma.customDomain.findUnique({
      where: { id: customDomainId },
      include: {
        project: { select: { slug: true, workspaceId: true } },
        environment: { select: { id: true, type: true } },
      },
    });
    if (!row) return;
    if (
      row.status === CustomDomainStatus.deleted ||
      row.status === CustomDomainStatus.revoked ||
      row.status === CustomDomainStatus.active
    ) {
      return;
    }

    const expectedCname = productionHostname({
      projectSlug: row.project.slug,
      platformDomain: this.env.PLATFORM_PUBLIC_DOMAIN,
    });

    const cnameTarget = await resolveCnameChainLeafTarget(row.hostname);
    const cnameOk = cnameMatchesPlatformTarget(cnameTarget, expectedCname);
    await this.prisma.domainVerificationCheck.create({
      data: {
        customDomainId: row.id,
        method: DomainCheckMethod.cname_target,
        result: cnameOk,
        observedValue: cnameTarget,
        errorDetail: cnameOk ? null : `expected_cname_to_${expectedCname}`,
      },
    });

    const txtName = verificationTxtRecordName(row.hostname);
    const txtVals = await txtRecordsAt(txtName);
    const txtOk = txtVals.some((t) => t.includes(row.verificationToken));
    await this.prisma.domainVerificationCheck.create({
      data: {
        customDomainId: row.id,
        method: DomainCheckMethod.dns_txt,
        result: txtOk,
        observedValue: txtVals.join(',').slice(0, 500),
        errorDetail: txtOk ? null : 'verification_token_not_found',
      },
    });

    await this.prisma.customDomain.update({
      where: { id: row.id },
      data: { lastCheckedAt: new Date() },
    });

    if (cnameOk && txtOk) {
      if (row.status !== CustomDomainStatus.verified) {
        await this.transition(row.id, CustomDomainStatus.verified, {
          verifiedAt: new Date(),
          failureCode: null,
          failureDetail: null,
          nextRetryAt: null,
        });
      }
      await this.emit(row.id, DomainEventType.verification_passed, {});
      await this.audit.record({
        workspaceId: row.project.workspaceId,
        actorUserId: undefined,
        action: 'custom_domain.verified',
        resource: 'custom_domain',
        resourceId: row.id,
      });
      return;
    }

    const code = !cnameOk ? DomainFailureCode.cname_misconfigured : DomainFailureCode.txt_misconfigured;
    await this.transition(row.id, CustomDomainStatus.failed, {
      failureCode: code,
      failureDetail: !cnameOk ? 'cname_misconfigured' : 'txt_misconfigured',
      nextRetryAt: new Date(Date.now() + suggestedBackoffMs('dns_propagation', 1)),
    });
    await this.emit(row.id, DomainEventType.verification_failed, {
      cnameOk,
      txtOk,
    });
  }

  async attach(input: {
    workspaceId: string;
    projectId: string;
    environmentId: string;
    customDomainId: string;
    releaseId: string;
    actorUserId: string;
  }) {
    const domain = await this.getOne(
      input.workspaceId,
      input.projectId,
      input.environmentId,
      input.customDomainId,
    );
    if (domain.status !== CustomDomainStatus.verified && domain.status !== CustomDomainStatus.detached) {
      throw new BadRequestException('domain_not_verified');
    }

    const release = await this.prisma.release.findFirst({
      where: {
        id: input.releaseId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        status: ReleaseStatus.active,
      },
      include: { runtimeInstances: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!release) throw new BadRequestException('release_not_active');
    const rt = release.runtimeInstances[0];
    if (!rt) throw new BadRequestException('runtime_missing');

    const latestOk = await this.prisma.healthCheckResult.findFirst({
      where: { runtimeInstanceId: rt.id, success: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!latestOk) throw new BadRequestException('runtime_not_healthy');

    await this.prisma.$transaction(async (tx) => {
      if (domain.routeBindingId) {
        await tx.routeBinding.update({
          where: { id: domain.routeBindingId },
          data: {
            status: RouteBindingStatus.detached,
            detachedAt: new Date(),
          },
        });
      }
      const binding = await tx.routeBinding.create({
        data: {
          platformHostnameId: null,
          runtimeInstanceId: rt.id,
          status: RouteBindingStatus.attached,
          attachedAt: new Date(),
        },
      });
      await tx.customDomain.update({
        where: { id: domain.id },
        data: {
          routeBindingId: binding.id,
          status: CustomDomainStatus.certificate_issuing,
          failureCode: null,
          failureDetail: null,
        },
      });
    });

    await this.emit(domain.id, DomainEventType.attach_requested, { releaseId: input.releaseId });
    await this.audit.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'custom_domain.attach_requested',
      resource: 'custom_domain',
      resourceId: domain.id,
      metadata: { releaseId: input.releaseId },
    });

    await this.domainQueue.enqueueAttach(domain.id);
    return { ok: true as const };
  }

  async executeAttach(customDomainId: string): Promise<void> {
    const domain = await this.prisma.customDomain.findUnique({
      where: { id: customDomainId },
      include: { project: true, routeBinding: { include: { runtimeInstance: true } } },
    });
    if (!domain?.routeBinding) return;

    await this.prisma.customDomain.update({
      where: { id: domain.id },
      data: { lastIssuanceAttemptAt: new Date() },
    });

    try {
      await this.caddy.applyFromDatabase();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const kind = classifyAcmeOrEdgeError(msg);
      await this.prisma.customDomain.update({
        where: { id: domain.id },
        data: {
          failureCode: kind === 'rate_limited' ? DomainFailureCode.rate_limited : DomainFailureCode.acme_order_failed,
          failureDetail: msg.slice(0, 500),
          nextRetryAt: new Date(Date.now() + suggestedBackoffMs(kind, 3)),
          status: CustomDomainStatus.failed,
        },
      });
      await this.emit(domain.id, DomainEventType.attach_failed, { kind });
      throw e;
    }

    const peer = await probePeerCertificate(domain.hostname);
    const serialMasked = peer?.serialMasked ?? null;
    const notBefore = peer?.notBefore ?? null;
    const notAfter = peer?.notAfter ?? null;

    let certId = domain.activeCertificateId;
    if (peer) {
      if (certId) {
        await this.prisma.certificateRecord.update({
          where: { id: certId },
          data: {
            status: CertificateRecordStatus.active,
            notBefore,
            notAfter,
            serialNumberMasked: serialMasked,
            failureCode: null,
            failureDetail: null,
            externalOrderRef: 'caddy-managed',
          },
        });
      } else {
        const cert = await this.prisma.certificateRecord.create({
          data: {
            customDomainId: domain.id,
            status: CertificateRecordStatus.active,
            challengeType: 'http_01',
            externalOrderRef: 'caddy-managed',
            notBefore,
            notAfter,
            serialNumberMasked: serialMasked,
          },
        });
        certId = cert.id;
      }
    } else if (!certId) {
      const cert = await this.prisma.certificateRecord.create({
        data: {
          customDomainId: domain.id,
          status: CertificateRecordStatus.issuing,
          challengeType: 'http_01',
          externalOrderRef: 'caddy-managed',
          failureCode: DomainFailureCode.acme_order_failed,
          failureDetail: 'tls_probe_failed',
        },
      });
      certId = cert.id;
    }

    await this.prisma.customDomain.update({
      where: { id: domain.id },
      data: {
        activeCertificateId: certId,
        status: peer ? CustomDomainStatus.active : CustomDomainStatus.certificate_active,
        failureCode: peer ? null : DomainFailureCode.acme_order_failed,
        failureDetail: peer ? null : 'tls_probe_failed',
        nextRetryAt: peer ? null : new Date(Date.now() + suggestedBackoffMs('transient', 2)),
      },
    });

    await this.emit(domain.id, DomainEventType.attach_succeeded, { certificateId: certId });
    await this.audit.record({
      workspaceId: domain.project.workspaceId,
      actorUserId: undefined,
      action: 'custom_domain.active',
      resource: 'custom_domain',
      resourceId: domain.id,
    });
  }

  async detach(input: {
    workspaceId: string;
    projectId: string;
    environmentId: string;
    customDomainId: string;
    actorUserId: string;
  }) {
    const domain = await this.getOne(
      input.workspaceId,
      input.projectId,
      input.environmentId,
      input.customDomainId,
    );
    await this.domainQueue.enqueueDetach(domain.id);
    await this.audit.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'custom_domain.detach_requested',
      resource: 'custom_domain',
      resourceId: domain.id,
    });
    return { ok: true as const };
  }

  async executeDetach(customDomainId: string): Promise<void> {
    const domain = await this.prisma.customDomain.findUnique({
      where: { id: customDomainId },
      include: { project: true },
    });
    if (!domain) return;

    if (domain.routeBindingId) {
      await this.prisma.routeBinding.update({
        where: { id: domain.routeBindingId },
        data: {
          status: RouteBindingStatus.detached,
          detachedAt: new Date(),
        },
      });
    }

    await this.prisma.customDomain.update({
      where: { id: domain.id },
      data: {
        routeBindingId: null,
        status: CustomDomainStatus.detached,
        activeCertificateId: null,
      },
    });

    await this.emit(domain.id, DomainEventType.detach, {});
    await this.audit.record({
      workspaceId: domain.project.workspaceId,
      actorUserId: undefined,
      action: 'custom_domain.detached',
      resource: 'custom_domain',
      resourceId: domain.id,
    });

    try {
      await this.caddy.applyFromDatabase();
    } catch (e) {
      this.logger.error(e, 'caddy_after_detach_failed');
    }
  }

  async retryIssuance(workspaceId: string, projectId: string, environmentId: string, customDomainId: string) {
    await this.getOne(workspaceId, projectId, environmentId, customDomainId);
    await this.domainQueue.enqueueCertificateIssue(customDomainId);
    return { ok: true as const };
  }

  async executeCertificateIssue(customDomainId: string): Promise<void> {
    await this.executeAttach(customDomainId);
  }

  async executeCertificateRenew(customDomainId: string): Promise<void> {
    const domain = await this.prisma.customDomain.findUnique({
      where: { id: customDomainId },
      include: {
        activeCertificate: true,
        project: { select: { workspaceId: true } },
      },
    });
    if (!domain?.activeCertificate?.id) return;

    await this.prisma.customDomain.update({
      where: { id: domain.id },
      data: { status: CustomDomainStatus.certificate_renewing },
    });
    await this.prisma.certificateRecord.update({
      where: { id: domain.activeCertificate.id },
      data: {
        renewalAttemptedAt: new Date(),
        status: CertificateRecordStatus.renewal_pending,
      },
    });

    try {
      await this.caddy.applyFromDatabase();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.prisma.certificateRecord.update({
        where: { id: domain.activeCertificate.id },
        data: {
          failureCode: DomainFailureCode.renewal_failed,
          failureDetail: msg.slice(0, 500),
          status: CertificateRecordStatus.failed,
        },
      });
      await this.prisma.customDomain.update({
        where: { id: domain.id },
        data: {
          status: CustomDomainStatus.failed,
          failureCode: DomainFailureCode.renewal_failed,
        },
      });
      throw e;
    }

    const peer = await probePeerCertificate(domain.hostname);
    if (peer) {
      await this.prisma.certificateRecord.update({
        where: { id: domain.activeCertificate.id },
        data: {
          notBefore: peer.notBefore,
          notAfter: peer.notAfter,
          renewalSucceededAt: new Date(),
          status: CertificateRecordStatus.active,
          serialNumberMasked: peer.serialMasked,
          failureCode: null,
          failureDetail: null,
        },
      });
      await this.prisma.customDomain.update({
        where: { id: domain.id },
        data: { status: CustomDomainStatus.active },
      });
      await this.emit(domain.id, DomainEventType.certificate_renewal, {});
    }
  }

  async executeReconcile(): Promise<void> {
    const now = new Date();
    const stale = await this.prisma.customDomain.findMany({
      where: {
        OR: [
          {
            status: CustomDomainStatus.certificate_issuing,
            OR: [
              { lastIssuanceAttemptAt: null },
              { lastIssuanceAttemptAt: { lt: new Date(now.getTime() - 45 * 60_000) } },
            ],
          },
          {
            status: CustomDomainStatus.failed,
            nextRetryAt: { lte: now },
            routeBindingId: { not: null },
          },
        ],
      },
      take: 25,
    });

    for (const d of stale) {
      await this.domainQueue.enqueueAttach(d.id);
    }

    const renewSoon = await this.prisma.certificateRecord.findMany({
      where: {
        status: CertificateRecordStatus.active,
        notAfter: { lt: new Date(now.getTime() + 30 * 24 * 3600_000) },
      },
      select: { customDomainId: true },
      take: 25,
    });
    for (const c of renewSoon) {
      await this.domainQueue.enqueueCertificateRenew(c.customDomainId);
    }
  }

  /**
   * Detach custom domains bound to route bindings for these runtime instances (transactional).
   */
  async detachCustomDomainsForRuntimeInstancesInTx(
    tx: Prisma.TransactionClient,
    runtimeInstanceIds: string[],
  ): Promise<{ id: string; workspaceId: string }[]> {
    if (!runtimeInstanceIds.length) return [];
    const bindings = await tx.routeBinding.findMany({
      where: { runtimeInstanceId: { in: runtimeInstanceIds } },
      select: { id: true },
    });
    const bids = bindings.map((b) => b.id);
    if (!bids.length) return [];
    const cds = await tx.customDomain.findMany({
      where: { routeBindingId: { in: bids } },
      include: { project: { select: { workspaceId: true } } },
    });
    await tx.customDomain.updateMany({
      where: { routeBindingId: { in: bids } },
      data: {
        status: CustomDomainStatus.detached,
        routeBindingId: null,
        activeCertificateId: null,
      },
    });
    return cds.map((c) => ({ id: c.id, workspaceId: c.project.workspaceId }));
  }

  async recordRuntimeDetachEvents(rows: { id: string; workspaceId: string }[]): Promise<void> {
    for (const r of rows) {
      await this.emit(r.id, DomainEventType.detach, { reason: 'runtime_teardown' });
      await this.audit.record({
        workspaceId: r.workspaceId,
        actorUserId: undefined,
        action: 'custom_domain.detached_runtime',
        resource: 'custom_domain',
        resourceId: r.id,
      });
    }
  }
}
