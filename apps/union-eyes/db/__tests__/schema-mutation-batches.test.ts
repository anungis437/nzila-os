/**
 * The schema census and the mutation-scope baseline stay ratchets.
 * This checks the prepared batch program covers every remaining entry and does not add one.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as declarations from '../schema'
import { buildSchemaMutationBatches } from '../../scripts/lib/schema-mutation-batches'

const REGISTER = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/register')
const PROGRAM = path.join(REGISTER, 'ue-schema-mutation-batches.json')

describe('schema and mutation batch program', () => {
  const program = buildSchemaMutationBatches()
  const committed = JSON.parse(readFileSync(PROGRAM, 'utf8'))

  it('matches the committed program', () => {
    expect(program).toEqual(committed)
  })

  // The census was regenerated against a database built by Django migrate plus the approved bootstrap (231 -> 202 -> 179 -> 1).
  // A table may only leave a ratchet by being evolved, created or having its declaration retired, so each exit is tied to its source.
  it('explains every table that left the census: its declaration is retired, a registered migration evolved it, or a registered migration created it', () => {
    const census = new Set((JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-census.json'), 'utf8')).entries as { table: string }[]).map((entry) => entry.table))
    const declared = new Set(
      Object.values(declarations as Record<string, unknown>)
        .filter((value) => is(value, PgTable))
        .map((value) => getTableConfig(value as PgTable).name),
    )
    const retiredDeclarations = [
      'bank_accounts', 'bank_reconciliations', 'clc_remittance_mapping', 'erp_invoices', 'grievance_timeline',
      'notification_history', 'org_usage', 'signature_templates', 'signature_webhooks_log',
    ]
    for (const table of retiredDeclarations) {
      expect(declared.has(table), `${table} is still declared`).toBe(false)
      expect(census.has(table), `${table} is still in the census`).toBe(false)
    }
    const evolvedBy: Record<string, string[]> = {
      'db/migrations-platform/0031_reachable_stub_shape.sql': ['data_anonymization_log', 'employment_history', 'job_classifications', 'member_leaves'],
      'db/migrations-platform/0039_committee_memberships_shape.sql': ['committee_memberships'],
      'db/migrations-platform/0041_room_bookings_shape.sql': ['room_bookings'],
      'db/migrations-cache/0031_feature_flags_attribution_columns.sql': ['feature_flags'],
      'db/migrations-platform/0060_reachable_stub_shape_2.sql': [
        'alert_rules', 'arbitration_decisions', 'automation_rules', 'case_studies', 'clc_organization_sync_log', 'cost_of_living_data',
        'external_data_sync_log', 'provincial_privacy_config', 'reserved_matter_votes', 'support_tickets', 'union_density',
        'wage_benchmarks', 'webhook_receipts',
      ],
      // Platform 0063 converges every physical relation on its declarations: the columns it adds appear in ALTER TABLE statements, the defaults and
      // relaxations it applies appear in the JSON specifications its DO blocks read.
      'db/migrations-platform/0063_declared_shape_convergence.sql': [
      'accessibility_audits', 'accessibility_issues', 'account_balance_reconciliation', 'address_change_history', 'address_validation_cache',
      'ai_budgets', 'alert_recipients', 'arbitrator_profiles', 'arms_length_verification', 'audit_security.security_events', 'autopay_settings',
      'award_history', 'award_templates', 'band_council_consent', 'band_councils', 'bank_of_canada_rates', 'bank_reconciliation',
      'bargaining_team_members', 'benefit_comparisons', 'blind_trust_registry', 'break_glass_activations', 'break_glass_system', 'budget_pool',
      'budget_reservations', 'cba_contacts', 'cba_footnotes', 'cba_version_history', 'certification_alerts', 'certification_audit_log',
      'certification_compliance_reports', 'certification_types', 'clc_bargaining_trends', 'clc_chart_of_accounts', 'clc_oauth_tokens',
      'clc_per_capita_benchmarks', 'clc_union_density', 'clc_webhook_log', 'conflict_audit_log', 'conflict_disclosures',
      'conflict_of_interest_policy', 'consent_records', 'continuing_education', 'contribution_rates', 'cpi_adjusted_pricing', 'cpi_data',
      'cross_border_transactions', 'cross_org_access_log', 'currency_enforcement_audit', 'currency_enforcement_policy',
      'currency_enforcement_violations', 'currency_exchange_rates', 'data_classification_policy', 'disaster_recovery_drills', 'donation_receipts',
      'donations', 'dues_rates', 'emergency_declarations', 'employer_access_attempts', 'event_attendees', 'event_reminders', 'exchange_rates',
      'external_document_files', 'external_document_libraries', 'external_document_permissions', 'external_document_sites', 'federation_remittances',
      'financial_audit_log', 'firewall_compliance_audit', 'fmv_audit_log', 'fmv_benchmarks', 'fmv_policy', 'fmv_violations', 'fx_rate_audit_log',
      'gl_account_mappings', 'governance_events', 'grievance_approvals', 'grievance_assignments', 'grievance_communications',
      'grievance_settlements', 'grievance_stages', 'grievance_workflows', 'gss_applications', 'independent_appraisals', 'indigenous_data_access_log',
      'indigenous_data_sharing_agreements', 'indigenous_member_data', 'integration_sync_log', 'integration_sync_schedules', 'integration_webhooks',
      'international_addresses', 'key_holder_registry', 'knowledge_base', 'knowledge_base_articles', 'license_renewals', 'lmbp_compliance_alerts',
      'lmbp_compliance_reports', 'location_tracking_config', 'lrb_agreements', 'lrb_sync_log', 'member_addresses', 'member_documents',
      'movement_trends', 'negotiation_sessions', 'newsletter_engagement', 'notification_log', 'organization_billing_config', 'organization_contacts',
      'organization_relationships', 'organization_sharing_settings', 'payment_cycles', 'payment_disputes', 'pci_dss_encryption_keys',
      'pci_dss_quarterly_scans', 'pci_dss_requirements', 'pci_dss_saq_assessments', 'precedent_citations', 'precedent_tags', 'privacy_breaches',
      'procurement_bids', 'procurement_requests', 'public_content', 'push_deliveries', 'recovery_time_objectives', 'recusal_tracking',
      'remittance_approvals', 'rl1_tax_slips', 'role_tenure_history', 'safety_training_records', 'security_events', 'segment_executions',
      'segment_exports', 'separated_payment_transactions', 'shopify_config', 'signature_audit_log', 'signature_verification', 'signature_workflows',
      'signers', 'sla_policies', 'sms_campaign_recipients', 'sms_opt_outs', 'sms_templates', 'social_campaigns', 'staff_certifications',
      'strike_fund_payment_audit', 'swiss_cold_storage', 'sync_jobs', 't106_filing_tracking', 't4a_tax_slips', 'tax_year_end_processing',
      'testimonials', 'ticket_comments', 'ticket_history', 'traditional_knowledge_registry', 'transaction_currency_conversions',
      'transfer_pricing_documentation', 'union_only_data_tags', 'user_consents', 'user_sessions', 'user_uuid_mapping', 'voting_audit_log',
      'voting_notifications', 'wage_progressions', 'webhook_events', 'weekly_threshold_tracking', 'whiplash_prevention_audit',
      ],
    }
    const appRoot = path.resolve(__dirname, '../..')
    for (const [file, tables] of Object.entries(evolvedBy)) {
      const sql = readFileSync(path.join(appRoot, file), 'utf8')
      for (const table of tables) {
        expect(census.has(table), `${table} is still in the census`).toBe(false)
        const bare = table.split('.').pop()!
        const alters = new RegExp(`ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?(?:(?:public|audit_security)\\.)?"?${bare}"?[\\s(;]`, 'i')
        const specified = file.includes('0063_') && sql.includes(`"t":"${bare}"`)
        expect(alters.test(sql) || specified, `${file} does not alter ${table}`).toBe(true)
      }
    }
    // Declared relations that no migration created until platform 0061: the census listed each as TABLE_ABSENT, and every route over one answered with an undefined-relation fault.
    const createdBy: Record<string, string[]> = {
      'db/migrations-platform/0061_declared_absent_relations.sql': [
        'anti_scab_violations', 'cnesst_filings', 'joint_hs_committees', 'pay_equity_exercises', 'preventive_withdrawals', 'right_of_refusal_events',
        'wcb_claims', 'wcb_employer_assessments', 'member_dues_issues', 'payroll_deductions', 'customer_nps_surveys', 'customer_onboarding_milestones',
        'cba_intel_sources', 'cba_intel_ingestion_jobs', 'cba_intel_documents', 'cba_intel_agreements', 'cba_intel_clauses', 'cba_intel_extraction_runs',
        'cba_intel_findings', 'cba_intel_wage_adjustments', 'cba_intel_review_decisions', 'cba_intel_benchmark_snapshots', 'cba_intel_freshness_log',
      ],
      'db/migrations-platform/0065_declared_absent_relations_2.sql': [
      'dunning_cases', 'dunning_policies', 'dunning_steps', 'fee_settlement_lines', 'pricing_discount_rules', 'pricing_regional_deployments',
      'pricing_template_modules', 'pricing_templates', 'usage_aggregates', 'usage_events', 'usage_meters',
      ],
    }
    for (const [file, tables] of Object.entries(createdBy)) {
      const sql = readFileSync(path.join(appRoot, file), 'utf8')
      for (const table of tables) {
        expect(census.has(table), `${table} is still in the census`).toBe(false)
        expect(declared.has(table), `${table} lost its declaration instead of gaining a relation`).toBe(true)
        expect(sql.includes(`CREATE TABLE public."${table}"`), `${file} does not create ${table}`).toBe(true)
      }
    }
    // The three relations that live in the audit_security and user_management schemas.
    const createdQualified = ['audit_security.failed_login_attempts', 'audit_security.rate_limit_events', 'user_management.oauth_providers']
    const qualifiedSql = readFileSync(path.join(appRoot, 'db/migrations-platform/0065_declared_absent_relations_2.sql'), 'utf8')
    for (const table of createdQualified) {
      const [schema, name] = table.split('.')
      expect(census.has(table), `${table} is still in the census`).toBe(false)
      expect(declared.has(name), `${table} lost its declaration instead of gaining a relation`).toBe(true)
      expect(qualifiedSql.includes(`CREATE TABLE "${schema}"."${name}"`), `0065 does not create ${table}`).toBe(true)
    }
    const explained = [...retiredDeclarations, ...Object.values(evolvedBy).flat(), ...Object.values(createdBy).flat(), ...createdQualified]
    expect(new Set(explained).size, 'a table is explained twice').toBe(explained.length)
    const originalCensusSize = 231
    expect(explained.length, 'a table left the census without an explanation').toBe(originalCensusSize - census.size)
  })

  it('covers the census and the mutation baseline without adding a row', () => {
    const census = JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-census.json'), 'utf8')).entries as { table: string }[]
    const disposition = JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-disposition.json'), 'utf8')).entries as Record<string, { disposition: string }>
    const baseline = JSON.parse(readFileSync(path.join(REGISTER, 'ue-mutation-scope-baseline.json'), 'utf8')).entries as Record<string, number>
    expect(program.applyNow).toBe(false)
    expect(program.sourceMutationBaselineSum).toBe(15)
    expect(program.mutationLiveSum).toBeLessThanOrEqual(15)
    expect(program.censusCount).toBe(census.length)
    expect(program.schema.map((entry) => entry.table)).toEqual(census.map((entry) => entry.table).sort())
    expect(new Set(program.schema.map((entry) => entry.table)).size).toBe(census.length)
    for (const entry of program.schema) expect(entry.disposition).toBe(disposition[entry.table].disposition)
    expect(program.mutations.map((entry) => entry.key)).toEqual(Object.keys(baseline).sort())
    expect(program.mutationBaselineSum).toBe(Object.values(baseline).reduce((sum, count) => sum + count, 0))
    expect(program.mutations.reduce((sum, entry) => sum + entry.baselineCount, 0)).toBe(program.mutationBaselineSum)
    expect(program.mutationLiveSum).toBeLessThanOrEqual(program.mutationBaselineSum)
    for (const entry of program.mutations) expect(entry.liveCount).toBeLessThanOrEqual(entry.baselineCount)
  })

  it('keeps hold batches from shrinking a ratchet and keeps create-relation equal to the oracle exclusion', () => {
    const holds = new Set(program.batches.filter((batch) => batch.execution === 'hold').map((batch) => batch.id))
    for (const entry of program.schema) {
      if (!holds.has(entry.batchId)) continue
      const batch = program.batches.find((item) => item.id === entry.batchId)
      expect(batch?.shrink).toBe('none')
    }
    const excluded = [...(JSON.parse(readFileSync(path.resolve(__dirname, '../../../../tooling/db/canonical-schema/oracle-binding.json'), 'utf8')).dispositionExcluded as string[])].sort()
    expect(program.schema.filter((entry) => entry.batchId === 'schema-create-relation').map((entry) => entry.table).sort()).toEqual(excluded)
    expect(program.schema.some((entry) => entry.disposition === 'EVOLVE_NEXT_TRANCHE')).toBe(false)
    const finance = program.batches.find((batch) => batch.id === 'mutation-finance-latent')
    expect(finance?.action).toContain('Do not issue a financial mandate')
    expect(finance?.action).toContain('not an approval path')
    expect(finance?.statementCount).toBe(7)
    expect(finance?.liveStatementCount).toBe(0)
    expect(finance?.execution).toBe('implemented')
    expect(finance?.applyNow).toBe(true)
    const clc = program.batches.find((batch) => batch.id === 'mutation-clc-sync-log')
    expect(clc?.action).toContain('Do not drop the relation')
    expect(clc?.statementCount).toBe(1)
    expect(clc?.liveStatementCount).toBe(0)
    expect(clc?.execution).toBe('implemented')
    expect(clc?.applyNow).toBe(true)
    const pilot = program.batches.find((batch) => batch.id === 'mutation-pilot-rebind')
    expect(pilot?.action).toContain('cannot supply an organization token')
    expect(pilot?.statementCount).toBe(1)
    expect(pilot?.liveStatementCount).toBe(0)
    expect(pilot?.execution).toBe('implemented')
    expect(pilot?.applyNow).toBe(true)
    const workbook = program.batches.find((batch) => batch.id === 'mutation-workbook-unclaimed')
    expect(workbook?.action).toContain('READY_FOR_VS_EXECUTION')
    expect(workbook?.statementCount).toBe(2)
    expect(workbook?.liveStatementCount).toBe(0)
    expect(workbook?.execution).toBe('implemented')
    expect(workbook?.applyNow).toBe(true)
    const retention = program.batches.find((batch) => batch.id === 'mutation-location-retention')
    expect(retention?.action).toContain('READY_FOR_VS_EXECUTION')
    expect(retention?.statementCount).toBe(2)
    expect(retention?.liveStatementCount).toBe(0)
    expect(retention?.execution).toBe('implemented')
    expect(retention?.applyNow).toBe(true)
    // Every schema batch emptied when the census was regenerated against the converged schema (platforms 0062 to 0065 created, evolved and unified every
    // relation the declarations name): each entry left it, and 'explains every table that left the census' says why each was allowed to.
    for (const id of [
      'schema-retire-declaration', 'schema-live-unreferenced', 'schema-verify-dead-module', 'schema-evolve-reachable', 'schema-create-relation',
      'schema-contained-deny-all', 'schema-verify-dead-required', 'schema-verify-reachable-blocked', 'schema-live-unreferenced-blocked',
      'schema-registry-gap', 'schema-global-reference', 'schema-system-only', 'schema-separate-database', 'schema-django-defined',
      'schema-individual-decision',
    ]) {
      expect(program.batches.some((batch) => batch.id === id), id).toBe(false)
    }
    expect(program.censusCount).toBe(0)
    expect(program.schema).toEqual([])
  })
})
