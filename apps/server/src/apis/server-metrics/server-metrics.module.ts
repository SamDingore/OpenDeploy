import { Module } from '@nestjs/common';
import { ServerMetricsController } from './server-metrics.controller';

@Module({
  controllers: [ServerMetricsController],
})
export class ServerMetricsModule {}
