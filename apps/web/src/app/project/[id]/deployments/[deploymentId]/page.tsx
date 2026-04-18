"use client";

import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Clock, GitBranch, LoaderCircle, Settings, TerminalSquare, UserCog } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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

type WorkerState = {
  id: string;
  status: "idle" | "busy";
  currentDeploymentId: string | null;
  updatedAt: string;
};

type Stage = {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "error";
  updatedAt: string;
};

type LogLine = {
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
};

type DeploymentStreamEvent =
  | {
      type: "snapshot";
      deploymentId: string;
      status: DeploymentDetails["status"];
      queuePosition: number;
      worker: WorkerState | null;
      workers: WorkerState[];
      logs: LogLine[];
      stages: Stage[];
      emittedAt: string;
    }
  | {
      type: "status";
      deploymentId: string;
      status: DeploymentDetails["status"];
      emittedAt: string;
    }
  | {
      type: "queue";
      deploymentId: string;
      queuePosition: number;
      emittedAt: string;
    }
  | {
      type: "worker";
      deploymentId: string;
      worker: WorkerState | null;
      workers: WorkerState[];
      emittedAt: string;
    }
  | {
      type: "stage";
      deploymentId: string;
      stage: Stage;
      emittedAt: string;
    }
  | {
      type: "log";
      deploymentId: string;
      line: LogLine;
      emittedAt: string;
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
  const [queuePosition, setQueuePosition] = useState(0);
  const [assignedWorker, setAssignedWorker] = useState<WorkerState | null>(null);
  const [workers, setWorkers] = useState<WorkerState[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [streamConnected, setStreamConnected] = useState(false);
  const redirectScheduledRef = useRef(false);

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

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    let cancelled = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    const decoder = new TextDecoder();
    let buffered = "";

    const applyEvent = (event: DeploymentStreamEvent) => {
      if (event.deploymentId !== deploymentId) {
        return;
      }
      if (event.type === "snapshot") {
        setQueuePosition(event.queuePosition);
        setAssignedWorker(event.worker);
        setWorkers(event.workers);
        setStages(event.stages);
        setLogs(event.logs);
        setDeployment((prev) => (prev ? { ...prev, status: event.status } : prev));
        return;
      }
      if (event.type === "status") {
        setDeployment((prev) => (prev ? { ...prev, status: event.status } : prev));
        return;
      }
      if (event.type === "queue") {
        setQueuePosition(event.queuePosition);
        return;
      }
      if (event.type === "worker") {
        setAssignedWorker(event.worker);
        setWorkers(event.workers);
        return;
      }
      if (event.type === "stage") {
        setStages((prev) => {
          const idx = prev.findIndex((stage) => stage.id === event.stage.id);
          if (idx === -1) {
            return [...prev, event.stage];
          }
          const next = [...prev];
          next[idx] = event.stage;
          return next;
        });
        return;
      }
      if (event.type === "log") {
        setLogs((prev) => [...prev, event.line].slice(-250));
      }
    };

    const connect = async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) {
          return;
        }

        const response = await fetch(
          `${apiBase()}/apis/projects/${projectId}/deployments/${deploymentId}/stream`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!response.ok || !response.body) {
          throw new Error(`Stream connection failed (${response.status})`);
        }

        setStreamConnected(true);
        reader = response.body.getReader();
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffered += decoder.decode(value, { stream: true });
          const frames = buffered.split("\n\n");
          buffered = frames.pop() ?? "";
          for (const frame of frames) {
            const dataLine = frame
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (!dataLine) {
              continue;
            }
            const raw = dataLine.slice("data: ".length);
            try {
              const event = JSON.parse(raw) as DeploymentStreamEvent;
              applyEvent(event);
            } catch {
              // Ignore malformed event payloads to keep stream resilient.
            }
          }
        }
      } catch {
        if (!cancelled) {
          setStreamConnected(false);
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      setStreamConnected(false);
      void reader?.cancel();
    };
  }, [deploymentId, getToken, isSignedIn, projectId]);

  const runningStage = useMemo(
    () => stages.find((stage) => stage.status === "running") ?? null,
    [stages],
  );

  useEffect(() => {
    if (
      !deployment ||
      deployment.status !== "ready" ||
      redirectScheduledRef.current
    ) {
      return;
    }
    redirectScheduledRef.current = true;
    const timeoutId = setTimeout(() => {
      router.push(`/project/${projectId}`);
    }, 1200);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [deployment, projectId, router]);

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
                <span
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    streamConnected
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  Stream {streamConnected ? "connected" : "connecting"}
                </span>
              </div>
            )}
          </div>

          <div className="p-6 space-y-6">
            {loading && <p className="text-sm text-zinc-500">Loading deployment...</p>}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {deployment?.status === "ready" && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Deployment is ready. Redirecting to project overview...
              </p>
            )}

            {!loading && !error && deployment && (
              <>
                <section className="space-y-3">
                  <h2 className="font-medium text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-2">
                    <UserCog className="w-4 h-4" />
                    Queue and Worker
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                      <p className="text-zinc-500">Queue Position</p>
                      <p className="font-semibold">{queuePosition > 0 ? `#${queuePosition}` : "Active / complete"}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                      <p className="text-zinc-500">Assigned Worker</p>
                      <p className="font-semibold">{assignedWorker?.id ?? "Waiting for worker"}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                      <p className="text-zinc-500">Pool Availability</p>
                      <p className="font-semibold">
                        {workers.filter((worker) => worker.status === "idle").length} idle / {workers.length} total
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="font-medium text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-2">
                    <LoaderCircle className="w-4 h-4" />
                    Build Pipeline
                  </h2>
                  {!stages.length ? (
                    <p className="text-sm text-zinc-500">Waiting for pipeline events...</p>
                  ) : (
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                      {stages.map((stage) => (
                        <div key={stage.id} className="px-4 py-3 flex items-center justify-between gap-3">
                          <span className="font-medium">{stage.label}</span>
                          <span
                            className={`text-xs px-2 py-1 rounded-md ${
                              stage.status === "completed"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                : stage.status === "running"
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 animate-pulse"
                                  : stage.status === "error"
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                            }`}
                          >
                            {stage.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {runningStage && (
                    <p className="text-xs text-zinc-500">Currently running: {runningStage.label}</p>
                  )}
                </section>

                <section className="space-y-3">
                  <h2 className="font-medium text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-2">
                    <TerminalSquare className="w-4 h-4" />
                    Live Logs
                  </h2>
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-100 h-56 overflow-auto space-y-2">
                    {!logs.length ? (
                      <p className="text-zinc-400">No logs yet. Waiting for worker output...</p>
                    ) : (
                      logs.map((line, index) => (
                        <div key={`${line.timestamp}-${index}`} className="flex gap-2">
                          <span className="text-zinc-500">{new Date(line.timestamp).toLocaleTimeString()}</span>
                          <span
                            className={
                              line.level === "error"
                                ? "text-rose-400"
                                : line.level === "warn"
                                  ? "text-amber-400"
                                  : line.level === "success"
                                    ? "text-emerald-400"
                                    : "text-blue-400"
                            }
                          >
                            [{line.level.toUpperCase()}]
                          </span>
                          <span>{line.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </section>

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
