"use client";

import { useState } from "react";
import { Sun, Moon, Laptop, Check } from "lucide-react";

export function AppearanceTab() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div>
        <h2 className="text-2xl font-medium tracking-tight mb-6">Appearance</h2>
        <p className="text-zinc-500 text-sm mb-6 max-w-lg">
          Customize how the application looks on your device. Choose between our carefully crafted light or dark themes.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: "light", icon: Sun, label: "Light" },
            { id: "dark", icon: Moon, label: "Dark" },
            { id: "system", icon: Laptop, label: "System" },
          ].map((t) => {
            const Icon = t.icon;
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as any)}
                className={`relative flex flex-col items-center gap-4 p-6 rounded-2xl border transition-all duration-300 group overflow-hidden ${
                  isSelected 
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10" 
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <div className={`p-3 rounded-full transition-colors duration-300 ${
                  isSelected ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-200"
                }`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className={`text-sm font-medium ${isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-600 dark:text-zinc-400"}`}>
                  {t.label}
                </span>
                
                {isSelected && (
                  <div className="absolute top-3 right-3 text-indigo-600 dark:text-indigo-400 animate-in zoom-in duration-300">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
