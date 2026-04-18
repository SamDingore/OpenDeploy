import React from "react";
import { User, Bell, Shield, Paintbrush, CreditCard, LogOut, ChevronRight, Link } from "lucide-react";

export const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Paintbrush },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "connections", label: "Connections", icon: Link },
  { id: "security", label: "Security", icon: Shield },
  { id: "billing", label: "Billing", icon: CreditCard },
] as const;

export type TabId = typeof tabs[number]["id"];

interface SettingsSidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 md:w-72 shrink-0 hide-scrollbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ease-out text-left whitespace-nowrap group relative overflow-hidden ${
              isActive 
                ? "text-indigo-600 dark:text-indigo-400 font-medium" 
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            {/* Hover & Active Background */}
            <div className={`absolute inset-0 -z-10 transition-opacity duration-300 ${
              isActive ? "bg-indigo-50 dark:bg-indigo-500/10 opacity-100" : "bg-zinc-100 dark:bg-white/5 opacity-0 group-hover:opacity-100"
            }`} />
            
            <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
            <span className="text-sm">{tab.label}</span>
            
            {isActive && (
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            )}
          </button>
        );
      })}
      
      <div className="md:mt-8 pt-4 md:border-t border-zinc-200 dark:border-zinc-800">
        <button className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 w-full text-left group">
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
          <span className="text-sm font-medium">Log out</span>
        </button>
      </div>
    </nav>
  );
}
