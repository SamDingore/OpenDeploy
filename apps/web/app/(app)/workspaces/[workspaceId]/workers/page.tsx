import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';

type WorkerNode = {
  id: string;
  name: string;
  status: string;
  lastSeenAt: string | null;
};

export default async function WorkersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const workers = await serverApiFetch<WorkerNode[]>(`/workspaces/${workspaceId}/workers`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Workers</h1>
      <div className="grid gap-3">
        {workers.map((w) => (
          <Card key={w.id}>
            <CardHeader>
              <CardTitle className="text-base">{w.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-600">
              <div>Status: {w.status}</div>
              <div>Last seen: {w.lastSeenAt ? new Date(w.lastSeenAt).toLocaleString() : '—'}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      {workers.length === 0 ? (
        <p className="text-sm text-zinc-600">No workers registered. Start `pnpm dev:worker`.</p>
      ) : null}
    </div>
  );
}
