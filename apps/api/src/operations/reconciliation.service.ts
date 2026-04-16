import { Injectable, Logger } from '@nestjs/common';
import {
  CertificateRecordStatus,
  ReconciliationKind,
  ReconciliationRunStatus,
  ReleaseStatus,
  RuntimeInstanceStatus,
  WorkerStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const HEARTBEAT_STALE_MS = 5 * 60 * 1000;
const STUCK_RELEASE_MS = 2 * 60 * 60 * 1000;
const STUCK_CERT_MS = 45 * 60 * 1000;

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runScheduledRound(): Promise<void> {
    await Promise.all([
      this.runKind(ReconciliationKind.lease, () => this.reconcileLeases()),
      this.runKind(ReconciliationKind.runtime, () => this.reconcileRuntimeVsRelease()),
      this.runKind(ReconciliationKind.node, () => this.reconcileWorkerHeartbeats()),
      this.runKind(ReconciliationKind.domain, () => this.reconcileStuckCertificates()),
      this.runKind(ReconciliationKind.route, () => this.reconcileStuckReleases()),
    ]);
  }

  private async runKind(
    kind: ReconciliationKind,
    fn: () => Promise<{ examined: number; repaired: number; error?: string }>,
  ): Promise<void> {
    const run = await this.prisma.reconciliationRun.create({
      data: { kind, status: ReconciliationRunStatus.running },
    });
    try {
      const { examined, repaired, error } = await fn();
      await this.prisma.reconciliationRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: error
            ? ReconciliationRunStatus.partially_repaired
            : ReconciliationRunStatus.completed,
          itemsExamined: examined,
          itemsRepaired: repaired,
          errorSummary: error ?? null,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error({ kind, err: msg }, 'reconciliation_kind_failed');
      await this.prisma.reconciliationRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: ReconciliationRunStatus.failed,
          errorSummary: msg,
        },
      });
    }
  }

  private async reconcileLeases(): Promise<{ examined: number; repaired: number; error?: string }> {
    const now = new Date();
    const stale = await this.prisma.nodeLease.findMany({
      where: { releasedAt: null, expiresAt: { lt: now } },
    });
    let repaired = 0;
    for (const l of stale) {
      await this.prisma.nodeLease.update({
        where: { id: l.id },
        data: { releasedAt: now },
      });
      repaired += 1;
    }
    return { examined: stale.length, repaired };
  }

  /** Mark runtimes as failed when their release already failed or terminated. */
  private async reconcileRuntimeVsRelease(): Promise<{
    examined: number;
    repaired: number;
    error?: string;
  }> {
    const bad = await this.prisma.runtimeInstance.findMany({
      where: {
        status: { in: [RuntimeInstanceStatus.running, RuntimeInstanceStatus.starting] },
        release: {
          status: { in: [ReleaseStatus.failed, ReleaseStatus.terminated, ReleaseStatus.stopped] },
        },
      },
      select: { id: true },
    });
    let repaired = 0;
    for (const r of bad) {
      await this.prisma.runtimeInstance.update({
        where: { id: r.id },
        data: { status: RuntimeInstanceStatus.failed, stoppedAt: new Date() },
      });
      repaired += 1;
    }
    return { examined: bad.length, repaired };
  }

  private async reconcileWorkerHeartbeats(): Promise<{
    examined: number;
    repaired: number;
    error?: string;
  }> {
    const threshold = new Date(Date.now() - HEARTBEAT_STALE_MS);
    const stale = await this.prisma.workerNode.findMany({
      where: {
        status: WorkerStatus.online,
        OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: threshold } }],
      },
      select: { id: true },
    });
    let repaired = 0;
    for (const w of stale) {
      await this.prisma.workerNode.update({
        where: { id: w.id },
        data: { status: WorkerStatus.offline },
      });
      repaired += 1;
    }
    return { examined: stale.length, repaired };
  }

  private async reconcileStuckCertificates(): Promise<{
    examined: number;
    repaired: number;
    error?: string;
  }> {
    const threshold = new Date(Date.now() - STUCK_CERT_MS);
    const stuck = await this.prisma.certificateRecord.findMany({
      where: {
        status: CertificateRecordStatus.issuing,
        updatedAt: { lt: threshold },
      },
      select: { id: true, customDomainId: true },
    });
    let repaired = 0;
    for (const c of stuck) {
      await this.prisma.certificateRecord.update({
        where: { id: c.id },
        data: {
          status: CertificateRecordStatus.failed,
          failureDetail: 'reconciler:stuck_in_issuing',
        },
      });
      repaired += 1;
    }
    return { examined: stuck.length, repaired };
  }

  private async reconcileStuckReleases(): Promise<{
    examined: number;
    repaired: number;
    error?: string;
  }> {
    const threshold = new Date(Date.now() - STUCK_RELEASE_MS);
    const stuck = await this.prisma.release.findMany({
      where: {
        status: {
          in: [
            ReleaseStatus.provisioning_runtime,
            ReleaseStatus.starting,
            ReleaseStatus.health_checking,
          ],
        },
        updatedAt: { lt: threshold },
      },
      select: { id: true },
    });
    let repaired = 0;
    for (const r of stuck) {
      await this.prisma.release.update({
        where: { id: r.id },
        data: {
          status: ReleaseStatus.failed,
          failureDetail: 'reconciler:stuck_provisioning',
        },
      });
      repaired += 1;
    }
    return { examined: stuck.length, repaired };
  }
}
