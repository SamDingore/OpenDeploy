import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  createTraceCarrierFromActiveContext,
  type ReleaseJobPayload,
  type ReleaseTeardownPayload,
} from '@opendeploy/shared';
import { RELEASE_QUEUE, RELEASE_TEARDOWN_QUEUE } from './queue.tokens';

@Injectable()
export class ReleaseQueueService {
  private readonly logger = new Logger(ReleaseQueueService.name);

  constructor(
    @Inject(RELEASE_QUEUE) private readonly releaseQueue: Queue,
    @Inject(RELEASE_TEARDOWN_QUEUE) private readonly teardownQueue: Queue,
  ) {}

  async enqueueProvision(releaseId: string): Promise<string> {
    const traceCarrier = createTraceCarrierFromActiveContext();
    const job = await this.releaseQueue.add(
      'provision',
      { releaseId, kind: 'provision', traceCarrier } satisfies ReleaseJobPayload,
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    );
    this.logger.log({ releaseId }, 'release_provision_enqueued');
    return String(job.id);
  }

  async enqueueTeardown(input: ReleaseTeardownPayload): Promise<string> {
    const traceCarrier = createTraceCarrierFromActiveContext();
    const job = await this.teardownQueue.add('teardown', { ...input, traceCarrier }, {
      attempts: 4,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    });
    this.logger.log(input, 'release_teardown_enqueued');
    return String(job.id);
  }

}
