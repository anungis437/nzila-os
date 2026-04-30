import { getMetricsSummary } from '@/lib/maestria-monitoring'

export default function MonitoringPage() {
  const summary = getMetricsSummary()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Request Monitoring</h1>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Requests" value={summary.capturedRequests} />
        <StatCard label="Error Rate" value={`${(summary.overallErrorRate * 100).toFixed(1)}%`} />
        <StatCard label="p50 Latency" value={`${summary.p50}ms`} />
        <StatCard label="p95 Latency" value={`${summary.p95}ms`} />
        <StatCard label="p99 Latency" value={`${summary.p99}ms`} />
        <StatCard label="Avg Latency" value={`${summary.avgMs.toFixed(1)}ms`} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Per-Route Breakdown</h2>
        {summary.routes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No requests recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <Th>Route</Th>
                  <Th>Requests</Th>
                  <Th>Errors</Th>
                  <Th>Error Rate</Th>
                  <Th>p50</Th>
                  <Th>p95</Th>
                  <Th>p99</Th>
                  <Th>Avg</Th>
                </tr>
              </thead>
              <tbody>
                {summary.routes.map((r) => (
                  <tr key={r.route} className="border-t hover:bg-muted/50">
                    <td className="px-3 py-2 font-mono">{r.route}</td>
                    <td className="px-3 py-2 text-right">{r.count}</td>
                    <td className="px-3 py-2 text-right">{r.errorCount}</td>
                    <td className="px-3 py-2 text-right">{(r.errorRate * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{r.p50}ms</td>
                    <td className="px-3 py-2 text-right">{r.p95}ms</td>
                    <td className="px-3 py-2 text-right">{r.p99}ms</td>
                    <td className="px-3 py-2 text-right">{r.avgMs.toFixed(1)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Tracking since: {new Date(summary.since).toLocaleString()} · last {summary.capturedRequests} request(s) in ring buffer
      </p>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border p-4 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>
}
