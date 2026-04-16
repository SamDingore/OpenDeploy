import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CustomDomainsModule } from '../custom-domains/custom-domains.module';
import { EdgeModule } from '../edge/edge.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReleasesService } from './releases.service';
import { ReleasesController } from './releases.controller';
import { ReleaseMaintenanceService } from './release-maintenance.service';

@Module({
  imports: [PrismaModule, AuditModule, EdgeModule, CustomDomainsModule],
  controllers: [ReleasesController],
  providers: [ReleasesService, ReleaseMaintenanceService],
  exports: [ReleasesService, EdgeModule],
})
export class ReleasesModule {}
