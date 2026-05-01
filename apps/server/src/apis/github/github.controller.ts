import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Logger,
  Query,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentClerkAuth } from '../../auth/clerk-auth.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import type { ClerkJwtPayload } from '../../auth/clerk-auth.types';
import {
  GithubHttpError,
  GithubOAuthService,
  verifyOAuthState,
} from './github-oauth.service';

const githubControllerLog = new Logger('GithubController');

function rethrowGithubFailure(
  err: unknown,
  logLabel: string,
  fallbackMessage: string,
): never {
  if (err instanceof GithubHttpError) {
    if (err.status === 401) {
      throw new BadRequestException(
        'GitHub access expired or was revoked. Open Settings and reconnect GitHub.',
      );
    }
    if (err.status === 403) {
      throw new BadRequestException(
        'GitHub denied this request. If you use SSO with an organization, complete SSO on github.com, or reconnect GitHub from Settings.',
      );
    }
    if (err.status === 404) {
      throw new BadRequestException(
        'That GitHub user or organization was not found.',
      );
    }
    if (err.status === 429) {
      throw new ServiceUnavailableException(
        'GitHub rate limit exceeded. Try again in a few minutes.',
      );
    }
    if (err.status === 0) {
      throw new ServiceUnavailableException(
        'Could not reach GitHub. Check your network and try again.',
      );
    }
    githubControllerLog.warn(
      `${logLabel}: GitHub HTTP ${err.status} ${(err.responseBody ?? '').slice(0, 400)}`,
    );
    throw new ServiceUnavailableException(
      'GitHub returned an error. Try again or reconnect GitHub from Settings.',
    );
  }
  if (err instanceof HttpException) {
    throw err;
  }
  githubControllerLog.error(err, logLabel);
  throw new ServiceUnavailableException(fallbackMessage);
}

function settingsRedirect(query: Record<string, string>): string {
  const base = (process.env.WEB_APP_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
  const q = new URLSearchParams({ tab: 'connections', ...query });
  return `${base}/settings?${q.toString()}`;
}

@Controller('apis/github')
export class GithubController {
  constructor(
    private readonly oauth: GithubOAuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('oauth/start')
  @UseGuards(ClerkAuthGuard)
  start(@CurrentClerkAuth() auth: ClerkJwtPayload | undefined) {
    const sub = auth?.sub;
    if (!sub) {
      throw new UnauthorizedException('Missing Clerk subject');
    }
    return { authorizeUrl: this.oauth.getAuthorizeUrl(sub) };
  }

  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ) {
    if (oauthError) {
      const msg = errorDescription ?? oauthError;
      return res.redirect(302, settingsRedirect({ github_error: msg }));
    }

    const stateSecret = process.env.GITHUB_OAUTH_STATE_SECRET?.trim();
    if (!stateSecret) {
      return res.redirect(
        302,
        settingsRedirect({ github_error: 'server_misconfigured_state_secret' }),
      );
    }

    const verified = verifyOAuthState(state, stateSecret);
    if (!verified || !code) {
      return res.redirect(
        302,
        settingsRedirect({ github_error: 'invalid_oauth_state' }),
      );
    }

    try {
      const { accessToken, scope } = await this.oauth.exchangeCode(code);
      const profile = await this.oauth.fetchGithubProfile(accessToken);

      await this.prisma.githubConnection.upsert({
        where: { clerkUserId: verified.clerkUserId },
        create: {
          clerkUserId: verified.clerkUserId,
          githubId: profile.id,
          githubLogin: profile.login,
          accessToken,
          scope,
        },
        update: {
          githubId: profile.id,
          githubLogin: profile.login,
          accessToken,
          scope,
        },
      });

      return res.redirect(302, settingsRedirect({ github: 'connected' }));
    } catch {
      return res.redirect(
        302,
        settingsRedirect({ github_error: 'connect_failed' }),
      );
    }
  }

  @Get('status')
  @UseGuards(ClerkAuthGuard)
  async status(@CurrentClerkAuth() auth: ClerkJwtPayload | undefined) {
    const sub = auth?.sub;
    if (!sub) {
      return { connected: false as const };
    }
    const row = await this.prisma.githubConnection.findUnique({
      where: { clerkUserId: sub },
      select: { githubLogin: true },
    });
    if (!row) {
      return { connected: false as const };
    }
    return { connected: true as const, githubLogin: row.githubLogin };
  }

  @Get('accounts')
  @UseGuards(ClerkAuthGuard)
  async accounts(@CurrentClerkAuth() auth: ClerkJwtPayload | undefined) {
    const sub = auth?.sub;
    if (!sub) {
      throw new UnauthorizedException('Missing Clerk subject');
    }
    const conn = await this.prisma.githubConnection.findUnique({
      where: { clerkUserId: sub },
      select: { accessToken: true, githubLogin: true },
    });
    if (!conn) {
      throw new BadRequestException('GitHub is not connected');
    }

    try {
      const [user, orgs] = await Promise.all([
        this.oauth.fetchGithubProfile(conn.accessToken),
        this.oauth.fetchGithubOrgs(conn.accessToken),
      ]);

      return {
        accounts: [
          {
            id: `user:${user.login}`,
            login: user.login,
            type: 'personal' as const,
          },
          ...orgs.map((org) => ({
            id: `org:${org.login}`,
            login: org.login,
            type: 'organization' as const,
          })),
        ],
      };
    } catch (err: unknown) {
      rethrowGithubFailure(
        err,
        'accounts',
        'Unable to load GitHub accounts',
      );
    }
  }

  @Get('repos')
  @UseGuards(ClerkAuthGuard)
  async repos(
    @CurrentClerkAuth() auth: ClerkJwtPayload | undefined,
    @Query('owner') ownerLogin: string | undefined,
  ) {
    const sub = auth?.sub;
    if (!sub) {
      throw new UnauthorizedException('Missing Clerk subject');
    }
    const owner = ownerLogin?.trim();
    if (!owner) {
      throw new BadRequestException('Missing owner query param');
    }
    const conn = await this.prisma.githubConnection.findUnique({
      where: { clerkUserId: sub },
      select: { accessToken: true, githubLogin: true },
    });
    if (!conn) {
      throw new BadRequestException('GitHub is not connected');
    }

    try {
      const repos =
        conn.githubLogin === owner
          ? await this.oauth.fetchUserRepos(conn.accessToken)
          : await this.oauth.fetchOrganizationRepos(conn.accessToken, owner);

      return {
        repos: repos.map((repo) => ({
          id: String(repo.id),
          name: repo.name,
          fullName: repo.full_name,
          ownerLogin: repo.owner.login,
          defaultBranch: repo.default_branch,
          isPrivate: repo.private,
          htmlUrl: repo.html_url,
          updatedAt: repo.updated_at,
        })),
      };
    } catch (err: unknown) {
      rethrowGithubFailure(
        err,
        'repos',
        'Unable to load repositories',
      );
    }
  }
}
