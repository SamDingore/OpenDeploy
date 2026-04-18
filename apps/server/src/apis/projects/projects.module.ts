import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DEPLOYMENT_QUEUE_NAME } from './deployment/deployment.constants';
import { DeploymentProcessor } from './deployment/deployment.processor';
import { DeploymentStreamService } from './deployment/deployment-stream.service';
import { createRedisConnection } from './deployment/redis.connection';
import { DeploymentOrchestratorService } from './deployment-orchestrator.service';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [
    PrismaModule,
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: createRedisConnection(),
      }),
    }),
    BullModule.registerQueue({
      name: DEPLOYMENT_QUEUE_NAME,
    }),
  ],
  controllers: [ProjectsController],
  providers: [
    DeploymentStreamService,
    DeploymentOrchestratorService,
    DeploymentProcessor,
  ],
})
export class ProjectsModule {}
