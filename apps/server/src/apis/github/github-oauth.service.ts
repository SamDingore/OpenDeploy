import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';

/** Thrown when GitHub REST returns a non-success status (token revoked, rate limit, etc.). */
export class GithubHttpError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody?: string,
  ) {
    super(`GitHub API returned HTTP ${status}`);
    this.name = 'GithubHttpError';
  }
}

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_ACCESS_TOKEN = 'https://github.com/login/oauth/access_token';

const OAUTH_SCOPES = [
  'read:user',
  'user:email',
  'repo',
  'read:org',
  'workflow',
].join(' ');

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new InternalServerErrorException(`${name} is not configured`);
  }
  return v;
}

function encodeStatePayload(clerkUserId: string, secret: string): string {
  const nonce = randomBytes(16).toString('hex');
  const payload = JSON.stringify({ sub: clerkUserId, n: nonce });
  const payloadBuf = Buffer.from(payload, 'utf8');
  const sig = createHmac('sha256', secret).update(payloadBuf).digest();
  return `${payloadBuf.toString('base64url')}.${sig.toString('base64url')}`;
}

export function verifyOAuthState(
  state: string | undefined,
  secret: string,
): { clerkUserId: string } | null {
  if (!state?.includes('.')) {
    return null;
  }
  const [payloadB64, sigB64] = state.split('.');
  if (!payloadB64 || !sigB64) {
    return null;
  }
  let payloadBuf: Buffer;
  let sigBuf: Buffer;
  try {
    payloadBuf = Buffer.from(payloadB64, 'base64url');
    sigBuf = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }
  const expected = createHmac('sha256', secret).update(payloadBuf).digest();
  if (sigBuf.length !== expected.length || !timingSafeEqual(sigBuf, expected)) {
    return null;
  }
  try {
    const parsed = JSON.parse(payloadBuf.toString('utf8')) as { sub?: string };
    if (!parsed.sub || typeof parsed.sub !== 'string') {
      return null;
    }
    return { clerkUserId: parsed.sub };
  } catch {
    return null;
  }
}

@Injectable()
export class GithubOAuthService {
  private async githubGet<T>(accessToken: string, path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`https://api.github.com${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
    } catch (cause) {
      throw new GithubHttpError(
        0,
        cause instanceof Error ? cause.message : 'network_error',
      );
    }
    if (!res.ok) {
      const responseBody = await res.text().catch(() => '');
      throw new GithubHttpError(res.status, responseBody);
    }
    return (await res.json()) as T;
  }

  getAuthorizeUrl(clerkUserId: string): string {
    const clientId = requireEnv('GITHUB_OAUTH_CLIENT_ID');
    const stateSecret = requireEnv('GITHUB_OAUTH_STATE_SECRET');
    const state = encodeStatePayload(clerkUserId, stateSecret);
    const redirectUri = requireEnv('GITHUB_OAUTH_CALLBACK_URL');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: OAUTH_SCOPES,
      state,
      allow_signup: 'false',
    });
    return `${GITHUB_AUTHORIZE}?${params.toString()}`;
  }

  async exchangeCode(
    code: string,
  ): Promise<{ accessToken: string; scope: string | null }> {
    const clientId = requireEnv('GITHUB_OAUTH_CLIENT_ID');
    const clientSecret = requireEnv('GITHUB_OAUTH_CLIENT_SECRET');
    const redirectUri = requireEnv('GITHUB_OAUTH_CALLBACK_URL');

    const res = await fetch(GITHUB_ACCESS_TOKEN, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const body = (await res.json()) as {
      access_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!res.ok || !body.access_token) {
      const msg =
        body.error_description ?? body.error ?? 'token_exchange_failed';
      throw new InternalServerErrorException(msg);
    }

    return {
      accessToken: body.access_token,
      scope: body.scope ?? null,
    };
  }

  async fetchGithubProfile(
    accessToken: string,
  ): Promise<{ id: number; login: string }> {
    const data = await this.githubGet<{ id?: number; login?: string }>(
      accessToken,
      '/user',
    );
    if (typeof data.id !== 'number' || typeof data.login !== 'string') {
      throw new InternalServerErrorException('github_user_invalid');
    }
    return { id: data.id, login: data.login };
  }

  async fetchGithubOrgs(
    accessToken: string,
  ): Promise<Array<{ id: number; login: string }>> {
    const orgs = await this.githubGet<Array<{ id?: number; login?: string }>>(
      accessToken,
      '/user/orgs',
    );
    return orgs
      .filter((org): org is { id: number; login: string } => {
        return typeof org.id === 'number' && typeof org.login === 'string';
      })
      .sort((a, b) => a.login.localeCompare(b.login));
  }

  async fetchUserRepos(accessToken: string): Promise<
    Array<{
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      html_url: string;
      default_branch: string;
      updated_at: string;
      owner: { login: string };
    }>
  > {
    return this.githubGet(
      accessToken,
      '/user/repos?sort=updated&per_page=100&type=owner',
    );
  }

  async fetchOrganizationRepos(
    accessToken: string,
    orgLogin: string,
  ): Promise<
    Array<{
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      html_url: string;
      default_branch: string;
      updated_at: string;
      owner: { login: string };
    }>
  > {
    const encodedOrg = encodeURIComponent(orgLogin);
    return this.githubGet(
      accessToken,
      `/orgs/${encodedOrg}/repos?sort=updated&per_page=100&type=all`,
    );
  }
}
