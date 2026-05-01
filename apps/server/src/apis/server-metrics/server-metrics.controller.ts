import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import {
  buildSystemSnapshot,
  sampleCpuPercent,
  sampleDiskUsage,
} from './system-snapshot.util';

const TICK_MS = 2000;
const KEEPALIVE_MS = 15000;

@Controller('apis/server-metrics')
export class ServerMetricsController {
  @Get('stream')
  @UseGuards(ClerkAuthGuard)
  async stream(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const writeSnapshot = async () => {
      const cpuPercent = sampleCpuPercent();
      const disk = await sampleDiskUsage();
      const payload = buildSystemSnapshot(cpuPercent, disk);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    void writeSnapshot();
    const tick = setInterval(() => {
      void writeSnapshot();
    }, TICK_MS);

    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, KEEPALIVE_MS);

    req.on('close', () => {
      clearInterval(tick);
      clearInterval(keepAlive);
      res.end();
    });
  }
}
