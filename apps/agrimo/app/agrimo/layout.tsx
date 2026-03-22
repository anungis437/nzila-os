export default function AgrimoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center gap-6 text-sm font-medium">
        <span className="font-bold text-lg">Agrimo</span>
        <a href="/agrimo/dashboard" className="hover:underline">Dashboard</a>
        <a href="/agrimo/producers" className="hover:underline">Producers</a>
        <a href="/agrimo/harvests" className="hover:underline">Harvests</a>
        <a href="/agrimo/lots" className="hover:underline">Lots</a>
        <a href="/agrimo/quality" className="hover:underline">Quality</a>
        <a href="/agrimo/warehouse" className="hover:underline">Warehouse</a>
        <a href="/agrimo/shipments" className="hover:underline">Shipments</a>
        <a href="/agrimo/payments" className="hover:underline">Payments</a>
        <a href="/agrimo/certifications" className="hover:underline">Certifications</a>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
