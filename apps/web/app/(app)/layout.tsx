import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/workspaces" className="font-semibold text-zinc-900">
            OpenDeploy
          </Link>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
