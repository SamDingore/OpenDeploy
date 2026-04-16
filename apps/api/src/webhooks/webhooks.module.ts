import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { ReleasesModule } from '../releases/releases.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [DeploymentsModule, ReleasesModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
