import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { EnvModule } from './config/env.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { GithubModule } from './github/github.module';
import { InternalModule } from './internal/internal.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { QueueModule } from './queue/queue.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    EnvModule,
    PrismaModule,
    AuditModule,
    QueueModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    GithubModule,
    DeploymentsModule,
    WebhooksModule,
    InternalModule,
    WorkersModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
