import { Worker } from 'bullmq';
import type IORedis from 'ioredis';
import {
  RELEASE_QUEUE_NAME,
  RELEASE_TEARDOWN_QUEUE_NAME,
  type ReleaseJobPayload,
  type ReleaseTeardownPayload,
  ReleaseStatus,
} from '@opendeploy/shared';
import { spawn } from 'node:child_process';

async function patchReleaseStatus(
  api: string,
  secret: string,
  releaseId: string,
  status: ReleaseStatus,
  failureDetail?: string,
): Promise<void> {
  const res = await fetch(`${api}/internal/releases/${releaseId}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
    body: JSON.stringify({ status, failureDetail }),
  });
  if (!res.ok) {
    throw new Error(`release_status_failed:${await res.text()}`);
  }
}

async function spawnExit(cmd: string, args: string[], timeoutMs: number): Promise<number> {
  const child = spawn(cmd, args, { stdio: 'pipe', windowsHide: true });
  const t = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  const code = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (c) => resolve(c ?? 1));
  }).finally(() => clearTimeout(t));
  return code;
}

async function runDockerRun(input: {
  name: string;
  network: string;
  image: string;
  env: Record<string, string>;
  memory: string;
  cpus: string;
}): Promise<number> {
  const args = [
    'run',
    '-d',
    '--name',
    input.name,
    '--network',
    input.network,
    '-m',
    input.memory,
    '--cpus',
    input.cpus,
    '--restart',
    'no',
  ];
  for (const [k, v] of Object.entries(input.env)) {
    args.push('-e', `${k}=${v}`);
  }
  args.push(input.image);
  return spawnExit('docker', args, 120_000);
}

async function dockerRm(name: string): Promise<void> {
  await spawnExit('docker', ['rm', '-f', name], 60_000);
}

async function dockerInspectId(name: string): Promise<string> {
  const child = spawn('docker', ['inspect', '-f', '{{.Id}}', name], { windowsHide: true });
  let out = '';
  child.stdout?.on('data', (b) => (out += b.toString()));
  const code = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (c) => resolve(c ?? 1));
  });
  if (code !== 0) return '';
  return out.trim();
}

function maskContainerId(id: string): string {
  if (id.length <= 12) return '***';
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

async function httpHealthViaSidecar(input: {
  network: string;
  host: string;
  port: number;
  path: string;
  timeoutMs: number;
}): Promise<{ ok: boolean; detail: string; latencyMs: number }> {
  const url = `http://${input.host}:${input.port}${input.path.startsWith('/') ? input.path : `/${input.path}`}`;
  const started = Date.now();
  const code = await spawnExit(
    'docker',
    [
      'run',
      '--rm',
      '--network',
      input.network,
      'curlimages/curl:8.5.0',
      '-sf',
      '--max-time',
      String(Math.ceil(input.timeoutMs / 1000)),
      url,
    ],
    input.timeoutMs + 5000,
  );
  const latencyMs = Date.now() - started;
  return { ok: code === 0, detail: `curl_exit_${code}`, latencyMs };
}

async function tcpHealthViaSidecar(input: {
  network: string;
  host: string;
  port: number;
  timeoutMs: number;
}): Promise<{ ok: boolean; detail: string; latencyMs: number }> {
  const started = Date.now();
  const code = await spawnExit(
    'docker',
    [
      'run',
      '--rm',
      '--network',
      input.network,
      'busybox:1.36',
      'nc',
      '-z',
      '-w',
      String(Math.ceil(input.timeoutMs / 1000)),
      input.host,
      String(input.port),
    ],
    input.timeoutMs + 5000,
  );
  const latencyMs = Date.now() - started;
  return { ok: code === 0, detail: `nc_exit_${code}`, latencyMs };
}

export function registerRuntimeWorkers(redis: IORedis, apiBase: string, secret: string, workerId: string): void {
  const api = apiBase.replace(/\/$/, '');

  const provisionWorker = new Worker(
    RELEASE_QUEUE_NAME,
    async (job) => {
      const data = job.data as ReleaseJobPayload;
      if (data.kind !== 'provision') return;
      const releaseId = data.releaseId;

      await patchReleaseStatus(api, secret, releaseId, ReleaseStatus.provisioning_runtime);

      const inputRes = await fetch(`${api}/internal/releases/${releaseId}/provision-input`, {
        headers: { 'x-internal-secret': secret },
      });
      const envelope = (await inputRes.json()) as {
        ok?: boolean;
        data?: { ok?: boolean; error?: string } & Record<string, unknown>;
      };
      const inner = envelope.data;
      if (!envelope.ok || !inner || inner.ok === false) {
        await patchReleaseStatus(
          api,
          secret,
          releaseId,
          ReleaseStatus.failed,
          'provision_input_failed',
        );
        return;
      }
      const p = inner as {
        containerName: string;
        dockerNetwork: string;
        imageTag: string;
        internalPort: number;
        upstreamDial: string;
        platformHostnameId: string;
        memoryLimit: string;
        cpus: string;
        healthCheck: { type: string; path?: string; port?: number; startupTimeoutMs: number; steadyIntervalMs?: number };
        env: Record<string, string>;
      };

      await patchReleaseStatus(api, secret, releaseId, ReleaseStatus.starting);
      await dockerRm(p.containerName).catch(() => {});

      const runCode = await runDockerRun({
        name: p.containerName,
        network: p.dockerNetwork,
        image: p.imageTag,
        env: p.env,
        memory: p.memoryLimit,
        cpus: p.cpus,
      });
      if (runCode !== 0) {
        await patchReleaseStatus(api, secret, releaseId, ReleaseStatus.failed, 'docker_run_failed');
        return;
      }

      await new Promise((r) => setTimeout(r, 2500));

      const fullId = await dockerInspectId(p.containerName);
      const masked = maskContainerId(fullId);

      const createRes = await fetch(`${api}/internal/releases/${releaseId}/runtime-instances`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify({
          containerName: p.containerName,
          imageTag: p.imageTag,
          internalPort: p.internalPort,
          upstreamDial: p.upstreamDial,
          workerNodeId: workerId,
          containerIdMasked: masked || null,
        }),
      });
      if (!createRes.ok) {
        await patchReleaseStatus(api, secret, releaseId, ReleaseStatus.failed, 'runtime_row_failed');
        return;
      }
      const created = (await createRes.json()) as {
        ok?: boolean;
        data?: { runtimeInstanceId?: string };
      };
      const runtimeInstanceId = created.ok ? created.data?.runtimeInstanceId : undefined;
      if (!runtimeInstanceId) {
        await patchReleaseStatus(api, secret, releaseId, ReleaseStatus.failed, 'runtime_id_missing');
        return;
      }

      await fetch(`${api}/internal/releases/runtime-instances/${runtimeInstanceId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify({
          status: 'running',
          startedAt: new Date().toISOString(),
          containerIdMasked: masked || undefined,
        }),
      });

      await patchReleaseStatus(api, secret, releaseId, ReleaseStatus.health_checking);

      const hc = p.healthCheck;
      const checkPort = hc.port ?? p.internalPort;
      const deadline = Date.now() + (hc.startupTimeoutMs ?? 120_000);
      let healthy = false;
      while (Date.now() < deadline) {
        const r =
          hc.type === 'tcp'
            ? await tcpHealthViaSidecar({
                network: p.dockerNetwork,
                host: p.containerName,
                port: checkPort,
                timeoutMs: 5000,
              })
            : await httpHealthViaSidecar({
                network: p.dockerNetwork,
                host: p.containerName,
                port: checkPort,
                path: hc.path ?? '/',
                timeoutMs: 5000,
              });

        await fetch(`${api}/internal/releases/runtime-instances/${runtimeInstanceId}/health`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
          body: JSON.stringify({
            checkType: hc.type === 'tcp' ? 'tcp' : 'http',
            success: r.ok,
            latencyMs: r.latencyMs,
            detail: r.detail,
          }),
        });

        if (r.ok) {
          healthy = true;
          break;
        }
        await new Promise((res) => setTimeout(res, hc.steadyIntervalMs ?? 2000));
      }

      if (!healthy) {
        await fetch(`${api}/internal/releases/runtime-instances/${runtimeInstanceId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
          body: JSON.stringify({ status: 'failed' }),
        });
        await patchReleaseStatus(api, secret, releaseId, ReleaseStatus.failed, 'health_check_timeout');
        return;
      }

      const completeRes = await fetch(`${api}/internal/releases/${releaseId}/complete-provision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify({
          runtimeInstanceId,
          platformHostnameId: p.platformHostnameId,
        }),
      });
      if (!completeRes.ok) {
        const t = await completeRes.text();
        throw new Error(`complete_provision_failed:${completeRes.status}:${t}`);
      }
    },
    { connection: redis, concurrency: 2 },
  );

  provisionWorker.on('failed', (job, err) => {
    console.error('release_job_failed', job?.id, err);
  });

  const teardownWorker = new Worker(
    RELEASE_TEARDOWN_QUEUE_NAME,
    async (job) => {
      const data = job.data as ReleaseTeardownPayload;
      const planRes = await fetch(`${api}/internal/releases/${data.releaseId}/teardown-plan`, {
        headers: { 'x-internal-secret': secret },
      });
      const planBody = (await planRes.json()) as {
        ok?: boolean;
        data?: { containerNames?: string[] };
      };
      const names = planBody.ok ? (planBody.data?.containerNames ?? []) : [];
      for (const n of names) {
        await dockerRm(n).catch(() => {});
      }
      const done = await fetch(`${api}/internal/releases/${data.releaseId}/teardown-done`, {
        method: 'POST',
        headers: { 'x-internal-secret': secret },
      });
      if (!done.ok) {
        throw new Error(`teardown_done_failed:${await done.text()}`);
      }
    },
    { connection: redis, concurrency: 3 },
  );

  teardownWorker.on('failed', (job, err) => {
    console.error('teardown_failed', job?.id, err);
  });

  console.info('runtime_workers_online', {
    provision: RELEASE_QUEUE_NAME,
    teardown: RELEASE_TEARDOWN_QUEUE_NAME,
  });
}
