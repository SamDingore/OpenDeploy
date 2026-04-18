import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_ACCESS_TOKEN = 'https://github.com/login/oauth/access_token';
const GITHUB_API_USER = 'https://api.github.com/user';

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

  async exchangeCode(code: string): Promise<{ accessToken: string; scope: string | null }> {
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
      const msg = body.error_description ?? body.error ?? 'token_exchange_failed';
      throw new InternalServerErrorException(msg);
    }

    return {
      accessToken: body.access_token,
      scope: body.scope ?? null,
    };
  }

  async fetchGithubProfile(accessToken: string): Promise<{ id: number; login: string }> {
    const res = await fetch(GITHUB_API_USER, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) {
      throw new InternalServerErrorException('github_user_fetch_failed');
    }
    const data = (await res.json()) as { id?: number; login?: string };
    if (typeof data.id !== 'number' || typeof data.login !== 'string') {
      throw new InternalServerErrorException('github_user_invalid');
    }
    return { id: data.id, login: data.login };
  }
}
