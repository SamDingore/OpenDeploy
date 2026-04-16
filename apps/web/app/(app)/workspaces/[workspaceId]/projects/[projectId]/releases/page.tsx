import Link from 'next/link';
import { serverApiFetch } from '@/lib/server-api';

type ReleaseRow = {
  id: string;
  status: string;
  releaseType: string;
  commitSha: string;
  pullRequestNumber?: number | null;
  createdAt: string;
  activatedAt?: string | null;
  environment?: { name: string; type: string };
};

export default async function ReleasesPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;
  const releases = await serverApiFetch<ReleaseRow[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/releases`,
  );

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link href={`/workspaces/${workspaceId}/projects/${projectId}`} className="text-blue-600">
          ← Back to project
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Releases</h1>
        <p className="text-sm text-zinc-600">Runtime releases and routing (Phase 3).</p>
      </div>
      <div className="space-y-2">
        {releases.map((r) => (
          <Link
            key={r.id}
            href={`/workspaces/${workspaceId}/projects/${projectId}/releases/${r.id}`}
            className="block rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:border-zinc-300"
          >
            <span className="font-medium">{r.status}</span>
            <span className="ml-2 text-zinc-500">{r.releaseType}</span>
            {r.pullRequestNumber != null ? (
              <span className="ml-2 font-mono text-xs text-zinc-600">PR #{r.pullRequestNumber}</span>
            ) : null}
            <span className="ml-2 font-mono text-xs">{r.commitSha.slice(0, 12)}</span>
            <span className="ml-2 text-zinc-400">{new Date(r.createdAt).toLocaleString()}</span>
          </Link>
        ))}
      </div>
      {releases.length === 0 ? <p className="text-sm text-zinc-600">No releases yet.</p> : null}
    </div>
  );
}
