import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { OperationsModule } from '../operations/operations.module';
import { ReleasesModule } from '../releases/releases.module';
import { DeploymentsController } from './deployments.controller';
import { DeploymentEventsService } from './deployment-events.service';
import { DeploymentsService } from './deployments.service';

@Module({
  imports: [GithubModule, ReleasesModule, OperationsModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentEventsService],
  exports: [DeploymentsService, DeploymentEventsService],
})
export class DeploymentsModule {}
