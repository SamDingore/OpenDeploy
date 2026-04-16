'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function PromoteDeploymentButton(props: {
  workspaceId: string;
  projectId: string;
  deploymentId: string;
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onPromote() {
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('not_signed_in');
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(
        `${base.replace(/\/$/, '')}/workspaces/${props.workspaceId}/projects/${props.projectId}/releases/promote`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ deploymentId: props.deploymentId }),
        },
      );
      if (!res.ok) throw new Error('promote_failed');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" onClick={onPromote} disabled={busy}>
      {busy ? 'Promoting…' : 'Promote to production'}
    </Button>
  );
}
