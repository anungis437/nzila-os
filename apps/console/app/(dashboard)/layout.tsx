import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { ExecutiveModeWrapper } from './executive-mode'
import { SidebarNav, type NavGroup } from '@/components/sidebar-nav'

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    defaultOpen: true,
    items: [
      { name: 'Dashboard', href: '/console', icon: 'HomeIcon' },
      { name: 'Platform', href: '/platform', icon: 'GlobeAltIcon' },
      { name: 'System Health', href: '/system-health', icon: 'ServerIcon' },
      { name: 'Analytics', href: '/analytics', icon: 'ChartBarIcon' },
    ],
  },
  {
    label: 'Governance & Compliance',
    items: [
      { name: 'Governance', href: '/governance', icon: 'EyeIcon' },
      { name: 'Compliance', href: '/compliance-snapshots', icon: 'ShieldCheckIcon' },
      { name: 'Assurance', href: '/assurance', icon: 'ShieldCheckIcon' },
      { name: 'Standards', href: '/standards', icon: 'BookOpenIcon' },
      { name: 'Audit Insights', href: '/audit-insights', icon: 'ShieldCheckIcon' },
      { name: 'Audit Graph', href: '/audit-graph', icon: 'LinkIcon' },
      { name: 'NACP Integrity', href: '/nacp-integrity', icon: 'ClipboardDocumentCheckIcon' },
    ],
  },
  {
    label: 'Evidence & Proof',
    items: [
      { name: 'Evidence Packs', href: '/evidence-packs', icon: 'DocumentArrowDownIcon' },
      { name: 'Proof Center', href: '/proof-center', icon: 'FingerPrintIcon' },
      { name: 'Proof Pack', href: '/proof-pack', icon: 'FingerPrintIcon' },
      { name: 'Isolation', href: '/isolation-certification', icon: 'LockClosedIcon' },
      { name: 'Pilot Export', href: '/pilot/export', icon: 'DocumentArrowDownIcon' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Ops', href: '/ops', icon: 'ShieldExclamationIcon' },
      { name: 'Ops Score', href: '/ops-score', icon: 'ShieldExclamationIcon' },
      { name: 'Performance', href: '/performance', icon: 'BoltIcon' },
      { name: 'Regressions', href: '/performance/regressions', icon: 'ArrowTrendingUpIcon' },
      { name: 'Trend Detection', href: '/trend-detection', icon: 'ChartBarSquareIcon' },
      { name: 'Failure Sim', href: '/failure-simulation', icon: 'BeakerIcon' },
      { name: 'Scale Sim', href: '/scale-simulation', icon: 'ArrowTrendingUpIcon' },
      { name: 'Deploy Profile', href: '/deployment-profile', icon: 'CloudIcon' },
    ],
  },
  {
    label: 'Cost & Economics',
    items: [
      { name: 'Cost', href: '/cost', icon: 'CurrencyDollarIcon' },
      { name: 'Economics', href: '/platform-economics', icon: 'BanknotesIcon' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { name: 'Integrations', href: '/integrations', icon: 'PuzzlePieceIcon' },
      { name: 'Control Plane', href: '/integrations-control-plane', icon: 'WrenchScrewdriverIcon' },
      { name: 'Marketplace', href: '/marketplace', icon: 'PuzzlePieceIcon' },
    ],
  },
  {
    label: 'AI & ML',
    items: [
      { name: 'AI Overview', href: '/console/ai/overview', icon: 'CpuChipIcon' },
      { name: 'AI Models', href: '/console/ai/models', icon: 'CpuChipIcon' },
      { name: 'AI Actions', href: '/console/ai/actions', icon: 'CpuChipIcon' },
      { name: 'AI Knowledge', href: '/console/ai/knowledge', icon: 'CircleStackIcon' },
      { name: 'AI Usage', href: '/console/ai/usage', icon: 'ChartBarIcon' },
      { name: 'ML Overview', href: '/console/ml/overview', icon: 'CpuChipIcon' },
      { name: 'ML Models', href: '/console/ml/models', icon: 'CpuChipIcon' },
      { name: 'ML Runs', href: '/console/ml/runs', icon: 'BoltIcon' },
    ],
  },
  {
    label: 'Business',
    items: [
      { name: 'Business OS', href: '/business', icon: 'BuildingOffice2Icon' },
      { name: 'Finance', href: '/business/finance', icon: 'BanknotesIcon' },
      { name: 'Equity', href: '/business/equity', icon: 'ChartBarIcon' },
      { name: 'Corporate Gov', href: '/business/governance', icon: 'EyeIcon' },
      { name: 'Approvals', href: '/business/approvals', icon: 'ClipboardDocumentCheckIcon' },
      { name: 'Signatures', href: '/business/signatures', icon: 'FingerPrintIcon' },
      { name: 'Queues', href: '/business/queues', icon: 'CircleStackIcon' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { name: 'Organizations', href: '/orgs', icon: 'UsersIcon' },
      { name: 'Automation', href: '/automation', icon: 'CogIcon' },
      { name: 'Docs', href: '/docs', icon: 'DocumentTextIcon' },
      { name: 'Data Retention', href: '/console/admin/retention', icon: 'CircleStackIcon' },
      { name: 'Stripe', href: '/console/finance/stripe', icon: 'BanknotesIcon' },
      { name: 'Settings', href: '/settings', icon: 'Cog6ToothIcon' },
    ],
  },
]

// External app URLs — configurable via NEXT_PUBLIC_* env vars
const appLinks = [
  { name: 'Public Web', href: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000', badge: '3000' },
  { name: 'Partner Portal', href: process.env.NEXT_PUBLIC_PARTNERS_URL ?? 'http://localhost:3002', badge: '3002' },
  { name: 'Union Eyes', href: process.env.NEXT_PUBLIC_UNION_EYES_URL ?? 'http://localhost:3003', badge: '3003' },
  { name: 'ABR Insights', href: process.env.NEXT_PUBLIC_ABR_URL ?? 'http://localhost:3004', badge: '3004' },
]

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  // Server-side auth gate — runs on Node.js (not Edge) so crypto.subtle works.
  // Middleware only sets up Clerk context; this layout enforces authentication.
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
