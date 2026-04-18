"use client";

import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Clock, GitBranch, Settings } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type DeploymentDetails = {
  id: string;
  projectId: string;
  status: "ready" | "error" | "building" | "queued" | "initializing" | "cancelled";
  sourceBranch: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  deployedBy: string | null;
  createdAt: string;
  config: {
    projectName: string;
    frameworkPreset: string;
    rootDirectory: string;
    buildCommand: string | null;
    outputDirectory: string | null;
    installCommand: string | null;
  } | null;
  environmentVars: Array<{ key: string; value: string }>;
};

const apiBase = () =>
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

function formatTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

export default function DeploymentDetailsPage() {
  const { getToken, isSignedIn } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const deploymentId = params.deploymentId as string;

  const [deployment, setDeployment] = useState<DeploymentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!isSignedIn) {
        setError("Sign in to view this deployment.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Session expired. Sign in again.");

        const res = await fetch(
          `${apiBase()}/apis/projects/${projectId}/deployments/${deploymentId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          const body = await res.text();
          throw new Error(body || `Could not load deployment (${res.status}).`);
        }
        const data = (await res.json()) as { deployment: DeploymentDetails };
        setDeployment(data.deployment);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load deployment.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [deploymentId, getToken, isSignedIn, projectId]);

  return (
    <div className="flex-1 bg-[#FAFAFA] dark:bg-[#0A0A0A] min-h-screen p-4 md:p-8">
      <main className="max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => router.push(`/project/${projectId}`)}
          className="mb-6 flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </button>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111] shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Deployment {deploymentId.slice(0, 8)}
            </h1>
            {deployment && (
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTimeAgo(deployment.createdAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <GitBranch className="w-4 h-4" />
                  {deployment.sourceBranch ?? "—"}
                </span>
                <span className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-xs uppercase tracking-wide">
                  {deployment.status}
                </span>
              </div>
            )}
          </div>

          <div className="p-6 space-y-6">
            {loading && <p className="text-sm text-zinc-500">Loading deployment...</p>}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            {!loading && !error && deployment && (
              <>
                <section className="space-y-3">
                  <h2 className="font-medium text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Saved Setup
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                      <p className="text-zinc-500">Project Name</p>
                      <p className="font-medium">{deployment.config?.projectName ?? "—"}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                      <p className="text-zinc-500">Framework</p>
                      <p className="font-medium">{deployment.config?.frameworkPreset ?? "—"}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                      <p className="text-zinc-500">Root Directory</p>
                      <p className="font-medium font-mono">{deployment.config?.rootDirectory ?? "—"}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                      <p className="text-zinc-500">Build Command</p>
                      <p className="font-medium font-mono">{deployment.config?.buildCommand ?? "—"}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                      <p className="text-zinc-500">Output Directory</p>
                      <p className="font-medium font-mono">{deployment.config?.outputDirectory ?? "—"}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                      <p className="text-zinc-500">Install Command</p>
                      <p className="font-medium font-mono">{deployment.config?.installCommand ?? "—"}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Environment Variables</h2>
                  {!deployment.environmentVars.length ? (
                    <p className="text-sm text-zinc-500">No environment variables saved.</p>
                  ) : (
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                      {deployment.environmentVars.map((entry, index) => (
                        <div key={`${entry.key}-${index}`} className="px-4 py-3 flex justify-between gap-3 text-sm">
                          <span className="font-mono">{entry.key}</span>
                          <span className="font-mono text-zinc-500 truncate">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
