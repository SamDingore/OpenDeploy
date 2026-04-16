import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EdgeModule } from '../edge/edge.module';
import { OperationsController } from './operations.controller';
import { CapacityService } from './capacity.service';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationScheduler } from './reconciliation.scheduler';

@Module({
  imports: [ScheduleModule, EdgeModule],
  controllers: [OperationsController],
  providers: [CapacityService, ReconciliationService, ReconciliationScheduler],
  exports: [CapacityService, ReconciliationService],
})
export class OperationsModule {}
