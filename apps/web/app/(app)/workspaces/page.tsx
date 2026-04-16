import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';

type Workspace = { id: string; name: string; slug: string };

export default async function WorkspacesPage() {
  const workspaces = await serverApiFetch<Workspace[]>('/workspaces');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workspaces</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {workspaces.map((w) => (
          <Link key={w.id} href={`/workspaces/${w.id}`}>
            <Card className="transition hover:border-zinc-300">
              <CardHeader>
                <CardTitle>{w.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600">{w.slug}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {workspaces.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No workspaces yet. Use the API or seed script to create one, or add a creation form in
          Phase 2.
        </p>
      ) : null}
    </div>
  );
}
