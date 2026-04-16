'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type DnsInstructions = {
  hostname: string;
  cname: { name: string; value: string };
  txt: { name: string; value: string };
  platformTarget: string;
};

type Cert = {
  id: string;
  status: string;
  notBefore: string | null;
  notAfter: string | null;
  failureCode: string | null;
  failureDetail: string | null;
} | null;

type DomainRow = {
  id: string;
  hostname: string;
  status: string;
  verificationToken: string;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  failureCode: string | null;
  failureDetail: string | null;
  dnsInstructions: DnsInstructions;
  activeCertificate: Cert;
};

export function CustomDomainsPanel(props: {
  workspaceId: string;
  projectId: string;
  environmentId: string;
  initial: DomainRow[];
}) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [rows, setRows] = useState(props.initial);
  const [hostname, setHostname] = useState('');
  const [busy, setBusy] = useState(false);
  const [attachReleaseId, setAttachReleaseId] = useState<Record<string, string>>({});

  const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  const path = (p: string) =>
    `${base}/workspaces/${props.workspaceId}/projects/${props.projectId}/environments/${props.environmentId}/custom-domains${p}`;

  async function refresh() {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(path(''), {
      headers: { authorization: `Bearer ${token}` },
    });
    const json: unknown = await res.json();
    const body = json as { ok?: boolean; data?: DomainRow[] };
    if (body.ok && body.data) setRows(body.data);
  }

  async function addDomain(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('not_signed_in');
      const res = await fetch(path(''), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ hostname }),
      });
      const json: unknown = await res.json();
      const body = json as { ok?: boolean };
      if (!body.ok) throw new Error('add_failed');
      setHostname('');
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function postAction(subpath: string) {
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('not_signed_in');
      const res = await fetch(path(subpath), {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const json: unknown = await res.json();
      const body = json as { ok?: boolean };
      if (!body.ok) throw new Error('action_failed');
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={addDomain} className="space-y-3 rounded-lg border border-zinc-200 p-4">
        <h2 className="font-medium">Add custom domain</h2>
        <p className="text-sm text-zinc-600">
          Production only. Use a subdomain (three or more labels), e.g. <code>app.example.com</code>.
        </p>
        <label className="block text-sm">
          <span className="text-zinc-600">Hostname</span>
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 font-mono text-sm"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="app.customer.com"
          />
        </label>
        <Button type="submit" disabled={busy || hostname.length < 5}>
          {busy ? 'Saving…' : 'Add domain'}
        </Button>
      </form>

      <div className="space-y-6">
        <h2 className="text-lg font-medium">Domains</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600">No custom domains yet.</p>
        ) : null}
        {rows.map((d) => (
          <div key={d.id} className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono font-medium">{d.hostname}</span>
              <span className="text-zinc-600">{d.status}</span>
            </div>
            {d.failureCode ? (
              <p className="mt-2 text-amber-800">
                {d.failureCode}
                {d.failureDetail ? `: ${d.failureDetail}` : ''}
              </p>
            ) : null}
            <div className="mt-3 space-y-1 text-zinc-700">
              <p>
                <span className="font-medium">CNAME</span>{' '}
                <code className="text-xs">{d.dnsInstructions.cname.name}</code> →{' '}
                <code className="text-xs">{d.dnsInstructions.cname.value}</code>
              </p>
              <p>
                <span className="font-medium">TXT</span>{' '}
                <code className="text-xs">{d.dnsInstructions.txt.name}</code> ={' '}
                <code className="break-all text-xs">{d.dnsInstructions.txt.value}</code>
              </p>
              <p className="text-xs text-zinc-500">
                Last checked: {d.lastCheckedAt ? new Date(d.lastCheckedAt).toLocaleString() : '—'}
              </p>
            </div>
            {d.activeCertificate ? (
              <div className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
                <p className="font-medium text-zinc-800">Certificate</p>
                <p>Status: {d.activeCertificate.status}</p>
                <p>
                  Not before:{' '}
                  {d.activeCertificate.notBefore
                    ? new Date(d.activeCertificate.notBefore).toLocaleString()
                    : '—'}
                </p>
                <p>
                  Not after:{' '}
                  {d.activeCertificate.notAfter
                    ? new Date(d.activeCertificate.notAfter).toLocaleString()
                    : '—'}
                </p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => postAction(`/${d.id}/recheck`)}>
                Recheck DNS
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => postAction(`/${d.id}/retry-issuance`)}
              >
                Retry issuance
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => postAction(`/${d.id}/detach`)}>
                Detach
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-xs">
                <span className="text-zinc-600">Attach active release id</span>
                <input
                  className="mt-1 block w-64 rounded border border-zinc-300 px-2 py-1 font-mono"
                  value={attachReleaseId[d.id] ?? ''}
                  onChange={(e) => setAttachReleaseId((m) => ({ ...m, [d.id]: e.target.value }))}
                  placeholder="release_…"
                />
              </label>
              <Button
                type="button"
                disabled={busy || !(attachReleaseId[d.id]?.length)}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const token = await getToken();
                    if (!token) throw new Error('not_signed_in');
                    const res = await fetch(path(`/${d.id}/attach`), {
                      method: 'POST',
                      headers: {
                        authorization: `Bearer ${token}`,
                        'content-type': 'application/json',
                      },
                      body: JSON.stringify({ releaseId: attachReleaseId[d.id] }),
                    });
                    const json: unknown = await res.json();
                    const body = json as { ok?: boolean };
                    if (!body.ok) throw new Error('attach_failed');
                    await refresh();
                    router.refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Attach
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
