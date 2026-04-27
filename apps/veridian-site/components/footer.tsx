import Link from 'next/link'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-slate-900 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-lg font-bold" style={{ color: '#0d9488' }}>
              Veridian Care
            </span>
            <p className="mt-1 text-sm">One patient story. Every location.</p>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/trust" className="hover:text-white transition-colors">
              Trust
            </Link>
            <Link href="/security" className="hover:text-white transition-colors">
              Security
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              Contact
            </Link>
          </nav>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-800 text-center text-xs">
          © {year} Veridian Care. All rights reserved. Platform designed for healthcare
          interoperability.
        </div>
      </div>
    </footer>
  )
}
