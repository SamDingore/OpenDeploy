import { Shield, CreditCard } from "lucide-react";
import { TabId } from "./SettingsSidebar";

interface PlaceholderTabProps {
  activeTab: TabId;
}

export function PlaceholderTab({ activeTab }: PlaceholderTabProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
        {activeTab === "security" ? <Shield className="w-8 h-8" /> : <CreditCard className="w-8 h-8" />}
      </div>
      <div>
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 capitalize">{activeTab} Settings</h3>
        <p className="text-sm text-zinc-500 mt-1 max-w-sm">This section is currently under construction. Check back soon for updates.</p>
      </div>
    </div>
  );
}
