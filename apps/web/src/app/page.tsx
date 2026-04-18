"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, GitBranch, Folder, Server, Building2, User, ChevronRight, Search } from "lucide-react";

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

const apiBase = () =>
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

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
        const text = await res.text();
        throw new Error(text || `Failed to load accounts (${res.status}).`);
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
          const text = await res.text();
          throw new Error(text || `Failed to load repositories (${res.status}).`);
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

  return (
    <div className="flex-1 bg-[#FAFAFA] flex flex-col p-8 dark:bg-[#0A0A0A]">
      <main className="max-w-6xl mx-auto w-full flex-1">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-zinc-50">Projects</h1>
          <button 
            onClick={openDialog}
            disabled={!isSignedIn}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            <Plus className="w-4 h-4" />
            Create Project
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
