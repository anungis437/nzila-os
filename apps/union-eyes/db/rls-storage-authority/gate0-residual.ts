import type {
  DbExecutionPrincipal,
  InvocationAuthority,
  RuntimeOperation,
  StorageAuthorityClassification,
  StorageAuthorityEntry,
} from './types'

type Spec = readonly [
  table: string,
  classification: StorageAuthorityClassification,
  runtime: readonly RuntimeOperation[],
  system: readonly RuntimeOperation[],
  invocation: InvocationAuthority,
  principal: DbExecutionPrincipal,
]

const migration = 'db/migrations-platform/0088_gate0_checkout_and_payroll_integrity.sql'

/**
 * Tables introduced by the final Gate 0 residual migration. Keeping this
 * cohort together makes admission atomic: a new physical table cannot be
 * migrated without an explicit principal and least-privilege DML contract.
 */
const specs: readonly Spec[] = [
  ['billing_automation_mandates', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], ['SELECT'], 'MIXED', 'MIXED'],
  ['billing_automation_runs', 'SYSTEM_ONLY', [], ['SELECT', 'INSERT', 'UPDATE'], 'SYSTEM_SCHEDULE', 'SYSTEM_RUNTIME'],
  ['campaign_delivery_outbox', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], ['SELECT', 'INSERT', 'UPDATE'], 'MIXED', 'MIXED'],
  ['document_upload_quarantines', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], ['SELECT', 'INSERT', 'UPDATE'], 'MIXED', 'MIXED'],
  ['dues_payment_disclosure_consents', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], ['SELECT', 'INSERT', 'UPDATE'], 'MIXED', 'MIXED'],
  ['dues_payment_merchant_configs', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], ['SELECT', 'INSERT', 'UPDATE'], 'MIXED', 'MIXED'],
  ['employer_remittance_submissions', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['employer_replay_intents', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['equity_consent_notice_versions', 'GLOBAL_REFERENCE_DATA', ['SELECT'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['equity_disclosure_grants', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['equity_purpose_consents', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], ['SELECT', 'UPDATE'], 'MIXED', 'MIXED'],
  ['equity_self_identification_records', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], ['SELECT', 'UPDATE'], 'MIXED', 'MIXED'],
  ['integration_config_versions', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['integration_credential_bindings', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['organizing_form_generation_receipts', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['organizing_form_template_versions', 'GLOBAL_REFERENCE_DATA', ['SELECT'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['pension_benefit_claim_evidence', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['pension_benefit_settlement_handoffs', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['pension_trustee_decisions', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['pension_trustee_mandates', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['pilot_commercial_acceptances', 'SYSTEM_ONLY', [], ['SELECT', 'INSERT', 'UPDATE'], 'PLATFORM_ADMIN', 'SYSTEM_RUNTIME'],
  ['pilot_commercial_offers', 'SYSTEM_ONLY', [], ['SELECT', 'INSERT', 'UPDATE'], 'PLATFORM_ADMIN', 'SYSTEM_RUNTIME'],
  ['pilot_contact_verifications', 'SYSTEM_ONLY', [], ['SELECT', 'INSERT', 'UPDATE'], 'MIXED', 'SYSTEM_RUNTIME'],
  ['pilot_crm_disclosure_outbox', 'SYSTEM_ONLY', [], ['SELECT', 'INSERT', 'UPDATE'], 'WORKER', 'SYSTEM_RUNTIME'],
  ['pilot_evidence_assessments', 'SYSTEM_ONLY', [], ['SELECT', 'INSERT', 'UPDATE'], 'PLATFORM_ADMIN', 'SYSTEM_RUNTIME'],
  ['reconciliation_resolution_decisions', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['reconciliation_resolution_postings', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['report_disclosure_receipts', 'TENANT_RLS_REQUIRED', ['INSERT'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['report_field_grants', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['shopify_webhook_secret_versions', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], ['SELECT'], 'MIXED', 'MIXED'],
  ['sso_oidc_attempts', 'SYSTEM_ONLY', [], ['SELECT', 'INSERT', 'UPDATE'], 'MIXED', 'SYSTEM_RUNTIME'],
  ['sso_provider_versions', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT'], ['SELECT', 'INSERT'], 'MIXED', 'MIXED'],
  ['statutory_rule_versions', 'GLOBAL_REFERENCE_DATA', ['SELECT'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['survey_anonymous_participations', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['survey_questionnaire_versions', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT'], [], 'TENANT_USER', 'TENANT_RUNTIME'],
  ['voice_usage_reservations', 'TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], ['SELECT', 'INSERT', 'UPDATE'], 'MIXED', 'MIXED'],
  ['workbook_checkout_intents', 'SYSTEM_ONLY', [], ['SELECT', 'INSERT', 'UPDATE'], 'MIXED', 'SYSTEM_RUNTIME'],
]

export const gate0ResidualEntries: StorageAuthorityEntry[] = specs.map(
  ([table, classification, requiredRuntimePrivileges, requiredSystemPrivileges, invocationAuthority, dbExecutionPrincipal]) => ({
    table,
    classification,
    reason: `Gate 0 residual closure: authority, FORCE-RLS policy, and least-privilege DML are defined by ${migration}; runtime consumers use the corresponding governed route/service transaction.`,
    supportingCapability: [migration],
    requiredRuntimePrivileges,
    requiredSystemPrivileges,
    invocationAuthority,
    dbExecutionPrincipal,
    reviewPriority: 'NONE',
    ...(['document_upload_quarantines', 'dues_payment_disclosure_consents', 'dues_payment_merchant_configs'].includes(table)
      ? { scopeDisposition: 'OTHER_EXPLICITLY_JUSTIFIED' as const }
      : {}),
  }),
)
