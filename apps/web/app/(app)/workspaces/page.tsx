import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';

type Workspace = { id: string; name: string; slug: string };

async function createWorkspace(formData: FormData) {
  'use server';

  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  if (!name || !slug) {
    return;
  }

  await serverApiFetch('/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name, slug }),
  });
  revalidatePath('/workspaces');
}

export default async function WorkspacesPage() {
  const workspaces = await serverApiFetch<Workspace[]>('/workspaces');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workspaces</h1>
      </div>
      <form action={createWorkspace} className="grid gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input
          name="name"
          placeholder="Workspace name"
          required
          minLength={2}
          className="h-9 rounded-md border border-zinc-300 px-3 text-sm outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-zinc-400"
        />
        <input
          name="slug"
          placeholder="workspace-slug"
          pattern="^[a-z0-9-]+$"
          title="Use lowercase letters, numbers, and dashes only"
          required
          className="h-9 rounded-md border border-zinc-300 px-3 text-sm outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-zinc-400"
        />
        <Button type="submit">Create workspace</Button>
      </form>
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
          No workspaces yet. Create one above to get started.
        </p>
      ) : null}
    </div>
  );
}
