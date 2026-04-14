export default function RsvpLoading() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-[#d9bf7b]/40 bg-[#fdfaf4] p-6 shadow-[0_28px_80px_-48px_rgba(90,70,40,0.45)]">
        <div className="h-72 animate-pulse rounded-[1.4rem] bg-[#f2e8d6]" />
        <div className="mt-5 h-6 w-2/3 animate-pulse rounded bg-[#efe2cd]" />
        <div className="mt-3 h-4 w-5/6 animate-pulse rounded bg-[#f0e5d2]" />
        <div className="mt-8 h-28 animate-pulse rounded-2xl bg-[#f2e8d6]" />
      </div>
    </main>
  );
}
