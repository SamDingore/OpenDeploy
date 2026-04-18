"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SettingsSidebar, TabId, tabs } from "./components/SettingsSidebar";
import { ProfileTab } from "./components/ProfileTab";
import { AppearanceTab } from "./components/AppearanceTab";
import { NotificationsTab } from "./components/NotificationsTab";
import { PlaceholderTab } from "./components/PlaceholderTab";
import { ConnectionsTab } from "./components/ConnectionsTab";

const TAB_IDS = new Set<TabId>(tabs.map((t) => t.id));

function parseTabId(raw: string | null): TabId | null {
  if (raw && TAB_IDS.has(raw as TabId)) {
    return raw as TabId;
  }
  return null;
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  useEffect(() => {
    const t = parseTabId(searchParams.get("tab"));
    if (t) {
      setActiveTab(t);
    }
  }, [searchParams]);

  const connectionsBanner = useMemo(() => {
    const github = searchParams.get("github");
    const err = searchParams.get("github_error");
    return {
      githubBanner: github === "connected" ? ("connected" as const) : null,
      githubError: err,
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-indigo-500/30 flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-violet-500/10 dark:bg-violet-500/5 blur-[120px]" />
      </div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl transition-all">
        <div className="max-w-6xl mx-auto px-6 w-full h-16 flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-900 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800 transition-colors">
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            </div>
            Back to Home
          </Link>
          
          <div className="flex items-center gap-3">
            {/* Optional right-side actions can go here */}
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl w-full mx-auto px-6 py-10 md:py-16 flex-1">
        <div className="mb-10 md:mb-14">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-500">
            Settings
          </h1>
          <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400 max-w-xl">
            Manage your account preferences and customize your premium experience.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

          <main className="flex-1 max-w-3xl">
            <div className="bg-white/60 dark:bg-zinc-900/40 backdrop-blur-xl rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] p-6 md:p-10 transition-all duration-500">
              {activeTab === "profile" && <ProfileTab />}
              {activeTab === "appearance" && <AppearanceTab />}
              {activeTab === "notifications" && <NotificationsTab />}
              {activeTab === "connections" && (
                <ConnectionsTab
                  githubBanner={connectionsBanner.githubBanner}
                  githubError={connectionsBanner.githubError}
                />
              )}
              {["security", "billing"].includes(activeTab) && <PlaceholderTab activeTab={activeTab} />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center text-zinc-500 text-sm">
          Loading settings…
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
