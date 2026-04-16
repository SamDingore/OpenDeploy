import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ReleaseStatus, RuntimeInstanceStatus } from '@prisma/client';
import { success } from '@opendeploy/shared';
import { InternalSecretGuard } from './internal-secret.guard';
import { ReleasesService } from '../releases/releases.service';

@Controller('internal/releases')
@UseGuards(InternalSecretGuard)
export class InternalReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get(':releaseId/provision-input')
  async provisionInput(@Param('releaseId') releaseId: string) {
    return success(await this.releases.getProvisionInput(releaseId));
  }

  @Patch(':releaseId/status')
  async status(
    @Param('releaseId') releaseId: string,
    @Body() body: { status: ReleaseStatus; failureDetail?: string },
  ) {
    await this.releases.transitionReleaseStatus(releaseId, body.status, body.failureDetail);
    return success({ ok: true });
  }

  @Post(':releaseId/runtime-instances')
  async createRuntime(
    @Param('releaseId') releaseId: string,
    @Body()
    body: {
      containerName: string;
      imageTag: string;
      imageDigest?: string | null;
      internalPort: number;
      upstreamDial: string;
      workerNodeId?: string | null;
      containerIdMasked?: string | null;
    },
  ) {
    const row = await this.releases.createRuntimeInstance({
      releaseId,
      ...body,
    });
    return success({ runtimeInstanceId: row.id });
  }

  @Patch('runtime-instances/:runtimeInstanceId')
  async patchRuntime(
    @Param('runtimeInstanceId') runtimeInstanceId: string,
    @Body()
    body: {
      status?: RuntimeInstanceStatus;
      containerIdMasked?: string;
      startedAt?: string;
      stoppedAt?: string;
      lastHealthStatus?: string;
    },
  ) {
    await this.releases.patchRuntimeInstance(runtimeInstanceId, {
      status: body.status,
      containerIdMasked: body.containerIdMasked,
      startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
      stoppedAt: body.stoppedAt ? new Date(body.stoppedAt) : undefined,
      lastHealthStatus: body.lastHealthStatus,
    });
    return success({ ok: true });
  }

  @Post(':releaseId/logs')
  async log(
    @Param('releaseId') releaseId: string,
    @Body() body: { level: string; message: string },
  ) {
    await this.releases.appendRuntimeLog(releaseId, body.level, body.message);
    return success({ ok: true });
  }

  @Post('runtime-instances/:runtimeInstanceId/health')
  async health(
    @Param('runtimeInstanceId') runtimeInstanceId: string,
    @Body()
    body: {
      checkType: 'http' | 'tcp';
      success: boolean;
      latencyMs?: number;
      detail?: string;
    },
  ) {
    await this.releases.appendHealthResult({
      runtimeInstanceId,
      checkType: body.checkType,
      success: body.success,
      latencyMs: body.latencyMs,
      detail: body.detail,
    });
    return success({ ok: true });
  }

  @Post(':releaseId/complete-provision')
  async complete(
    @Param('releaseId') releaseId: string,
    @Body() body: { runtimeInstanceId: string; platformHostnameId: string },
  ) {
    await this.releases.completeProvisionAfterHealth({
      releaseId,
      runtimeInstanceId: body.runtimeInstanceId,
      platformHostnameId: body.platformHostnameId,
    });
    return success({ ok: true });
  }

  @Get(':releaseId/teardown-plan')
  async teardownPlan(@Param('releaseId') releaseId: string) {
    return success(await this.releases.getTeardownPlan(releaseId));
  }

  @Post(':releaseId/teardown-done')
  async teardownDone(@Param('releaseId') releaseId: string) {
    await this.releases.applyTeardownDone(releaseId);
    return success({ ok: true });
  }
}
