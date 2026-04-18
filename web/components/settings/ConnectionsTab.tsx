"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

const apiBase = () =>
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

type GithubStatus = { connected: false } | { connected: true; githubLogin: string };

interface ConnectionsTabProps {
  githubBanner?: "connected" | null;
  githubError?: string | null;
}

export function ConnectionsTab({ githubBanner, githubError }: ConnectionsTabProps) {
  const { isSignedIn, getToken } = useAuth();
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusFetchError, setStatusFetchError] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!isSignedIn) {
      setStatus(null);
      setStatusFetchError(null);
      return;
    }
    setStatusLoading(true);
    setStatusFetchError(null);
    try {
      const token = await getToken();
      if (!token) {
        setStatus(null);
        return;
      }
      const res = await fetch(`${apiBase()}/apis/github/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setStatus(null);
        return;
      }
      const data = (await res.json()) as GithubStatus;
      setStatus(data);
    } catch {
      setStatus(null);
      setStatusFetchError(
        `Could not reach the API at ${apiBase()} (network or CORS). Start the Nest server on that port, set NEXT_PUBLIC_API_URL in web/.env if it differs, and ensure the server allows this site’s origin (WEB_APP_URL / WEB_APP_URLS).`,
      );
    } finally {
      setStatusLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const onConnectGithub = async () => {
    if (!isSignedIn) {
      setConnectError("Sign in to connect GitHub.");
      return;
    }
    setConnectLoading(true);
    setConnectError(null);
    try {
      const token = await getToken();
      if (!token) {
        setConnectError("Could not read your session. Try signing in again.");
        return;
      }
      const res = await fetch(`${apiBase()}/apis/github/oauth/start`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.text();
        setConnectError(body || `Request failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { authorizeUrl?: string };
      if (!data.authorizeUrl) {
        setConnectError("Server did not return a GitHub URL.");
        return;
      }
      window.location.assign(data.authorizeUrl);
    } catch {
      setConnectError("Something went wrong. Check the API URL and that the server is running.");
    } finally {
      setConnectLoading(false);
    }
  };

  const connected = status?.connected === true;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div>
        <h2 className="text-2xl font-medium tracking-tight mb-6">Connected Accounts</h2>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8 max-w-xl">
          Connect your accounts to unlock additional features, including automated deployments and repository synchronization.
        </p>

        {githubBanner === "connected" && (
          <p className="mb-4 text-sm text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-4 py-3">
            GitHub is connected. You can use repository and deployment features from here.
          </p>
        )}

        {(githubError || connectError || statusFetchError) && (
          <p className="mb-4 text-sm text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/40 px-4 py-3">
            {connectError ?? statusFetchError ?? githubError}
          </p>
        )}

        {!isSignedIn && (
          <p className="mb-4 text-sm text-amber-800 dark:text-amber-200/90 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3">
            Sign in with your account, then connect GitHub.
          </p>
        )}

        <div className="space-y-4">
          <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 p-6 transition-all duration-300 hover:shadow-lg dark:hover:shadow-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700">
            <div className="absolute -inset-x-4 -inset-y-4 z-0 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 opacity-0 transition-opacity duration-500 group-hover:opacity-100 blur-xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-7 h-7"
                  >
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.6 6-6.6a5.5 5.5 0 0 0-1.5-3.8 5.5 5.5 0 0 0-.1-3.8s-1.2-.4-3.9 1.4a13.3 13.3 0 0 0-7 0C6.2 1.2 5 1.6 5 1.6a5.5 5.5 0 0 0-.1 3.8A5.5 5.5 0 0 0 3.4 9c0 5 3 6.3 6 6.6-.6.5-1 1.5-1 3.2V22" />
                    <path d="M3 19.5c.5.5 2 .5 3-1" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">GitHub</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Connect your GitHub account to sync repositories, including organizations, and to report deployment status.
                  </p>
                  {statusLoading && isSignedIn && (
                    <p className="text-xs text-zinc-400 mt-2">Checking connection…</p>
                  )}
                  {!statusLoading && connected && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                      Connected as <span className="font-medium">@{status.githubLogin}</span>
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void onConnectGithub()}
                disabled={connectLoading || !isSignedIn}
                className="px-6 py-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium transition-all shadow-sm hover:bg-zinc-800 dark:hover:bg-white active:scale-95 shrink-0 whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none"
              >
                {connectLoading
                  ? "Redirecting…"
                  : connected
                    ? "Reconnect GitHub"
                    : "Connect GitHub"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
