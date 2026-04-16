import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';

type NodePool = {
  id: string;
  name: string;
  kind: string;
  isHardened: boolean;
  supportsRootless: boolean;
  workerNodes: { id: string; name: string; status: string; rootlessCapable: boolean }[];
};

type ReconciliationRun = {
  id: string;
  kind: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  itemsExamined: number;
  itemsRepaired: number;
  errorSummary: string | null;
};

type EdgeConfigVersion = {
  id: string;
  version: number;
  configHash: string;
  applyStatus: string;
  appliedAt: string;
  actorHint: string | null;
};

export default async function OperationsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const [pools, runs, edgeVersions, quotas] = await Promise.all([
    serverApiFetch<NodePool[]>(`/workspaces/${workspaceId}/operations/node-pools`),
    serverApiFetch<ReconciliationRun[]>(`/workspaces/${workspaceId}/operations/reconciliation-runs`),
    serverApiFetch<EdgeConfigVersion[]>(`/workspaces/${workspaceId}/operations/edge-config-versions`),
    serverApiFetch<Record<string, unknown>>(`/workspaces/${workspaceId}/operations/quotas`),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Operations</h1>
        <Link href={`/workspaces/${workspaceId}`} className="text-sm text-blue-600 hover:underline">
          ← Workspace
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace quotas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-zinc-700">
          {Object.entries(quotas).map(([k, v]) => (
            <div key={k}>
              <span className="font-medium text-zinc-900">{k}</span>: {String(v)}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Node pools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {pools.length === 0 ? (
            <p className="text-zinc-600">
              No pools yet. Workers register into the <code className="text-xs">default</code> pool.
            </p>
          ) : null}
          {pools.map((p) => (
            <div key={p.id} className="rounded-md border border-zinc-200 p-3">
              <div className="font-medium">
                {p.name}{' '}
                <span className="text-zinc-500">
                  ({p.kind}
                  {p.isHardened ? ', hardened' : ''}
                  {p.supportsRootless ? ', rootless-capable pool' : ''})
                </span>
              </div>
              <div className="mt-2 text-zinc-600">
                Workers: {p.workerNodes.length}
                {p.workerNodes.length ? (
                  <ul className="mt-1 list-inside list-disc">
                    {p.workerNodes.map((w) => (
                      <li key={w.id}>
                        {w.name} — {w.status}
                        {w.rootlessCapable ? ' (rootless worker)' : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reconciliation runs</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-700">
          {runs.length === 0 ? <p className="text-zinc-600">No runs recorded yet.</p> : null}
          <ul className="space-y-2">
            {runs.slice(0, 15).map((r) => (
              <li key={r.id} className="border-b border-zinc-100 pb-2">
                <span className="font-medium">{r.kind}</span> — {r.status} — examined {r.itemsExamined},
                repaired {r.itemsRepaired}
                {r.errorSummary ? (
                  <span className="block text-red-600"> {r.errorSummary}</span>
                ) : null}
                <span className="block text-xs text-zinc-500">
                  {new Date(r.startedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edge config versions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-700">
          <p className="mb-2 text-zinc-600">
            Roll back via API: <code className="text-xs">POST .../operations/edge-config/rollback</code>{' '}
            with body <code className="text-xs">{'{ "version": N }'}</code> (admin only).
          </p>
          {edgeVersions.length === 0 ? (
            <p className="text-zinc-600">No versions stored yet (apply edge from a successful reload).</p>
          ) : (
            <ul className="space-y-1">
              {edgeVersions.map((v) => (
                <li key={v.id}>
                  v{v.version} — {v.applyStatus} — {v.configHash.slice(0, 12)}… —{' '}
                  {v.actorHint ?? '—'} — {new Date(v.appliedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
