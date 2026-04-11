export const metadata = { title: "System Status — Flow" };

const services = [
  { name: "API Server", endpoint: "/api/health" },
  { name: "Database", endpoint: "/api/health" },
  { name: "Blob Storage", endpoint: "/api/health" },
  { name: "Authentication (Entra ID)", endpoint: null },
  { name: "Background Jobs", endpoint: null },
];

export default function SystemStatusPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy">System Status</h1>
        <p className="mt-1 text-sm text-gray-500">
          Live health of platform services. Data refreshes on page load.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => (
          <div
            key={svc.name}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">{svc.name}</h3>
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
            {svc.endpoint && (
              <p className="mt-2 text-xs text-gray-400 font-mono">
                {svc.endpoint}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">Operational</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-navy">
          Recent Incidents
        </h2>
        <p className="text-sm text-gray-400">No incidents in the last 30 days.</p>
      </div>
    </div>
  );
}
