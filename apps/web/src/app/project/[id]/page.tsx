"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, GitBranch, Activity, Clock, Cpu, RotateCcw, ArrowUpCircle, HardDrive, RefreshCw, Server, Globe, Terminal, Plus } from "lucide-react";

// Mock data structures
type Status = "ready" | "error" | "building" | "queued" | "initializing" | "cancelled";

type Deployment = {
  id: string;
  status: Status;
  buildTime: string;
  sourceBranch: string;
  lastCommit: string;
  timeAgo: string;
  deployedBy: string;
};

const MOCK_DEPLOYMENTS: Deployment[] = [
  { id: "dep_abc123", status: "building", buildTime: "-", sourceBranch: "feat/auth", lastCommit: "fix: auth flow issue", timeAgo: "Just now", deployedBy: "Sam Dingore" },
  { id: "dep_def456", status: "ready", buildTime: "1m 12s", sourceBranch: "main", lastCommit: "feat: add new dashboard", timeAgo: "2 hours ago", deployedBy: "Sam Dingore" },
  { id: "dep_ghi789", status: "error", buildTime: "45s", sourceBranch: "main", lastCommit: "Merge pull request #12", timeAgo: "1 day ago", deployedBy: "Acme CI" },
  { id: "dep_jkl012", status: "cancelled", buildTime: "12s", sourceBranch: "fix/typo", lastCommit: "fix: typo in header", timeAgo: "2 days ago", deployedBy: "Sam Dingore" },
  { id: "dep_pqr345", status: "ready", buildTime: "1m 05s", sourceBranch: "main", lastCommit: "Initial commit", timeAgo: "3 days ago", deployedBy: "Sam Dingore" },
];

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  
  const [activeTab, setActiveTab] = useState<"overview" | "deployments" | "domains" | "logs">("overview");

  const getStatusColor = (status: Status) => {
    switch (status) {
      case "ready": return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
      case "error": return "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]";
      case "building": return "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.5)]";
      case "queued": return "bg-gray-400";
      case "initializing": return "bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]";
      case "cancelled": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: Status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusTextColor = (status: Status) => {
    switch (status) {
      case "ready": return "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10";
      case "error": return "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10";
      case "building": return "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10";
      case "queued": return "text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-500/10";
      case "initializing": return "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10";
      case "cancelled": return "text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-500/10";
      default: return "text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-500/10";
    }
  };

  return (
    <div className="flex-1 bg-[#FAFAFA] flex flex-col p-4 md:p-8 dark:bg-[#0A0A0A] min-h-screen font-sans text-zinc-900 dark:text-zinc-50">
      <main className="max-w-6xl mx-auto w-full flex-1">
        {/* Header Section */}
        <div className="mb-8">
          <button 
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </button>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight">awesome-project</h1>
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor("building")}`} />
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Building</span>
                </div>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 mt-2 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                samdingore/awesome-project
              </p>
            </div>

            <div className="flex gap-3">
              <a 
                href="#"
                className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 px-4 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium text-sm shadow-sm"
              >
                <GitBranch className="w-4 h-4" />
                Repository
              </a>
              <a 
                href="#"
                className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium text-sm shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Visit Site
              </a>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-zinc-800 mb-8 mt-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === "overview" 
                ? "text-zinc-900 dark:text-zinc-50" 
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Overview
            {activeTab === "overview" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("deployments")}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === "deployments" 
                ? "text-zinc-900 dark:text-zinc-50" 
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Deployments
            {activeTab === "deployments" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("domains")}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === "domains" 
                ? "text-zinc-900 dark:text-zinc-50" 
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Domains
            {activeTab === "domains" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === "logs" 
                ? "text-zinc-900 dark:text-zinc-50" 
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Logs
            {activeTab === "logs" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white rounded-t-full" />
            )}
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Main Content Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Current Deployment Panel */}
              <div className="bg-white dark:bg-[#111] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-[#111]">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-500" />
                    Current Deployment
                  </h2>
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-900">
                    Building
                  </span>
                </div>
                <div className="p-6">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row gap-6 md:items-center">
                      <div className="h-24 w-full md:w-40 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-100 dark:bg-zinc-900 flex justify-center items-center">
                         <Activity className="w-8 h-8 text-zinc-300 dark:text-zinc-700 animate-pulse" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Commit</span>
                          <code className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-300">
                            a1b2c3d
                          </code>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          feat: add new dashboard and component library integration
                        </p>
                        <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
                          <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> feat/auth</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Started 2m ago</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Domains */}
              <div className="bg-white dark:bg-[#111] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                  <h2 className="font-semibold flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-blue-500" />
                    Domains
                  </h2>
                </div>
                <div className="p-0">
                  <div className="flex items-center justify-between p-4 px-6 border-b border-zinc-100 dark:border-zinc-800/50">
                    <div>
                      <div className="font-medium flex items-center gap-2 text-sm">
                        awesome-project.opendeploy.app
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-1.5 py-0.5 rounded">Primary</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">Configured securely with TLS</div>
                    </div>
                    <button className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium">Edit</button>
                  </div>
                  <div className="flex items-center justify-between p-4 px-6">
                    <div>
                      <div className="font-medium flex items-center gap-2 text-sm">
                        awesome-project-git-main.opendeploy.app
                        <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400 px-1.5 py-0.5 rounded">Branch</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">Automatically assigns branch aliases</div>
                    </div>
                    <button className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium">Edit</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
              {/* Resource Stats */}
              <div className="bg-white dark:bg-[#111] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-500" />
                    Compute & Resources
                  </h2>
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Serverless Functions</span>
                      <span className="font-medium">1.2s avg</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
                      <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: "45%" }}></div>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 text-right">4.5M Invocations</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Bandwidth</span>
                      <span className="font-medium">14.2 GB</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: "22%" }}></div>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 text-right">Out of 100GB limit</p>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Uptime</span>
                      <span className="font-medium text-emerald-500">99.99%</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <div key={i} className="h-6 flex-1 bg-emerald-500 rounded-sm opacity-80" style={{ opacity: i === 28 ? 0.3 : (i === 14 ? 0.2 : 0.8), backgroundColor: i === 28 || i === 14 ? '#eab308' : '#10b981' }}></div>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 text-right">Last 30 days</p>
                  </div>
                </div>
              </div>

              {/* Environment Info */}
              <div className="bg-white dark:bg-[#111] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
                 <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <HardDrive className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Framework</div>
                        <div className="text-xs text-zinc-500">Next.js 14</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <Server className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Node.js Version</div>
                        <div className="text-xs text-zinc-500">18.17.0</div>
                      </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* Deployments Tab */}
        {activeTab === "deployments" && (
          <div className="bg-white dark:bg-[#111] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#0A0A0A]">
                    <th className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400">Deployment</th>
                    <th className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                    <th className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400">Commit</th>
                    <th className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400">Branch</th>
                    <th className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400">Duration</th>
                    <th className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400">Time</th>
                    <th className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {MOCK_DEPLOYMENTS.map((deploy) => (
                    <tr key={deploy.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-zinc-900 dark:text-zinc-100">{deploy.id.split('_')[1]}</span>
                          {deploy.status === "building" && <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusTextColor(deploy.status)} border-current/20`}>
                          <div className={`w-1.5 h-1.5 rounded-full mr-2 ${getStatusColor(deploy.status).split(' ')[0]}`} />
                          {getStatusLabel(deploy.status)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-zinc-900 dark:text-zinc-100 font-medium truncate max-w-[180px]" title={deploy.lastCommit}>
                          {deploy.lastCommit}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">by {deploy.deployedBy}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                          <GitBranch className="w-3 h-3" />
                          <span className="font-mono text-xs">{deploy.sourceBranch}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                        {deploy.buildTime}
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                        {deploy.timeAgo}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {deploy.status === "ready" && (
                            <button className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title="Promote to Production">
                              <ArrowUpCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title="Redeploy">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Domains Tab */}
        {activeTab === "domains" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-medium">Production Domains</h3>
                <p className="text-sm text-zinc-500">Manage custom domains assigned to this project.</p>
              </div>
              <button className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium text-sm shadow-sm">
                <Plus className="w-4 h-4" />
                Add Domain
              </button>
            </div>
            
            <div className="bg-white dark:bg-[#111] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-0">
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800/50">
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-zinc-400 mt-0.5" />
                    <div>
                      <div className="font-medium flex items-center gap-2 text-base">
                        awesome-project.opendeploy.app
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-1.5 py-0.5 rounded">Primary</span>
                      </div>
                      <div className="text-sm text-emerald-600 dark:text-emerald-500 mt-1 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Valid Configuration
                      </div>
                    </div>
                  </div>
                  <button className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium border border-zinc-200 dark:border-zinc-700">Edit</button>
                </div>
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-zinc-400 mt-0.5" />
                    <div>
                      <div className="font-medium flex items-center gap-2 text-base">
                        awesome-project-git-main.opendeploy.app
                        <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400 px-1.5 py-0.5 rounded">Branch</span>
                      </div>
                      <div className="text-sm text-emerald-600 dark:text-emerald-500 mt-1 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Valid Configuration
                      </div>
                    </div>
                  </div>
                  <button className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium border border-zinc-200 dark:border-zinc-700">Edit</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div className="bg-[#0A0A0A] rounded-xl border border-zinc-800 shadow-inner overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col min-h-[500px]">
             <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center bg-[#111] shrink-0">
               <div className="flex items-center gap-2 text-zinc-300 font-medium text-sm">
                 <Terminal className="w-4 h-4" />
                 Production Runtime Logs
               </div>
               <div className="flex items-center gap-2">
                 <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   Listening
                 </span>
               </div>
             </div>
             <div className="p-4 font-mono text-sm overflow-y-auto flex-1 space-y-2 !text-zinc-300 selection:bg-emerald-500/30">
               <div className="flex gap-4">
                 <span className="text-zinc-500 shrink-0">12:01:45</span>
                 <span className="text-blue-400 shrink-0">[INFO]</span>
                 <span>Server started successfully on port 3000.</span>
               </div>
               <div className="flex gap-4">
                 <span className="text-zinc-500 shrink-0">12:01:46</span>
                 <span className="text-blue-400 shrink-0">[INFO]</span>
                 <span>Connected to primary database cluster.</span>
               </div>
               <div className="flex gap-4">
                 <span className="text-zinc-500 shrink-0">12:02:11</span>
                 <span className="text-emerald-400 shrink-0">[GET] </span>
                 <span>/api/health-check - 200 OK - 12ms</span>
               </div>
               <div className="flex gap-4">
                 <span className="text-zinc-500 shrink-0">12:05:32</span>
                 <span className="text-emerald-400 shrink-0">[GET] </span>
                 <span>/api/users/me - 200 OK - 88ms</span>
               </div>
               <div className="flex gap-4">
                 <span className="text-zinc-500 shrink-0">12:08:15</span>
                 <span className="text-amber-400 shrink-0">[WARN]</span>
                 <span className="text-amber-200">Rate limit approaching for IP 192.168.1.1</span>
               </div>
               <div className="flex gap-4">
                 <span className="text-zinc-500 shrink-0">12:15:02</span>
                 <span className="text-emerald-400 shrink-0">[GET] </span>
                 <span>/ - 200 OK - 42ms</span>
               </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
