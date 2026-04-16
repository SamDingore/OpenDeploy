'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CreateDeploymentForm(props: {
  workspaceId: string;
  projectId: string;
  environments: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [environmentId, setEnvironmentId] = useState(props.environments[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('not_signed_in');
      }
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(
        `${base.replace(/\/$/, '')}/workspaces/${props.workspaceId}/projects/${props.projectId}/deployments`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ environmentId }),
        },
      );
      const json: unknown = await res.json();
      const body = json as {
        ok?: boolean;
        data?: { deployment?: { id: string } };
      };
      const id = body.data?.deployment?.id;
      if (!body.ok || !id) {
        throw new Error('create_failed');
      }
      router.push(
        `/workspaces/${props.workspaceId}/projects/${props.projectId}/deployments/${id}`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <h2 className="font-medium">New build</h2>
      <label className="block text-sm">
        <span className="text-zinc-600">Environment</span>
        <select
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
          value={environmentId}
          onChange={(e) => setEnvironmentId(e.target.value)}
        >
          {props.environments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={busy || !environmentId}>
        {busy ? 'Creating…' : 'Create deployment'}
      </Button>
    </form>
  );
}
