'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function RetryBuildButton(props: {
  workspaceId: string;
  projectId: string;
  deploymentId: string;
  disabled?: boolean;
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onRetry() {
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('not_signed_in');
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      await fetch(
        `${base.replace(/\/$/, '')}/workspaces/${props.workspaceId}/projects/${props.projectId}/deployments/${props.deploymentId}/retry`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
        },
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" onClick={onRetry} disabled={props.disabled || busy}>
      {busy ? 'Retrying…' : 'Retry build'}
    </Button>
  );
}

