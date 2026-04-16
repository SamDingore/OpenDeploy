import { Inject, Injectable } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import type { Env } from '../config/env';
import { OPENDEPLOY_ENV } from '../config/env.constants';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(OPENDEPLOY_ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  async verifyBearer(token: string): Promise<{ clerkUserId: string }> {
    const payload = await verifyToken(token, { secretKey: this.env.CLERK_SECRET_KEY });
    const sub = payload.sub;
    if (!sub) {
      throw new Error('invalid_token');
    }
    return { clerkUserId: sub };
  }

  async syncUser(clerkUserId: string, email?: string | null) {
    return this.prisma.user.upsert({
      where: { clerkId: clerkUserId },
      update: { email: email ?? undefined },
      create: { clerkId: clerkUserId, email: email ?? undefined },
    });
  }
}
