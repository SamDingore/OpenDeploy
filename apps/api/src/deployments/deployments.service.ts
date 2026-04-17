import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  BuildFailureCode,
  DeploymentStatus,
  assertTerminalFailureReason,
  canTransition,
} from '@opendeploy/shared';
import { Prisma } from '@prisma/client';
import type { BuildFailureCode as PrismaFail } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { GithubService } from '../github/github.service';
import { DeploymentQueueService } from '../queue/deployment-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReleasesService } from '../releases/releases.service';
import { DeploymentEventsService } from './deployment-events.service';
import { CapacityService } from '../operations/capacity.service';

@Injectable()
export class DeploymentsService {
  private readonly logger = new Logger(DeploymentsService.name);
  private readonly logWriteTails = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: DeploymentQueueService,
    private readonly audit: AuditService,
    private readonly events: DeploymentEventsService,
    private readonly github: GithubService,
    private readonly releases: ReleasesService,
    private readonly capacity: CapacityService,
  ) {}

  async create(input: {
    workspaceId: string;
    projectId: string;
    environmentId: string;
    actorUserId: string;
    gitRef?: string;
    framework?: string;
    installCommand?: string;
    buildCommand?: string;
    startCommand?: string;
    rootDirectory?: string;
  }) {
    const project = await this.prisma.project.findFirst({
      where: { id: input.projectId, workspaceId: input.workspaceId },
      include: { environments: true },
    });
    if (!project) {
      throw new NotFoundException('project_not_found');
    }
    const env = project.environments.find((e) => e.id === input.environmentId);
    if (!env) {
      throw new NotFoundException('environment_not_found');
    }

    await this.capacity.assertCanEnqueueBuild(input.workspaceId);

    const repoLink = await this.prisma.repositoryLink.findUnique({
      where: { projectId: input.projectId },
      include: { installation: true },
    });
    if (!repoLink) {
      throw new BadRequestException('project_repo_not_linked');
    }

    const ref = input.gitRef ?? repoLink.defaultBranch ?? 'main';
    const { sha } = await this.github.resolveCommitSha({
      repoFullName: repoLink.fullName,
      ref,
      providerInstallationId: repoLink.installation.providerInstallationId,
    });

    const deployment = await this.prisma.deployment.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        status: DeploymentStatus.created,
        gitRef: input.gitRef,
        branch: repoLink.defaultBranch ?? null,
        commitSha: sha,
        triggerSource: 'manual',
        framework: input.framework?.trim() || null,
        installCommand: input.installCommand?.trim() || null,
        buildCommand: input.buildCommand?.trim() || null,
        startCommand: input.startCommand?.trim() || null,
        rootDirectory: input.rootDirectory?.trim() || null,
      },
    });

    const attempt = await this.prisma.deploymentAttempt.create({
      data: {
        deploymentId: deployment.id,
        attemptNumber: 1,
      },
    });

    await this.audit.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'deployment.created',
      resource: 'deployment',
      resourceId: deployment.id,
      metadata: {
        projectId: input.projectId,
        environmentId: input.environmentId,
        framework: input.framework?.trim() || null,
        rootDirectory: input.rootDirectory?.trim() || null,
      },
    });

    await this.transitionStatus(
      deployment.id,
      DeploymentStatus.queued,
      null,
      input.actorUserId,
    );

    const queueJobId = await this.queue.enqueue({
      deploymentId: deployment.id,
      deploymentAttemptId: attempt.id,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
    });

    await this.prisma.deploymentAttempt.update({
      where: { id: attempt.id },
      data: { queueJobId },
    });

    return { deployment, attempt };
  }

  async createFromWebhook(input: {
    workspaceId: string;
    projectId: string;
    environmentId: string;
    commitSha: string;
    branch?: string | null;
    triggerSource: 'push' | 'pull_request';
    pullRequestNumber?: number | null;
  }) {
    const existing = await this.prisma.deployment.findFirst({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        commitSha: input.commitSha,
        triggerSource: input.triggerSource,
      },
      select: { id: true },
    });
    if (existing) {
      return { duplicate: true as const, deploymentId: existing.id };
    }

    await this.capacity.assertCanEnqueueBuild(input.workspaceId);

    const deployment = await this.prisma.deployment.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        status: DeploymentStatus.created,
        commitSha: input.commitSha,
        branch: input.branch ?? null,
        triggerSource: input.triggerSource,
        pullRequestNumber: input.pullRequestNumber ?? null,
      },
    });

    const attempt = await this.prisma.deploymentAttempt.create({
      data: { deploymentId: deployment.id, attemptNumber: 1 },
    });

    await this.transitionStatus(deployment.id, DeploymentStatus.queued, null, undefined);

    const queueJobId = await this.queue.enqueue({
      deploymentId: deployment.id,
      deploymentAttemptId: attempt.id,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
    });

    await this.prisma.deploymentAttempt.update({
      where: { id: attempt.id },
      data: { queueJobId },
    });

    await this.audit.record({
      workspaceId: input.workspaceId,
      actorUserId: undefined,
      action: 'deployment.created.webhook',
      resource: 'deployment',
      resourceId: deployment.id,
      metadata: { projectId: input.projectId, environmentId: input.environmentId, commitSha: input.commitSha, triggerSource: input.triggerSource },
    });

    return { duplicate: false as const, deploymentId: deployment.id };
  }

  async listForProject(workspaceId: string, projectId: string) {
    return this.prisma.deployment.findMany({
      where: { workspaceId, projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async retryBuild(input: { workspaceId: string; deploymentId: string; actorUserId: string }) {
    const dep = await this.prisma.deployment.findFirst({
      where: { id: input.deploymentId, workspaceId: input.workspaceId },
      include: { attempts: true },
    });
    if (!dep) {
      throw new NotFoundException('deployment_not_found');
    }
    if (
      dep.status !== DeploymentStatus.build_failed &&
      dep.status !== DeploymentStatus.cancelled &&
      dep.status !== DeploymentStatus.build_succeeded
    ) {
      throw new BadRequestException('deployment_not_retryable_in_current_state');
    }

    const nextAttemptNumber = (dep.attempts.reduce((m, a) => Math.max(m, a.attemptNumber), 0) ?? 0) + 1;
    const attempt = await this.prisma.deploymentAttempt.create({
      data: { deploymentId: dep.id, attemptNumber: nextAttemptNumber },
    });

    await this.prisma.deployment.update({
      where: { id: dep.id },
      data: {
        status: DeploymentStatus.queued,
        failureCode: null,
        failureDetail: null,
        buildStartedAt: null,
        buildFinishedAt: null,
        buildDurationMs: null,
      },
    });

    await this.capacity.assertCanEnqueueBuild(dep.workspaceId);

    const queueJobId = await this.queue.enqueue({
      deploymentId: dep.id,
      deploymentAttemptId: attempt.id,
      workspaceId: dep.workspaceId,
      projectId: dep.projectId,
    });

    await this.prisma.deploymentAttempt.update({
      where: { id: attempt.id },
      data: { queueJobId },
    });

    await this.audit.record({
      workspaceId: dep.workspaceId,
      actorUserId: input.actorUserId,
      action: 'deployment.retry',
      resource: 'deployment',
      resourceId: dep.id,
      metadata: { attemptNumber: nextAttemptNumber },
    });

    this.events.emit({
      type: 'status',
      deploymentId: dep.id,
      status: DeploymentStatus.queued,
      at: new Date().toISOString(),
    });

    return { attemptId: attempt.id, queueJobId };
  }

  async get(workspaceId: string, deploymentId: string) {
    const d = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, workspaceId },
      include: {
        attempts: true,
        logs: { orderBy: { seq: 'asc' } },
        artifacts: { orderBy: { createdAt: 'desc' } },
        sourceSnapshot: true,
      },
    });
    if (!d) {
      throw new NotFoundException('deployment_not_found');
    }
    return d;
  }

  async transitionStatus(
    deploymentId: string,
    next: DeploymentStatus,
    failureCode: BuildFailureCode | null,
    actorUserId?: string,
    failureDetail?: string,
  ) {
    const dep = await this.prisma.deployment.findUnique({ where: { id: deploymentId } });
    if (!dep) {
      throw new NotFoundException('deployment_not_found');
    }
    assertTerminalFailureReason(next, failureCode);
    const t = canTransition(dep.status as DeploymentStatus, next);
    if (!t.ok) {
      throw new BadRequestException(t.reason);
    }

    const now = new Date();
    const buildStartedAt =
      dep.buildStartedAt ?? (next === DeploymentStatus.fetching_source ? now : null);
    const buildFinishedAt =
      next === DeploymentStatus.build_succeeded || next === DeploymentStatus.build_failed
        ? now
        : null;

    const durationMs =
      buildStartedAt && buildFinishedAt ? buildFinishedAt.getTime() - buildStartedAt.getTime() : null;

    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: next,
        buildStartedAt: buildStartedAt ?? undefined,
        buildFinishedAt: buildFinishedAt ?? undefined,
        buildDurationMs: durationMs ?? undefined,
        failureCode: failureCode ? (failureCode as unknown as PrismaFail) : null,
        failureDetail: next === DeploymentStatus.build_failed ? (failureDetail ?? null) : null,
      },
    });

    await this.audit.record({
      workspaceId: dep.workspaceId,
      actorUserId: actorUserId ?? undefined,
      action: actorUserId ? 'deployment.status' : 'deployment.status.system',
      resource: 'deployment',
      resourceId: deploymentId,
      metadata: { status: next, failureCode, failureDetail },
    });

    this.events.emit({
      type: 'status',
      deploymentId,
      status: next,
      at: new Date().toISOString(),
    });

    if (next === DeploymentStatus.build_succeeded) {
      void this.releases.onBuildSucceeded(deploymentId).catch((err) => {
        this.logger.error(err, 'release_after_build_failed');
      });
    }
  }

  async appendLog(deploymentId: string, chunk: { level: string; message: string; meta?: Prisma.InputJsonValue }) {
    const previousTail = this.logWriteTails.get(deploymentId) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const currentStep = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const currentTail = previousTail
      .catch(() => undefined)
      .then(() => currentStep);
    this.logWriteTails.set(deploymentId, currentTail);

    await previousTail.catch(() => undefined);

    try {
      const last = await this.prisma.deploymentLogChunk.findFirst({
        where: { deploymentId },
        orderBy: { seq: 'desc' },
        select: { seq: true },
      });
      const seq = (last?.seq ?? 0) + 1;
      const row = await this.prisma.deploymentLogChunk.create({
        data: {
          deploymentId,
          seq,
          level: chunk.level,
          message: chunk.message,
          meta: chunk.meta,
        },
      });
      this.events.emit({
        type: 'log',
        deploymentId,
        seq: row.seq,
        level: row.level,
        message: row.message,
        at: row.createdAt.toISOString(),
      });
      return row;
    } finally {
      releaseCurrent();
      if (this.logWriteTails.get(deploymentId) === currentTail) {
        this.logWriteTails.delete(deploymentId);
      }
    }
  }

  /** Worker-internal: transition with optional system audit */
  async workerTransition(input: {
    deploymentId: string;
    next: DeploymentStatus;
    failureCode?: BuildFailureCode | null;
    failureDetail?: string;
    log?: { level: string; message: string };
  }) {
    if (input.log) {
      await this.appendLog(input.deploymentId, input.log);
    }
    await this.transitionStatus(
      input.deploymentId,
      input.next,
      input.failureCode ?? null,
      undefined,
      input.failureDetail,
    );
  }

  async registerWorkerFailure(deploymentId: string, code: BuildFailureCode, detail?: string) {
    await this.workerTransition({
      deploymentId,
      next: DeploymentStatus.build_failed,
      failureCode: code,
      failureDetail: detail,
      log: { level: 'error', message: `worker_failure:${code}` },
    });
  }
}
