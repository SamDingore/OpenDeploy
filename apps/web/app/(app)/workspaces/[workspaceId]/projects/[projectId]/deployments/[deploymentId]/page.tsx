import Link from 'next/link';
import { DeploymentLive } from '@/components/deployment-live';
import { RetryBuildButton } from '@/components/retry-build-button';
import { serverApiFetch } from '@/lib/server-api';

type Deployment = {
  id: string;
  status: string;
  createdAt: string;
  commitSha?: string | null;
  branch?: string | null;
  triggerSource?: string | null;
  buildStartedAt?: string | null;
  buildFinishedAt?: string | null;
  buildDurationMs?: number | null;
  failureCode?: string | null;
  failureDetail?: string | null;
  artifacts?: { id: string; imageTag: string; imageDigest?: string | null; createdAt: string }[];
  logs: { seq: number; level: string; message: string }[];
};

export default async function DeploymentPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string; deploymentId: string }>;
}) {
  const { workspaceId, projectId, deploymentId } = await params;
  const deployment = await serverApiFetch<Deployment>(
    `/workspaces/${workspaceId}/projects/${projectId}/deployments/${deploymentId}`,
  );

  const eventUrl = `/api/workspaces/${workspaceId}/projects/${projectId}/deployments/${deploymentId}/events`;

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link href={`/workspaces/${workspaceId}/projects/${projectId}`} className="text-blue-600">
          ← Back to project
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Deployment</h1>
        <p className="text-sm text-zinc-600">
          {deployment.id} · {new Date(deployment.createdAt).toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <RetryBuildButton
          workspaceId={workspaceId}
          projectId={projectId}
          deploymentId={deploymentId}
        />
        <div className="text-xs text-zinc-600">
          {deployment.commitSha ? (
            <span className="font-mono">sha {deployment.commitSha.slice(0, 12)}</span>
          ) : (
            <span className="font-mono">sha (missing)</span>
          )}
        </div>
      </div>
      {(deployment.failureCode || deployment.failureDetail) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
          <div className="font-mono font-medium text-red-800">{deployment.failureCode}</div>
          {deployment.failureDetail && (
            <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-red-900">
              {deployment.failureDetail}
            </pre>
          )}
        </div>
      )}
      {deployment.artifacts?.[0] && (
        <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
          <div className="text-zinc-600">Latest artifact</div>
          <div className="mt-1 font-mono">{deployment.artifacts[0].imageTag}</div>
          {deployment.artifacts[0].imageDigest && (
            <div className="font-mono text-xs text-zinc-600">
              digest {deployment.artifacts[0].imageDigest}
            </div>
          )}
        </div>
      )}
      <DeploymentLive eventUrl={eventUrl} initialStatus={deployment.status} />
      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-700">Initial log snapshot</h3>
        <pre className="max-h-64 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs">
          {deployment.logs.map((l) => (
            <div key={l.seq}>
              {l.seq} {l.level} {l.message}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
