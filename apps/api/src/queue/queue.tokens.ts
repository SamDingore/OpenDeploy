/** DI tokens for QueueModule — kept separate from queue.module to avoid circular imports. */
export const REDIS = 'REDIS';
export const DEPLOYMENT_QUEUE = 'DEPLOYMENT_QUEUE';
export const RELEASE_QUEUE = 'RELEASE_QUEUE';
export const RELEASE_TEARDOWN_QUEUE = 'RELEASE_TEARDOWN_QUEUE';
export const DOMAIN_QUEUE = 'DOMAIN_QUEUE';
