"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, GitBranch, Activity, Clock, Cpu, RotateCcw, ArrowUpCircle, HardDrive, RefreshCw, Server, Globe, Terminal, Plus, Settings, ChevronDown, Trash2, Play, Upload, Folder } from "lucide-react";

type Status = "ready" | "error" | "building" | "queued" | "initializing" | "cancelled";

type Deployment = {
  id: string;
  status: Status;
  sourceBranch: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  deployedBy: string | null;
  buildDurationMs: number | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectDetails = {
  id: string;
  name: string;
  framework: string;
  domain: string | null;
  repository: {
    fullName: string;
    htmlUrl: string;
  };
  deployments: Deployment[];
};

type SetupFields = {
  projectName: string;
  frameworkPreset: string;
  rootDirectory: string;
  buildCommand: string;
  outputDirectory: string;
  installCommand: string;
};

const apiBase = () =>
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

function formatBuildDuration(ms: number | null): string {
  if (ms == null || ms < 0) return "—";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

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

function shortCommitRef(sha: string | null): string {
  if (!sha) return "—";
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const { isSignedIn, getToken } = useAuth();
  const projectId = params.id as string;
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [deploymentSubmitting, setDeploymentSubmitting] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<"overview" | "deployments" | "domains" | "logs">("overview");
  const [setup, setSetup] = useState<SetupFields>({
    projectName: "",
    frameworkPreset: "Other",
    rootDirectory: "./",
    buildCommand: "",
    outputDirectory: "",
    installCommand: "",
  });

  const [envVars, setEnvVars] = useState([{ key: "", value: "" }]);
  const addEnv = () => setEnvVars([...envVars, { key: "", value: "" }]);
  const removeEnv = (index: number) => {
    if (envVars.length === 1) {
      setEnvVars([{ key: "", value: "" }]);
      return;
    }
    setEnvVars(envVars.filter((_, i) => i !== index));
  };
  const updateEnv = (index: number, field: "key" | "value", val: string) => {
    const newVars = [...envVars];
    newVars[index][field] = val;
    setEnvVars(newVars);
  };

  useEffect(() => {
    const loadProject = async () => {
      if (!isSignedIn) {
        setProject(null);
        setProjectError("Sign in to view this project.");
        return;
      }
      setProjectLoading(true);
      setProjectError(null);
      try {
        const token = await getToken();
        if (!token) {
          setProjectError("Session expired. Sign in again.");
          return;
        }
        const res = await fetch(`${apiBase()}/apis/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(body || `Could not load project (${res.status}).`);
        }
        const data = (await res.json()) as { project: ProjectDetails };
        const normalizedProject = {
          ...data.project,
          deployments: data.project.deployments ?? [],
        };
        setProject(normalizedProject);
        setSetup((prev) => ({
          ...prev,
          projectName: normalizedProject.name || "",
          frameworkPreset: normalizedProject.framework || "Other",
        }));
      } catch (error) {
        setProjectError(error instanceof Error ? error.message : "Could not load project.");
      } finally {
        setProjectLoading(false);
      }
    };
    void loadProject();
  }, [getToken, isSignedIn, projectId]);

  const submitSetup = async () => {
    if (!project || deploymentSubmitting) return;
    setDeployError(null);
    setDeploymentSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Session expired. Sign in again.");
      }

      const payload = {
        projectName: setup.projectName.trim() || project.name,
        frameworkPreset: setup.frameworkPreset.trim() || project.framework || "Other",
        rootDirectory: setup.rootDirectory.trim() || "./",
        buildCommand: setup.buildCommand.trim() || null,
        outputDirectory: setup.outputDirectory.trim() || null,
        installCommand: setup.installCommand.trim() || null,
        envVars: envVars
          .map((entry) => ({ key: entry.key.trim(), value: entry.value }))
          .filter((entry) => entry.key.length > 0),
      };

      const res = await fetch(`${apiBase()}/apis/projects/${project.id}/deployments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Could not create deployment (${res.status}).`);
      }
      const data = (await res.json()) as { deployment: { id: string } };
      router.push(`/project/${project.id}/deployments/${data.deployment.id}`);
    } catch (error) {
      setDeployError(error instanceof Error ? error.message : "Could not create deployment.");
    } finally {
      setDeploymentSubmitting(false);
    }
  };

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

  const latest = project?.deployments?.[0];
  const latestStatus = latest?.status;
  const hasDeployments = (project?.deployments?.length ?? 0) > 0;

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
                <h1 className="text-3xl font-semibold tracking-tight">
                  {projectLoading ? "Loading project..." : (project?.name ?? "Project")}
                </h1>
                {!projectLoading && latestStatus && (
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(latestStatus)}`} />
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{getStatusLabel(latestStatus)}</span>
                  </div>
                )}
                {!projectLoading && project && !latestStatus && (
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-zinc-400" />
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">No deployments</span>
                  </div>
                )}
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 mt-2 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                {project?.repository.fullName ?? "Repository unavailable"}
              </p>
              {projectError && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                  {projectError}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <a 
                href={project?.repository.htmlUrl ?? "#"}
                className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 px-4 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium text-sm shadow-sm"
              >
                <GitBranch className="w-4 h-4" />
                Repository
              </a>
              <a 
                href={project?.domain ? `https://${project.domain}` : "#"}
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
        {activeTab === "overview" && projectLoading && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111] px-6 py-12 text-center text-sm text-zinc-500">
            Loading overview…
          </div>
        )}
        {activeTab === "overview" && !projectLoading && project && !hasDeployments && (
          <div className="max-w-4xl mx-auto mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left w-full">
            <div className="bg-white dark:bg-[#111] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#111]">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Configure Deployment</h2>
                <p className="text-sm text-zinc-500 mt-1">Review and configure your build and deployment settings.</p>
              </div>
              
              <div className="p-6 md:p-8 space-y-8">
                {/* Settings Grid */}
                <div className="grid gap-8">
                  
                  {/* Project Name */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Project Name</label>
                    <input 
                      type="text" 
                      value={setup.projectName}
                      onChange={(e) => setSetup((prev) => ({ ...prev, projectName: e.target.value }))}
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-shadow"
                    />
                  </div>

                  {/* Framework Preset & Root Directory */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Framework Preset</label>
                      <div className="relative">
                        <select 
                          value={setup.frameworkPreset}
                          onChange={(e) => setSetup((prev) => ({ ...prev, frameworkPreset: e.target.value }))}
                          className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-shadow"
                        >
                          <option value="Next.js">Next.js</option>
                          <option value="NestJS">NestJS</option>
                          <option value="React">React</option>
                          <option value="Vue">Vue</option>
                          <option value="Other">Other</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Root Directory</label>
                      <div className="flex rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 focus-within:ring-2 focus-within:ring-black dark:focus-within:ring-white transition-shadow h-[42px]">
                        <span className="bg-zinc-50 dark:bg-zinc-900/50 px-4 flex items-center border-r border-zinc-200 dark:border-zinc-800 text-zinc-500 text-sm">
                          <Folder className="w-4 h-4 mr-2"/>
                          Root
                        </span>
                        <input 
                          type="text" 
                          value={setup.rootDirectory}
                          onChange={(e) => setSetup((prev) => ({ ...prev, rootDirectory: e.target.value }))}
                          className="flex-1 bg-white dark:bg-zinc-950 px-4 py-2.5 text-sm focus:outline-none min-w-0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Build and Output Settings */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        <Settings className="w-4 h-4" />
                        Build and Output Settings
                      </div>
                    </div>
                    <div className="p-5 space-y-5 bg-white dark:bg-zinc-950/20">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 flex justify-between pr-1">
                          Build Command
                          <span className="text-zinc-400 font-normal text-xs">Override default</span>
                        </label>
                        <input 
                          type="text" 
                          value={setup.buildCommand}
                          onChange={(e) => setSetup((prev) => ({ ...prev, buildCommand: e.target.value }))}
                          placeholder="npm run odeploy-build"
                          className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-shadow"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 flex justify-between pr-1">
                          Output Directory
                          <span className="text-zinc-400 font-normal text-xs">Override default</span>
                        </label>
                        <input 
                          type="text" 
                          value={setup.outputDirectory}
                          onChange={(e) => setSetup((prev) => ({ ...prev, outputDirectory: e.target.value }))}
                          placeholder="."
                          className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-shadow"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 flex justify-between pr-1">
                          Install Command
                          <span className="text-zinc-400 font-normal text-xs">Override default</span>
                        </label>
                        <input 
                          type="text" 
                          value={setup.installCommand}
                          onChange={(e) => setSetup((prev) => ({ ...prev, installCommand: e.target.value }))}
                          placeholder="npm install"
                          className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-shadow"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Environment Variables */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                      <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Environment Variables</label>
                      <button className="text-xs items-center justify-center gap-1.5 font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 flex rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition shadow-sm">
                        <Upload className="w-3 h-3" />
                        Upload .env
                      </button>
                    </div>
                    
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-950/20">
                      {envVars.map((env, i) => (
                        <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                          <input 
                            type="text"
                            placeholder="KEY"
                            value={env.key}
                            onChange={(e) => updateEnv(i, 'key', e.target.value)}
                            className="w-full sm:flex-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-shadow"
                          />
                          <div className="flex w-full sm:flex-1 gap-2 items-center">
                            <input 
                              type="text"
                              placeholder="VALUE"
                              value={env.value}
                              onChange={(e) => updateEnv(i, 'value', e.target.value)}
                              className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-shadow"
                            />
                            <button 
                              onClick={() => removeEnv(i)}
                              className="shrink-0 p-2 text-zinc-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
                              title="Remove variable"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <button 
                      onClick={addEnv}
                      className="mt-3 text-sm flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Environment Variable
                    </button>
                  </div>

                </div>
              </div>
              <div className="px-6 py-4 md:px-8 md:py-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#111] flex justify-end">
                <button
                  type="button"
                  onClick={submitSetup}
                  disabled={deploymentSubmitting}
                  className="flex items-center gap-2 bg-black disabled:opacity-60 dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity font-medium shadow-sm w-full sm:w-auto justify-center"
                >
                  {deploymentSubmitting ? "Creating..." : "Deploy"}
                  <Play className="w-4 h-4 fill-current ml-1" />
                </button>
              </div>
              {deployError && (
                <div className="px-6 pb-5 text-sm text-red-600 dark:text-red-400">
                  {deployError}
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === "overview" && !projectLoading && project && hasDeployments && latest && (
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
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-md border ${getStatusTextColor(latest.status)} border-current/20`}
                  >
                    {getStatusLabel(latest.status)}
                  </span>
                </div>
                <div className="p-6">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row gap-6 md:items-center">
                      <div className="h-24 w-full md:w-40 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-100 dark:bg-zinc-900 flex justify-center items-center">
                        <Activity
                          className={`w-8 h-8 text-zinc-300 dark:text-zinc-700 ${latest.status === "building" || latest.status === "initializing" ? "animate-pulse" : ""}`}
                        />
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Commit</span>
                          <code className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-300">
                            {shortCommitRef(latest.commitSha)}
                          </code>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {latest.commitMessage ?? "No commit message"}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
                          <span className="flex items-center gap-1">
                            <GitBranch className="w-3 h-3" /> {latest.sourceBranch ?? "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatTimeAgo(latest.createdAt)}
                          </span>
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
                  {project.domain ? (
                    <div className="flex items-center justify-between p-4 px-6 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                      <div>
                        <div className="font-medium flex items-center gap-2 text-sm">
                          {project.domain}
                          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                            Primary
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">Production domain</div>
                      </div>
                      <button
                        type="button"
                        className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 text-sm text-zinc-500">No production domain configured.</div>
                  )}
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
                        <div
                          key={i}
                          className="h-6 flex-1 bg-emerald-500 rounded-sm opacity-80"
                          style={{
                            opacity: i === 28 ? 0.3 : i === 14 ? 0.2 : 0.8,
                            backgroundColor: i === 28 || i === 14 ? "#eab308" : "#10b981",
                          }}
                        ></div>
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
                      <div className="text-xs text-zinc-500">{project.framework}</div>
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
            {projectLoading ? (
              <div className="px-6 py-12 text-center text-sm text-zinc-500">Loading deployments…</div>
            ) : !project?.deployments?.length ? (
              <div className="px-6 py-12 text-center text-sm text-zinc-500">No deployments yet.</div>
            ) : (
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
                    {project.deployments.map((deploy) => (
                      <tr 
                        key={deploy.id} 
                        onClick={() => router.push(`/project/${projectId}/deployments/${deploy.id}`)}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors group cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-zinc-900 dark:text-zinc-100">{deploy.id.slice(0, 8)}</span>
                            {deploy.status === "building" && <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div
                            className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusTextColor(deploy.status)} border-current/20`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full mr-2 ${getStatusColor(deploy.status).split(" ")[0]}`} />
                            {getStatusLabel(deploy.status)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div
                            className="text-zinc-900 dark:text-zinc-100 font-medium truncate max-w-[180px]"
                            title={deploy.commitMessage ?? undefined}
                          >
                            {deploy.commitMessage ?? "—"}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {deploy.deployedBy ? `by ${deploy.deployedBy}` : ""}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                            <GitBranch className="w-3 h-3" />
                            <span className="font-mono text-xs">{deploy.sourceBranch ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{formatBuildDuration(deploy.buildDurationMs)}</td>
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{formatTimeAgo(deploy.createdAt)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {deploy.status === "ready" && (
                              <button
                                type="button"
                                className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                title="Promote to Production"
                              >
                                <ArrowUpCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Redeploy"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
