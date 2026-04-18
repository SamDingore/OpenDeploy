"use client";

import { useState } from "react";
import { Plus, GitBranch, Folder, Server, Building2, User, ChevronRight, Search } from "lucide-react";

type Account = {
  id: string;
  name: string;
  type: "personal" | "organization";
};

type Repo = {
  id: string;
  name: string;
  updatedAt: string;
};

type Project = {
  id: string;
  name: string;
  framework: string;
  domain: string;
};

const MOCK_ACCOUNTS: Account[] = [
  { id: "1", name: "samdingore", type: "personal" },
  { id: "acme-corp", name: "Acme Corp", type: "organization" },
  { id: "glambrandi", name: "Glambrandi", type: "organization" },
];

const MOCK_REPOS: Record<string, Repo[]> = {
  "1": [
    { id: "r1", name: "nextjs-portfolio", updatedAt: "2d ago" },
    { id: "r2", name: "react-todo-app", updatedAt: "5d ago" },
    { id: "r5", name: "personal-blog", updatedAt: "1w ago" },
  ],
  "acme-corp": [
    { id: "r3", name: "acme-landing-page", updatedAt: "1w ago" },
    { id: "r4", name: "acme-api-service", updatedAt: "2w ago" },
  ],
  "glambrandi": [
    { id: "r6", name: "glambrandi-store", updatedAt: "12h ago" },
    { id: "r7", name: "glambrandi-admin", updatedAt: "2d ago" },
  ],
};

const INITIAL_PROJECTS: Project[] = [
  { id: "p1", name: "OpenDeploy", framework: "Next.js", domain: "opendeploy.vercel.app" },
  { id: "p2", name: "glambrandi-frontend", framework: "Vite", domain: "glambrandi.com" },
];

export default function Home() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [step, setStep] = useState<"account" | "repo">("account");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const openDialog = () => {
    setIsDialogOpen(true);
    setStep("account");
    setSelectedAccount(null);
    setSelectedRepo(null);
    setSearchQuery("");
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
  };

  const handleAccountSelect = (account: Account) => {
    setSelectedAccount(account);
    setStep("repo");
    setSearchQuery("");
  };

  const handleRepoSelect = (repo: Repo) => {
    setSelectedRepo(repo);
  };

  const handleImport = () => {
    if (selectedRepo) {
      const newProject: Project = {
        id: `p${Date.now()}`,
        name: selectedRepo.name,
        framework: "Next.js",
        domain: `${selectedRepo.name}.vercel.app`,
      };
      setProjects([newProject, ...projects]);
      closeDialog();
    }
  };

  const filteredRepos = selectedAccount 
    ? MOCK_REPOS[selectedAccount.id]?.filter(repo => repo.name.toLowerCase().includes(searchQuery.toLowerCase())) || []
    : [];

  return (
    <div className="flex-1 bg-[#FAFAFA] flex flex-col p-8 dark:bg-[#0A0A0A]">
      <main className="max-w-6xl mx-auto w-full flex-1">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-zinc-50">Projects</h1>
          <button 
            onClick={openDialog}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <div key={project.id} className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
                  <Folder className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-zinc-50">{project.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-zinc-500">{project.domain}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400 pt-2 border-t border-gray-100 dark:border-zinc-800 mt-4">
                <Server className="w-4 h-4" />
                <span>{project.framework}</span>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
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
                  <div className="space-y-3">
                    {MOCK_ACCOUNTS.map(account => (
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
                            <div className="font-medium text-gray-900 dark:text-zinc-100">{account.name}</div>
                            <div className="text-xs text-gray-500 dark:text-zinc-500 capitalize">{account.type}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 dark:text-zinc-600 group-hover:text-gray-600 dark:group-hover:text-zinc-400 transition-colors" />
                      </button>
                    ))}
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
                    <span className="text-gray-900 dark:text-zinc-100 font-medium">{selectedAccount.name}</span>
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
                              <div className="text-xs text-gray-500 dark:text-zinc-500">{repo.updatedAt}</div>
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded-full border ${selectedRepo?.id === repo.id ? 'border-[5px] border-black dark:border-white' : 'border-gray-300 dark:border-zinc-600'}`}></div>
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-8 text-sm text-gray-500 dark:text-zinc-500">
                        No repositories found matching "{searchQuery}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-800 flex justify-end gap-3 bg-gray-50 dark:bg-[#0A0A0A]">
              <button 
                onClick={closeDialog}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-white bg-white dark:bg-[#111] border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleImport}
                disabled={step === "account" || !selectedRepo}
                className="px-4 py-2 text-sm font-medium text-white bg-black dark:bg-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
