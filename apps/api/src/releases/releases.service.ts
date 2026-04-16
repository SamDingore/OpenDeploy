import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EnvironmentType,
  PlatformHostnameKind,
  Prisma,
  ReleaseStatus,
  ReleaseType,
  RouteBindingStatus,
  RuntimeInstanceStatus,
} from '@prisma/client';
import {
  DeploymentStatus,
  ReleaseStatus as SharedReleaseStatus,
  canTransitionRelease,
  isPlatformManagedHostname,
  previewHostname,
  productionHostname,
} from '@opendeploy/shared';
import type { Env } from '../config/env';
import { OPENDEPLOY_ENV } from '../config/env.constants';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReleaseQueueService } from '../queue/release-queue.service';
import { CustomDomainsService } from '../custom-domains/custom-domains.service';
import { CaddyService } from '../edge/caddy.service';
import { CapacityService } from '../operations/capacity.service';
import { openSealed, sealSecret } from '../secrets/secret-crypto';

const DEFAULT_HEALTH = {
  type: 'http' as const,
  path: '/',
  startupTimeoutMs: 120_000,
  steadyIntervalMs: 2000,
};

@Injectable()
export class ReleasesService {
  private readonly logger = new Logger(ReleasesService.name);

  constructor(
    @Inject(OPENDEPLOY_ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly releaseQueue: ReleaseQueueService,
    private readonly caddy: CaddyService,
    private readonly customDomains: CustomDomainsService,
    private readonly capacity: CapacityService,
  ) {}

  private async enqueueProvisionRelease(workspaceId: string, releaseId: string): Promise<void> {
    await this.capacity.assertCanProvisionRuntime(workspaceId);
    await this.releaseQueue.enqueueProvision(releaseId);
  }

  async onBuildSucceeded(deploymentId: string): Promise<void> {
    const dep = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        environment: true,
        project: true,
        artifacts: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!dep || dep.status !== DeploymentStatus.build_succeeded) return;
    const artifact = dep.artifacts[0];
    if (!artifact) {
      this.logger.warn({ deploymentId }, 'build_succeeded_missing_artifact');
      return;
    }

    const rType =
      dep.environment.type === EnvironmentType.production
        ? ReleaseType.production
        : ReleaseType.preview;

    const existing = await this.prisma.release.findFirst({
      where: { deploymentId: dep.id },
    });
    if (existing) {
      this.logger.log({ deploymentId, releaseId: existing.id }, 'release_already_exists_for_deployment');
      return;
    }

    const release = await this.prisma.release.create({
      data: {
        workspaceId: dep.workspaceId,
        projectId: dep.projectId,
        environmentId: dep.environmentId,
        deploymentId: dep.id,
        buildArtifactId: artifact.id,
        releaseType: rType,
        status: ReleaseStatus.pending,
        pullRequestNumber: dep.pullRequestNumber ?? null,
        commitSha: dep.commitSha ?? 'unknown',
      },
    });

    await this.audit.record({
      workspaceId: dep.workspaceId,
      actorUserId: undefined,
      action: 'release.created',
      resource: 'release',
      resourceId: release.id,
      metadata: { deploymentId, releaseType: rType },
    });

    await this.enqueueProvisionRelease(dep.workspaceId, release.id);
  }

  async requestTeardown(releaseId: string, reason: 'pr_closed' | 'superseded' | 'ttl' | 'manual') {
    await this.releaseQueue.enqueueTeardown({ releaseId, reason });
    await this.audit.record({
      workspaceId: null,
      actorUserId: undefined,
      action: 'release.teardown_enqueued',
      resource: 'release',
      resourceId: releaseId,
      metadata: { reason },
    });
  }

  async getTeardownPlan(releaseId: string) {
    const runtimes = await this.prisma.runtimeInstance.findMany({
      where: { releaseId },
      select: { containerName: true, id: true, status: true },
    });
    return {
      releaseId,
      containerNames: runtimes.map((r) => r.containerName),
    };
  }

  async applyTeardownDone(releaseId: string): Promise<void> {
    const release = await this.prisma.release.findUnique({
      where: { id: releaseId },
      include: { environment: true },
    });
    if (!release) return;

    let detachedCustomDomains: { id: string; workspaceId: string }[] = [];

    await this.prisma.$transaction(async (tx) => {
      const instances = await tx.runtimeInstance.findMany({
        where: { releaseId },
        select: { id: true },
      });
      const ids = instances.map((i) => i.id);
      if (ids.length) {
        detachedCustomDomains = await this.customDomains.detachCustomDomainsForRuntimeInstancesInTx(
          tx,
          ids,
        );
        await tx.routeBinding.updateMany({
          where: {
            runtimeInstanceId: { in: ids },
            status: { in: [RouteBindingStatus.attached, RouteBindingStatus.pending] },
          },
          data: {
            status: RouteBindingStatus.detached,
            detachedAt: new Date(),
          },
        });
      }
      await tx.runtimeInstance.updateMany({
        where: { releaseId },
        data: {
          status: RuntimeInstanceStatus.stopped,
          stoppedAt: new Date(),
        },
      });
      await tx.release.update({
        where: { id: releaseId },
        data: { status: ReleaseStatus.terminated, deactivatedAt: new Date() },
      });
    });

    if (release.environment.activeReleaseId === releaseId) {
      await this.prisma.environment.update({
        where: { id: release.environmentId },
        data: { activeReleaseId: null },
      });
    }

    await this.audit.record({
      workspaceId: release.workspaceId,
      actorUserId: undefined,
      action: 'release.teardown_done',
      resource: 'release',
      resourceId: releaseId,
    });

    await this.customDomains.recordRuntimeDetachEvents(detachedCustomDomains);

    try {
      await this.caddy.applyFromDatabase();
    } catch (e) {
      this.logger.error(e, 'caddy_apply_after_teardown_failed');
    }
  }

  async transitionReleaseStatus(
    releaseId: string,
    next: ReleaseStatus,
    failureDetail?: string,
  ): Promise<void> {
    const r = await this.prisma.release.findUnique({ where: { id: releaseId } });
    if (!r) throw new NotFoundException('release_not_found');
    const t = canTransitionRelease(r.status as SharedReleaseStatus, next as SharedReleaseStatus);
    if (!t.ok) {
      throw new BadRequestException(t.reason);
    }
    await this.prisma.release.update({
      where: { id: releaseId },
      data: {
        status: next,
        failureDetail: next === ReleaseStatus.failed ? (failureDetail ?? null) : null,
      },
    });
    await this.audit.record({
      workspaceId: r.workspaceId,
      actorUserId: undefined,
      action: 'release.status',
      resource: 'release',
      resourceId: releaseId,
      metadata: { status: next, failureDetail },
    });
  }

  async getProvisionInput(releaseId: string) {
    const release = await this.prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        buildArtifact: true,
        environment: true,
        project: true,
      },
    });
    if (!release) {
      return { ok: false as const, error: 'release_not_found' };
    }
    if (release.status === ReleaseStatus.terminated || release.status === ReleaseStatus.failed) {
      return { ok: false as const, error: 'release_not_runnable' };
    }

    const domain = this.env.PLATFORM_PUBLIC_DOMAIN;
    const hostnameRow = await this.ensurePlatformHostname(release);

    const healthRaw = release.environment.runtimeHealthCheck as Record<string, unknown> | null;
    const health = {
      ...DEFAULT_HEALTH,
      ...(healthRaw && typeof healthRaw === 'object' ? healthRaw : {}),
    };

    const envVars = await this.buildRuntimeEnv(release.environmentId, release.projectId);

    const containerName = `odr${release.id.replace(/[^a-z0-9]/gi, '').slice(0, 20)}`;
    const internalPort = release.environment.runtimeContainerPort;
    const upstreamDial = `${containerName}:${internalPort}`;

    return {
      ok: true as const,
      releaseId: release.id,
      workspaceId: release.workspaceId,
      imageTag: release.buildArtifact.imageTag,
      imageDigest: release.buildArtifact.imageDigest,
      internalPort,
      upstreamDial,
      containerName,
      hostname: hostnameRow.hostname,
      platformHostnameId: hostnameRow.id,
      dockerNetwork: process.env.RUNTIME_DOCKER_NETWORK ?? 'opendeploy_runtime',
      memoryLimit: process.env.RUNTIME_MEMORY_LIMIT ?? '512m',
      cpus: process.env.RUNTIME_CPU_LIMIT ?? '1',
      healthCheck: health,
      env: envVars,
    };
  }

  private async ensurePlatformHostname(release: {
    id: string;
    projectId: string;
    environmentId: string;
    releaseType: ReleaseType;
    pullRequestNumber: number | null;
    project: { slug: string };
  }) {
    const domain = this.env.PLATFORM_PUBLIC_DOMAIN;
    let hostname: string;
    let kind: PlatformHostnameKind;
    let pr: number | null = null;
    if (release.releaseType === ReleaseType.preview) {
      if (release.pullRequestNumber == null) {
        throw new BadRequestException('preview_release_requires_pr_number');
      }
      hostname = previewHostname({
        pullRequestNumber: release.pullRequestNumber,
        projectSlug: release.project.slug,
        platformDomain: domain,
      });
      kind = PlatformHostnameKind.preview;
      pr = release.pullRequestNumber;
    } else {
      hostname = productionHostname({ projectSlug: release.project.slug, platformDomain: domain });
      kind = PlatformHostnameKind.production;
    }
    if (!isPlatformManagedHostname(hostname, domain)) {
      throw new BadRequestException('hostname_validation_failed');
    }
    return this.prisma.platformHostname.upsert({
      where: { hostname },
      create: {
        projectId: release.projectId,
        environmentId: release.environmentId,
        hostname,
        kind,
        pullRequestNumber: pr,
        status: 'active',
      },
      update: { status: 'active' },
    });
  }

  private async buildRuntimeEnv(environmentId: string, projectId: string): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    if (!this.env.SECRETS_ENCRYPTION_KEY) {
      return out;
    }
    const secrets = await this.prisma.environmentSecret.findMany({
      where: { environmentId, projectId },
    });
    for (const s of secrets) {
      try {
        out[s.name] = openSealed(s.valueEncrypted, this.env.SECRETS_ENCRYPTION_KEY);
      } catch {
        this.logger.warn({ secretId: s.id }, 'secret_decrypt_failed');
      }
    }
    return out;
  }

  async createRuntimeInstance(input: {
    releaseId: string;
    containerName: string;
    imageTag: string;
    imageDigest?: string | null;
    internalPort: number;
    upstreamDial: string;
    workerNodeId?: string | null;
    containerIdMasked?: string | null;
  }) {
    return this.prisma.runtimeInstance.create({
      data: {
        releaseId: input.releaseId,
        containerName: input.containerName,
        imageTag: input.imageTag,
        imageDigest: input.imageDigest ?? null,
        internalPort: input.internalPort,
        upstreamDial: input.upstreamDial,
        status: RuntimeInstanceStatus.created,
        workerNodeId: input.workerNodeId ?? null,
        containerIdMasked: input.containerIdMasked ?? null,
      },
    });
  }

  async patchRuntimeInstance(
    id: string,
    data: Partial<{
      status: RuntimeInstanceStatus;
      containerIdMasked: string;
      startedAt: Date;
      stoppedAt: Date;
      lastHealthStatus: string;
    }>,
  ) {
    await this.prisma.runtimeInstance.update({ where: { id }, data });
  }

  async appendRuntimeLog(releaseId: string, level: string, message: string) {
    const redacted = message.replace(/(password|secret|token|key)=([\w-]+)/gi, '$1=***');
    const last = await this.prisma.runtimeLogChunk.findFirst({
      where: { releaseId },
      orderBy: { seq: 'desc' },
      select: { seq: true },
    });
    const seq = (last?.seq ?? 0) + 1;
    await this.prisma.runtimeLogChunk.create({
      data: { releaseId, seq, level, message: redacted },
    });
  }

  async appendHealthResult(input: {
    runtimeInstanceId: string;
    checkType: 'http' | 'tcp';
    success: boolean;
    latencyMs?: number;
    detail?: string;
  }) {
    await this.prisma.healthCheckResult.create({
      data: {
        runtimeInstanceId: input.runtimeInstanceId,
        checkType: input.checkType,
        success: input.success,
        latencyMs: input.latencyMs ?? null,
        detail: input.detail ?? null,
      },
    });
    await this.prisma.runtimeInstance.update({
      where: { id: input.runtimeInstanceId },
      data: { lastHealthStatus: input.success ? 'healthy' : 'unhealthy' },
    });
  }

  async completeProvisionAfterHealth(input: {
    releaseId: string;
    runtimeInstanceId: string;
    platformHostnameId: string;
  }): Promise<void> {
    const release = await this.prisma.release.findUnique({
      where: { id: input.releaseId },
      include: { environment: true },
    });
    if (!release) throw new NotFoundException('release_not_found');

    const latestOk = await this.prisma.healthCheckResult.findFirst({
      where: { runtimeInstanceId: input.runtimeInstanceId, success: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!latestOk) {
      throw new BadRequestException('health_not_passed');
    }

    let prevProductionReleaseId: string | null = null;
    const oldPreviewIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      await tx.routeBinding.updateMany({
        where: {
          platformHostnameId: input.platformHostnameId,
          status: RouteBindingStatus.attached,
        },
        data: {
          status: RouteBindingStatus.detaching,
          detachedAt: new Date(),
        },
      });
      await tx.routeBinding.updateMany({
        where: {
          platformHostnameId: input.platformHostnameId,
          status: RouteBindingStatus.detaching,
        },
        data: {
          status: RouteBindingStatus.detached,
        },
      });

      await tx.routeBinding.create({
        data: {
          platformHostnameId: input.platformHostnameId,
          runtimeInstanceId: input.runtimeInstanceId,
          status: RouteBindingStatus.attached,
          attachedAt: new Date(),
        },
      });

      if (release.releaseType === ReleaseType.production) {
        const envRow = await tx.environment.findUnique({ where: { id: release.environmentId } });
        prevProductionReleaseId = envRow?.activeReleaseId ?? null;
        if (prevProductionReleaseId && prevProductionReleaseId !== release.id) {
          await tx.release.update({
            where: { id: prevProductionReleaseId },
            data: {
              status: ReleaseStatus.stopped,
              deactivatedAt: new Date(),
            },
          });
        }
        await tx.environment.update({
          where: { id: release.environmentId },
          data: { activeReleaseId: release.id },
        });
      }

      if (release.releaseType === ReleaseType.preview && release.pullRequestNumber != null) {
        const others = await tx.release.findMany({
          where: {
            projectId: release.projectId,
            environmentId: release.environmentId,
            pullRequestNumber: release.pullRequestNumber,
            releaseType: ReleaseType.preview,
            id: { not: release.id },
            status: {
              in: [
                ReleaseStatus.pending,
                ReleaseStatus.provisioning_runtime,
                ReleaseStatus.starting,
                ReleaseStatus.health_checking,
                ReleaseStatus.active,
                ReleaseStatus.stopped,
              ],
            },
          },
          select: { id: true },
        });
        for (const o of others) {
          oldPreviewIds.push(o.id);
          await tx.release.update({
            where: { id: o.id },
            data: { status: ReleaseStatus.terminated, deactivatedAt: new Date() },
          });
        }
      }

      await tx.release.update({
        where: { id: release.id },
        data: {
          status: ReleaseStatus.active,
          activatedAt: new Date(),
        },
      });
    });

    await this.audit.record({
      workspaceId: release.workspaceId,
      actorUserId: undefined,
      action: 'route.attached',
      resource: 'release',
      resourceId: release.id,
      metadata: { runtimeInstanceId: input.runtimeInstanceId, platformHostnameId: input.platformHostnameId },
    });

    try {
      await this.caddy.applyFromDatabase();
    } catch (e) {
      this.logger.error(e, 'caddy_apply_failed');
      throw e;
    }

    if (prevProductionReleaseId && prevProductionReleaseId !== release.id) {
      await this.releaseQueue.enqueueTeardown({
        releaseId: prevProductionReleaseId,
        reason: 'superseded',
      });
    }
    for (const pid of oldPreviewIds) {
      await this.releaseQueue.enqueueTeardown({ releaseId: pid, reason: 'superseded' });
    }
  }

  async listForProject(workspaceId: string, projectId: string) {
    return this.prisma.release.findMany({
      where: { workspaceId, projectId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        environment: true,
        runtimeInstances: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async getForProject(workspaceId: string, projectId: string, releaseId: string) {
    const r = await this.prisma.release.findFirst({
      where: { id: releaseId, workspaceId, projectId },
      include: {
        environment: true,
        deployment: true,
        buildArtifact: true,
        runtimeInstances: { orderBy: { createdAt: 'desc' } },
        runtimeLogs: { orderBy: { seq: 'asc' }, take: 500 },
      },
    });
    if (!r) throw new NotFoundException('release_not_found');
    const hostnameWhere: Prisma.PlatformHostnameWhereInput =
      r.pullRequestNumber != null
        ? {
            projectId,
            environmentId: r.environmentId,
            pullRequestNumber: r.pullRequestNumber,
            kind: PlatformHostnameKind.preview,
          }
        : {
            projectId,
            environmentId: r.environmentId,
            kind: PlatformHostnameKind.production,
            pullRequestNumber: null,
          };
    const hostname = await this.prisma.platformHostname.findFirst({
      where: hostnameWhere,
    });
    const bindings = await this.prisma.routeBinding.findMany({
      where: { runtimeInstance: { releaseId: r.id } },
      include: { platformHostname: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const health = r.runtimeInstances[0]
      ? await this.prisma.healthCheckResult.findMany({
          where: { runtimeInstanceId: r.runtimeInstances[0].id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : [];
    return { ...r, platformHostname: hostname, routeBindings: bindings, healthResults: health };
  }

  async promoteDeployment(input: {
    workspaceId: string;
    projectId: string;
    deploymentId: string;
    actorUserId: string;
  }) {
    const dep = await this.prisma.deployment.findFirst({
      where: {
        id: input.deploymentId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
      },
      include: {
        artifacts: { orderBy: { createdAt: 'desc' }, take: 1 },
        project: { include: { environments: true } },
      },
    });
    if (!dep) throw new NotFoundException('deployment_not_found');
    if (dep.status !== DeploymentStatus.build_succeeded) {
      throw new BadRequestException('deployment_not_built');
    }
    const art = dep.artifacts[0];
    if (!art) throw new BadRequestException('deployment_missing_artifact');
    const prod = dep.project.environments.find((e) => e.type === EnvironmentType.production);
    if (!prod) throw new BadRequestException('production_env_missing');

    const release = await this.prisma.release.create({
      data: {
        workspaceId: dep.workspaceId,
        projectId: dep.projectId,
        environmentId: prod.id,
        deploymentId: dep.id,
        buildArtifactId: art.id,
        releaseType: ReleaseType.production,
        status: ReleaseStatus.pending,
        commitSha: dep.commitSha ?? 'unknown',
        createdByUserId: input.actorUserId,
      },
    });
    await this.audit.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'release.promote',
      resource: 'release',
      resourceId: release.id,
      metadata: { deploymentId: dep.id },
    });
    await this.enqueueProvisionRelease(input.workspaceId, release.id);
    return release;
  }

  async rollbackProduction(input: {
    workspaceId: string;
    projectId: string;
    actorUserId: string;
  }) {
    const prod = await this.prisma.environment.findFirst({
      where: { projectId: input.projectId, type: EnvironmentType.production },
      include: { project: true },
    });
    if (!prod?.project || prod.project.workspaceId !== input.workspaceId) {
      throw new NotFoundException('production_env_not_found');
    }
    const currentId = prod.activeReleaseId;
    if (!currentId) throw new BadRequestException('no_active_release');

    const candidate = await this.prisma.release.findFirst({
      where: {
        environmentId: prod.id,
        releaseType: ReleaseType.production,
        status: ReleaseStatus.stopped,
      },
      orderBy: { deactivatedAt: 'desc' },
    });
    if (!candidate) throw new BadRequestException('no_rollback_candidate');

    const release = await this.prisma.release.create({
      data: {
        workspaceId: prod.project.workspaceId,
        projectId: input.projectId,
        environmentId: prod.id,
        deploymentId: candidate.deploymentId,
        buildArtifactId: candidate.buildArtifactId,
        releaseType: ReleaseType.production,
        status: ReleaseStatus.pending,
        commitSha: candidate.commitSha,
        rollbackOfReleaseId: currentId,
        createdByUserId: input.actorUserId,
      },
    });

    await this.audit.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'release.rollback',
      resource: 'release',
      resourceId: release.id,
      metadata: { fromReleaseId: currentId, targetArtifactReleaseId: candidate.id },
    });

    await this.enqueueProvisionRelease(input.workspaceId, release.id);
    return release;
  }

  async createEnvironmentSecret(input: {
    workspaceId: string;
    projectId: string;
    environmentId: string;
    name: string;
    value: string;
    actorUserId: string;
  }) {
    if (!this.env.SECRETS_ENCRYPTION_KEY) {
      throw new BadRequestException('secrets_encryption_not_configured');
    }
    const env = await this.prisma.environment.findFirst({
      where: { id: input.environmentId, projectId: input.projectId, project: { workspaceId: input.workspaceId } },
    });
    if (!env) throw new NotFoundException('environment_not_found');
    const enc = sealSecret(input.value, this.env.SECRETS_ENCRYPTION_KEY);
    const row = await this.prisma.environmentSecret.upsert({
      where: { environmentId_name: { environmentId: input.environmentId, name: input.name } },
      create: {
        projectId: input.projectId,
        environmentId: input.environmentId,
        name: input.name,
        valueEncrypted: enc,
      },
      update: { valueEncrypted: enc },
    });
    await this.audit.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'secret.upsert',
      resource: 'environment_secret',
      resourceId: row.id,
      metadata: { name: input.name, environmentId: input.environmentId },
    });
    return { id: row.id, name: row.name };
  }

  async purgeStalePreviews(): Promise<number> {
    const cutoff = new Date(Date.now() - this.env.PREVIEW_TTL_HOURS * 3600 * 1000);
    const stale = await this.prisma.release.findMany({
      where: {
        releaseType: ReleaseType.preview,
        status: { in: [ReleaseStatus.active, ReleaseStatus.pending, ReleaseStatus.health_checking] },
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    });
    for (const s of stale) {
      await this.requestTeardown(s.id, 'ttl');
    }
    return stale.length;
  }

  async teardownPreviewForPr(input: {
    workspaceId: string;
    projectId: string;
    environmentId: string;
    pullRequestNumber: number;
  }) {
    const rows = await this.prisma.release.findMany({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        pullRequestNumber: input.pullRequestNumber,
        releaseType: ReleaseType.preview,
        status: { notIn: [ReleaseStatus.terminated] },
      },
    });
    for (const r of rows) {
      await this.requestTeardown(r.id, 'pr_closed');
    }
  }
}
