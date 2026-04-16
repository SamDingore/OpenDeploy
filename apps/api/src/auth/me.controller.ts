import { Controller, Get, UseGuards } from '@nestjs/common';
import { success } from '@opendeploy/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { CurrentUserId } from './current-user.decorator';

@Controller('me')
@UseGuards(ClerkAuthGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentUserId() userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { include: { workspace: true } },
      },
    });
    return success(user);
  }
}
