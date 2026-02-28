export default function PonduLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center gap-6 text-sm font-medium">
        <span className="font-bold text-lg">Pondu Ops</span>
        <a href="/pondu/dashboard" className="hover:underline">Dashboard</a>
        <a href="/pondu/producers" className="hover:underline">Producers</a>
        <a href="/pondu/harvests" className="hover:underline">Harvests</a>
        <a href="/pondu/lots" className="hover:underline">Lots</a>
        <a href="/pondu/quality" className="hover:underline">Quality</a>
        <a href="/pondu/warehouse" className="hover:underline">Warehouse</a>
        <a href="/pondu/shipments" className="hover:underline">Shipments</a>
        <a href="/pondu/payments" className="hover:underline">Payments</a>
        <a href="/pondu/certifications" className="hover:underline">Certifications</a>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
