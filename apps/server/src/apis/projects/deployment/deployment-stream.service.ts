import { Injectable, Logger } from '@nestjs/common';
import type {
  DeploymentStatus,
  Prisma,
} from '../../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MAX_DEPLOYMENT_LOG_LINES } from './deployment.constants';
import {
  parseStoredStreamLogs,
  parseStoredStreamStages,
} from './deployment-stream-persist.util';
import { createInitialStages } from './deployment-stages.util';
import { deploymentStatusToApi } from './deployment-status.util';
import type {
  DeploymentRuntimeState,
  DeploymentStageId,
  DeploymentStreamEvent,
  StreamListener,
  StreamLogLevel,
  StreamLogLine,
  StageStatus,
  WorkerState,
} from './deployment-stream.types';
import { resolveDeploymentWorkerConcurrency } from './deployment-concurrency.util';
import { nowIso } from './time.util';

const STREAM_PERSIST_DEBOUNCE_MS = 400;

@Injectable()
export class DeploymentStreamService {
  private readonly logger = new Logger(DeploymentStreamService.name);
  private readonly listenersByDeployment = new Map<
    string,
    Set<StreamListener>
  >();
  private readonly runtimeByDeployment = new Map<
    string,
    DeploymentRuntimeState
  >();
  private readonly persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly workerSlots: (string | null)[];
  private readonly workerUpdatedAt: string[];

  constructor(private readonly prisma: PrismaService) {
    const n = resolveDeploymentWorkerConcurrency();
    this.workerSlots = Array.from({ length: n }, () => null);
    this.workerUpdatedAt = Array.from({ length: n }, () => nowIso());
  }

  /** True if this deployment is currently bound to a worker slot */
  isDeploymentRunning(deploymentId: string): boolean {
    return this.workerSlots.some((id) => id === deploymentId);
  }

  beginWork(deploymentId: string): string {
    const freeIndex = this.workerSlots.findIndex((slot) => slot === null);
    if (freeIndex === -1) {
      throw new Error(
        `No free worker slot for deployment ${deploymentId} — check BullMQ concurrency vs stream slot count`,
      );
    }
    this.workerSlots[freeIndex] = deploymentId;
    this.workerUpdatedAt[freeIndex] = nowIso();
    const runtime = this.ensureRuntime(deploymentId);
    runtime.workerId = `worker-${freeIndex + 1}`;
    runtime.queuePosition = 0;
    this.emitWorker(deploymentId);
    return runtime.workerId;
  }

  endWork(deploymentId: string): void {
    const index = this.workerSlots.findIndex((id) => id === deploymentId);
    if (index !== -1) {
      this.workerSlots[index] = null;
      this.workerUpdatedAt[index] = nowIso();
    }
    const runtime = this.runtimeByDeployment.get(deploymentId);
    if (runtime) {
      runtime.workerId = null;
    }
    this.emitWorker(deploymentId);
  }

  onEnqueued(deploymentId: string): void {
    const runtime = this.ensureRuntime(deploymentId);
    runtime.status = 'QUEUED';
    runtime.stages = createInitialStages();
    runtime.logs = [];

    const t = nowIso();
    this.emit({
      type: 'status',
      deploymentId,
      status: deploymentStatusToApi(runtime.status),
      emittedAt: t,
    });

    void this.flushStreamPersistence(deploymentId);
  }

  updateQueuePosition(deploymentId: string, queuePosition: number): void {
    const runtime = this.ensureRuntime(deploymentId);
    if (runtime.queuePosition === queuePosition) {
      return;
    }
    runtime.queuePosition = queuePosition;
    this.emit({
      type: 'queue',
      deploymentId,
      queuePosition,
      emittedAt: nowIso(),
    });
  }

  subscribe(
    deploymentId: string,
    listener: StreamListener,
    getQueuePosition: () => Promise<number>,
  ): () => void {
    const listeners =
      this.listenersByDeployment.get(deploymentId) ?? new Set<StreamListener>();
    listeners.add(listener);
    this.listenersByDeployment.set(deploymentId, listeners);

    void this.emitSnapshot(deploymentId, listener, getQueuePosition);

    return () => {
      const set = this.listenersByDeployment.get(deploymentId);
      if (!set) {
        return;
      }
      set.delete(listener);
      if (set.size === 0) {
        this.listenersByDeployment.delete(deploymentId);
      }
    };
  }

  async emitSnapshot(
    deploymentId: string,
    listener: StreamListener,
    getQueuePosition: () => Promise<number>,
  ): Promise<void> {
    await this.hydrateRuntimeFromDatabase(deploymentId);

    const runtime = this.ensureRuntime(deploymentId);
    const queuePosition = await getQueuePosition();
    runtime.queuePosition = queuePosition;

    listener({
      type: 'snapshot',
      deploymentId,
      status: deploymentStatusToApi(runtime.status),
      queuePosition,
      worker: this.findWorkerByDeployment(deploymentId) ?? null,
      workers: this.getWorkersSnapshot(),
      logs: [...runtime.logs],
      stages: [...runtime.stages],
      emittedAt: nowIso(),
    });
  }

  async updateStatus(
    deploymentId: string,
    status: DeploymentStatus,
  ): Promise<void> {
    const runtime = this.ensureRuntime(deploymentId);
    runtime.status = status;
    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { status },
    });
    this.emit({
      type: 'status',
      deploymentId,
      status: deploymentStatusToApi(status),
      emittedAt: nowIso(),
    });
  }

  updateStage(
    deploymentId: string,
    stageId: DeploymentStageId,
    status: StageStatus,
  ): void {
    const runtime = this.ensureRuntime(deploymentId);
    runtime.stages = runtime.stages.map((stage) =>
      stage.id === stageId ? { ...stage, status, updatedAt: nowIso() } : stage,
    );
    const stage = runtime.stages.find((item) => item.id === stageId);
    if (!stage) {
      return;
    }
    this.emit({
      type: 'stage',
      deploymentId,
      stage,
      emittedAt: nowIso(),
    });
    void this.persistStreamSnapshotNow(deploymentId);
  }

  log(deploymentId: string, level: StreamLogLevel, message: string): void {
    const runtime = this.ensureRuntime(deploymentId);
    const line: StreamLogLine = {
      timestamp: nowIso(),
      level,
      message,
    };
    runtime.logs = [...runtime.logs, line].slice(-MAX_DEPLOYMENT_LOG_LINES);
    this.emit({
      type: 'log',
      deploymentId,
      line,
      emittedAt: nowIso(),
    });
    this.scheduleDebouncedStreamPersist(deploymentId);
  }

  async finalizeSuccessfulSimulation(
    deploymentId: string,
    startedAtMs: number,
  ): Promise<void> {
    await this.flushStreamPersistence(deploymentId);
    const duration = Date.now() - startedAtMs;
    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        buildDurationMs: duration,
        commitSha: `sim${deploymentId.slice(-9)}`,
        commitMessage: 'Simulated deployment completed',
      },
    });
  }

  /** Clears debounced writes and persists the latest logs/stages to Postgres. */
  async flushStreamPersistence(deploymentId: string): Promise<void> {
    const pending = this.persistTimers.get(deploymentId);
    if (pending) {
      clearTimeout(pending);
      this.persistTimers.delete(deploymentId);
    }
    await this.persistStreamSnapshotNow(deploymentId);
  }

  private scheduleDebouncedStreamPersist(deploymentId: string): void {
    const existing = this.persistTimers.get(deploymentId);
    if (existing) {
      clearTimeout(existing);
    }
    const handle = setTimeout(() => {
      this.persistTimers.delete(deploymentId);
      void this.persistStreamSnapshotNow(deploymentId);
    }, STREAM_PERSIST_DEBOUNCE_MS);
    this.persistTimers.set(deploymentId, handle);
  }

  private async persistStreamSnapshotNow(deploymentId: string): Promise<void> {
    const runtime = this.runtimeByDeployment.get(deploymentId);
    if (!runtime) {
      return;
    }
    try {
      const streamLogs = JSON.parse(
        JSON.stringify(runtime.logs),
      ) as Prisma.InputJsonValue;
      const streamStages = JSON.parse(
        JSON.stringify(runtime.stages),
      ) as Prisma.InputJsonValue;
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { streamLogs, streamStages },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not persist deployment stream snapshot (${deploymentId}): ${message}`,
      );
    }
  }

  /**
   * When no worker is bound, load persisted logs/stages so revisits and cold
   * SSE subscribers see the last saved pipeline state.
   */
  private async hydrateRuntimeFromDatabase(
    deploymentId: string,
  ): Promise<void> {
    const row = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { status: true, streamLogs: true, streamStages: true },
    });
    if (!row) {
      return;
    }

    const runtime = this.ensureRuntime(deploymentId);
    runtime.status = row.status;

    if (this.isDeploymentRunning(deploymentId)) {
      return;
    }

    const persistedStages = parseStoredStreamStages(row.streamStages);
    const persistedLogs = parseStoredStreamLogs(row.streamLogs);

    if (persistedStages.length > 0) {
      runtime.stages = persistedStages;
    }
    if (persistedLogs.length > 0) {
      runtime.logs = persistedLogs;
    }
  }

  seedRecoveryRuntime(
    deploymentId: string,
    status: DeploymentStatus,
    stagesHint: 'fresh' | 'pastQueued',
  ): void {
    const runtime = this.ensureRuntime(deploymentId);
    runtime.status = status;
    if (stagesHint === 'pastQueued') {
      runtime.stages = runtime.stages.map((stage) =>
        stage.id === 'queued' ? { ...stage, status: 'completed' } : stage,
      );
    }
  }

  private emitWorker(deploymentId: string): void {
    this.emit({
      type: 'worker',
      deploymentId,
      worker: this.findWorkerByDeployment(deploymentId) ?? null,
      workers: this.getWorkersSnapshot(),
      emittedAt: nowIso(),
    });
  }

  private ensureRuntime(deploymentId: string): DeploymentRuntimeState {
    const existing = this.runtimeByDeployment.get(deploymentId);
    if (existing) {
      return existing;
    }
    const runtime: DeploymentRuntimeState = {
      deploymentId,
      status: 'QUEUED',
      workerId: null,
      queuePosition: 0,
      stages: createInitialStages(),
      logs: [],
    };
    this.runtimeByDeployment.set(deploymentId, runtime);
    return runtime;
  }

  private findWorkerByDeployment(
    deploymentId: string,
  ): WorkerState | undefined {
    const index = this.workerSlots.findIndex((id) => id === deploymentId);
    if (index === -1) {
      return undefined;
    }
    return {
      id: `worker-${index + 1}`,
      status: 'busy',
      currentDeploymentId: deploymentId,
      updatedAt: this.workerUpdatedAt[index] ?? nowIso(),
    };
  }

  private getWorkersSnapshot(): WorkerState[] {
    return this.workerSlots.map((deploymentId, index) => ({
      id: `worker-${index + 1}`,
      status: deploymentId ? 'busy' : 'idle',
      currentDeploymentId: deploymentId,
      updatedAt: this.workerUpdatedAt[index] ?? nowIso(),
    }));
  }

  private emit(event: DeploymentStreamEvent): void {
    const listeners = this.listenersByDeployment.get(event.deploymentId);
    if (!listeners || listeners.size === 0) {
      return;
    }
    for (const listener of listeners) {
      listener(event);
    }
  }
}
