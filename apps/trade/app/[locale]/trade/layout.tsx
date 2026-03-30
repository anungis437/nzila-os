import Link from 'next/link'

/**
 * Trade layout — shared navigation for all /trade/* routes.
 */
export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-gray-50 p-4 space-y-1">
        <div className="text-lg font-bold mb-4">Trade</div>
        <NavLink href="/trade/dashboard">Dashboard</NavLink>
        <NavLink href="/trade/parties">Parties</NavLink>
        <NavLink href="/trade/listings">Listings</NavLink>
        <NavLink href="/trade/deals">Deals</NavLink>
        <NavLink href="/trade/shipments">Shipments</NavLink>
        <NavLink href="/trade/commissions">Commissions</NavLink>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm hover:bg-gray-100"
    >
      {children}
    </Link>
  )
}
