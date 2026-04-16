import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env';
import { WebhooksService } from './webhooks.service';

function svc(
  env: Env,
  prisma: {
    webhookEvent: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  },
) {
  const deployments = {} as never;
  const releases = { teardownPreviewForPr: vi.fn() } as never;
  return new WebhooksService(env, prisma as never, deployments, releases);
}

describe('WebhooksService', () => {
  it('rejects invalid signature', async () => {
    const prisma = {
      webhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const env = { GITHUB_WEBHOOK_SECRET: 'secret' } as Env;
    const webhooks = svc(env, prisma);
    await expect(
      webhooks.persistGitHubEvent({
        rawBody: Buffer.from('{}'),
        signature: 'sha256=deadbeef',
        deliveryId: 'd1',
        eventType: 'push',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns duplicate when idempotency key exists', async () => {
    const existing = { id: 'evt_1' };
    const prisma = {
      webhookEvent: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const env = { GITHUB_WEBHOOK_SECRET: 'secret' } as Env;
    const webhooks = svc(env, prisma);
    const body = Buffer.from('{"a":1}');
    const sig = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
    const result = await webhooks.persistGitHubEvent({
      rawBody: body,
      signature: sig,
      deliveryId: 'dup',
      eventType: 'ping',
      payload: { a: 1 },
    });
    expect(result.duplicate).toBe(true);
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
  });
});
