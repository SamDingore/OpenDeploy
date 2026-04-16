import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { createTraceCarrierFromActiveContext, type DomainJobPayload } from '@opendeploy/shared';
import { DOMAIN_QUEUE } from './queue.module';

@Injectable()
export class DomainQueueService {
  private readonly logger = new Logger(DomainQueueService.name);

  constructor(@Inject(DOMAIN_QUEUE) private readonly queue: Queue) {}

  private async enqueue(jobName: DomainJobPayload['kind'], payload: DomainJobPayload) {
    const traceCarrier = createTraceCarrierFromActiveContext();
    const job = await this.queue.add(jobName, { ...payload, traceCarrier }, {
      attempts: 8,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
    });
    this.logger.log({ jobId: job.id, kind: jobName }, 'domain_job_enqueued');
  }

  async enqueueVerify(customDomainId: string) {
    await this.enqueue('domain-verify', { kind: 'domain-verify', customDomainId });
  }

  async enqueueCertificateIssue(customDomainId: string) {
    await this.enqueue('certificate-issue', { kind: 'certificate-issue', customDomainId });
  }

  async enqueueCertificateRenew(customDomainId: string) {
    await this.enqueue('certificate-renew', { kind: 'certificate-renew', customDomainId });
  }

  async enqueueAttach(customDomainId: string) {
    await this.enqueue('domain-attach', { kind: 'domain-attach', customDomainId });
  }

  async enqueueDetach(customDomainId: string) {
    await this.enqueue('domain-detach', { kind: 'domain-detach', customDomainId });
  }

  async enqueueReconcileSweep() {
    await this.enqueue('domain-reconcile', { kind: 'domain-reconcile', sweep: true });
  }
}
