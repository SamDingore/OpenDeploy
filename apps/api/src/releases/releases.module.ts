import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReleasesService } from './releases.service';
import { ReleasesController } from './releases.controller';
import { CaddyService } from './caddy.service';
import { ReleaseMaintenanceService } from './release-maintenance.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ReleasesController],
  providers: [ReleasesService, CaddyService, ReleaseMaintenanceService],
  exports: [ReleasesService, CaddyService],
})
export class ReleasesModule {}
