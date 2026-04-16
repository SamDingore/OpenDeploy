import { Module } from '@nestjs/common';
import { EnvModule } from '../config/env.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CaddyService } from './caddy.service';

@Module({
  imports: [EnvModule, PrismaModule],
  providers: [CaddyService],
  exports: [CaddyService],
})
export class EdgeModule {}
