import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { TICKET_TYPES } from '@nzila/itsm-core'

export const dynamic = 'force-dynamic'

const TICKET_TYPE_DESCRIPTIONS: Record<string, string> = {
  incident: 'Unplanned disruption or degradation of an IT service.',
  service_request: 'Request for information, advice, or a standard change.',
  access_request: 'Request for access to a system, application, or resource.',
  change_request: 'Formal proposal for a change to the IT environment (RFC).',
  problem: 'Root cause investigation for one or more incidents.',
  procurement: 'Hardware, software, or vendor procurement request.',
  vendor_escalation: 'Escalation to an external vendor or third-party supplier.',
  security_event: 'Security incident, alert, or compliance concern.',
  project_task: 'Discrete task associated with an IT project.',
}

export default async function TicketTypesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ticket Types</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure custom fields and workflows for each ticket type.
          </p>
        </div>
        <Link
          href="/itsm-config"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to ITSM Config
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Custom Fields</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {TICKET_TYPES.map((type) => (
              <tr key={type} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {TICKET_TYPE_DESCRIPTIONS[type] ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs italic">No custom fields</td>
                <td className="px-4 py-3">
                  <button
                    className="text-xs text-gray-300 cursor-not-allowed"
                    disabled
                    title="Custom-field configuration is not yet implemented"
                  >
                    Configure
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Custom fields per ticket type — coming in a future release. Schema managed via{' '}
        <code className="font-mono">packages/itsm-core</code>.
      </p>
    </div>
  )
}
