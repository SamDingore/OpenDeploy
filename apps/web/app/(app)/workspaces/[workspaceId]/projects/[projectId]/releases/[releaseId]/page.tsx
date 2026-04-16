import Link from 'next/link';
import { RollbackProductionButton } from '@/components/rollback-production-button';
import { serverApiFetch } from '@/lib/server-api';

type ReleaseDetail = {
  id: string;
  status: string;
  releaseType: string;
  commitSha: string;
  pullRequestNumber?: number | null;
  failureDetail?: string | null;
  environment: { id: string; name: string; type: string };
  runtimeInstances: {
    id: string;
    status: string;
    containerName: string;
    upstreamDial: string;
    lastHealthStatus?: string | null;
  }[];
  runtimeLogs: { seq: number; level: string; message: string }[];
  platformHostname: { hostname: string } | null;
  routeBindings: { status: string; platformHostname: { hostname: string } }[];
  healthResults: { success: boolean; checkType: string; detail?: string | null; createdAt: string }[];
};

export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string; releaseId: string }>;
}) {
  const { workspaceId, projectId, releaseId } = await params;
  const release = await serverApiFetch<ReleaseDetail>(
    `/workspaces/${workspaceId}/projects/${projectId}/releases/${releaseId}`,
  );

  const publicUrl = release.platformHostname
    ? `http://${release.platformHostname.hostname}`
    : null;

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href={`/workspaces/${workspaceId}/projects/${projectId}/releases`}
          className="text-blue-600"
        >
          ← Releases
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Release</h1>
        <p className="text-sm text-zinc-600">
          {release.id} · {release.releaseType} · {release.environment.name}
        </p>
      </div>

      {release.releaseType === 'production' ? (
        <div>
          <RollbackProductionButton workspaceId={workspaceId} projectId={projectId} />
        </div>
      ) : null}

      {publicUrl && (
        <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
          <div className="text-zinc-600">URL</div>
          <a className="font-mono text-blue-700" href={publicUrl} target="_blank" rel="noreferrer">
            {publicUrl}
          </a>
        </div>
      )}

      {release.failureDetail && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {release.failureDetail}
        </div>
      )}

      <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
        <div className="font-medium text-zinc-700">Runtime</div>
        <ul className="mt-2 space-y-1 font-mono text-xs">
          {release.runtimeInstances.map((ri) => (
            <li key={ri.id}>
              {ri.status} · {ri.containerName} → {ri.upstreamDial}
              {ri.lastHealthStatus ? ` · ${ri.lastHealthStatus}` : ''}
            </li>
          ))}
        </ul>
        {release.runtimeInstances.length === 0 ? (
          <p className="text-xs text-zinc-500">No runtime instance yet.</p>
        ) : null}
      </div>

      <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
        <div className="font-medium text-zinc-700">Route bindings</div>
        <ul className="mt-2 space-y-1 text-xs">
          {release.routeBindings.map((b, i) => (
            <li key={i}>
              {b.status} · {b.platformHostname.hostname}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
        <div className="font-medium text-zinc-700">Health checks</div>
        <ul className="mt-2 max-h-40 overflow-auto font-mono text-xs">
          {release.healthResults.map((h, i) => (
            <li key={i}>
              {h.success ? 'ok' : 'fail'} {h.checkType} {h.detail ?? ''}{' '}
              {new Date(h.createdAt).toLocaleTimeString()}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-700">Runtime logs</h3>
        <pre className="max-h-64 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs">
          {release.runtimeLogs.map((l) => (
            <div key={l.seq}>
              {l.seq} {l.level} {l.message}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
