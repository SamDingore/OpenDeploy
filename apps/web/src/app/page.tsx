"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, GitBranch, Folder, Server, Building2, User, ChevronRight, Search, Cpu, Database, Activity, ArrowDown, ArrowUp, HardDrive } from "lucide-react";

type GithubAccount = {
  id: string;
  login: string;
  type: "personal" | "organization";
};

type GithubRepo = {
  id: string;
  name: string;
  fullName: string;
  ownerLogin: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  updatedAt: string;
};

type Project = {
  id: string;
  name: string;
  framework: string;
  domain: string | null;
};

type ServerMetricsSnapshot = {
  type: "snapshot";
  hostname: string;
  cpuPercent?: number;
  cpuCores: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  diskFreeBytes: number | null;
  diskTotalBytes: number | null;
  networkIngressBps: number | null;
  networkEgressBps: number | null;
  emittedAt: string;
};

const apiBase = () =>
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

/** Reads Nest-style `{ message: string }` from error responses so the UI does not show raw JSON. */
async function readApiErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { message?: unknown };
    if (typeof j.message === "string") {
      return j.message;
    }
    if (Array.isArray(j.message) && j.message.every((x) => typeof x === "string")) {
      return j.message.join(" ");
    }
  } catch {
    // fall through
  }
  return text.trim() || `Request failed (${res.status})`;
}

const gib = (bytes: number): number => bytes / 1024 ** 3;

const formatRateMibPerSec = (bytesPerSec: number): string =>
  `${(bytesPerSec / 1024 ** 2).toFixed(1)} MB/s`;

const relativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function Home() {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [step, setStep] = useState<"account" | "repo">("account");
  const [accounts, setAccounts] = useState<GithubAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<GithubAccount | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [serverMetrics, setServerMetrics] = useState<ServerMetricsSnapshot | null>(null);
  const [serverMetricsConnected, setServerMetricsConnected] = useState(false);
  const [serverMetricsError, setServerMetricsError] = useState<string | null>(null);

  const authedFetch = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const token = await getToken();
      if (!token) {
        throw new Error("No session token found. Please sign in again.");
      }
      return fetch(`${apiBase()}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init?.headers ?? {}),
        },
      });
    },
    [getToken],
  );

  const loadProjects = useCallback(async () => {
    if (!isSignedIn) {
      setProjects([]);
      setProjectsError(null);
      return;
    }
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const res = await authedFetch("/apis/projects");
      if (!res.ok) {
        throw new Error(`Could not load projects (${res.status})`);
      }
      const data = (await res.json()) as { projects: Project[] };
      setProjects(data.projects);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Could not load projects.");
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, [authedFetch, isSignedIn]);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const res = await authedFetch("/apis/github/accounts");
      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res));
      }
      const data = (await res.json()) as { accounts: GithubAccount[] };
      setAccounts(data.accounts);
    } catch (error) {
      setAccounts([]);
      setAccountsError(
        error instanceof Error
          ? error.message
          : "Could not load GitHub accounts. Connect GitHub from settings first.",
      );
    } finally {
      setAccountsLoading(false);
    }
  }, [authedFetch]);

  const loadReposForAccount = useCallback(
    async (account: GithubAccount) => {
      setReposLoading(true);
      setReposError(null);
      setRepos([]);
      try {
        const res = await authedFetch(`/apis/github/repos?owner=${encodeURIComponent(account.login)}`);
        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res));
        }
        const data = (await res.json()) as { repos: GithubRepo[] };
        setRepos(data.repos);
      } catch (error) {
        setReposError(error instanceof Error ? error.message : "Could not load repositories.");
      } finally {
        setReposLoading(false);
      }
    },
    [authedFetch],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadProjects();
    });
  }, [loadProjects]);

  useEffect(() => {
    if (!isSignedIn) {
      setServerMetrics(null);
      setServerMetricsConnected(false);
      setServerMetricsError(null);
      return;
    }

    let cancelled = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const decoder = new TextDecoder();
    let buffered = "";

    const connect = async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) {
          return;
        }
        const res = await fetch(`${apiBase()}/apis/server-metrics/stream`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || !res.body) {
          throw new Error(`Live metrics unavailable (${res.status})`);
        }
        setServerMetricsConnected(true);
        setServerMetricsError(null);
        reader = res.body.getReader();
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
              const event = JSON.parse(raw) as ServerMetricsSnapshot;
              if (event.type === "snapshot") {
                setServerMetrics(event);
              }
            } catch {
              // Ignore malformed SSE payloads.
            }
          }
        }
      } catch {
        if (!cancelled) {
          setServerMetricsConnected(false);
          setServerMetricsError("Could not load live server metrics.");
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      setServerMetricsConnected(false);
      void reader?.cancel();
    };
  }, [getToken, isSignedIn]);

  const openDialog = () => {
    if (!isSignedIn) {
      return;
    }
    setIsDialogOpen(true);
    setStep("account");
    setSelectedAccount(null);
    setSelectedRepo(null);
    setRepos([]);
    setReposError(null);
    setImportError(null);
    setSearchQuery("");
    void loadAccounts();
  };

  const closeDialog = () => {
    if (importLoading) {
      return;
    }
    setIsDialogOpen(false);
  };

  const handleAccountSelect = (account: GithubAccount) => {
    setSelectedAccount(account);
    setSelectedRepo(null);
    setStep("repo");
    setSearchQuery("");
    void loadReposForAccount(account);
  };

  const handleRepoSelect = (repo: GithubRepo) => {
    setSelectedRepo(repo);
  };

  const handleImport = async () => {
    if (!selectedRepo) {
      return;
    }
    setImportLoading(true);
    setImportError(null);
    try {
      const res = await authedFetch("/apis/projects/import-github", {
        method: "POST",
        body: JSON.stringify({
          githubRepoId: selectedRepo.id,
          ownerLogin: selectedRepo.ownerLogin,
          name: selectedRepo.name,
          fullName: selectedRepo.fullName,
          defaultBranch: selectedRepo.defaultBranch,
          htmlUrl: selectedRepo.htmlUrl,
          isPrivate: selectedRepo.isPrivate,
          framework: "Next.js",
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Import failed (${res.status}).`);
      }
      const data = (await res.json()) as { project: Project };
      setProjects((prev) => [data.project, ...prev.filter((p) => p.id !== data.project.id)]);
      setIsDialogOpen(false);
      router.push(`/project/${data.project.id}`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not import project.");
    } finally {
      setImportLoading(false);
    }
  };

  const filteredRepos = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return repos.filter((repo) => repo.name.toLowerCase().includes(query));
  }, [repos, searchQuery]);

  const serverUi = useMemo(() => {
    if (!isSignedIn) {
      return {
        kind: "demo" as const,
        host: "production-gb-server-01",
        cpuPercent: 24,
        cpuCores: 16,
        memUsedGiB: 18.4,
        memTotalGiB: 64,
        memBarPct: (18.4 / 64) * 100,
        diskFreeGiB: 854,
        diskTotalGiB: 2048,
        diskBarPct: ((2048 - 854) / 2048) * 100,
        netInBps: 4.2 * 1024 * 1024,
        netOutBps: 1.8 * 1024 * 1024,
      };
    }
    if (!serverMetrics) {
      return {
        kind: "pending" as const,
        host: serverMetricsConnected ? "Loading…" : "…",
      };
    }
    const m = serverMetrics;
    const memBarPct =
      m.memoryTotalBytes > 0 ? (m.memoryUsedBytes / m.memoryTotalBytes) * 100 : 0;
    const hasDisk =
      m.diskFreeBytes != null &&
      m.diskTotalBytes != null &&
      m.diskTotalBytes > 0;
    const diskBarPct = hasDisk
      ? ((m.diskTotalBytes! - m.diskFreeBytes!) / m.diskTotalBytes!) * 100
      : 0;
    return {
      kind: "live" as const,
      host: m.hostname,
      cpuPercent: m.cpuPercent,
      cpuCores: m.cpuCores,
      memUsedGiB: gib(m.memoryUsedBytes),
      memTotalGiB: gib(m.memoryTotalBytes),
      memBarPct,
      diskFreeGiB: hasDisk ? gib(m.diskFreeBytes!) : null,
      diskTotalGiB: hasDisk ? gib(m.diskTotalBytes!) : null,
      diskBarPct: hasDisk ? diskBarPct : null,
      netInBps: m.networkIngressBps,
      netOutBps: m.networkEgressBps,
    };
  }, [isSignedIn, serverMetrics, serverMetricsConnected]);

  return (
    <div className="flex-1 bg-[#FAFAFA] flex flex-col p-8 dark:bg-[#0A0A0A]">
      <main className="max-w-6xl mx-auto w-full flex-1">
        {/* Server Dashboard Section — live metrics stream when signed in */}
        <div className="mb-12">
          {serverMetricsError && isSignedIn && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {serverMetricsError}
            </div>
          )}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-800 to-black dark:from-zinc-100 dark:to-zinc-300 flex items-center justify-center shadow-lg">
              <Server className="w-6 h-6 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100 tracking-tight">{serverUi.host}</h1>
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                <span className="relative flex h-2 w-2">
                  {serverUi.kind === "live" ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-400 dark:bg-zinc-500"></span>
                  )}
                </span>
                {serverUi.kind === "live" ? "Live metrics" : serverUi.kind === "demo" ? "Demo preview" : "Connecting…"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* CPU Usage Card */}
            <div className="bg-white dark:bg-[#111] p-5 rounded-2xl border border-gray-200 dark:border-zinc-800/80 shadow-sm relative overflow-hidden group">
              <div className="flex justify-between items-center mb-4 relative z-10">
                <h3 className="text-sm font-medium text-gray-500 dark:text-zinc-400">CPU Usage</h3>
                <div className="p-1.5 rounded-md bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <Cpu className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-3 relative z-10">
                <span className="text-3xl font-semibold text-gray-900 dark:text-zinc-50 tracking-tight">
                  {serverUi.kind !== "pending"
                    ? `${serverUi.cpuPercent != null ? Math.round(serverUi.cpuPercent) : "—"}%`
                    : "—"}
                </span>
                <span className="text-sm text-gray-500 dark:text-zinc-500">
                  of {serverUi.kind !== "pending" ? serverUi.cpuCores : "—"} cores
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-zinc-800/50 rounded-full h-1.5 relative z-10 overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${serverUi.kind !== "pending" && serverUi.cpuPercent != null ? Math.min(100, serverUi.cpuPercent) : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Memory Usage Card */}
            <div className="bg-white dark:bg-[#111] p-5 rounded-2xl border border-gray-200 dark:border-zinc-800/80 shadow-sm relative overflow-hidden group">
              <div className="flex justify-between items-center mb-4 relative z-10">
                <h3 className="text-sm font-medium text-gray-500 dark:text-zinc-400">Memory</h3>
                <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Database className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-3 relative z-10">
                <span className="text-3xl font-semibold text-gray-900 dark:text-zinc-50 tracking-tight">
                  {serverUi.kind !== "pending" ? (
                    <>
                      {serverUi.memUsedGiB.toFixed(1)}{" "}
                      <span className="text-xl">GiB</span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="text-sm text-gray-500 dark:text-zinc-500">
                  {serverUi.kind !== "pending" ? `/ ${serverUi.memTotalGiB.toFixed(0)} GiB` : ""}
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-zinc-800/50 rounded-full h-1.5 relative z-10 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${serverUi.kind !== "pending" ? serverUi.memBarPct : 0}%`,
                  }}
                ></div>
              </div>
            </div>
            
            {/* Network Activity Card */}
            <div className="bg-white dark:bg-[#111] p-5 rounded-2xl border border-gray-200 dark:border-zinc-800/80 shadow-sm relative overflow-hidden group">
              <div className="flex justify-between items-center mb-3 relative z-10">
                <h3 className="text-sm font-medium text-gray-500 dark:text-zinc-400">Network</h3>
                <div className="p-1.5 rounded-md bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-1 relative z-10">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-zinc-400 text-sm flex items-center gap-1.5">
                    <div className="p-1 rounded bg-teal-50 dark:bg-teal-500/10"><ArrowDown className="w-3 h-3 text-teal-600 dark:text-teal-400"/></div>
                    Ingress
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-zinc-100">
                    {serverUi.kind === "pending"
                      ? "—"
                      : serverUi.netInBps != null
                        ? formatRateMibPerSec(serverUi.netInBps)
                        : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-zinc-400 text-sm flex items-center gap-1.5">
                    <div className="p-1 rounded bg-orange-50 dark:bg-orange-500/10"><ArrowUp className="w-3 h-3 text-orange-600 dark:text-orange-400"/></div>
                    Egress
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-zinc-100">
                    {serverUi.kind === "pending"
                      ? "—"
                      : serverUi.netOutBps != null
                        ? formatRateMibPerSec(serverUi.netOutBps)
                        : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Available Storage Card */}
            <div className="bg-white dark:bg-[#111] p-5 rounded-2xl border border-gray-200 dark:border-zinc-800/80 shadow-sm relative overflow-hidden group">
              <div className="flex justify-between items-center mb-4 relative z-10">
                <h3 className="text-sm font-medium text-gray-500 dark:text-zinc-400">Storage</h3>
                <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <HardDrive className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-3 relative z-10">
                <span className="text-3xl font-semibold text-gray-900 dark:text-zinc-50 tracking-tight">
                  {serverUi.kind !== "pending" && serverUi.diskFreeGiB != null ? (
                    <>
                      {Math.round(serverUi.diskFreeGiB)}{" "}
                      <span className="text-xl">GiB</span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="text-sm text-gray-500 dark:text-zinc-500">
                  {serverUi.kind !== "pending" && serverUi.diskTotalGiB != null
                    ? `free of ${Math.round(serverUi.diskTotalGiB)} GiB`
                    : ""}
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-zinc-800/50 rounded-full h-1.5 relative z-10 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${serverUi.kind !== "pending" && serverUi.diskBarPct != null ? Math.min(100, serverUi.diskBarPct) : 0}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-50">Projects</h2>
          <button 
            onClick={openDialog}
            disabled={!isSignedIn}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm dark:bg-white dark:text-black dark:hover:bg-gray-200 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {!isSignedIn && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            Sign in first, then connect GitHub in settings to import repositories.
          </div>
        )}

        {projectsError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {projectsError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projectsLoading && (
            <div className="col-span-full py-12 text-center text-gray-500 border-2 border-dashed border-gray-300 dark:border-zinc-800 rounded-xl">
              Loading projects...
            </div>
          )}
          {projects.map(project => (
            <div 
              key={project.id} 
              onClick={() => router.push(`/project/${project.id}`)}
              className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
                  <Folder className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-zinc-50">{project.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-zinc-500">
                    {project.domain ?? "Domain is pending"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400 pt-2 border-t border-gray-100 dark:border-zinc-800 mt-4">
                <Server className="w-4 h-4" />
                <span>{project.framework}</span>
              </div>
            </div>
          ))}
          {!projectsLoading && projects.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500 border-2 border-dashed border-gray-300 dark:border-zinc-800 rounded-xl">
              No projects found. Create one to get started!
            </div>
          )}
        </div>
      </main>

      {/* Import Project Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div 
            className="bg-white dark:bg-[#111] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-zinc-800"
          >
            <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {step === "account" ? "Import Git Repository" : "Select Repository"}
              </h2>
              <button 
                onClick={closeDialog} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none transition-colors"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {step === "account" && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">Select an account or organization to import a repository from.</p>
                  {accountsError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                      {accountsError}
                    </div>
                  )}
                  {accountsLoading && (
                    <p className="text-sm text-gray-500 dark:text-zinc-500">Loading GitHub accounts...</p>
                  )}
                  <div className="space-y-3">
                    {accounts.map(account => (
                      <button
                        key={account.id}
                        onClick={() => handleAccountSelect(account)}
                        className="w-full flex items-center justify-between p-4 border border-gray-200 dark:border-zinc-800 rounded-lg hover:border-black dark:hover:border-zinc-400 bg-white dark:bg-[#111] hover:bg-gray-50 dark:hover:bg-zinc-900 transition-all text-left group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-gray-700 dark:text-zinc-300">
                            {account.type === "personal" ? <User className="w-5 h-5"/> : <Building2 className="w-5 h-5"/>}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-zinc-100">{account.login}</div>
                            <div className="text-xs text-gray-500 dark:text-zinc-500 capitalize">{account.type}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 dark:text-zinc-600 group-hover:text-gray-600 dark:group-hover:text-zinc-400 transition-colors" />
                      </button>
                    ))}
                    {!accountsLoading && accounts.length === 0 && !accountsError && (
                      <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                        No GitHub accounts available.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === "repo" && selectedAccount && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-sm">
                    <button 
                      onClick={() => setStep("account")} 
                      className="text-gray-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
                    >
                      Accounts
                    </button>
                    <span className="text-gray-300 dark:text-zinc-600">/</span>
                    <span className="text-gray-900 dark:text-zinc-100 font-medium">{selectedAccount.login}</span>
                  </div>
                  
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search repositories..." 
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-[#111] text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-zinc-100"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-3">
                    {reposError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                        {reposError}
                      </div>
                    )}
                    {reposLoading && (
                      <div className="text-center py-8 text-sm text-gray-500 dark:text-zinc-500">
                        Loading repositories...
                      </div>
                    )}
                    {filteredRepos.length > 0 ? (
                      filteredRepos.map(repo => (
                        <button
                          key={repo.id}
                          onClick={() => handleRepoSelect(repo)}
                          className={`w-full flex items-center justify-between p-4 border rounded-lg transition-all text-left ${
                            selectedRepo?.id === repo.id 
                              ? 'border-black bg-gray-50 dark:border-white dark:bg-zinc-800/50' 
                              : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <GitBranch className={`w-6 h-6 ${selectedRepo?.id === repo.id ? 'text-black dark:text-white' : 'text-gray-600 dark:text-zinc-400'}`} />
                            <div>
                              <div className="font-medium text-gray-900 dark:text-zinc-100">{repo.name}</div>
                              <div className="text-xs text-gray-500 dark:text-zinc-500">{relativeTime(repo.updatedAt)}</div>
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded-full border ${selectedRepo?.id === repo.id ? 'border-[5px] border-black dark:border-white' : 'border-gray-300 dark:border-zinc-600'}`}></div>
                        </button>
                      ))
                    ) : (!reposLoading && (
                      <div className="text-center py-8 text-sm text-gray-500 dark:text-zinc-500">
                        No repositories found matching &quot;{searchQuery}&quot;
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-800 flex justify-end gap-3 bg-gray-50 dark:bg-[#0A0A0A]">
              {importError && (
                <div className="mr-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                  {importError}
                </div>
              )}
              <button 
                onClick={closeDialog}
                disabled={importLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-white bg-white dark:bg-[#111] border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => void handleImport()}
                disabled={step === "account" || !selectedRepo || importLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-black dark:bg-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importLoading ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
