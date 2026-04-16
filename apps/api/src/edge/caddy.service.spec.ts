import { describe, expect, it, vi } from 'vitest';
import { CustomDomainStatus } from '@prisma/client';
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
        findMany: vi
          .fn()
          .mockImplementation((args: { where?: { platformHostnameId?: unknown } }) => {
            if (args?.where?.platformHostnameId === null) {
              return Promise.resolve([]);
            }
            return Promise.resolve([
              {
                platformHostname: { hostname: 'a.deploy.local' },
                runtimeInstance: { upstreamDial: 'ctr:3000' },
              },
            ]);
          }),
      },
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const svc = new CaddyService(env, prisma as never);
    await svc.applyFromDatabase();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('includes custom-domain routes only for allowed lifecycle states', async () => {
    const env = {
      PLATFORM_PUBLIC_DOMAIN: 'deploy.local',
      CADDY_ADMIN_URL: undefined,
      CADDY_ACME_EMAIL: undefined,
      CADDYFILE_PATH: undefined,
    } as Env;
    const prisma = {
      routeBinding: {
        findMany: vi.fn().mockImplementation((args: { where?: { platformHostnameId?: unknown } }) => {
          if (args?.where?.platformHostnameId === null) {
            return Promise.resolve([
              {
                runtimeInstance: { upstreamDial: 'c1:3000' },
                customDomain: { hostname: 'app.customer.com' },
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
    };
    const svc = new CaddyService(env, prisma as never);
    await svc.applyFromDatabase();
    expect(prisma.routeBinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customDomain: { status: { in: expect.arrayContaining([CustomDomainStatus.active]) } },
        }),
      }),
    );
  });
});
