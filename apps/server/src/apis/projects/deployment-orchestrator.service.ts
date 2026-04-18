import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEPLOYMENT_JOB_NAME,
  DEPLOYMENT_QUEUE_NAME,
} from './deployment/deployment.constants';
import { readDeploymentIdFromJob } from './deployment/deployment-job.data';
import type { StreamListener } from './deployment/deployment-stream.types';
import { DeploymentStreamService } from './deployment/deployment-stream.service';

@Injectable()
export class DeploymentOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(DeploymentOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stream: DeploymentStreamService,
    @InjectQueue(DEPLOYMENT_QUEUE_NAME)
    private readonly deploymentQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.recoverPendingDeployments();
  }

  async enqueue(deploymentId: string): Promise<void> {
    if (this.stream.isDeploymentRunning(deploymentId)) {
      return;
    }

    const existing = await this.deploymentQueue.getJob(deploymentId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'waiting' || state === 'active' || state === 'delayed') {
        return;
      }
    }

    await this.deploymentQueue.add(
      DEPLOYMENT_JOB_NAME,
      { deploymentId },
      {
        jobId: deploymentId,
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    );

    this.stream.onEnqueued(deploymentId);
    await this.syncQueuePositions();
  }

  subscribe(deploymentId: string, listener: StreamListener): () => void {
    const unsubscribe = this.stream.subscribe(deploymentId, listener, () =>
      this.getQueuePosition(deploymentId),
    );
    void this.ensureProcessing(deploymentId);
    return unsubscribe;
  }

  /** Called after BullMQ job lifecycle events to keep SSE queue positions accurate */
  async syncQueuePositions(): Promise<void> {
    const [waiting, active] = await Promise.all([
      this.deploymentQueue.getWaiting(),
      this.deploymentQueue.getActive(),
    ]);

    for (const job of active) {
      const id = readDeploymentIdFromJob(job);
      if (id) {
        this.stream.updateQueuePosition(id, 0);
      }
    }

    waiting.forEach((job, index) => {
      const id = readDeploymentIdFromJob(job);
      if (id) {
        this.stream.updateQueuePosition(id, index + 1);
      }
    });
  }

  private async getQueuePosition(deploymentId: string): Promise<number> {
    const active = await this.deploymentQueue.getActive();
    if (active.some((j) => readDeploymentIdFromJob(j) === deploymentId)) {
      return 0;
    }
    const waiting = await this.deploymentQueue.getWaiting();
    const index = waiting.findIndex(
      (j) => readDeploymentIdFromJob(j) === deploymentId,
    );
    return index >= 0 ? index + 1 : 0;
  }

  private async ensureProcessing(deploymentId: string): Promise<void> {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { status: true },
    });
    if (!deployment) {
      return;
    }
    if (
      deployment.status === 'QUEUED' ||
      deployment.status === 'INITIALIZING' ||
      deployment.status === 'BUILDING'
    ) {
      await this.enqueue(deploymentId);
    }
  }

  private async recoverPendingDeployments(): Promise<void> {
    const pending = await this.prisma.deployment.findMany({
      where: {
        status: {
          in: ['QUEUED', 'INITIALIZING', 'BUILDING'],
        },
      },
      select: { id: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    if (pending.length === 0) {
      return;
    }

    for (const item of pending) {
      this.stream.seedRecoveryRuntime(
        item.id,
        item.status,
        item.status === 'INITIALIZING' || item.status === 'BUILDING'
          ? 'pastQueued'
          : 'fresh',
      );
      await this.enqueue(item.id);
    }

    this.logger.log(`Recovered ${pending.length} pending deployment(s)`);
  }
}
