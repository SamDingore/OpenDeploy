"use client";

import { useState } from "react";
import { Bell } from "lucide-react";

export function NotificationsTab() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div>
        <h2 className="text-2xl font-medium tracking-tight mb-6">Notifications</h2>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
            <div className="space-y-1">
              <p className="text-sm font-medium">Push Notifications</p>
              <p className="text-xs text-zinc-500">Receive alerts about important activity directly on your device.</p>
            </div>
            <button 
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${
                notificationsEnabled ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
          
          <div className="space-y-4 pt-4">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Bell className="w-4 h-4 text-zinc-400" />
              Email Preferences
            </h3>
            
            {[
              { id: "marketing", label: "Marketing Emails", desc: "Receive emails about new products, features, and more." },
              { id: "security_alerts", label: "Security Emails", desc: "Receive emails about your account activity and security.", locked: true },
              { id: "activity", label: "Activity Summary", desc: "A weekly breakdown of your activity on the platform." }
            ].map((item) => (
              <label key={item.id} className={`flex items-start gap-4 p-3 -mx-3 rounded-lg transition-colors ${item.locked ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                <div className="pt-0.5">
                  <input 
                    type="checkbox" 
                    defaultChecked={item.locked || item.id === 'activity'}
                    disabled={item.locked}
                    className="w-4 h-4 text-indigo-600 bg-zinc-100 border-zinc-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-zinc-800 focus:ring-2 dark:bg-zinc-700 dark:border-zinc-600"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
