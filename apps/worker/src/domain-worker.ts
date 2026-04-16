import { Worker } from 'bullmq';
import type IORedis from 'ioredis';
import { DOMAIN_QUEUE_NAME, type DomainJobPayload } from '@opendeploy/shared';

async function postInternal(api: string, secret: string, path: string): Promise<void> {
  const res = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: { 'x-internal-secret': secret },
  });
  if (!res.ok) {
    throw new Error(`domain_internal_failed:${path}:${await res.text()}`);
  }
}

export function registerDomainWorkers(redis: IORedis, apiBase: string, secret: string): void {
  const api = apiBase.replace(/\/$/, '');

  const w = new Worker(
    DOMAIN_QUEUE_NAME,
    async (job) => {
      const data = job.data as DomainJobPayload;
      switch (data.kind) {
        case 'domain-verify':
          if (!data.customDomainId) return;
          await postInternal(api, secret, `/internal/domains/${data.customDomainId}/run-verify`);
          break;
        case 'certificate-issue':
          if (!data.customDomainId) return;
          await postInternal(
            api,
            secret,
            `/internal/domains/${data.customDomainId}/run-certificate-issue`,
          );
          break;
        case 'certificate-renew':
          if (!data.customDomainId) return;
          await postInternal(
            api,
            secret,
            `/internal/domains/${data.customDomainId}/run-certificate-renew`,
          );
          break;
        case 'domain-attach':
          if (!data.customDomainId) return;
          await postInternal(api, secret, `/internal/domains/${data.customDomainId}/run-attach`);
          break;
        case 'domain-detach':
          if (!data.customDomainId) return;
          await postInternal(api, secret, `/internal/domains/${data.customDomainId}/run-detach`);
          break;
        case 'domain-reconcile':
          await postInternal(api, secret, '/internal/domains/reconcile/run');
          break;
        default:
          break;
      }
    },
    { connection: redis, concurrency: 2 },
  );

  w.on('failed', (job, err) => {
    console.error('domain_job_failed', job?.name, err);
  });
}
