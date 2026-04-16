import { describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));
import { CustomDomainStatus, EdgeConfigApplyStatus } from '@prisma/client';
import { CaddyService } from './caddy.service';
import type { Env } from '../config/env';

function basePrismaMock() {
  return {
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
    edgeNode: { upsert: vi.fn() },
    edgeConfigVersion: {
      aggregate: vi.fn().mockResolvedValue({ _max: { version: null } }),
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn(),
    },
  };
}

describe('CaddyService', () => {
  it('skips admin fetch when CADDY_ADMIN_URL unset', async () => {
    const env = {
      PLATFORM_PUBLIC_DOMAIN: 'deploy.local',
      CADDY_ADMIN_URL: undefined,
      CADDY_ACME_EMAIL: undefined,
      CADDYFILE_PATH: undefined,
      CADDY_ADMIN_UNIX_SOCKET: undefined,
      EDGE_NODE_NAME: undefined,
    } as Env;
    const prisma = basePrismaMock();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const audit = { record: vi.fn() };
    const svc = new CaddyService(env, prisma as never, audit as never);
    await svc.applyFromDatabase();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.edgeConfigVersion.create).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('includes custom-domain routes only for allowed lifecycle states', async () => {
    const env = {
      PLATFORM_PUBLIC_DOMAIN: 'deploy.local',
      CADDY_ADMIN_URL: undefined,
      CADDY_ACME_EMAIL: undefined,
      CADDYFILE_PATH: undefined,
      CADDY_ADMIN_UNIX_SOCKET: undefined,
      EDGE_NODE_NAME: undefined,
    } as Env;
    const prisma = {
      ...basePrismaMock(),
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
    const audit = { record: vi.fn() };
    const svc = new CaddyService(env, prisma as never, audit as never);
    await svc.applyFromDatabase();
    expect(prisma.routeBinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customDomain: { status: { in: expect.arrayContaining([CustomDomainStatus.active]) } },
        }),
      }),
    );
  });

  it('records edge config version when CADDYFILE_PATH is set', async () => {
    const env = {
      PLATFORM_PUBLIC_DOMAIN: 'deploy.local',
      CADDY_ADMIN_URL: undefined,
      CADDY_ACME_EMAIL: undefined,
      CADDYFILE_PATH: '/tmp/x.Caddyfile',
      CADDY_ADMIN_UNIX_SOCKET: undefined,
      EDGE_NODE_NAME: undefined,
    } as Env;
    const prisma = basePrismaMock();
    const audit = { record: vi.fn() };
    const svc = new CaddyService(env, prisma as never, audit as never);
    await svc.applyFromDatabase();
    expect(prisma.edgeConfigVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ applyStatus: EdgeConfigApplyStatus.applied }),
      }),
    );
  });
});
