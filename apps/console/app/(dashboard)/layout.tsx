import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { UserButton } from '@nzila/platform-auth/entra/client'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { ExecutiveModeWrapper } from './executive-mode'
import { SidebarNav, type NavGroup } from '@/components/sidebar-nav'

const navGroups: NavGroup[] = [
  // ── Zone 1: TODAY — CEO Daily Pulse ────────────────────────────────────────
  {
    label: 'Command',
    defaultOpen: true,
    items: [
      { name: 'CEO One-Screen', href: '/ceo', icon: 'EyeIcon' },
      { name: 'Today', href: '/today', icon: 'HomeIcon' },
      { name: 'Autopilot', href: '/autopilot', icon: 'BoltIcon' },
      { name: 'Briefing', href: '/briefing', icon: 'ClipboardDocumentCheckIcon' },
      { name: 'Focus', href: '/focus', icon: 'ClockIcon' },
      { name: 'Portfolio', href: '/portfolio', icon: 'BuildingOffice2Icon' },
    ],
  },
  // ── Zone 2: REVENUE — Sales Command Center ─────────────────────────────────
  {
    label: 'Revenue',
    defaultOpen: true,
    items: [
      { name: 'Pipeline', href: '/revenue', icon: 'ArrowTrendingUpIcon' },
      { name: 'Pilot Export', href: '/pilot/export', icon: 'DocumentArrowDownIcon' },
    ],
  },
  // ── Zone 3: CAPITAL — Cash · Burn · Runway ─────────────────────────────────
  {
    label: 'Capital',
    defaultOpen: true,
    items: [
      { name: 'Burn & Runway', href: '/capital', icon: 'BanknotesIcon' },
      { name: 'Runway', href: '/runway', icon: 'ArrowTrendingUpIcon' },
      { name: 'Forecast', href: '/forecast', icon: 'ChartBarIcon' },
      { name: 'Cost Dashboard', href: '/cost', icon: 'CurrencyDollarIcon' },
      { name: 'Economics', href: '/platform-economics', icon: 'ChartBarIcon' },
      { name: 'Finance Ops', href: '/business/finance', icon: 'DocumentTextIcon' },
    ],
  },
  // ── Zone 4: EXECUTION — Initiatives · Owners · Blockers ───────────────────
  {
    label: 'Execution',
    items: [
      { name: 'Initiatives', href: '/execution', icon: 'BoltIcon' },
      { name: 'Accountability', href: '/accountability', icon: 'CheckCircleIcon' },
      { name: 'Operator Mode', href: '/operator', icon: 'WrenchScrewdriverIcon' },
      { name: 'Decision Scoreback', href: '/decision-scoreback', icon: 'ChartBarSquareIcon' },
      { name: 'Approvals', href: '/business/approvals', icon: 'ClipboardDocumentCheckIcon' },
      { name: 'Queues', href: '/business/queues', icon: 'CircleStackIcon' },
      { name: 'Signatures', href: '/business/signatures', icon: 'FingerPrintIcon' },
    ],
  },
  // ── Zone 5: RISK — Business · Platform · Financial Threats ────────────────
  {
    label: 'Risk',
    items: [
      { name: 'Risk Register', href: '/risk', icon: 'ExclamationTriangleIcon' },
      { name: 'Ops Score', href: '/ops-score', icon: 'ShieldExclamationIcon' },
      { name: 'Audit Insights', href: '/audit-insights', icon: 'EyeIcon' },
      { name: 'Trend Detection', href: '/trend-detection', icon: 'ChartBarSquareIcon' },
    ],
  },
  // ── Zone 6: GOVERNANCE — GRC · Evidence · Corporate Gov ───────────────────
  {
    label: 'Governance',
    items: [
      { name: 'Governance', href: '/governance', icon: 'ShieldCheckIcon' },
      { name: 'Board Pack', href: '/board', icon: 'DocumentTextIcon' },
      { name: 'Corporate Gov', href: '/business/governance', icon: 'EyeIcon' },
      { name: 'Equity & Cap Table', href: '/business/equity', icon: 'DocumentDuplicateIcon' },
      { name: 'Evidence Packs', href: '/evidence-packs', icon: 'DocumentArrowDownIcon' },
      { name: 'Proof Center', href: '/proof-center', icon: 'FingerPrintIcon' },
      { name: 'Compliance', href: '/compliance-snapshots', icon: 'ClipboardDocumentCheckIcon' },
    ],
  },
  // ── Internal Tools (collapsed by default) ─────────────────────────────────
  {
    label: 'Ops Toolkit',
    items: [
      { name: 'System Health', href: '/system-health', icon: 'ServerIcon' },
      { name: 'Ops', href: '/ops', icon: 'ShieldExclamationIcon' },
      { name: 'Performance', href: '/performance', icon: 'BoltIcon' },
      { name: 'Integrations', href: '/integrations', icon: 'PuzzlePieceIcon' },
      { name: 'Control Plane', href: '/integrations-control-plane', icon: 'WrenchScrewdriverIcon' },
    ],
  },
  // ── Admin (minimal) ────────────────────────────────────────────────────────
  {
    label: 'Admin',
    items: [
      { name: 'Organizations', href: '/orgs', icon: 'UsersIcon' },
      { name: 'Docs', href: '/docs', icon: 'DocumentTextIcon' },
      { name: 'Settings', href: '/settings', icon: 'Cog6ToothIcon' },
    ],
  },
]

// External app URLs — configurable via NEXT_PUBLIC_* env vars
const appLinks = [
  { name: 'Public Web', href: process.env.NEXT_PUBLIC_WEB_URL, badge: '3000' },
  { name: 'Partner Portal', href: process.env.NEXT_PUBLIC_PARTNERS_URL, badge: '3002' },
  { name: 'Union Eyes', href: process.env.NEXT_PUBLIC_UNION_EYES_URL, badge: '3003' },
  { name: 'ABR Insights', href: process.env.NEXT_PUBLIC_ABR_URL, badge: '3004' },
]

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  // Server-side auth gate — runs on Node.js (not Edge) so crypto.subtle works.
  // Middleware only sets up auth context; this layout enforces authentication.
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const sidebar = (
    <aside className="w-64 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <Link href="/console" className="text-xl font-bold text-blue-600">
          Nzila Console
        </Link>
      </div>
      <SidebarNav groups={navGroups} />

      {/* App Launcher */}
      <div className="px-3 pb-2 border-t border-gray-100 pt-3">
        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Launch App</p>
        {appLinks.map((app) => (
          app.href ? (
            <a
              key={app.name}
              href={app.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition"
            >
              <span className="flex items-center gap-2">
                <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400" />
                {app.name}
              </span>
              <span className="text-xs text-gray-400 font-mono">{app.badge}</span>
            </a>
          ) : (
            <div key={app.name} className="flex items-center justify-between px-3 py-2 text-sm text-amber-700 rounded-lg bg-amber-50">
              <span>{app.name}</span>
              <span className="text-xs">Not configured</span>
            </div>
          )
        ))}
      </div>
      <div className="p-4 border-t border-gray-100 flex items-center gap-3">
        <UserButton />
        <span className="text-sm text-gray-500">Account</span>
      </div>
    </aside>
  )

  return (
    <ExecutiveModeWrapper sidebar={sidebar}>
      {children}
    </ExecutiveModeWrapper>
  )
}
