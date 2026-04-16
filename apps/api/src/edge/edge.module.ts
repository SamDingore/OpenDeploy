import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EnvModule } from '../config/env.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CaddyService } from './caddy.service';

@Module({
  imports: [EnvModule, PrismaModule, AuditModule],
  providers: [CaddyService],
  exports: [CaddyService],
})
export class EdgeModule {}
