export default function AuthSetupPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Authentication is not configured</h1>
      <p className="text-sm text-zinc-700">
        The web app cannot authenticate requests because Clerk environment variables are missing.
      </p>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
        <p className="font-medium">Add these variables to apps/web/.env.local:</p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words">
{`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
API_URL=http://localhost:3001`}
        </pre>
      </div>
      <p className="text-sm text-zinc-700">
        After updating values, restart the web dev server and reload this page.
      </p>
    </main>
  );
}
