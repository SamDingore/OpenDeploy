import Link from 'next/link';
import { CustomDomainsPanel } from '@/components/custom-domains-panel';
import { serverApiFetch } from '@/lib/server-api';

type DomainRow = {
  id: string;
  hostname: string;
  status: string;
  verificationToken: string;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  failureCode: string | null;
  failureDetail: string | null;
  dnsInstructions: {
    hostname: string;
    cname: { name: string; value: string };
    txt: { name: string; value: string };
    platformTarget: string;
  };
  activeCertificate: {
    id: string;
    status: string;
    notBefore: string | null;
    notAfter: string | null;
    failureCode: string | null;
    failureDetail: string | null;
  } | null;
};

export default async function CustomDomainsPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string; environmentId: string }>;
}) {
  const { workspaceId, projectId, environmentId } = await params;
  const initial = await serverApiFetch<DomainRow[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/environments/${environmentId}/custom-domains`,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/workspaces/${workspaceId}/projects/${projectId}`}
          className="text-sm text-blue-600"
        >
          ← Project
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Custom domains</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Verify DNS, issue TLS via the edge, and attach to a healthy production release.
        </p>
      </div>
      <CustomDomainsPanel
        workspaceId={workspaceId}
        projectId={projectId}
        environmentId={environmentId}
        initial={initial}
      />
    </div>
  );
}
