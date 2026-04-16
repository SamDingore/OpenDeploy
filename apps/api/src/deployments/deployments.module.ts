import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { DeploymentsController } from './deployments.controller';
import { DeploymentEventsService } from './deployment-events.service';
import { DeploymentsService } from './deployments.service';

@Module({
  imports: [GithubModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentEventsService],
  exports: [DeploymentsService, DeploymentEventsService],
})
export class DeploymentsModule {}
