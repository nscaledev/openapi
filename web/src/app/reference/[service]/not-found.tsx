import Link from "next/link";

export default function ServiceNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Service not found</h1>
      <p className="text-secondary-content">
        That service isn&apos;t published here.
      </p>
      <Link href="/" className="underline">
        Back to all services
      </Link>
    </main>
  );
}
