import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { GithubModule } from '../github/github.module';
import { ReleasesModule } from '../releases/releases.module';
import { InternalController } from './internal.controller';
import { InternalReleasesController } from './internal-releases.controller';

@Module({
  imports: [DeploymentsModule, GithubModule, ReleasesModule],
  controllers: [InternalController, InternalReleasesController],
})
export class InternalModule {}
