/**
 * Platform Admin — Automation Rule Builder
 *
 * No-code automation rules for ITSM.
 * Built-in templates from itsm-core exposed here.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  VIP_P1_ESCALATION_TEMPLATE,
  NO_RESPONSE_ESCALATION_TEMPLATE,
  RECURRING_INCIDENT_PROBLEM_TEMPLATE,
} from '@nzila/itsm-core'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Automation Rules | ITSM Config',
}

const BUILT_IN_TEMPLATES = [
  VIP_P1_ESCALATION_TEMPLATE,
  NO_RESPONSE_ESCALATION_TEMPLATE,
  RECURRING_INCIDENT_PROBLEM_TEMPLATE,
]

export default async function AutomationRulesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // TODO: fetch custom automation rules from DB. Until then warn loudly on
  // every render so an empty Custom Rules list is not silently mistaken for
  // "no rules configured" by a platform admin.
  console.warn(
    '[platform-admin] itsm-config/automation: customRules DB query is not wired — rendering empty list',
  )
  const customRules: Array<{
    id: string
    name: string
    enabled: boolean
    conditionCount: number
    actionCount: number
    triggeredCount: number
  }> = []

  return (
    <div className="p-6 space-y-6">
      <Link href="/itsm-config" className="text-gray-400 hover:text-gray-600 text-sm">
        ← ITSM Config
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation Rules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Auto-assign, escalate, notify, or link tickets based on conditions.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + New Rule
        </button>
      </div>

      {/* Built-in templates */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Platform Templates</h2>
        <div className="space-y-2">
          {BUILT_IN_TEMPLATES.map((template, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-gray-200 bg-white p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-900 text-sm">{template.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {template.conditions.length} condition{template.conditions.length !== 1 ? 's' : ''} ·{' '}
                  {template.actions.length} action{template.actions.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  Template
                </span>
                <button className="text-xs text-blue-600 hover:underline">
                  Use Template
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom rules */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Custom Rules</h2>
        {customRules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-400">
              No custom rules yet. Create a rule or start from a template above.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {customRules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-lg border border-gray-200 bg-white p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{rule.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {rule.conditionCount} conditions · {rule.actionCount} actions · triggered {rule.triggeredCount}×
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <button className="text-xs text-blue-600 hover:underline">Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
