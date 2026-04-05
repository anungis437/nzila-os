import Link from 'next/link'
import { currentUser } from '@nzila/platform-auth/entra/server'
import {
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  BookOpenIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  UsersIcon,
  AcademicCapIcon,
  BuildingStorefrontIcon,
  CommandLineIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'

const tiles = [
  {
    name: 'Internal Docs',
    href: '/docs',
    icon: DocumentTextIcon,
    description: 'Curated internal documentation and guides.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: ChartBarIcon,
    description: 'Portfolio analytics dashboards and reports.',
    color: 'bg-green-50 text-green-600',
  },
  {
    name: 'Automation',
    href: '/automation',
    icon: CogIcon,
    description: 'Migration orchestration and validation.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    name: 'Standards',
    href: '/standards',
    icon: BookOpenIcon,
    description: 'Scripts Book templates and CI/CD standards.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    name: 'Deployments',
    href: '/console',
    icon: RocketLaunchIcon,
    description: 'Azure deployment status (coming soon).',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    name: 'Security',
    href: '/console',
    icon: ShieldCheckIcon,
    description: 'Compliance and security overview (coming soon).',
    color: 'bg-red-50 text-red-600',
  },
]

// External app registry — URLs configurable via NEXT_PUBLIC_* env vars
const externalApps = [
  {
    name: 'Public Website',
    href: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
    icon: GlobeAltIcon,
    description: 'Nzila Ventures public site — products, verticals, investors.',
    port: '3000',
    color: 'bg-slate-50 text-slate-600',
    statusColor: 'bg-emerald-100 text-emerald-700',
    status: 'live',
  },
  {
    name: 'Partner Portal',
    href: process.env.NEXT_PUBLIC_PARTNERS_URL ?? 'http://localhost:3002',
    icon: BuildingStorefrontIcon,
    description: 'Partner onboarding, deal rooms, and portal access.',
    port: '3002',
    color: 'bg-violet-50 text-violet-600',
    statusColor: 'bg-emerald-100 text-emerald-700',
    status: 'live',
  },
  {
    name: 'Union Eyes',
    href: process.env.NEXT_PUBLIC_UNION_EYES_URL ?? 'http://localhost:3003',
    icon: UsersIcon,
    description: 'Union management — pension, grievances, member analytics.',
    port: '3003',
    color: 'bg-gold/10 text-amber-600',
    statusColor: 'bg-emerald-100 text-emerald-700',
    status: 'flagship',
  },
  {
    name: 'ABR Insights',
    href: process.env.NEXT_PUBLIC_ABR_URL ?? 'http://localhost:3004',
    icon: AcademicCapIcon,
    description: 'Anti-racism LMS, tribunal database, DEI analytics.',
    port: '3004',
    color: 'bg-blue-50 text-blue-600',
    statusColor: 'bg-emerald-100 text-emerald-700',
    status: 'production',
  },
  {
    name: 'Platform Admin',
    href: process.env.NEXT_PUBLIC_PLATFORM_ADMIN_URL ?? 'http://localhost:3005',
    icon: WrenchScrewdriverIcon,
    description: 'Platform ontology, entity graph, AI operations explorer.',
    port: '3005',
    color: 'bg-orange-50 text-orange-600',
    statusColor: 'bg-emerald-100 text-emerald-700',
    status: 'internal',
  },
  {
    name: 'Control Plane',
    href: process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? 'http://localhost:3010',
    icon: CommandLineIcon,
    description: 'Executive visibility — platform health, governance, intelligence.',
    port: '3010',
    color: 'bg-gray-50 text-gray-600',
    statusColor: 'bg-blue-100 text-blue-700',
    status: 'ops',
  },
]

export const dynamic = 'force-dynamic'

export default async function ConsoleDashboard() {
  const user = await currentUser()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
        </h1>
        <p className="text-gray-500 mt-1">Nzila Ventures — Internal Operations Console</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.name}
            href={tile.href}
            className="block bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className={`inline-flex p-3 rounded-lg mb-4 ${tile.color}`}>
              <tile.icon className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{tile.name}</h3>
            <p className="text-sm text-gray-500">{tile.description}</p>
          </Link>
        ))}
      </div>

      {/* ─── App Launcher ─── */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">App Launcher</h2>
        <p className="text-sm text-gray-400 mb-4">Open any platform in a new tab</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {externalApps.map((app) => (
            <a
              key={app.name}
              href={app.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`inline-flex p-2.5 rounded-lg ${app.color}`}>
                  <app.icon className="h-5 w-5" />
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${app.statusColor}`}>
                  {app.status}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">{app.name}</h3>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{app.description}</p>
              <span className="text-xs text-gray-400 font-mono">:{app.port}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
