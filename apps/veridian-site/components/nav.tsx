import Link from 'next/link'

const navLinks = [
  { href: '/product', label: 'Product' },
  { href: '/trust', label: 'Trust' },
  { href: '/security', label: 'Security' },
  { href: '/pilot', label: 'Pilot' },
  { href: '/contact', label: 'Contact' },
]

export function Nav() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold" style={{ color: '#0d9488' }}>
            Veridian Care
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link
          href="/pilot"
          className="hidden md:inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#0d9488' }}
        >
          Request Demo
        </Link>
      </div>
    </header>
  )
}
