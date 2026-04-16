import Link from 'next/link';
import { CreateDeploymentForm } from '@/components/create-deployment-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';

type Project = {
  id: string;
  name: string;
  slug: string;
  environments: { id: string; name: string; slug: string; type: string }[];
};

type Deployment = { id: string; status: string; createdAt: string };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;
  const project = await serverApiFetch<Project>(
    `/workspaces/${workspaceId}/projects/${projectId}`,
  );
  const deployments = await serverApiFetch<Deployment[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/deployments`,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-zinc-600">{project.slug}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environments</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-700">
          <ul className="list-disc space-y-1 pl-5">
            {project.environments.map((e) => (
              <li key={e.id}>
                {e.name} ({e.slug}) — {e.type}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <CreateDeploymentForm
        workspaceId={workspaceId}
        projectId={projectId}
        environments={project.environments}
      />

      <div>
        <h2 className="mb-3 text-lg font-medium">Deployments</h2>
        <div className="space-y-2">
          {deployments.map((d) => (
            <Link
              key={d.id}
              href={`/workspaces/${workspaceId}/projects/${projectId}/deployments/${d.id}`}
              className="block rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:border-zinc-300"
            >
              <span className="font-medium">{d.status}</span>
              <span className="ml-2 text-zinc-500">{new Date(d.createdAt).toLocaleString()}</span>
            </Link>
          ))}
        </div>
        {deployments.length === 0 ? (
          <p className="text-sm text-zinc-600">No deployments yet.</p>
        ) : null}
      </div>
    </div>
  );
}
