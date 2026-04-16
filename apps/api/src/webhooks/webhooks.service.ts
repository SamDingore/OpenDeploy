import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { WebhookProvider } from '@opendeploy/shared';
import { webhookIdempotencyKey, verifyGitHubWebhookSignature } from '@opendeploy/security';
import type { Env } from '../config/env';
import { OPENDEPLOY_ENV } from '../config/env.constants';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentsService } from '../deployments/deployments.service';

@Injectable()
export class WebhooksService {
  constructor(
    @Inject(OPENDEPLOY_ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly deployments: DeploymentsService,
  ) {}

  async persistGitHubEvent(input: {
    rawBody: Buffer;
    signature: string | undefined;
    deliveryId: string;
    eventType: string;
    payload: unknown;
  }) {
    const secret = this.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      throw new UnauthorizedException('github_webhook_not_configured');
    }
    if (!verifyGitHubWebhookSignature(secret, input.rawBody, input.signature)) {
      throw new UnauthorizedException('invalid_signature');
    }
    const idempotencyKey = webhookIdempotencyKey(WebhookProvider.github, input.deliveryId);
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return { duplicate: true as const, event: existing };
    }
    const event = await this.prisma.webhookEvent.create({
      data: {
        provider: 'github',
        deliveryId: input.deliveryId,
        eventType: input.eventType,
        idempotencyKey,
        payload: input.payload as object,
      },
    });
    return { duplicate: false as const, event };
  }

  async markProcessed(id: string, error?: string) {
    await this.prisma.webhookEvent.update({
      where: { id },
      data: {
        processed: !error,
        processedAt: new Date(),
        error: error ?? null,
      },
    });
  }

  async handleGitHubEvent(eventId: string): Promise<void> {
    const event = await this.prisma.webhookEvent.findUnique({ where: { id: eventId } });
    if (!event) return;
    if (event.provider !== 'github') return;

    const payload = event.payload as any;

    if (event.eventType === 'push') {
      const installationId = String(payload?.installation?.id ?? '');
      const repoFullName = String(payload?.repository?.full_name ?? '');
      const commitSha = String(payload?.after ?? '');
      const ref = String(payload?.ref ?? '');
      const branch = ref.startsWith('refs/heads/') ? ref.replace('refs/heads/', '') : ref || null;

      if (!installationId || !repoFullName || !commitSha) {
        throw new Error('github_push_payload_missing_fields');
      }

      const inst = await this.prisma.gitProviderInstallation.findUnique({
        where: { providerInstallationId: installationId },
      });
      if (!inst) {
        // installation not linked to any workspace yet
        return;
      }

      const link = await this.prisma.repositoryLink.findFirst({
        where: { installationId: inst.id, fullName: repoFullName },
      });
      if (!link) return;

      const env = await this.prisma.environment.findFirst({
        where: { projectId: link.projectId, type: 'preview' },
      });
      if (!env) return;

      await this.deployments.createFromWebhook({
        workspaceId: inst.workspaceId,
        projectId: link.projectId,
        environmentId: env.id,
        commitSha,
        branch,
        triggerSource: 'push',
      });
    }

    if (event.eventType === 'pull_request') {
      const installationId = String(payload?.installation?.id ?? '');
      const repoFullName = String(payload?.repository?.full_name ?? '');
      const sha = String(payload?.pull_request?.head?.sha ?? '');
      const branch = String(payload?.pull_request?.head?.ref ?? '') || null;

      if (!installationId || !repoFullName || !sha) {
        throw new Error('github_pr_payload_missing_fields');
      }

      const inst = await this.prisma.gitProviderInstallation.findUnique({
        where: { providerInstallationId: installationId },
      });
      if (!inst) return;

      const link = await this.prisma.repositoryLink.findFirst({
        where: { installationId: inst.id, fullName: repoFullName },
      });
      if (!link) return;

      const env = await this.prisma.environment.findFirst({
        where: { projectId: link.projectId, type: 'preview' },
      });
      if (!env) return;

      await this.deployments.createFromWebhook({
        workspaceId: inst.workspaceId,
        projectId: link.projectId,
        environmentId: env.id,
        commitSha: sha,
        branch,
        triggerSource: 'pull_request',
      });
    }
  }
}
