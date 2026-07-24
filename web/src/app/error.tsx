"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-secondary-content">
        Couldn&apos;t load the service catalog right now.
      </p>
      <button
        type="button"
        onClick={reset}
        className="underline cursor-pointer"
      >
        Try again
      </button>
    </main>
  );
}
