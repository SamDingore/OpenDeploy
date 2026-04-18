"use client";

import { useAuth } from "@clerk/nextjs";
import { 
  ArrowLeft, 
  Clock, 
  GitBranch, 
  LoaderCircle, 
  Settings, 
  TerminalSquare, 
  UserCog, 
  CheckCircle2, 
  CircleDashed,
  XCircle,
  Activity,
  Server,
  Box,
  Hash,
  Database
} from "lucide-react";
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
  
  const bottomLogsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Attempt auto-scroll
    if (bottomLogsRef.current) {
      bottomLogsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

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
        setLogs((prev) => [...prev, event.line].slice(-500));
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready": return "text-emerald-500 bg-emerald-500/10";
      case "error": return "text-rose-500 bg-rose-500/10";
      case "building": return "text-amber-500 bg-amber-500/10 border-amber-500/50 animate-pulse";
      case "queued": return "text-zinc-500 bg-zinc-500/10";
      case "initializing": return "text-blue-500 bg-blue-500/10 animate-pulse";
      case "cancelled": return "text-zinc-500 bg-zinc-500/10";
      default: return "text-zinc-500 bg-zinc-500/10";
    }
  };

  const getStageIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "running": return <LoaderCircle className="w-5 h-5 text-blue-500 animate-spin" />;
      case "error": return <XCircle className="w-5 h-5 text-rose-500" />;
      default: return <CircleDashed className="w-5 h-5 text-zinc-400 dark:text-zinc-600" />;
    }
  };

  return (
    <div className="flex-1 bg-[#FAFAFA] dark:bg-[#0A0A0A] min-h-screen text-zinc-900 dark:text-zinc-50 p-4 md:p-8 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800">
      <main className="max-w-6xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => router.push(`/project/${projectId}`)}
          className="group flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
        >
          <span className="p-1 rounded-full bg-zinc-100 dark:bg-zinc-900 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
          </span>
          Back to Deployments
        </button>

        {loading && (
          <div className="flex flex-col items-center justify-center p-20 animate-in fade-in duration-500">
            <LoaderCircle className="w-8 h-8 text-zinc-400 animate-spin mb-4" />
            <p className="text-zinc-500">Loading Deployment Data...</p>
          </div>
        )}

        {error && (
          <div className="p-6 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 animate-in fade-in">
            {error}
          </div>
        )}

        {!loading && !error && deployment && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header & Quick Info block */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111] shadow-sm overflow-hidden relative">
                {/* Glow bar for active builds */}
                {(deployment.status === "building" || deployment.status === "initializing") && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-amber-500 to-emerald-500 animate-pulse" />
                )}
                
                <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h1 className="text-xl md:text-3xl font-bold font-mono tracking-tight flex items-center gap-3">
                      <TerminalSquare className="w-6 h-6 md:w-8 md:h-8 text-zinc-400" />
                      {deploymentId}
                    </h1>
                    
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded-md">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTimeAgo(deployment.createdAt)}
                      </span>
                      <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded-md">
                        <GitBranch className="w-3.5 h-3.5" />
                        {deployment.sourceBranch ?? "—"}
                      </span>
                      <span className={`px-2.5 py-1 rounded-md text-xs uppercase font-bold tracking-wider border ${getStatusColor(deployment.status)}`}>
                        {deployment.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 text-right">
                     <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border ${
                        streamConnected
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${streamConnected ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
                      Stream {streamConnected ? "Connected" : "Connecting..."}
                    </span>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 max-w-[200px] truncate">
                      {deployment.commitMessage ?? "Manual triggers do not have commit info over here normally. "}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Left Column: Build Tools */}
            <div className="lg:col-span-2 space-y-6">
              {/* Build Logs Terminal */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#FAFAFA] dark:bg-[#0A0A0A] shadow-sm overflow-hidden flex flex-col min-h-[400px] max-h-[600px]">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111] flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-zinc-500" />
                    <h2 className="text-sm font-semibold">Build Logs</h2>
                  </div>
                  {runningStage && (
                    <div className="text-xs text-zinc-500 flex items-center gap-2">
                      <LoaderCircle className="w-3 h-3 animate-spin"/> {runningStage.label}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 p-4 md:p-6 overflow-y-auto font-mono text-xs md:text-sm bg-zinc-50 dark:bg-[#0A0A0A] relative">
                  {!logs.length ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-3">
                      <LoaderCircle className="w-6 h-6 animate-spin opacity-50" />
                      <p>Awaiting worker connection...</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {logs.map((line, index) => (
                        <div key={`${line.timestamp}-${index}`} className="flex gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 px-2 py-0.5 rounded transition-colors group">
                          <span className="text-zinc-400 dark:text-zinc-600 shrink-0 select-none hidden md:block">
                            {new Date(line.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                          </span>
                          <span
                            className={`shrink-0 w-8 select-none ${
                              line.level === "error"
                                ? "text-rose-500"
                                : line.level === "warn"
                                  ? "text-amber-500"
                                  : line.level === "success"
                                    ? "text-emerald-500"
                                    : "text-blue-500"
                            }`}
                          >
                            [{line.level.charAt(0).toUpperCase()}]
                          </span>
                          <span className="text-zinc-700 dark:text-zinc-300 break-all">{line.message}</span>
                        </div>
                      ))}
                      <div ref={bottomLogsRef} className="h-1" />
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Configuration Accordion or Details */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111] shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Settings className="w-4 h-4 text-zinc-500" />
                    Execution Configuration
                  </h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1 block">Root Directory</label>
                    <div className="font-mono text-sm bg-zinc-50 dark:bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {deployment.config?.rootDirectory ?? "./"}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1 block">Framework</label>
                    <div className="font-sans text-sm bg-zinc-50 dark:bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {deployment.config?.frameworkPreset ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1 block">Install Command</label>
                    <div className="font-mono text-sm bg-zinc-50 dark:bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 truncate" title={deployment.config?.installCommand ?? "—"}>
                      {deployment.config?.installCommand ?? "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1 block">Build Command</label>
                    <div className="font-mono text-sm bg-zinc-50 dark:bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 truncate" title={deployment.config?.buildCommand ?? "—"}>
                      {deployment.config?.buildCommand ?? "—"}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1 block">Output Directory</label>
                    <div className="font-mono text-sm bg-zinc-50 dark:bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {deployment.config?.outputDirectory ?? "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Pipeline & Instance Info */}
            <div className="space-y-6">
              {/* Build Pipeline */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111] shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Box className="w-4 h-4 text-zinc-500" />
                    Pipeline Stages
                  </h2>
                </div>
                <div className="p-6">
                  {!stages.length ? (
                    <div className="text-sm text-zinc-500 text-center py-6">
                      Waiting for pipeline to init...
                    </div>
                  ) : (
                    <div className="relative space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:w-0.5 before:h-full before:bg-zinc-200 dark:before:bg-zinc-800 before:z-0">
                      {stages.map((stage, i) => (
                        <div key={stage.id} className="relative flex items-center justify-between z-10 bg-white dark:bg-[#111]">
                          <div className="flex items-center gap-4">
                            <div className="bg-white dark:bg-[#111] rounded-full">
                              {getStageIcon(stage.status)}
                            </div>
                            <span className={`text-sm font-medium ${stage.status === 'completed' ? 'text-zinc-900 dark:text-zinc-100' : stage.status === 'running' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500'}`}>
                              {stage.label}
                            </span>
                          </div>
                          
                          {stage.status === 'running' && (
                            <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded animate-pulse">Running</span>
                          )}
                          {stage.status === 'completed' && (
                            <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Done</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Infrastructure Stats */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111] shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Server className="w-4 h-4 text-zinc-500" />
                    Infrastructure
                  </h2>
                </div>
                <div className="p-6 space-y-4 text-sm">
                  <div className="flex justify-between items-center pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <Hash className="w-4 h-4" /> Queue Pos
                    </div>
                    <span className="font-mono font-medium">
                      {queuePosition > 0 ? `#${queuePosition}` : "Complete/Active"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <UserCog className="w-4 h-4" /> Assigned Node
                    </div>
                    <span className="font-mono max-w-[120px] truncate text-right">
                      {assignedWorker?.id ?? "Pending"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <Database className="w-4 h-4" /> Active Nodes
                    </div>
                    <span>
                      {workers.filter((worker) => worker.status === "idle").length} Idle / {workers.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Environment Variables */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111] shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                     Environment
                  </h2>
                </div>
                <div className="p-6 max-h-[300px] overflow-y-auto">
                  {!deployment.environmentVars.length ? (
                    <p className="text-xs text-zinc-500 text-center">No environment variables exposed.</p>
                  ) : (
                    <div className="space-y-3">
                      {deployment.environmentVars.map((entry, index) => (
                        <div key={`${entry.key}-${index}`} className="flex flex-col bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1 truncate">{entry.key}</span>
                          <div className="text-xs font-mono text-zinc-500 bg-zinc-200 dark:bg-[#0A0A0A] p-2 rounded truncate select-all border border-zinc-300 dark:border-zinc-800">
                            {entry.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
