import type { verifyToken } from '@clerk/backend';

export type ClerkJwtPayload = Awaited<ReturnType<typeof verifyToken>>;

declare global {
  namespace Express {
    interface Request {
      /** Set by {@link ClerkAuthGuard} after a successful `verifyToken`. */
      clerkAuth?: ClerkJwtPayload;
    }
  }
}

export {};
