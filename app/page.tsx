import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-5 py-12 sm:px-8">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-zinc-200">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-zinc-500">RSVP App</p>
        <h1 className="text-3xl font-semibold text-zinc-900">Event RSVP Dashboard</h1>
        <p className="mt-3 text-zinc-600">
          Create events, add guests, and share secure RSVP links for each family.
        </p>
        <Link
          href="/admin/events"
          className="mt-6 inline-flex rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white"
        >
          Open Admin Events
        </Link>
      </div>
    </main>
  );
}
