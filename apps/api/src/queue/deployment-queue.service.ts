import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { createTraceCarrierFromActiveContext, type DeploymentJobPayload } from '@opendeploy/shared';
import { DEPLOYMENT_QUEUE } from './queue.tokens';

@Injectable()
export class DeploymentQueueService {
  private readonly logger = new Logger(DeploymentQueueService.name);

  constructor(@Inject(DEPLOYMENT_QUEUE) private readonly queue: Queue) {}

  async enqueue(payload: DeploymentJobPayload): Promise<string> {
    const traceCarrier = createTraceCarrierFromActiveContext();
    const job = await this.queue.add('process', { ...payload, traceCarrier }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    this.logger.log({ deploymentId: payload.deploymentId }, 'deployment_job_enqueued');
    return String(job.id);
  }
}
