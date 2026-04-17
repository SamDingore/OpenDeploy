import { auth } from '@clerk/nextjs/server';

const getBaseUrl = () => process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const hasClerkKeys = () =>
  Boolean(process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'] && process.env['CLERK_SECRET_KEY']);

export async function serverApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!hasClerkKeys()) {
    throw new Error('not_authenticated');
  }
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    throw new Error('not_authenticated');
  }
  const res = await fetch(`${getBaseUrl().replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    cache: 'no-store',
  });
  const json: unknown = await res.json();
  const body = json as { ok?: boolean; data?: T; error?: { message?: string } };
  if (!body.ok) {
    throw new Error(body.error?.message ?? 'api_error');
  }
  return body.data as T;
}
