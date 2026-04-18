import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentClerkAuth } from '../../auth/clerk-auth.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import type { ClerkJwtPayload } from '../../auth/clerk-auth.types';
import { GithubOAuthService, verifyOAuthState } from './github-oauth.service';

function settingsRedirect(query: Record<string, string>): string {
  const base = (process.env.WEB_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
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
      return res.redirect(302, settingsRedirect({ github_error: 'invalid_oauth_state' }));
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
      return res.redirect(302, settingsRedirect({ github_error: 'connect_failed' }));
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
}
