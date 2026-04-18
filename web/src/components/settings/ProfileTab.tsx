export function ProfileTab() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div>
        <h2 className="text-2xl font-medium tracking-tight mb-6">Profile Information</h2>
        
        <div className="flex items-center gap-6 mb-8 group cursor-pointer">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white text-3xl font-semibold shadow-lg group-hover:shadow-indigo-500/25 transition-all duration-300 group-hover:scale-105">
              JD
            </div>
            <div className="absolute inset-0 rounded-full ring-2 ring-white dark:ring-black ring-offset-2 ring-offset-transparent group-hover:ring-offset-indigo-50 dark:group-hover:ring-offset-indigo-500/20 transition-all duration-300" />
          </div>
          <div>
            <button className="px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm active:scale-95">
              Change Avatar
            </button>
            <p className="text-xs text-zinc-500 mt-2">JPG, GIF or PNG. Max size 2MB.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">First Name</label>
              <input 
                type="text" 
                defaultValue="John"
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-700" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Last Name</label>
              <input 
                type="text" 
                defaultValue="Doe"
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-700" 
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email Address</label>
            <input 
              type="email" 
              defaultValue="john.doe@example.com"
              className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-500 focus:outline-none cursor-not-allowed" 
              readOnly
            />
            <p className="text-xs text-zinc-500 mt-1">Your email address cannot be changed here.</p>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
        <button className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-all shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] active:scale-95">
          Save Changes
        </button>
      </div>
    </div>
  );
}
