import { DEPLOYMENT_ENV } from './deployment.constants';

export function resolveDeploymentWorkerConcurrency(): number {
  const raw = Number(process.env[DEPLOYMENT_ENV.WORKER_CONCURRENCY] ?? 1);
  if (!Number.isFinite(raw) || raw < 1) {
    return 1;
  }
  return Math.floor(raw);
}

/** Resolved once at module load (import `env-bootstrap` before app modules in main). */
export const DEPLOYMENT_PROCESSOR_CONCURRENCY =
  resolveDeploymentWorkerConcurrency();
