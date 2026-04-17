import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
const hasClerkKeys = () =>
  Boolean(process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'] && process.env['CLERK_SECRET_KEY']);

export async function GET(
  _req: Request,
  context: { params: Promise<{ workspaceId: string; projectId: string; deploymentId: string }> },
) {
  const { workspaceId, projectId, deploymentId } = await context.params;
  if (!hasClerkKeys()) {
    return new Response('Unauthorized', { status: 401 });
  }
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  const base = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(
    /\/$/,
    '',
  );
  const url = `${base}/workspaces/${workspaceId}/projects/${projectId}/deployments/${deploymentId}/events`;

  const upstream = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('Upstream error', { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
