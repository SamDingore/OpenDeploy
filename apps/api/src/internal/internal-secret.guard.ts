import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Env } from '../config/env';
import { OPENDEPLOY_ENV } from '../config/env.constants';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(@Inject(OPENDEPLOY_ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const secret = req.headers['x-internal-secret'];
    if (!secret || secret !== this.env.INTERNAL_API_SECRET) {
      throw new UnauthorizedException('invalid_internal_secret');
    }
    return true;
  }
}
