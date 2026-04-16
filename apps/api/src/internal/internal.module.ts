import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { GithubModule } from '../github/github.module';
import { InternalController } from './internal.controller';

@Module({
  imports: [DeploymentsModule, GithubModule],
  controllers: [InternalController],
})
export class InternalModule {}
