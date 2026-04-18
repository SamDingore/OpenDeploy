import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';
import './clerk-auth.types';

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.trim()) {
    return null;
  }
  const match = /^Bearer\s+(\S+)/i.exec(header.trim());
  return match?.[1] ?? null;
}

function parseAuthorizedParties(): string[] | undefined {
  const raw = process.env.CLERK_AUTHORIZED_PARTIES?.trim();
  if (!raw) {
    return undefined;
  }
  const parties = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parties.length ? parties : undefined;
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const secretKey = process.env.CLERK_SECRET_KEY?.trim();
    const jwtKey = process.env.CLERK_JWT_KEY?.trim();

    if (!secretKey && !jwtKey) {
      throw new InternalServerErrorException(
        'Clerk is not configured: set CLERK_SECRET_KEY or CLERK_JWT_KEY',
      );
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: secretKey || undefined,
        jwtKey: jwtKey || undefined,
        authorizedParties: parseAuthorizedParties(),
      });
      request.clerkAuth = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session token');
    }
  }
}
