export default function PortalLoading() {
  return (
    <div className="max-w-6xl animate-pulse space-y-6">
      <div className="h-8 bg-slate-200 rounded w-48" />
      <div className="h-4 bg-slate-100 rounded w-72" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-28" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 h-64" />
    </div>
  )
}
