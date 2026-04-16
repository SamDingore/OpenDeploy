import { describe, expect, it, vi } from 'vitest';
import { CaddyService } from './caddy.service';
import type { Env } from '../config/env';

describe('CaddyService', () => {
  it('skips admin fetch when CADDY_ADMIN_URL unset', async () => {
    const env = {
      PLATFORM_PUBLIC_DOMAIN: 'deploy.local',
      CADDY_ADMIN_URL: undefined,
      CADDY_ACME_EMAIL: undefined,
      CADDYFILE_PATH: undefined,
    } as Env;
    const prisma = {
      routeBinding: {
        findMany: vi.fn().mockResolvedValue([
          {
            platformHostname: { hostname: 'a.deploy.local' },
            runtimeInstance: { upstreamDial: 'ctr:3000' },
          },
        ]),
      },
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const svc = new CaddyService(env, prisma as never);
    await svc.applyFromDatabase();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
