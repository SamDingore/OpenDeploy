import type { Metadata } from 'next';
import { AppClerkProvider } from '@/components/clerk-provider';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'OpenDeploy',
  description: 'Phase 1 control plane',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppClerkProvider>{children}</AppClerkProvider>
      </body>
    </html>
  );
}
