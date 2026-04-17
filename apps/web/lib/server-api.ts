import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

const getBaseUrl = () => process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function serverApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let token: string;
  try {
    const { getToken } = await auth();
    token = (await getToken()) ?? '';
  } catch {
    redirect('/setup/auth');
  }
  if (!token) {
    redirect('/sign-in');
  }

  const res = await fetch(`${getBaseUrl().replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      redirect('/sign-in');
    }
    throw new Error(`api_http_${res.status}`);
  }
  const json: unknown = await res.json();
  const body = json as { ok?: boolean; data?: T; error?: { message?: string } };
  if (!body.ok) {
    throw new Error(body.error?.message ?? 'api_error');
  }
  return body.data as T;
}
