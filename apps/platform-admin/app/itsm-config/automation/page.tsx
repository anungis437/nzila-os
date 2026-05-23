/**
 * Platform Admin — Automation Rule Builder
 *
 * Lists per-org persisted automation rules, alongside read-only built-in
 * templates from `@nzila/itsm-core` that can be cloned with one click via
 * `NewAutomationDialog`.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  VIP_P1_ESCALATION_TEMPLATE,
  NO_RESPONSE_ESCALATION_TEMPLATE,
  RECURRING_INCIDENT_PROBLEM_TEMPLATE,
} from '@nzila/itsm-core'
import { getPageOrgContext } from '../../../lib/page-org-context'
import { listAutomationRules } from '../../../lib/automation-queries'
import {
  ActiveOrgBadge,
  ForbiddenPanel,
  OrgPickerPanel,
} from '../../../lib/org-page-fallbacks'
import { canWrite } from '../../../lib/org-scope-guard'
import {
  NewAutomationDialog,
  RuleActions,
} from '../_components/automation-actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Automation Rules | ITSM Config',
}

const BUILT_IN_TEMPLATES = [
  VIP_P1_ESCALATION_TEMPLATE,
  NO_RESPONSE_ESCALATION_TEMPLATE,
  RECURRING_INCIDENT_PROBLEM_TEMPLATE,
]

export default async function AutomationRulesPage({
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
        returnTo="/itsm-config/automation"
      />
    )
  }
  if (result.status === 'forbidden') {
    return <ForbiddenPanel orgId={result.orgId} />
  }

  const { orgId, orgName, orgRole } = result.context
  const customRules = await listAutomationRules(orgId)
  const writable = canWrite(orgRole)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/itsm-config"
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← ITSM Config
        </Link>
        <ActiveOrgBadge orgName={orgName} orgId={orgId} orgRole={orgRole} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation Rules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Auto-assign, escalate, notify, or link tickets based on conditions.
          </p>
        </div>
        {writable && <NewAutomationDialog orgId={orgId} />}
      </div>

      {/* Built-in templates */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Platform Templates
        </h2>
        <div className="space-y-2">
          {BUILT_IN_TEMPLATES.map((template, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-gray-200 bg-white p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-900 text-sm">
                  {template.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {template.conditions.length} condition
                  {template.conditions.length !== 1 ? 's' : ''} ·{' '}
                  {template.actions.length} action
                  {template.actions.length !== 1 ? 's' : ''}
                  {template.cooldownMinutes != null
                    ? ` · ${template.cooldownMinutes}m cooldown`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  Template
                </span>
                {writable && (
                  <NewAutomationDialog
                    orgId={orgId}
                    initial={template}
                    label="Use Template"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom rules */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Custom Rules ({customRules.length})
        </h2>
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
                  <p className="font-medium text-gray-900 text-sm">
                    {rule.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {rule.conditionCount} condition
                    {rule.conditionCount !== 1 ? 's' : ''}{' '}
                    ({rule.conditionLogic === 'all' ? 'AND' : 'OR'}) ·{' '}
                    {rule.actionCount} action
                    {rule.actionCount !== 1 ? 's' : ''} · triggered{' '}
                    {rule.triggerCount}×
                    {rule.cooldownMinutes != null
                      ? ` · ${rule.cooldownMinutes}m cooldown`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      rule.enabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </span>
                  {writable && (
                    <RuleActions
                      orgId={orgId}
                      ruleId={rule.id}
                      enabled={rule.enabled}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
