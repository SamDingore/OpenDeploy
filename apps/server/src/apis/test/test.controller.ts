import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentClerkAuth } from '../../auth/clerk-auth.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import type { ClerkJwtPayload } from '../../auth/clerk-auth.types';

@Controller('apis/test')
export class TestController {
  @Get()
  get() {
    return { ok: true };
  }

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  me(@CurrentClerkAuth() auth: ClerkJwtPayload | undefined) {
    return { sub: auth?.sub, sid: auth?.sid };
  }
}
