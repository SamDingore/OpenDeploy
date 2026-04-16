import { Inject, Injectable, Logger } from '@nestjs/common';
import { buildCaddyfile } from '@opendeploy/shared';
import { writeFile } from 'node:fs/promises';
import type { Env } from '../config/env';
import { OPENDEPLOY_ENV } from '../config/env.constants';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CaddyService {
  private readonly logger = new Logger(CaddyService.name);

  constructor(
    @Inject(OPENDEPLOY_ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  async applyFromDatabase(): Promise<void> {
    const bindings = await this.prisma.routeBinding.findMany({
      where: { status: 'attached' },
      include: {
        platformHostname: true,
        runtimeInstance: true,
      },
    });
    const routes = bindings.map((b) => ({
      host: b.platformHostname.hostname,
      upstreamDial: b.runtimeInstance.upstreamDial,
    }));
    const body = buildCaddyfile({
      routes,
      email: this.env.CADDY_ACME_EMAIL,
    });

    if (this.env.CADDYFILE_PATH) {
      await writeFile(this.env.CADDYFILE_PATH, `${body}\n`, 'utf8');
      this.logger.log({ path: this.env.CADDYFILE_PATH }, 'caddyfile_written');
    }

    const admin = this.env.CADDY_ADMIN_URL;
    if (!admin) {
      this.logger.warn('CADDY_ADMIN_URL unset; edge config not hot-reloaded');
      return;
    }

    const url = `${admin.replace(/\/$/, '')}/load`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/caddyfile' },
      body,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`caddy_reload_failed:${res.status}:${t}`);
    }
    this.logger.log({ routeCount: routes.length }, 'caddy_reload_ok');
  }
}
