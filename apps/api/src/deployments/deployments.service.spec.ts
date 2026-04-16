import { describe, expect, it, vi } from 'vitest';
import { DeploymentStatus } from '@opendeploy/shared';
import { AuditService } from '../audit/audit.service';
import { DeploymentQueueService } from '../queue/deployment-queue.service';
import { DeploymentsService } from './deployments.service';

describe('DeploymentsService', () => {
  it('creates deployment, audits, enqueues, and transitions to queued', async () => {
    const project = {
      id: 'p1',
      workspaceId: 'w1',
      environments: [{ id: 'e1', slug: 'preview' }],
    };
    const prisma = {
      project: {
        findFirst: vi.fn().mockResolvedValue(project),
      },
      repositoryLink: {
        findUnique: vi.fn().mockResolvedValue({
          fullName: 'acme/app',
          defaultBranch: 'main',
          installation: { providerInstallationId: 'inst_1' },
        }),
      },
      deployment: {
        create: vi.fn().mockResolvedValue({
          id: 'd1',
          workspaceId: 'w1',
          projectId: 'p1',
          environmentId: 'e1',
          status: DeploymentStatus.created,
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'd1',
          workspaceId: 'w1',
          status: DeploymentStatus.created,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      deploymentAttempt: {
        create: vi.fn().mockResolvedValue({ id: 'a1' }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const queue = { enqueue: vi.fn() };
    const audit = { record: vi.fn() };
    const events = { emit: vi.fn() };
    const github = { resolveCommitSha: vi.fn().mockResolvedValue({ sha: 'deadbeef' }) };
    const releases = { onBuildSucceeded: vi.fn().mockResolvedValue(undefined) };

    const svc = new DeploymentsService(
      prisma as never,
      queue as never,
      audit as never,
      events as never,
      github as never,
      releases as never,
    );

    await svc.create({
      workspaceId: 'w1',
      projectId: 'p1',
      environmentId: 'e1',
      actorUserId: 'u1',
    });

    expect(prisma.deployment.create).toHaveBeenCalled();
    expect(queue.enqueue).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();
    expect(prisma.deployment.update).toHaveBeenCalled();
  });
});
