export default function CoraLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center gap-6 text-sm font-medium">
        <span className="font-bold text-lg">Cora Insights</span>
        <a href="/cora/dashboard" className="hover:underline">Dashboard</a>
        <a href="/cora/yield-forecast" className="hover:underline">Yield</a>
        <a href="/cora/price-signals" className="hover:underline">Prices</a>
        <a href="/cora/risk-and-resilience" className="hover:underline">Risk</a>
        <a href="/cora/impact-and-traceability" className="hover:underline">Traceability</a>
        <a href="/cora/cooperative-performance" className="hover:underline">Performance</a>
        <a href="/cora/data-sources" className="hover:underline">Data Sources</a>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
