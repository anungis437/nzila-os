/**
 * Dashboard root loading UI — displayed by Next.js while the dashboard
 * layout and initial page are being streamed to the client.
 * Uses skeleton placeholders that match the sidebar + main content layout.
 */
export default function DashboardLoading() {
  return (
    <div className="flex h-screen w-full animate-pulse">
      {/* Sidebar skeleton */}
      <aside className="hidden w-64 shrink-0 border-r bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <div className="h-6 w-32 rounded bg-gray-200" />
        </div>
        <nav className="flex flex-col gap-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md px-3 py-2">
              <div className="h-5 w-5 rounded bg-gray-200" />
              <div className="h-4 w-28 rounded bg-gray-200" />
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content skeleton */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div className="h-5 w-48 rounded bg-gray-200" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gray-200" />
            <div className="h-8 w-24 rounded bg-gray-200" />
          </div>
        </div>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 h-8 w-56 rounded bg-gray-200" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="mb-3 h-4 w-24 rounded bg-gray-200" />
                <div className="h-8 w-16 rounded bg-gray-200" />
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg border bg-white p-5 shadow-sm">
            <div className="mb-4 h-5 w-40 rounded bg-gray-200" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 w-full rounded bg-gray-100" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
