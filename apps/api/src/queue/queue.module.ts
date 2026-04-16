import { Global, Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { DEPLOYMENT_QUEUE_NAME } from '@opendeploy/shared';
import type { Env } from '../config/env';
import { OPENDEPLOY_ENV } from '../config/env.constants';
import { DeploymentQueueService } from './deployment-queue.service';

export const REDIS = 'REDIS';
export const DEPLOYMENT_QUEUE = 'DEPLOYMENT_QUEUE';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (env: Env) => new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }),
      inject: [OPENDEPLOY_ENV],
    },
    {
      provide: DEPLOYMENT_QUEUE,
      useFactory: (connection: IORedis) =>
        new Queue(DEPLOYMENT_QUEUE_NAME, { connection }),
      inject: [REDIS],
    },
    DeploymentQueueService,
  ],
  exports: [REDIS, DEPLOYMENT_QUEUE, DeploymentQueueService],
})
export class QueueModule {}
