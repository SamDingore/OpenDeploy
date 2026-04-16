'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function RollbackProductionButton(props: { workspaceId: string; projectId: string }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onRollback() {
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('not_signed_in');
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(
        `${base.replace(/\/$/, '')}/workspaces/${props.workspaceId}/projects/${props.projectId}/releases/rollback-production`,
        { method: 'POST', headers: { authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('rollback_failed');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={onRollback} disabled={busy}>
      {busy ? 'Rolling back…' : 'Rollback production'}
    </Button>
  );
}
