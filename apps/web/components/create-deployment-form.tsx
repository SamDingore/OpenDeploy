'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type FrameworkPreset = {
  id: string;
  label: string;
  installCommand: string;
  buildCommand: string;
  startCommand: string;
};

const PRESETS: FrameworkPreset[] = [
  {
    id: 'nextjs',
    label: 'Next.js',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    startCommand: 'npm run start',
  },
  {
    id: 'nestjs',
    label: 'NestJS',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    startCommand: 'npm run start:prod',
  },
  {
    id: 'react-vite',
    label: 'React (Vite)',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    startCommand: 'npm run preview -- --host 0.0.0.0 --port 3000',
  },
  {
    id: 'node-express',
    label: 'Node.js (Express)',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    startCommand: 'npm run start',
  },
  {
    id: 'custom',
    label: 'Custom',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    startCommand: 'npm run start',
  },
];

export function CreateDeploymentForm(props: {
  workspaceId: string;
  projectId: string;
  environments: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const { getToken } = useAuth();
  const initialPreset = PRESETS[0]!;
  const [environmentId, setEnvironmentId] = useState(props.environments[0]?.id ?? '');
  const [framework, setFramework] = useState(initialPreset.id);
  const [rootDirectory, setRootDirectory] = useState('.');
  const [installCommand, setInstallCommand] = useState(initialPreset.installCommand);
  const [buildCommand, setBuildCommand] = useState(initialPreset.buildCommand);
  const [startCommand, setStartCommand] = useState(initialPreset.startCommand);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
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
          body: JSON.stringify({
            environmentId,
            framework,
            rootDirectory,
            installCommand,
            buildCommand,
            startCommand,
          }),
        },
      );
      const json: unknown = await res.json();
      const body = json as {
        ok?: boolean;
        data?: { deployment?: { id: string } };
        error?: { message?: string };
      };
      const id = body.data?.deployment?.id;
      if (!body.ok || !id) {
        throw new Error(body.error?.message ?? `create_failed_http_${res.status}`);
      }
      router.push(
        `/workspaces/${props.workspaceId}/projects/${props.projectId}/deployments/${id}`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'create_failed');
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
      <label className="block text-sm">
        <span className="text-zinc-600">Framework preset</span>
        <select
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
          value={framework}
          onChange={(e) => {
            const next = PRESETS.find((preset) => preset.id === e.target.value);
            if (!next) return;
            setFramework(next.id);
            setInstallCommand(next.installCommand);
            setBuildCommand(next.buildCommand);
            setStartCommand(next.startCommand);
          }}
        >
          {PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Install command</span>
        <input
          className="mt-1 h-9 w-full rounded border border-zinc-300 px-2 py-1"
          value={installCommand}
          onChange={(e) => setInstallCommand(e.target.value)}
          placeholder="npm install"
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Build command</span>
        <input
          className="mt-1 h-9 w-full rounded border border-zinc-300 px-2 py-1"
          value={buildCommand}
          onChange={(e) => setBuildCommand(e.target.value)}
          placeholder="npm run build"
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Start command</span>
        <input
          className="mt-1 h-9 w-full rounded border border-zinc-300 px-2 py-1"
          value={startCommand}
          onChange={(e) => setStartCommand(e.target.value)}
          placeholder="npm run start"
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Root directory</span>
        <input
          className="mt-1 h-9 w-full rounded border border-zinc-300 px-2 py-1"
          value={rootDirectory}
          onChange={(e) => setRootDirectory(e.target.value)}
          placeholder="."
        />
      </label>
      <Button
        type="submit"
        disabled={
          busy ||
          !environmentId ||
          !installCommand.trim() ||
          !buildCommand.trim() ||
          !startCommand.trim()
        }
      >
        {busy ? 'Creating…' : 'Create deployment'}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
