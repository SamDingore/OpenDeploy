'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

type Installation = {
  providerInstallationId: string;
  accountLogin: string | null;
  accountType: string | null;
};

type Repository = {
  providerRepoId: string;
  fullName: string;
  defaultBranch: string | null;
  private: boolean;
};

type ExistingRepoLink = {
  fullName: string;
  defaultBranch: string | null;
};

export function GithubIntegrationCard(props: {
  workspaceId: string;
  projectId: string;
  existingRepoLink: ExistingRepoLink | null;
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [installUrl, setInstallUrl] = useState<string>('');
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<string>('');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [defaultBranch, setDefaultBranch] = useState<string>('main');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const selectedRepo = useMemo(
    () => repositories.find((r) => r.providerRepoId === selectedRepoId) ?? null,
    [repositories, selectedRepoId],
  );

  async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getToken();
    if (!token) {
      throw new Error('not_signed_in');
    }
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: T;
      error?: { message?: string };
    };
    if (!res.ok || !json.ok) {
      throw new Error(json.error?.message ?? `api_http_${res.status}`);
    }
    return json.data as T;
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [urlData, installationsData] = await Promise.all([
          apiFetch<{ url: string }>(`/workspaces/${props.workspaceId}/github/install-url`),
          apiFetch<Installation[]>(`/workspaces/${props.workspaceId}/github/installations`),
        ]);
        if (cancelled) return;
        setInstallUrl(urlData.url);
        setInstallations(installationsData);
        if (installationsData.length > 0) {
          setSelectedInstallation((prev) => prev || installationsData[0]?.providerInstallationId || '');
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'failed_to_load_github');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [props.workspaceId]);

  async function loadRepositories(installationId: string) {
    setError('');
    setRepositories([]);
    setSelectedRepoId('');
    setLoading(true);
    try {
      await apiFetch(`/workspaces/${props.workspaceId}/github/link-installation`, {
        method: 'POST',
        body: JSON.stringify({ providerInstallationId: installationId }),
      });
      const repos = await apiFetch<Repository[]>(
        `/workspaces/${props.workspaceId}/github/installations/${installationId}/repositories`,
      );
      setRepositories(repos);
      if (repos.length > 0) {
        setSelectedRepoId(repos[0]?.providerRepoId ?? '');
        setDefaultBranch(repos[0]?.defaultBranch ?? 'main');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed_to_load_repositories');
    } finally {
      setLoading(false);
    }
  }

  async function connectRepository() {
    if (!selectedInstallation || !selectedRepo) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/workspaces/${props.workspaceId}/github/projects/${props.projectId}/link-repository`, {
        method: 'POST',
        body: JSON.stringify({
          providerInstallationId: selectedInstallation,
          providerRepoId: selectedRepo.providerRepoId,
          fullName: selectedRepo.fullName,
          defaultBranch: defaultBranch.trim() || selectedRepo.defaultBranch || 'main',
        }),
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed_to_link_repository');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <div>
        <h2 className="font-medium">GitHub integration</h2>
        <p className="text-sm text-zinc-600">
          Connect a repository so deployments can resolve commits and trigger from webhooks.
        </p>
      </div>

      {props.existingRepoLink ? (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          Connected: <span className="font-medium">{props.existingRepoLink.fullName}</span> (
          {props.existingRepoLink.defaultBranch ?? 'main'})
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (installUrl) window.open(installUrl, '_blank', 'noopener,noreferrer');
          }}
          disabled={!installUrl || loading}
        >
          Install GitHub App
        </Button>
      </div>

      <label className="block text-sm">
        <span className="text-zinc-600">Installation</span>
        <select
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
          value={selectedInstallation}
          onChange={(e) => setSelectedInstallation(e.target.value)}
          disabled={loading || installations.length === 0}
        >
          {installations.length === 0 ? <option value="">No installations found</option> : null}
          {installations.map((inst) => (
            <option key={inst.providerInstallationId} value={inst.providerInstallationId}>
              {(inst.accountLogin ?? 'unknown-account') + ' (' + inst.providerInstallationId + ')'}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadRepositories(selectedInstallation)}
          disabled={!selectedInstallation || loading}
        >
          Load repositories
        </Button>
      </div>

      <label className="block text-sm">
        <span className="text-zinc-600">Repository</span>
        <select
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
          value={selectedRepoId}
          onChange={(e) => {
            const nextRepoId = e.target.value;
            setSelectedRepoId(nextRepoId);
            const repo = repositories.find((r) => r.providerRepoId === nextRepoId);
            setDefaultBranch(repo?.defaultBranch ?? 'main');
          }}
          disabled={loading || repositories.length === 0}
        >
          {repositories.length === 0 ? <option value="">No repositories loaded</option> : null}
          {repositories.map((repo) => (
            <option key={repo.providerRepoId} value={repo.providerRepoId}>
              {repo.fullName}
              {repo.private ? ' (private)' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-zinc-600">Default branch</span>
        <input
          value={defaultBranch}
          onChange={(e) => setDefaultBranch(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-zinc-400"
          placeholder="main"
          disabled={loading}
        />
      </label>

      <Button
        type="button"
        onClick={() => void connectRepository()}
        disabled={!selectedInstallation || !selectedRepo || loading}
      >
        {loading ? 'Working…' : props.existingRepoLink ? 'Update repository link' : 'Connect repository'}
      </Button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
