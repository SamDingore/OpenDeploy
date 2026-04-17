import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';

type Project = {
  id: string;
  name: string;
  slug: string;
  environments: { id: string; name: string; slug: string }[];
};

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const projects = await serverApiFetch<Project[]>(`/workspaces/${workspaceId}/projects`);

  async function createProject(formData: FormData) {
    'use server';

    const name = String(formData.get('name') ?? '').trim();
    const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
    if (!name || !slug) {
      return;
    }

    await serverApiFetch(`/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    revalidatePath(`/workspaces/${workspaceId}/projects`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <form action={createProject} className="grid gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input
          name="name"
          placeholder="Project name"
          required
          minLength={2}
          className="h-9 rounded-md border border-zinc-300 px-3 text-sm outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-zinc-400"
        />
        <input
          name="slug"
          placeholder="project-slug"
          pattern="^[a-z0-9-]+$"
          title="Use lowercase letters, numbers, and dashes only"
          required
          className="h-9 rounded-md border border-zinc-300 px-3 text-sm outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-zinc-400"
        />
        <Button type="submit">Create project</Button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((p) => (
          <Link key={p.id} href={`/workspaces/${workspaceId}/projects/${p.id}`}>
            <Card className="h-full transition hover:border-zinc-300">
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600">{p.slug}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-zinc-600">No projects in this workspace yet. Create one above.</p>
      ) : null}
    </div>
  );
}
