import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { compileSecurity, type SecurityRule } from './security'
import { hash, root, type V2Plan } from './source'

const callers = {
  alert_executions: 'services/observability/realtime-alerting-service.ts',
  alert_rules: 'services/observability/realtime-alerting-service.ts',
  audit_logs: 'backend/core/models.py',
  campaigns: 'app/api/communications/webhooks/resend/route.ts',
  communication_preferences: 'app/api/communications/unsubscribe/[recipientId]/route.ts',
  consent_records: 'app/api/communications/unsubscribe/[recipientId]/route.ts',
  contribution_rates: 'lib/services/external-data/wage-enrichment-service.ts',
  cost_of_living_data: 'lib/services/external-data/wage-enrichment-service.ts',
  council_elections: 'app/api/elections/[id]/route.ts',
  data_subject_access_requests: 'services/provincial-privacy-service.ts',
  domain_events: 'backend/services/events/dispatcher.py',
  external_data_sync_log: 'lib/services/external-data/wage-enrichment-service.ts',
  golden_shares: 'app/api/governance/golden-share/route.ts',
  holidays: 'lib/canadian-labour-standards/statutory-holidays.ts',
  integration_idempotency_keys: 'backend/services/integration_control_plane/views.py',
  integration_registry: 'backend/services/integration_control_plane/views.py',
  message_log: 'app/api/communications/unsubscribe/[recipientId]/route.ts',
  mission_audits: 'app/api/governance/mission-audits/route.ts',
  notification_delivery_log: 'lib/services/notification-service.ts',
  notification_queue: 'lib/services/notification-service.ts',
  organization_members: 'lib/services/member-access-revocation-service.ts',
  organizations: 'app/api/organizations/route.ts',
  payments: 'app/api/payments/webhooks/stripe/route.ts',
  per_capita_remittances: 'services/clc/per-capita-calculator.ts',
  pilot_applications: 'app/api/pilot/apply/[id]/commercial-transition/route.ts',
  recognition_awards: 'lib/services/rewards/award-service.ts',
  reserved_matter_votes: 'app/api/governance/reserved-matters/[id]/class-b-vote/route.ts',
  union_density: 'lib/services/external-data/wage-enrichment-service.ts',
  user_notification_preferences: 'app/api/notifications/preferences/route.ts',
  wage_benchmarks: 'lib/services/external-data/wage-enrichment-service.ts',
  webhook_receipts: 'lib/services/rewards/webhook-service.ts',
  commercial_contracts: 'app/api/pilot/apply/[id]/commercial-transition/route.ts',
  deadline_audit_events: 'lib/deadline-engine/audit.ts',
  dues_transactions: 'lib/dues/dues-settlement.ts',
  member_dues_ledger: 'lib/dues/dues-settlement.ts',
  deadline_reassignment_convergence: 'lib/deadline-engine/assignment-sync.ts',
  deadline_reminder_executions: 'lib/deadline-engine/reminder-worker.ts',
  deadline_reminders: 'lib/deadline-engine/reminder-worker.ts',
  employer_execution_artifacts: 'lib/workers/employer-execution/process-evidence-seal.ts',
  employer_execution_compliance_events:
    'lib/workers/employer-execution/process-compliance-watchdog.ts',
  employer_execution_replays: 'lib/workers/employer-execution/process-replay-run.ts',
  fee_adjustments: 'services/platform-economics/transaction-fee-engine.ts',
  platform_payments: 'services/platform-economics/billing-service.ts',
  transaction_fee_events: 'services/platform-economics/transaction-fee-engine.ts',
  icra_assessment_answers: 'app/api/icra/[assessmentId]/answer/route.ts',
  icra_assessments: 'app/api/icra/start/route.ts',
  icra_continuity_scores: 'app/api/icra/submit/route.ts',
  icra_followup_recommendations: 'app/api/icra/submit/route.ts',
  icra_governance_flags: 'app/api/icra/submit/route.ts',
  icra_maturity_profiles: 'app/api/icra/submit/route.ts',
  icra_organizations: 'app/api/icra/start/route.ts',
  workbook_purchases: 'app/api/payments/webhooks/stripe/route.ts',
  workbooks: 'app/api/payments/webhooks/stripe/route.ts',
  // Relations whose SYSTEM mutation authority entered the plan with the 2026-10-29 (R-46) and 2026-11-04
  // regenerations. Each caller is the source file, listed in the relation's supportingCapability, that
  // performs the mutation under the system role or opens the system context in which it runs.
  contact_submissions: 'app/api/contact/route.ts',
  cookie_consents: 'app/api/gdpr/cookie-consent/route.ts',
  document_intakes: 'lib/documents/intake-lifecycle.ts',
  email_address_suppressions: 'lib/communications/address-suppression.ts',
  geofence_events: 'app/api/cron/location-retention/route.ts',
  in_app_notifications: 'app/api/rewards/cron/route.ts',
  location_deletion_log: 'app/api/cron/location-retention/route.ts',
  location_tracking: 'app/api/cron/location-retention/route.ts',
  member_location_consent: 'app/api/cron/location-retention/route.ts',
  member_roles: 'db/queries/enhanced-rbac-queries.ts',
  newsletter_list_subscribers: 'app/api/communications/webhooks/resend/route.ts',
  org_subscriptions: 'app/api/pilot/apply/[id]/commercial-transition/route.ts',
  payment_allocations: 'services/platform-economics/billing-service.ts',
  permission_exceptions: 'db/queries/enhanced-rbac-queries.ts',
  pilot_fixture_rows: 'app/api/pilot/bootstrap/cupe/route.ts',
  platform_invoice_line_items: 'app/api/pilot/apply/[id]/commercial-transition/route.ts',
  platform_invoices: 'services/platform-economics/billing-service.ts',
  public_intake_audit_events: 'lib/public-intake/intake-audit.ts',
  rbac_audit_log: 'db/queries/enhanced-rbac-queries.ts',
  reward_budget_envelopes: 'lib/services/rewards/budget-service.ts',
  reward_wallet_ledger: 'lib/services/rewards/wallet-service.ts',
  role_definitions: 'db/queries/enhanced-rbac-queries.ts',
  scim_configurations: 'lib/scim/scim-token.ts',
  scim_events_log: 'lib/scim/events-log.ts',
  scim_provisioned_users: 'lib/scim/provisioned-members.ts',
  workbook_memory_holders: 'lib/workbook/access-control.ts',
  workbook_modules: 'app/api/workbook/start/route.ts',
} as const

/** The exact number of relations the plan grants a SYSTEM INSERT, UPDATE or DELETE; one source caller each. */
export const SYSTEM_MUTATION_DENOMINATOR = 80

export interface SystemMutationContract {
  table: string
  caller: string
  callerDigest: string
  selector: string
  insertReturning: string[]
  preallocateInsertIdentity: boolean
  writeOwnedFeeResult: boolean
  updateReturning: string[]
  updateColumn: string
  updateValue: string
}

export const systemMutationRules = (plan: V2Plan): SecurityRule[] =>
  compileSecurity(plan).rules.filter((rule) =>
    rule.systemPrivileges.some((privilege) => ['INSERT', 'UPDATE', 'DELETE'].includes(privilege)),
  )

export function systemMutationContracts(plan: V2Plan): SystemMutationContract[] {
  const rules = systemMutationRules(plan)
  assert.equal(
    rules.length,
    SYSTEM_MUTATION_DENOMINATOR,
    'UE_V2_SYSTEM_MUTATION_EXACT_DENOMINATOR_REQUIRED',
  )
  assert.deepEqual(
    rules.map((rule) => rule.table).sort(),
    Object.keys(callers).sort(),
    'UE_V2_SYSTEM_MUTATION_SOURCE_CENSUS_DRIFT',
  )
  const feeHelper = 'apps/union-eyes/services/platform-economics/fee-adjustment-insert.ts'
  assert.equal(
    plan.sourceCommitments[feeHelper],
    hash(readFileSync(path.join(root, ...feeHelper.split('/')), 'utf8')),
    'UE_V2_SYSTEM_MUTATION_FEE_HELPER_SOURCE_DRIFT',
  )
  return rules.map((rule) => {
    const table = plan.tables.find((table) => table.name === rule.table)!
    const caller = callers[rule.table as keyof typeof callers]
    assert(
      table.authority?.supportingCapability.includes(caller),
      `UE_V2_SYSTEM_MUTATION_CALLER_AUTHORITY_REQUIRED:${rule.table}:${caller}`,
    )
    const absoluteCaller = path.join(root, 'apps', 'union-eyes', ...caller.split('/'))
    const callerDigest = hash(readFileSync(absoluteCaller, 'utf8'))
    const committed = plan.sourceCommitments[`apps/union-eyes/${caller}`]
    if (committed)
      assert.equal(callerDigest, committed, `UE_V2_SYSTEM_MUTATION_CALLER_SOURCE_DRIFT:${caller}`)
    const selector = rule.table === 'external_data_sync_log' ? 'sync_id' : 'id'
    assert(table.columns.some((column) => column.name === selector))
    // Returning shapes are SQL component projections, not proof that every caller was invoked.
    const insertReturning =
      rule.table === 'commercial_contracts'
        ? ['id']
        : rule.systemPrivileges.includes('SELECT')
          ? ['*']
          : []
    const updateReturning =
      rule.table === 'external_data_sync_log'
        ? ['sync_id']
        : rule.table === 'commercial_contracts'
          ? ['id']
          : rule.systemPrivileges.includes('SELECT')
            ? ['*']
            : []
    const updateColumns: Record<string, string> = {
      icra_assessment_answers: 'note',
      icra_assessments: 'report_tier_id',
      icra_maturity_profiles: 'maturity_band_id',
    }
    // Relations without updated_at: the column and value the source caller's own system UPDATE sets.
    const callerUpdates: Record<string, [column: string, value: string]> = {
      contact_submissions: ['crm_status', 'recorded'],
      document_intakes: ['status', 'expired'],
      rbac_audit_log: ['reviewed_at', '2026-10-13T12:00:00.000Z'],
    }
    const updateColumn =
      updateColumns[rule.table] ??
      callerUpdates[rule.table]?.[0] ??
      (rule.table === 'transaction_fee_events' || rule.table === 'external_data_sync_log'
        ? 'status'
        : 'updated_at')
    const updateValue =
      rule.table in updateColumns
        ? 'synthetic-system-update'
        : (callerUpdates[rule.table]?.[1] ??
          (rule.table === 'transaction_fee_events'
            ? 'reversed'
            : rule.table === 'external_data_sync_log'
              ? 'completed'
              : '2026-10-13T12:00:00.000Z'))
    if (rule.systemPrivileges.includes('UPDATE'))
      assert(
        table.columns.some((column) => column.name === updateColumn),
        `UE_V2_SYSTEM_MUTATION_UPDATE_SOURCE_COLUMN_REQUIRED:${rule.table}`,
      )
    return {
      table: rule.table,
      caller,
      callerDigest,
      selector,
      insertReturning,
      preallocateInsertIdentity: rule.table === 'alert_executions',
      writeOwnedFeeResult: rule.table === 'fee_adjustments',
      updateReturning,
      updateColumn,
      updateValue,
    }
  })
}
