import type { DeploymentStatus } from '../../../../generated/prisma/client';
import { SIMULATION_DELAYS_MS } from './deployment-simulation.constants';
import type {
  DeploymentStageId,
  StageStatus,
  StreamLogLevel,
} from './deployment-stream.types';
import { delay } from './time.util';

export type DeploymentPipelinePorts = {
  updateStatus(deploymentId: string, status: DeploymentStatus): Promise<void>;
  updateStage(
    deploymentId: string,
    stageId: DeploymentStageId,
    status: StageStatus,
  ): void;
  log(deploymentId: string, level: StreamLogLevel, message: string): void;
  finalizeSuccess(deploymentId: string, startedAtMs: number): Promise<void>;
};

export async function runSimulatedDeploymentPipeline(
  deploymentId: string,
  workerLabel: string,
  ports: DeploymentPipelinePorts,
): Promise<void> {
  const startedAtMs = Date.now();

  await ports.updateStatus(deploymentId, 'INITIALIZING');
  ports.updateStage(deploymentId, 'queued', 'completed');
  ports.updateStage(deploymentId, 'initializing', 'running');
  ports.log(deploymentId, 'info', `Worker ${workerLabel} picked up deployment`);
  await delay(SIMULATION_DELAYS_MS.workerPickup);
  ports.updateStage(deploymentId, 'initializing', 'completed');

  await ports.updateStatus(deploymentId, 'BUILDING');
  ports.updateStage(deploymentId, 'installing', 'running');
  ports.log(
    deploymentId,
    'info',
    'Restoring cache and installing dependencies',
  );
  await delay(SIMULATION_DELAYS_MS.install);
  ports.log(deploymentId, 'info', 'Dependencies installed successfully');
  ports.updateStage(deploymentId, 'installing', 'completed');

  ports.updateStage(deploymentId, 'building', 'running');
  ports.log(deploymentId, 'info', 'Running build command');
  await delay(SIMULATION_DELAYS_MS.buildPart1);
  ports.log(deploymentId, 'info', 'Optimizing bundles and generating output');
  await delay(SIMULATION_DELAYS_MS.buildPart2);
  ports.updateStage(deploymentId, 'building', 'completed');

  ports.updateStage(deploymentId, 'packaging', 'running');
  ports.log(deploymentId, 'info', 'Packaging build artifacts');
  await delay(SIMULATION_DELAYS_MS.package);
  ports.updateStage(deploymentId, 'packaging', 'completed');

  ports.updateStage(deploymentId, 'healthcheck', 'running');
  ports.log(deploymentId, 'info', 'Running smoke and health checks');
  await delay(SIMULATION_DELAYS_MS.healthcheck);
  ports.updateStage(deploymentId, 'healthcheck', 'completed');

  ports.updateStage(deploymentId, 'ready', 'running');
  await delay(SIMULATION_DELAYS_MS.readyFinalize);
  ports.updateStage(deploymentId, 'ready', 'completed');
  ports.log(deploymentId, 'success', 'Deployment completed successfully');
  await ports.updateStatus(deploymentId, 'READY');
  await ports.finalizeSuccess(deploymentId, startedAtMs);
}
