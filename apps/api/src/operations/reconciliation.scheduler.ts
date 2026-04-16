import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReconciliationService } from './reconciliation.service';

@Injectable()
export class ReconciliationScheduler {
  private readonly logger = new Logger(ReconciliationScheduler.name);

  constructor(private readonly reconciliation: ReconciliationService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick(): Promise<void> {
    if (process.env['ENABLE_RECONCILER'] === 'false') {
      return;
    }
    this.logger.debug('reconciliation_round_start');
    await this.reconciliation.runScheduledRound();
  }
}
