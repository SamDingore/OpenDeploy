import Link from 'next/link';
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
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
        <p className="text-sm text-zinc-600">No projects in this workspace yet.</p>
      ) : null}
    </div>
  );
}
