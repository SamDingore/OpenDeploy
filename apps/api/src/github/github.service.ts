import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import type { Env } from '../config/env';
import { OPENDEPLOY_ENV } from '../config/env.constants';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { importPKCS8, SignJWT } from 'jose';

@Injectable()
export class GithubService {
  constructor(
    @Inject(OPENDEPLOY_ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private requireAppConfig(): { appId: string; privateKeyPem: string } {
    const appId = this.env.GITHUB_APP_ID;
    const privateKeyPem = this.env.GITHUB_APP_PRIVATE_KEY;
    if (!appId || !privateKeyPem) {
      throw new BadRequestException('github_app_not_configured');
    }
    // Support envs that store PEM with literal "\n"
    const normalizedKey = privateKeyPem.includes('\\n')
      ? privateKeyPem.replace(/\\n/g, '\n')
      : privateKeyPem;
    return { appId, privateKeyPem: normalizedKey };
  }

  private async createAppJwt(): Promise<string> {
    const { appId, privateKeyPem } = this.requireAppConfig();
    const key = await importPKCS8(privateKeyPem, 'RS256');
    const now = Math.floor(Date.now() / 1000);
    return await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + 60) // short-lived
      .setIssuer(appId)
      .sign(key);
  }

  async createInstallationAccessToken(providerInstallationId: string): Promise<{
    token: string;
    expiresAt: string;
  }> {
    const jwt = await this.createAppJwt();
    const res = await fetch(
      `https://api.github.com/app/installations/${encodeURIComponent(providerInstallationId)}/access_tokens`,
      {
        method: 'POST',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${jwt}`,
          'x-github-api-version': '2022-11-28',
        },
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(`github_installation_token_failed:${res.status}:${text}`);
    }
    const j = (await res.json()) as { token?: string; expires_at?: string };
    if (!j.token || !j.expires_at) {
      throw new BadRequestException('github_installation_token_malformed');
    }
    return { token: j.token, expiresAt: j.expires_at };
  }

  async listAppInstallations(): Promise<
    { providerInstallationId: string; accountLogin: string | null; accountType: string | null }[]
  > {
    const jwt = await this.createAppJwt();
    const res = await fetch('https://api.github.com/app/installations?per_page=100', {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${jwt}`,
        'x-github-api-version': '2022-11-28',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(`github_installations_list_failed:${res.status}:${text}`);
    }
    const rows = (await res.json()) as Array<{
      id: number;
      account?: { login?: string; type?: string } | null;
    }>;
    return rows.map((r) => ({
      providerInstallationId: String(r.id),
      accountLogin: r.account?.login ?? null,
      accountType: r.account?.type ?? null,
    }));
  }

  async listInstallationRepositories(input: { providerInstallationId: string }): Promise<
    { providerRepoId: string; fullName: string; defaultBranch: string | null; private: boolean }[]
  > {
    const { token } = await this.createInstallationAccessToken(input.providerInstallationId);
    const res = await fetch('https://api.github.com/installation/repositories?per_page=100', {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `token ${token}`,
        'x-github-api-version': '2022-11-28',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(`github_installation_repos_failed:${res.status}:${text}`);
    }
    const j = (await res.json()) as {
      repositories?: Array<{
        id: number;
        full_name?: string;
        default_branch?: string;
        private?: boolean;
      }>;
    };
    return (j.repositories ?? [])
      .filter((r) => Boolean(r.full_name))
      .map((r) => ({
        providerRepoId: String(r.id),
        fullName: String(r.full_name),
        defaultBranch: r.default_branch ?? null,
        private: Boolean(r.private),
      }));
  }

  getInstallUrl(workspaceId: string): string {
    const clientId = this.env.GITHUB_APP_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('github_app_not_configured');
    }
    const state = Buffer.from(JSON.stringify({ workspaceId }), 'utf8').toString('base64url');
    const params = new URLSearchParams({
      client_id: clientId,
      state,
    });
    return `https://github.com/apps/${this.env.GITHUB_APP_SLUG ?? 'YOUR_APP'}/installations/new?${params.toString()}`;
  }

  async linkInstallation(input: {
    workspaceId: string;
    actorUserId: string;
    providerInstallationId: string;
    accountLogin?: string | null;
  }) {
    const row = await this.prisma.gitProviderInstallation.upsert({
      where: { providerInstallationId: input.providerInstallationId },
      update: {
        workspaceId: input.workspaceId,
        accountLogin: input.accountLogin,
      },
      create: {
        workspaceId: input.workspaceId,
        providerInstallationId: input.providerInstallationId,
        accountLogin: input.accountLogin,
      },
    });
    await this.audit.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'github.installation.linked',
      resource: 'git_installation',
      resourceId: row.id,
    });
    return row;
  }

  async linkProjectRepository(input: {
    workspaceId: string;
    projectId: string;
    actorUserId: string;
    providerInstallationId: string;
    providerRepoId: string;
    fullName: string;
    defaultBranch?: string | null;
  }) {
    const project = await this.prisma.project.findFirst({
      where: { id: input.projectId, workspaceId: input.workspaceId },
      select: { id: true },
    });
    if (!project) {
      throw new BadRequestException('project_not_found');
    }

    const installation = await this.prisma.gitProviderInstallation.findUnique({
      where: { providerInstallationId: input.providerInstallationId },
      select: { id: true, workspaceId: true },
    });
    if (!installation || installation.workspaceId !== input.workspaceId) {
      throw new BadRequestException('installation_not_linked_to_workspace');
    }

    const row = await this.prisma.repositoryLink.upsert({
      where: { projectId: input.projectId },
      update: {
        installationId: installation.id,
        providerRepoId: input.providerRepoId,
        fullName: input.fullName,
        defaultBranch: input.defaultBranch ?? null,
      },
      create: {
        projectId: input.projectId,
        installationId: installation.id,
        providerRepoId: input.providerRepoId,
        fullName: input.fullName,
        defaultBranch: input.defaultBranch ?? null,
      },
    });

    await this.audit.record({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: 'github.repository.linked',
      resource: 'repository_link',
      resourceId: row.id,
      metadata: { projectId: input.projectId, fullName: input.fullName },
    });
    return row;
  }

  async resolveCommitSha(input: {
    repoFullName: string; // owner/name
    ref: string; // branch, tag, or sha
    providerInstallationId: string;
  }): Promise<{ sha: string }> {
    const { token } = await this.createInstallationAccessToken(input.providerInstallationId);
    const res = await fetch(
      `https://api.github.com/repos/${input.repoFullName}/commits/${encodeURIComponent(input.ref)}`,
      {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `token ${token}`,
          'x-github-api-version': '2022-11-28',
        },
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(`github_resolve_sha_failed:${res.status}:${text}`);
    }
    const j = (await res.json()) as { sha?: string };
    if (!j.sha) {
      throw new BadRequestException('github_resolve_sha_malformed');
    }
    return { sha: j.sha };
  }
}
