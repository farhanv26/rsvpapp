export default function RsvpLoading() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10" aria-busy="true">
      <span className="sr-only" role="status">
        Loading your invitation
      </span>
      <div className="invite-sheet w-full max-w-xl animate-pulse px-8 py-10 motion-reduce:animate-none" aria-hidden>
        <div className="invite-rule" />
        <div className="mx-auto mt-7 h-9 w-2/3 rounded bg-[#efe8dc]" />
        <div className="mx-auto mt-4 h-3 w-24 rounded bg-[#efe8dc]" />
        <div className="mx-auto mt-10 h-5 w-1/2 rounded bg-[#efe8dc]" />
        <div className="mx-auto mt-3 h-4 w-3/4 rounded bg-[#efe8dc]" />
      </div>
    </main>
  );
}
