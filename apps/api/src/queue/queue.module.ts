import { Global, Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  DEPLOYMENT_QUEUE_NAME,
  DOMAIN_QUEUE_NAME,
  RELEASE_QUEUE_NAME,
  RELEASE_TEARDOWN_QUEUE_NAME,
} from '@opendeploy/shared';
import type { Env } from '../config/env';
import { OPENDEPLOY_ENV } from '../config/env.constants';
import { DeploymentQueueService } from './deployment-queue.service';
import { DomainQueueService } from './domain-queue.service';
import { ReleaseQueueService } from './release-queue.service';
import {
  DEPLOYMENT_QUEUE,
  DOMAIN_QUEUE,
  REDIS,
  RELEASE_QUEUE,
  RELEASE_TEARDOWN_QUEUE,
} from './queue.tokens';

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
    {
      provide: RELEASE_QUEUE,
      useFactory: (connection: IORedis) => new Queue(RELEASE_QUEUE_NAME, { connection }),
      inject: [REDIS],
    },
    {
      provide: RELEASE_TEARDOWN_QUEUE,
      useFactory: (connection: IORedis) =>
        new Queue(RELEASE_TEARDOWN_QUEUE_NAME, { connection }),
      inject: [REDIS],
    },
    {
      provide: DOMAIN_QUEUE,
      useFactory: (connection: IORedis) => new Queue(DOMAIN_QUEUE_NAME, { connection }),
      inject: [REDIS],
    },
    DeploymentQueueService,
    ReleaseQueueService,
    DomainQueueService,
  ],
  exports: [
    REDIS,
    DEPLOYMENT_QUEUE,
    RELEASE_QUEUE,
    RELEASE_TEARDOWN_QUEUE,
    DOMAIN_QUEUE,
    DeploymentQueueService,
    ReleaseQueueService,
    DomainQueueService,
  ],
})
export class QueueModule {}
