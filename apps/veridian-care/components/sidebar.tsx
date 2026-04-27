import Link from 'next/link'

const navLinks = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/patients', label: 'Patients', icon: '👥' },
]

export function Sidebar() {
  return (
    <aside className="w-60 min-h-screen bg-slate-900 text-white flex flex-col shrink-0">
      <div className="p-6 border-b border-slate-700">
        <span className="text-lg font-bold" style={{ color: '#2dd4bf' }}>
          Veridian Care
        </span>
        <p className="text-xs text-slate-400 mt-1">Clinician Portal</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navLinks.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <span>{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
          <span>⚠</span>
          Synthetic Demo
        </span>
      </div>
    </aside>
  )
}
