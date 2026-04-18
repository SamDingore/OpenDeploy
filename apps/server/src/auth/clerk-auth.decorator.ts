import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ClerkJwtPayload } from './clerk-auth.types';

/**
 * Returns the verified Clerk JWT payload for the request (requires {@link ClerkAuthGuard}).
 */
export const CurrentClerkAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClerkJwtPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.clerkAuth;
  },
);
