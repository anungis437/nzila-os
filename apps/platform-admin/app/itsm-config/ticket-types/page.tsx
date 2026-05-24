/**
 * Platform Admin — Ticket Types & Custom Fields
 *
 * Lists every built-in ticket type from `@nzila/itsm-core` together with
 * the org-defined custom fields stored in `itsm_ticket_field_defs`. Each
 * row exposes a `ManageFieldsDialog` (org-admin / org-secretary only)
 * that lets operators add, toggle, or delete fields for that type.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { TICKET_TYPES, type TicketType } from '@nzila/itsm-core'
import { getPageOrgContext } from '../../../lib/page-org-context'
import { listFieldDefs } from '../../../lib/ticket-type-queries'
import {
  ActiveOrgBadge,
  ForbiddenPanel,
  OrgPickerPanel,
} from '../../../lib/org-page-fallbacks'
import { canWrite } from '../../../lib/org-scope-guard'
import {
  ManageFieldsDialog,
  type ExistingField,
} from '../_components/ticket-type-actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Ticket Types | ITSM Config',
}

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

function formatLabel(t: string): string {
  return t.replace(/_/g, ' ')
}

export default async function TicketTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>
}) {
  const sp = await searchParams
  const result = await getPageOrgContext(sp)

  if (result.status === 'unauthenticated') redirect('/sign-in')
  if (result.status === 'no-selection') {
    return (
      <OrgPickerPanel
        candidates={result.candidates}
        returnTo="/itsm-config/ticket-types"
      />
    )
  }
  if (result.status === 'forbidden') {
    return <ForbiddenPanel orgId={result.orgId} />
  }

  const { orgId, orgName, orgRole } = result.context
  const allFields = await listFieldDefs(orgId)
  const writable = canWrite(orgRole)

  // Group field defs by ticket type.
  const fieldsByType = new Map<TicketType, ExistingField[]>()
  for (const f of allFields) {
    const list = fieldsByType.get(f.ticketType) ?? []
    list.push({
      id: f.id,
      fieldKey: f.fieldKey,
      label: f.label,
      fieldType: f.fieldType,
      options: f.options,
      required: f.required,
      helpText: f.helpText,
      sortOrder: f.sortOrder,
      active: f.active,
    })
    fieldsByType.set(f.ticketType, list)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link
          href="/itsm-config"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← ITSM Config
        </Link>
        <ActiveOrgBadge orgName={orgName} orgId={orgId} orgRole={orgRole} />
      </div>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Ticket Types</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure custom fields per ticket type. Built-in types are managed
          by the platform; only custom fields are org-scoped.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Description
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Custom Fields
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {TICKET_TYPES.map((type) => {
              const fields = fieldsByType.get(type) ?? []
              const activeCount = fields.filter((f) => f.active).length
              return (
                <tr key={type} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {formatLabel(type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {TICKET_TYPE_DESCRIPTIONS[type] ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {fields.length === 0 ? (
                      <span className="italic text-gray-400">
                        No custom fields
                      </span>
                    ) : (
                      <span>
                        {activeCount} active / {fields.length} total
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {writable ? (
                      <ManageFieldsDialog
                        orgId={orgId}
                        ticketType={type}
                        ticketTypeLabel={formatLabel(type)}
                        existingFields={fields}
                      />
                    ) : (
                      <span className="text-xs text-gray-300">View only</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
