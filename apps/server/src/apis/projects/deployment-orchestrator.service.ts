import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { DeploymentStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type WorkerStatus = 'idle' | 'busy';

type WorkerState = {
  id: string;
  status: WorkerStatus;
  currentDeploymentId: string | null;
  updatedAt: string;
};

type DeploymentStreamEvent =
  | {
      type: 'snapshot';
      deploymentId: string;
      status: string;
      queuePosition: number;
      worker: WorkerState | null;
      workers: WorkerState[];
      logs: StreamLogLine[];
      stages: StageProgress[];
      emittedAt: string;
    }
  | {
      type: 'status';
      deploymentId: string;
      status: string;
      emittedAt: string;
    }
  | {
      type: 'queue';
      deploymentId: string;
      queuePosition: number;
      emittedAt: string;
    }
  | {
      type: 'worker';
      deploymentId: string;
      worker: WorkerState | null;
      workers: WorkerState[];
      emittedAt: string;
    }
  | {
      type: 'stage';
      deploymentId: string;
      stage: StageProgress;
      emittedAt: string;
    }
  | {
      type: 'log';
      deploymentId: string;
      line: StreamLogLine;
      emittedAt: string;
    };

type DeploymentStageId =
  | 'queued'
  | 'initializing'
  | 'installing'
  | 'building'
  | 'packaging'
  | 'healthcheck'
  | 'ready';

type StageStatus = 'pending' | 'running' | 'completed' | 'error';

type StageProgress = {
  id: DeploymentStageId;
  label: string;
  status: StageStatus;
  updatedAt: string;
};

type StreamLogLevel = 'info' | 'warn' | 'error' | 'success';

type StreamLogLine = {
  timestamp: string;
  level: StreamLogLevel;
  message: string;
};

type DeploymentRuntimeState = {
  deploymentId: string;
  status: DeploymentStatus;
  workerId: string | null;
  queuePosition: number;
  stages: StageProgress[];
  logs: StreamLogLine[];
};

type StreamListener = (event: DeploymentStreamEvent) => void;

const MAX_LOG_LINES = 200;

function toApiStatus(status: DeploymentStatus): string {
  switch (status) {
    case 'READY':
      return 'ready';
    case 'ERROR':
      return 'error';
    case 'BUILDING':
      return 'building';
    case 'QUEUED':
      return 'queued';
    case 'INITIALIZING':
      return 'initializing';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'queued';
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function createInitialStages(): StageProgress[] {
  const emittedAt = nowIso();
  return [
    { id: 'queued', label: 'Queued', status: 'running', updatedAt: emittedAt },
    {
      id: 'initializing',
      label: 'Initialize Worker',
      status: 'pending',
      updatedAt: emittedAt,
    },
    {
      id: 'installing',
      label: 'Install Dependencies',
      status: 'pending',
      updatedAt: emittedAt,
    },
    {
      id: 'building',
      label: 'Build Project',
      status: 'pending',
      updatedAt: emittedAt,
    },
    {
      id: 'packaging',
      label: 'Package Artifacts',
      status: 'pending',
      updatedAt: emittedAt,
    },
    {
      id: 'healthcheck',
      label: 'Run Health Checks',
      status: 'pending',
      updatedAt: emittedAt,
    },
    {
      id: 'ready',
      label: 'Deployment Ready',
      status: 'pending',
      updatedAt: emittedAt,
    },
  ];
}

@Injectable()
export class DeploymentOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(DeploymentOrchestratorService.name);
  private readonly queue: string[] = [];
  private readonly workers: WorkerState[] = [];
  private readonly listenersByDeployment = new Map<
    string,
    Set<StreamListener>
  >();
  private readonly runtimeByDeployment = new Map<
    string,
    DeploymentRuntimeState
  >();
  private readonly concurrency: number;

  constructor(private readonly prisma: PrismaService) {
    const requested = Number(process.env.DEPLOYMENT_WORKER_CONCURRENCY ?? 1);
    this.concurrency =
      Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 1;
    this.workers = Array.from({ length: this.concurrency }).map((_, index) => ({
      id: `worker-${index + 1}`,
      status: 'idle',
      currentDeploymentId: null,
      updatedAt: nowIso(),
    }));
  }

  async onModuleInit(): Promise<void> {
    await this.recoverPendingDeployments();
  }

  enqueue(deploymentId: string): void {
    if (
      this.queue.includes(deploymentId) ||
      this.findWorkerByDeployment(deploymentId)
    ) {
      return;
    }

    this.queue.push(deploymentId);
    const runtime = this.ensureRuntime(deploymentId);
    runtime.status = 'QUEUED';
    runtime.queuePosition = this.queue.length;
    runtime.stages = createInitialStages();
    runtime.logs = [];

    this.emit({
      type: 'queue',
      deploymentId,
      queuePosition: runtime.queuePosition,
      emittedAt: nowIso(),
    });
    this.emit({
      type: 'status',
      deploymentId,
      status: toApiStatus(runtime.status),
      emittedAt: nowIso(),
    });
    this.runScheduler();
  }

  subscribe(deploymentId: string, listener: StreamListener): () => void {
    const listeners =
      this.listenersByDeployment.get(deploymentId) ?? new Set<StreamListener>();
    listeners.add(listener);
    this.listenersByDeployment.set(deploymentId, listeners);

    void this.emitSnapshot(deploymentId, listener);
    void this.ensureProcessing(deploymentId);

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
      this.enqueue(deploymentId);
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
      const runtime = this.ensureRuntime(item.id);
      runtime.status = item.status;
      if (item.status === 'INITIALIZING' || item.status === 'BUILDING') {
        runtime.stages = runtime.stages.map((stage) =>
          stage.id === 'queued' ? { ...stage, status: 'completed' } : stage,
        );
      }
      this.enqueue(item.id);
    }

    this.logger.log(`Recovered ${pending.length} pending deployment(s)`);
  }

  private async emitSnapshot(
    deploymentId: string,
    listener: StreamListener,
  ): Promise<void> {
    const runtime = this.ensureRuntime(deploymentId);
    const dbDeployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { status: true },
    });
    if (dbDeployment) {
      runtime.status = dbDeployment.status;
    }

    listener({
      type: 'snapshot',
      deploymentId,
      status: toApiStatus(runtime.status),
      queuePosition: runtime.queuePosition,
      worker: this.findWorkerByDeployment(deploymentId) ?? null,
      workers: this.cloneWorkers(),
      logs: [...runtime.logs],
      stages: [...runtime.stages],
      emittedAt: nowIso(),
    });
  }

  private runScheduler(): void {
    for (const worker of this.workers) {
      if (worker.status === 'busy') {
        continue;
      }
      const nextDeploymentId = this.queue.shift();
      if (!nextDeploymentId) {
        this.updateQueuePositions();
        return;
      }
      this.processWithWorker(worker.id, nextDeploymentId).catch(
        (error: unknown) => {
          const trace = error instanceof Error ? error.stack : String(error);
          this.logger.error(`Deployment ${nextDeploymentId} failed`, trace);
        },
      );
    }
    this.updateQueuePositions();
  }

  private async processWithWorker(
    workerId: string,
    deploymentId: string,
  ): Promise<void> {
    const worker = this.workers.find((item) => item.id === workerId);
    if (!worker) {
      return;
    }

    const runtime = this.ensureRuntime(deploymentId);
    worker.status = 'busy';
    worker.currentDeploymentId = deploymentId;
    worker.updatedAt = nowIso();
    runtime.workerId = worker.id;
    runtime.queuePosition = 0;
    this.emitWorker(deploymentId);

    const startedAtMs = Date.now();
    try {
      await this.updateStatus(deploymentId, 'INITIALIZING');
      this.updateStage(deploymentId, 'queued', 'completed');
      this.updateStage(deploymentId, 'initializing', 'running');
      this.log(
        deploymentId,
        'info',
        `Worker ${worker.id} picked up deployment`,
      );
      await this.delay(1000);
      this.updateStage(deploymentId, 'initializing', 'completed');

      await this.updateStatus(deploymentId, 'BUILDING');
      this.updateStage(deploymentId, 'installing', 'running');
      this.log(
        deploymentId,
        'info',
        'Restoring cache and installing dependencies',
      );
      await this.delay(1200);
      this.log(deploymentId, 'info', 'Dependencies installed successfully');
      this.updateStage(deploymentId, 'installing', 'completed');

      this.updateStage(deploymentId, 'building', 'running');
      this.log(deploymentId, 'info', 'Running build command');
      await this.delay(1600);
      this.log(
        deploymentId,
        'info',
        'Optimizing bundles and generating output',
      );
      await this.delay(1400);
      this.updateStage(deploymentId, 'building', 'completed');

      this.updateStage(deploymentId, 'packaging', 'running');
      this.log(deploymentId, 'info', 'Packaging build artifacts');
      await this.delay(900);
      this.updateStage(deploymentId, 'packaging', 'completed');

      this.updateStage(deploymentId, 'healthcheck', 'running');
      this.log(deploymentId, 'info', 'Running smoke and health checks');
      await this.delay(1000);
      this.updateStage(deploymentId, 'healthcheck', 'completed');

      this.updateStage(deploymentId, 'ready', 'running');
      await this.delay(300);
      this.updateStage(deploymentId, 'ready', 'completed');
      await this.updateStatus(deploymentId, 'READY');

      const duration = Date.now() - startedAtMs;
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          buildDurationMs: duration,
          commitSha: `sim${deploymentId.slice(-9)}`,
          commitMessage: 'Simulated deployment completed',
        },
      });
      this.log(deploymentId, 'success', 'Deployment completed successfully');
    } catch (error) {
      await this.updateStatus(deploymentId, 'ERROR');
      this.log(
        deploymentId,
        'error',
        'Deployment failed while running worker pipeline',
      );
      throw error;
    } finally {
      worker.status = 'idle';
      worker.currentDeploymentId = null;
      worker.updatedAt = nowIso();
      runtime.workerId = null;
      this.emitWorker(deploymentId);
      this.runScheduler();
    }
  }

  private async updateStatus(
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
      status: toApiStatus(status),
      emittedAt: nowIso(),
    });
  }

  private updateStage(
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
  }

  private log(
    deploymentId: string,
    level: StreamLogLevel,
    message: string,
  ): void {
    const runtime = this.ensureRuntime(deploymentId);
    const line: StreamLogLine = {
      timestamp: nowIso(),
      level,
      message,
    };
    runtime.logs = [...runtime.logs, line].slice(-MAX_LOG_LINES);
    this.emit({
      type: 'log',
      deploymentId,
      line,
      emittedAt: nowIso(),
    });
  }

  private emitWorker(deploymentId: string): void {
    this.emit({
      type: 'worker',
      deploymentId,
      worker: this.findWorkerByDeployment(deploymentId) ?? null,
      workers: this.cloneWorkers(),
      emittedAt: nowIso(),
    });
    this.updateQueuePositions();
  }

  private updateQueuePositions(): void {
    this.queue.forEach((deploymentId, index) => {
      const runtime = this.ensureRuntime(deploymentId);
      const nextPosition = index + 1;
      if (runtime.queuePosition !== nextPosition) {
        runtime.queuePosition = nextPosition;
        this.emit({
          type: 'queue',
          deploymentId,
          queuePosition: nextPosition,
          emittedAt: nowIso(),
        });
      }
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
      queuePosition: this.queue.indexOf(deploymentId) + 1,
      stages: createInitialStages(),
      logs: [],
    };
    this.runtimeByDeployment.set(deploymentId, runtime);
    return runtime;
  }

  private findWorkerByDeployment(
    deploymentId: string,
  ): WorkerState | undefined {
    return this.workers.find(
      (worker) => worker.currentDeploymentId === deploymentId,
    );
  }

  private cloneWorkers(): WorkerState[] {
    return this.workers.map((worker) => ({ ...worker }));
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

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
