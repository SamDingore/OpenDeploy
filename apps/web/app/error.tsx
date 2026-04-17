'use client';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Something went wrong</h1>
      <p className="text-sm text-zinc-700">
        The request failed unexpectedly. Please try again. If this keeps happening, check server logs and
        environment configuration.
      </p>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700">
        {error.message || 'unknown_error'}
      </div>
      <div>
        <button
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
