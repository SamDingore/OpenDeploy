import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { success } from '@opendeploy/shared';
import { WebhooksService } from './webhooks.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('github')
  @HttpCode(200)
  async github(
    @Req() req: RawBodyRequest,
    @Headers('x-github-delivery') deliveryId: string | undefined,
    @Headers('x-github-event') eventType: string | undefined,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    if (!deliveryId || !eventType) {
      return success({ accepted: false, reason: 'missing_headers' });
    }
    const payload = JSON.parse(rawBody.toString('utf8')) as unknown;
    const result = await this.webhooks.persistGitHubEvent({
      rawBody,
      signature,
      deliveryId,
      eventType,
      payload,
    });
    if (result.duplicate) {
      return success({ accepted: true, duplicate: true });
    }
    try {
      await this.webhooks.handleGitHubEvent(result.event.id);
      await this.webhooks.markProcessed(result.event.id);
    } catch (err) {
      await this.webhooks.markProcessed(
        result.event.id,
        String(err instanceof Error ? err.message : err),
      );
    }
    return success({ accepted: true, duplicate: false, eventId: result.event.id });
  }
}
