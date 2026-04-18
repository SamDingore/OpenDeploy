import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DeploymentOrchestratorService } from '../deployment-orchestrator.service';
import { DEPLOYMENT_QUEUE_NAME } from './deployment.constants';
import { DEPLOYMENT_PROCESSOR_CONCURRENCY } from './deployment-concurrency.util';
import type { DeploymentJobData } from './deployment-job.data';
import {
  type DeploymentPipelinePorts,
  runSimulatedDeploymentPipeline,
} from './deployment-simulation.pipeline';
import { DeploymentStreamService } from './deployment-stream.service';

@Processor(DEPLOYMENT_QUEUE_NAME, {
  concurrency: DEPLOYMENT_PROCESSOR_CONCURRENCY,
})
export class DeploymentProcessor extends WorkerHost {
  private readonly logger = new Logger(DeploymentProcessor.name);

  constructor(
    private readonly stream: DeploymentStreamService,
    private readonly orchestrator: DeploymentOrchestratorService,
  ) {
    super();
  }

  async process(job: Job<DeploymentJobData>): Promise<void> {
    const { deploymentId } = job.data;
    const workerLabel = this.stream.beginWork(deploymentId);

    const ports: DeploymentPipelinePorts = {
      updateStatus: (id, status) => this.stream.updateStatus(id, status),
      updateStage: (id, stageId, status) =>
        this.stream.updateStage(id, stageId, status),
      log: (id, level, message) => this.stream.log(id, level, message),
      finalizeSuccess: (id, startedAtMs) =>
        this.stream.finalizeSuccessfulSimulation(id, startedAtMs),
    };

    try {
      await runSimulatedDeploymentPipeline(deploymentId, workerLabel, ports);
    } catch (error: unknown) {
      await this.stream.updateStatus(deploymentId, 'ERROR');
      this.stream.log(
        deploymentId,
        'error',
        'Deployment failed while running worker pipeline',
      );
      const trace = error instanceof Error ? error.stack : String(error);
      this.logger.error(`Deployment ${deploymentId} failed`, trace);
      throw error;
    } finally {
      await this.stream.flushStreamPersistence(deploymentId);
      this.stream.endWork(deploymentId);
      await this.orchestrator.syncQueuePositions();
    }
  }
}
