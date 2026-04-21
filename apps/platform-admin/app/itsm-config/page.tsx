/**
 * Platform Admin — Service Operations Configuration hub
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Service Ops Config | Platform Admin',
}

const CONFIG_SECTIONS = [
  {
    title: 'SLA Profiles',
    href: '/itsm-config/sla-profiles',
    description: 'Define response and resolution SLA targets by priority. Assign profiles to queues and contracts.',
    badge: null,
  },
  {
    title: 'Queue Manager',
    href: '/itsm-config/queues',
    description: 'Create and configure service queues. Set working hours, escalation paths, and team assignments.',
    badge: null,
  },
  {
    title: 'Automation Rules',
    href: '/itsm-config/automation',
    description: 'Build no-code automation rules — auto-assign, escalate, notify, or create problems from recurring incidents.',
    badge: 'Beta',
  },
  {
    title: 'Ticket Types',
    href: '/itsm-config/ticket-types',
    description: 'Configure custom fields and workflows per ticket type (Incident, Service Request, Change, etc.).',
    badge: null,
  },
  {
    title: 'Approval Workflows',
    href: '/itsm-config/approvals',
    description: 'Define multi-step approval chains for Change Requests and High-Impact Incidents.',
    badge: null,
  },
]

export default async function ItsmConfigPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Service Operations Config</h1>
        <p className="text-sm text-gray-500 mt-1">
          Platform-level configuration for the Nzila Service Operations Layer.
          Changes here affect all tenants unless overridden at org level.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CONFIG_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-gray-200 bg-white p-5 hover:border-blue-400 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-600">
                {section.title}
              </h2>
              {section.badge && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {section.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
