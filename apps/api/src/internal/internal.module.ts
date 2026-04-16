import { Module } from '@nestjs/common';
import { CustomDomainsModule } from '../custom-domains/custom-domains.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { GithubModule } from '../github/github.module';
import { ReleasesModule } from '../releases/releases.module';
import { InternalController } from './internal.controller';
import { InternalDomainsController } from './internal-domains.controller';
import { InternalReleasesController } from './internal-releases.controller';

@Module({
  imports: [DeploymentsModule, GithubModule, ReleasesModule, CustomDomainsModule],
  controllers: [InternalController, InternalReleasesController, InternalDomainsController],
})
export class InternalModule {}
