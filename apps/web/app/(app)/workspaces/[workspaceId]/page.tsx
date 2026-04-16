import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';

type Workspace = { id: string; name: string; slug: string };

export default async function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const workspace = await serverApiFetch<Workspace>(`/workspaces/${workspaceId}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{workspace.name}</h1>
        <p className="text-sm text-zinc-600">{workspace.slug}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Navigate</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <Link className="text-blue-600 hover:underline" href={`/workspaces/${workspaceId}/projects`}>
            Projects
          </Link>
          <Link className="text-blue-600 hover:underline" href={`/workspaces/${workspaceId}/workers`}>
            Workers
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
