/** BullMQ queue name — must match @Processor registration */
export const DEPLOYMENT_QUEUE_NAME = 'deployments';

/** Job name for deployment runs */
export const DEPLOYMENT_JOB_NAME = 'run' as const;

/** Max log lines retained per deployment in memory for SSE */
export const MAX_DEPLOYMENT_LOG_LINES = 200;

export const DEPLOYMENT_ENV = {
  WORKER_CONCURRENCY: 'DEPLOYMENT_WORKER_CONCURRENCY',
  REDIS_URL: 'REDIS_URL',
  REDIS_HOST: 'REDIS_HOST',
  REDIS_PORT: 'REDIS_PORT',
} as const;
