import Redis from 'ioredis';

/**
 * Shared Redis connection for BullMQ.
 * `maxRetriesPerRequest: null` is required by BullMQ for blocking commands.
 */
export function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    return new Redis(url, {
      maxRetriesPerRequest: null,
    });
  }

  const host = process.env.REDIS_HOST?.trim() || '127.0.0.1';
  const port = Number(process.env.REDIS_PORT ?? 6379);
  return new Redis({
    host,
    port: Number.isFinite(port) ? port : 6379,
    maxRetriesPerRequest: null,
  });
}
