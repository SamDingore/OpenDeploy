import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

export type AuthedRequest = Request & {
  clerkUserId?: string;
  userId?: string;
};

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing_bearer_token');
    }
    const token = header.slice('Bearer '.length);
    try {
      const { clerkUserId } = await this.auth.verifyBearer(token);
      const user = await this.auth.syncUser(clerkUserId);
      req.clerkUserId = clerkUserId;
      req.userId = user.id;
      return true;
    } catch {
      throw new UnauthorizedException('invalid_token');
    }
  }
}
