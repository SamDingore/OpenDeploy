import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EdgeModule } from '../edge/edge.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { CustomDomainsController } from './custom-domains.controller';
import { CustomDomainsService } from './custom-domains.service';

@Module({
  imports: [PrismaModule, AuditModule, QueueModule, EdgeModule],
  controllers: [CustomDomainsController],
  providers: [CustomDomainsService],
  exports: [CustomDomainsService],
})
export class CustomDomainsModule {}
