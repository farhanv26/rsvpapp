export default function AdminEventsLoading() {
  return (
    <main className="min-h-screen">
      <div className="app-shell space-y-6">
        <div className="app-card h-40 animate-pulse bg-[#f6efe3]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="app-card h-28 animate-pulse bg-[#f6efe3]" />
          <div className="app-card h-28 animate-pulse bg-[#f6efe3]" />
          <div className="app-card h-28 animate-pulse bg-[#f6efe3]" />
          <div className="app-card h-28 animate-pulse bg-[#f6efe3]" />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="app-card h-72 animate-pulse bg-[#f6efe3]" />
          <div className="app-card h-72 animate-pulse bg-[#f6efe3]" />
        </div>
      </div>
    </main>
  );
}
