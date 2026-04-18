import type { DeploymentStatus } from '../../../../generated/prisma/client';

export type WorkerStatus = 'idle' | 'busy';

export type WorkerState = {
  id: string;
  status: WorkerStatus;
  currentDeploymentId: string | null;
  updatedAt: string;
};

export type DeploymentStreamEvent =
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

export type DeploymentStageId =
  | 'queued'
  | 'initializing'
  | 'installing'
  | 'building'
  | 'packaging'
  | 'healthcheck'
  | 'ready';

export type StageStatus = 'pending' | 'running' | 'completed' | 'error';

export type StageProgress = {
  id: DeploymentStageId;
  label: string;
  status: StageStatus;
  updatedAt: string;
};

export type StreamLogLevel = 'info' | 'warn' | 'error' | 'success';

export type StreamLogLine = {
  timestamp: string;
  level: StreamLogLevel;
  message: string;
};

export type DeploymentRuntimeState = {
  deploymentId: string;
  status: DeploymentStatus;
  workerId: string | null;
  queuePosition: number;
  stages: StageProgress[];
  logs: StreamLogLine[];
};

export type StreamListener = (event: DeploymentStreamEvent) => void;
