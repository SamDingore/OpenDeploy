import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import {
  DEPLOYMENT_QUEUE_NAME,
  type DeploymentJobPayload,
  BuildFailureCode,
  DeploymentStatus,
  isRetryableBuildFailure,
} from '@opendeploy/shared';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { registerRuntimeWorkers } from './runtime-worker';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env ${name}`);
  }
  return v;
}

function maskSecrets(input: string, secrets: string[]): string {
  let out = input;
  for (const s of secrets) {
    if (!s) continue;
    out = out.split(s).join('***');
  }
  return out;
}

async function register(api: string, secret: string, name: string): Promise<string> {
  const res = await fetch(`${api}/internal/workers/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
    body: JSON.stringify({ name }),
  });
  const j = (await res.json()) as { ok?: boolean; data?: { workerId: string } };
  if (!j.ok || !j.data?.workerId) {
    throw new Error('worker_register_failed');
  }
  return j.data.workerId;
}

async function getBuildInput(
  api: string,
  secret: string,
  deploymentId: string,
): Promise<
  | {
      ok: true;
      commitSha: string;
      repoFullName: string;
      providerInstallationId: string;
      defaultBranch: string | null;
    }
  | { ok: false; error: string }
> {
  const res = await fetch(`${api}/internal/deployments/${deploymentId}/build-input`, {
    headers: { 'x-internal-secret': secret },
  });
  const j = (await res.json()) as { ok?: boolean; data?: any };
  if (!j.ok) {
    return { ok: false, error: 'build_input_failed' };
  }
  if (j.data?.ok === false) {
    return { ok: false, error: String(j.data.error ?? 'unknown') };
  }
  return {
    ok: true,
    commitSha: String(j.data.commitSha),
    repoFullName: String(j.data.repoFullName),
    providerInstallationId: String(j.data.providerInstallationId),
    defaultBranch: (j.data.defaultBranch ?? null) as string | null,
  };
}

async function getInstallationToken(
  api: string,
  secret: string,
  providerInstallationId: string,
): Promise<{ token: string; expiresAt: string }> {
  const res = await fetch(
    `${api}/internal/github/installations/${encodeURIComponent(providerInstallationId)}/token`,
    { method: 'POST', headers: { 'x-internal-secret': secret } },
  );
  const j = (await res.json()) as { ok?: boolean; data?: { token?: string; expiresAt?: string } };
  if (!j.ok || !j.data?.token || !j.data.expiresAt) {
    throw new Error('installation_token_failed');
  }
  return { token: j.data.token, expiresAt: j.data.expiresAt };
}

async function assignWorker(
  api: string,
  secret: string,
  deploymentId: string,
  attemptId: string,
  workerId: string,
): Promise<void> {
  const res = await fetch(
    `${api}/internal/deployments/${deploymentId}/attempt/${attemptId}/assign-worker`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({ workerId }),
    },
  );
  if (!res.ok) {
    throw new Error('assign_worker_failed');
  }
}

async function patchStatus(
  api: string,
  secret: string,
  deploymentId: string,
  body: {
    status: DeploymentStatus;
    failureCode?: BuildFailureCode;
    failureDetail?: string;
    logMessage?: string;
    logLevel?: string;
  },
): Promise<void> {
  const res = await fetch(`${api}/internal/deployments/${deploymentId}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`status_update_failed:${text}`);
  }
}

async function postLog(
  api: string,
  secret: string,
  deploymentId: string,
  level: string,
  message: string,
): Promise<void> {
  const res = await fetch(`${api}/internal/deployments/${deploymentId}/logs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
    body: JSON.stringify({ level, message }),
  });
  if (!res.ok) {
    // don't throw: logging must be best-effort
    return;
  }
}

async function spawnStreaming(input: {
  cmd: string;
  args: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
  timeoutMs: number;
  onLine: (line: string) => void;
}): Promise<{ exitCode: number; output: string }> {
  const child = spawn(input.cmd, input.args, {
    cwd: input.cwd,
    env: { ...process.env, ...(input.env ?? {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let output = '';
  const onData = (buf: Buffer) => {
    const text = buf.toString('utf8');
    output += text;
    for (const raw of text.split(/\r?\n/)) {
      if (!raw) continue;
      input.onLine(raw);
    }
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);

  const timeout = setTimeout(() => {
    child.kill();
  }, input.timeoutMs);

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  }).finally(() => clearTimeout(timeout));

  return { exitCode, output };
}

function imageTagFor(projectId: string, sha: string): string {
  const short = sha.slice(0, 12);
  return `opendeploy-${projectId}:git-${short}`;
}

function classifyGitFailure(output: string): BuildFailureCode {
  const o = output.toLowerCase();
  if (o.includes('repository not found') || o.includes('not found')) return BuildFailureCode.repo_not_found;
  if (o.includes('authentication failed') || o.includes('403')) return BuildFailureCode.github_api_forbidden;
  return BuildFailureCode.repo_fetch_failed;
}

function classifyBuildFailure(output: string): BuildFailureCode {
  const o = output.toLowerCase();
  if (o.includes('dockerfile') && (o.includes('failed to read') || o.includes('no such file'))) {
    return BuildFailureCode.dockerfile_invalid;
  }
  return BuildFailureCode.build_failed;
}

function extractDigest(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const anyMeta = meta as Record<string, unknown>;
  const direct = anyMeta['containerimage.digest'];
  if (typeof direct === 'string' && direct.includes(':')) return direct;
  return null;
}

async function processJob(
  api: string,
  secret: string,
  workerId: string,
  data: DeploymentJobPayload,
): Promise<void> {
  const { deploymentId, deploymentAttemptId } = data;
  await assignWorker(api, secret, deploymentId, deploymentAttemptId, workerId);

  const buildInput = await getBuildInput(api, secret, deploymentId);
  if (!buildInput.ok) {
    await patchStatus(api, secret, deploymentId, {
      status: DeploymentStatus.build_failed,
      failureCode: BuildFailureCode.worker_internal_error,
      failureDetail: `build_input:${buildInput.error}`,
    });
    return;
  }

  const workspace = await mkdtemp(join(tmpdir(), 'opendeploy-build-'));
  const { commitSha, repoFullName, providerInstallationId, defaultBranch } = buildInput;

  const short = commitSha.slice(0, 12);
  const pushEnabled = process.env.REGISTRY_PUSH_ENABLED === 'true';
  const registryRepo = process.env.REGISTRY_REPOSITORY;
  const imageBase = pushEnabled
    ? (() => {
        if (!registryRepo) throw new Error('registry_push_enabled_but_registry_repository_missing');
        return registryRepo;
      })()
    : null;

  const artifactTag = pushEnabled
    ? `${imageBase}:git-${short}`
    : imageTagFor(data.projectId, commitSha);
  const stableTag = pushEnabled ? `${imageBase}:deployment-${deploymentId}` : null;
  const secretsToMask: string[] = [];

  try {
    await patchStatus(api, secret, deploymentId, { status: DeploymentStatus.fetching_source });

    const { token } = await getInstallationToken(api, secret, providerInstallationId);
    secretsToMask.push(token);

    const cloneUrl = `https://x-access-token:${token}@github.com/${repoFullName}.git`;
    const cloneUrlMasked = `https://x-access-token:***@github.com/${repoFullName}.git`;

    await postLog(api, secret, deploymentId, 'info', `cloning ${cloneUrlMasked} @ ${commitSha}`);

    // shallow fetch exact sha
    await spawnStreaming({
      cmd: 'git',
      args: ['init', '.'],
      cwd: workspace,
      timeoutMs: 60_000,
      onLine: () => {},
    });
    await spawnStreaming({
      cmd: 'git',
      args: ['remote', 'add', 'origin', cloneUrl],
      cwd: workspace,
      timeoutMs: 60_000,
      onLine: () => {},
    });
    const fetchRes = await spawnStreaming({
      cmd: 'git',
      args: ['fetch', '--depth', '1', 'origin', commitSha],
      cwd: workspace,
      timeoutMs: 3 * 60_000,
      onLine: (line) => void postLog(api, secret, deploymentId, 'info', maskSecrets(line, secretsToMask)),
    });
    if (fetchRes.exitCode !== 0) {
      const code = classifyGitFailure(fetchRes.output);
      await patchStatus(api, secret, deploymentId, {
        status: DeploymentStatus.build_failed,
        failureCode: code,
        failureDetail: maskSecrets(fetchRes.output.slice(-4000), secretsToMask),
      });
      if (isRetryableBuildFailure(code)) throw new Error(`retryable_failure:${code}`);
      return;
    }
    await spawnStreaming({
      cmd: 'git',
      args: ['checkout', '--detach', 'FETCH_HEAD'],
      cwd: workspace,
      timeoutMs: 60_000,
      onLine: (line) => void postLog(api, secret, deploymentId, 'info', maskSecrets(line, secretsToMask)),
    });

    await patchStatus(api, secret, deploymentId, { status: DeploymentStatus.preparing_context });

    const dockerfilePath = process.env.DOCKERFILE_PATH ?? 'Dockerfile';
    const contextPath = process.env.BUILD_CONTEXT_PATH ?? '.';

    await patchStatus(api, secret, deploymentId, { status: DeploymentStatus.building_image });

    const metadataFile = join(workspace, '.opendeploy-build-metadata.json');
    const buildArgs = [
      'buildx',
      'build',
      '--progress=plain',
      '--metadata-file',
      metadataFile,
      '--file',
      dockerfilePath,
      '--tag',
      artifactTag,
      stableTag ? '--tag' : null,
      stableTag ?? null,
      pushEnabled ? '--push' : '--load',
      contextPath,
    ].filter(Boolean) as string[];

    const buildRes = await spawnStreaming({
      cmd: 'docker',
      args: buildArgs,
      cwd: workspace,
      timeoutMs: Number(process.env.BUILD_TIMEOUT_MS ?? 20 * 60_000),
      onLine: (line) => void postLog(api, secret, deploymentId, 'info', maskSecrets(line, secretsToMask)),
    });

    if (buildRes.exitCode !== 0) {
      const code = classifyBuildFailure(buildRes.output);
      await patchStatus(api, secret, deploymentId, {
        status: DeploymentStatus.build_failed,
        failureCode: code,
        failureDetail: maskSecrets(buildRes.output.slice(-4000), secretsToMask),
      });
      if (isRetryableBuildFailure(code)) throw new Error(`retryable_failure:${code}`);
      return;
    }

    if (pushEnabled) {
      await patchStatus(api, secret, deploymentId, { status: DeploymentStatus.pushing_image });
    }

    // Persist artifact (digest best-effort; buildx metadata format can vary)
    let meta: unknown = null;
    try {
      const text = await (await import('node:fs/promises')).readFile(metadataFile, 'utf8');
      meta = JSON.parse(text) as unknown;
    } catch {
      meta = null;
    }
    const digest = extractDigest(meta);

    await fetch(`${api}/internal/deployments/${deploymentId}/artifacts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({
        imageTag: artifactTag,
        imageDigest: digest,
        registryType: pushEnabled ? 'single' : 'none',
        registryRepository: pushEnabled ? imageBase : null,
        dockerfilePath,
        builderVersion: 'docker-buildx',
        metadataJson: meta,
        sourceSnapshot: {
          repoOwner: repoFullName.split('/')[0],
          repoName: repoFullName.split('/')[1],
          installationId: providerInstallationId,
          commitSha,
          cloneUrlMasked,
          defaultBranch,
        },
      }),
    });

    await patchStatus(api, secret, deploymentId, { status: DeploymentStatus.build_succeeded });
  } catch (err) {
    await patchStatus(api, secret, deploymentId, {
      status: DeploymentStatus.build_failed,
      failureCode: BuildFailureCode.worker_internal_error,
      failureDetail: maskSecrets(String(err instanceof Error ? err.message : err), secretsToMask),
    });
  } finally {
    await rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}

async function main(): Promise<void> {
  const redisUrl = requireEnv('REDIS_URL');
  const api = requireEnv('API_PUBLIC_URL').replace(/\/$/, '');
  const secret = requireEnv('INTERNAL_API_SECRET');

  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const name = `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const workerId = await register(api, secret, name);

  const w = new Worker(
    DEPLOYMENT_QUEUE_NAME,
    async (job) => {
      const data = job.data as DeploymentJobPayload;
      await processJob(api, secret, workerId, data);
    },
    { connection: redis, concurrency: 2 },
  );

  w.on('failed', (job, err) => {
    console.error('job_failed', job?.id, err);
  });

  registerRuntimeWorkers(redis, api, secret, workerId);

  console.info('worker_online', { workerId, queue: DEPLOYMENT_QUEUE_NAME });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
