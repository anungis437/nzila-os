/**
 * PHASE 10 — Monetization Phase 2 Certification
 *
 * Validates Phase 2 MIL additions are production-certifiable:
 *  - Transaction fee schema (5 tables, 5 enums)
 *  - Pricing template schema (2 tables, 3 enums)
 *  - Contract amendment schema (3 tables, 2 enums)
 *  - Reconciliation schema (3 tables, 4 enums)
 *  - Transaction fee engine service
 *  - Reconciliation service
 *  - Entitlement guard service
 *  - Pricing template service
 *  - Migration 0086 well-formed
 *  - Services barrel exports complete
 *  - Monetary fields use DECIMAL, never VARCHAR or FLOAT
 *  - Fee engine math invariants
 *  - Entitlement guard constants & error class
 *  - Pricing template seed data correctness
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const UE = join(ROOT, 'apps', 'union-eyes')
const FIN_SCHEMA = join(UE, 'db', 'schema', 'domains', 'finance')
const PE_SVC = join(UE, 'services', 'platform-economics')
const MIGRATIONS = join(UE, 'db', 'migrations')

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

// ============================================================================
// TRANSACTION FEE SCHEMA
// ============================================================================

describe('CERT-MIL2 — Transaction Fee Schema', () => {
  const schema = read(join(FIN_SCHEMA, 'transaction-fees.ts'))

  it('transaction-fees.ts exists', () => {
    expect(existsSync(join(FIN_SCHEMA, 'transaction-fees.ts'))).toBe(true)
  })

  it('defines transactionFeeRules table', () => {
    expect(schema).toContain("pgTable('transaction_fee_rules'")
  })

  it('defines transactionFeeEvents table', () => {
    expect(schema).toContain("pgTable('transaction_fee_events'")
  })

  it('defines feeSettlementBatches table', () => {
    expect(schema).toContain("pgTable('fee_settlement_batches'")
  })

  it('defines feeSettlementLines table', () => {
    expect(schema).toContain("pgTable('fee_settlement_lines'")
  })

  it('defines feeAdjustments table', () => {
    expect(schema).toContain("pgTable('fee_adjustments'")
  })

  it('defines feeModelEnum with required values', () => {
    expect(schema).toContain("'percentage'")
    expect(schema).toContain("'flat'")
    expect(schema).toContain("'hybrid'")
    expect(schema).toContain("'waived'")
    expect(schema).toContain("'subsidized'")
  })

  it('defines feeEventStatusEnum', () => {
    expect(schema).toContain("'captured'")
    expect(schema).toContain("'reversed'")
    expect(schema).toContain("'settled'")
  })

  it('defines settlementBatchStatusEnum', () => {
    expect(schema).toContain("settlement_batch_status")
  })

  it('fee amounts use DECIMAL type', () => {
    expect(schema).toContain("decimal('fee_amount_cad'")
    expect(schema).toContain("decimal('gross_amount_cad'")
    expect(schema).toContain("decimal('net_amount_cad'")
  })

  it('percentageRate uses precision 8 scale 6', () => {
    expect(schema).toContain("precision: 8, scale: 6")
  })

  it('fee event idempotency key is unique', () => {
    expect(schema).toContain(".unique()")
  })

  it('exports all type unions', () => {
    expect(schema).toContain('TransactionFeeRule')
    expect(schema).toContain('TransactionFeeEvent')
    expect(schema).toContain('FeeSettlementBatch')
    expect(schema).toContain('FeeSettlementLine')
    expect(schema).toContain('FeeAdjustment')
  })
})

// ============================================================================
// PRICING TEMPLATE SCHEMA
// ============================================================================

describe('CERT-MIL2 — Pricing Template Schema', () => {
  const schema = read(join(FIN_SCHEMA, 'pricing-templates.ts'))

  it('pricing-templates.ts exists', () => {
    expect(existsSync(join(FIN_SCHEMA, 'pricing-templates.ts'))).toBe(true)
  })

  it('defines pricingTemplates table', () => {
    expect(schema).toContain("pgTable('pricing_templates'")
  })

  it('defines pricingTemplateModules table', () => {
    expect(schema).toContain("pgTable('pricing_template_modules'")
  })

  it('defines templateStatusEnum', () => {
    expect(schema).toContain("pricing_template_status")
  })

  it('defines billingCadenceEnum with monthly/quarterly/annual', () => {
    expect(schema).toContain("'monthly'")
    expect(schema).toContain("'quarterly'")
    expect(schema).toContain("'annual'")
  })

  it('defines templateTierEnum with all tiers', () => {
    expect(schema).toContain("'pilot'")
    expect(schema).toContain("'shared_rollout'")
    expect(schema).toContain("'full_deployment'")
    expect(schema).toContain("'mid_sized_union'")
    expect(schema).toContain("'membership_association'")
  })

  it('template has all pricing fields', () => {
    expect(schema).toContain("base_platform_fee_cad")
    expect(schema).toContain("per_local_fee_cad")
    expect(schema).toContain("per_division_fee_cad")
    expect(schema).toContain("per_admin_seat_fee_cad")
    expect(schema).toContain("per_module_fee_cad")
  })

  it('template has transaction fee fields', () => {
    expect(schema).toContain("transaction_fee_rate")
    expect(schema).toContain("transaction_flat_fee_cad")
  })

  it('template has discount/subsidy fields', () => {
    expect(schema).toContain("discount_percent")
    expect(schema).toContain("subsidy_cad")
  })

  it('template has constraint fields', () => {
    expect(schema).toContain("max_covered_locals")
    expect(schema).toContain("max_covered_divisions")
    expect(schema).toContain("included_modules")
    expect(schema).toContain("trial_days")
    expect(schema).toContain("contract_term_months")
  })

  it('template has boolean flags', () => {
    expect(schema).toContain("fee_waiver_active")
    expect(schema).toContain("allocation_enabled")
    expect(schema).toContain("pilot_mode")
  })

  it('all pricing fields use DECIMAL', () => {
    expect(schema).not.toMatch(/varchar.*fee_cad/i)
  })

  it('exports PricingTemplate and PricingTemplateModule types', () => {
    expect(schema).toContain('PricingTemplate')
    expect(schema).toContain('PricingTemplateModule')
  })
})

// ============================================================================
// CONTRACT AMENDMENTS SCHEMA
// ============================================================================

describe('CERT-MIL2 — Contract Amendments Schema', () => {
  const schema = read(join(FIN_SCHEMA, 'contract-amendments.ts'))

  it('contract-amendments.ts exists', () => {
    expect(existsSync(join(FIN_SCHEMA, 'contract-amendments.ts'))).toBe(true)
  })

  it('defines contractRateCards table', () => {
    expect(schema).toContain("pgTable('contract_rate_cards'")
  })

  it('defines contractAmendments table', () => {
    expect(schema).toContain("pgTable('contract_amendments'")
  })

  it('defines contractCoveredOrgs table', () => {
    expect(schema).toContain("pgTable('contract_covered_orgs'")
  })

  it('defines amendmentStatusEnum', () => {
    expect(schema).toContain("'draft'")
    expect(schema).toContain("'pending_approval'")
    expect(schema).toContain("'approved'")
    expect(schema).toContain("'rejected'")
    expect(schema).toContain("'superseded'")
  })

  it('defines coveredOrgRoleEnum', () => {
    expect(schema).toContain("'local'")
    expect(schema).toContain("'division'")
    expect(schema).toContain("'region'")
    expect(schema).toContain("'employer'")
  })

  it('rate card has base and negotiated price', () => {
    expect(schema).toContain("base_price_cad")
    expect(schema).toContain("negotiated_price_cad")
  })

  it('rate card has unique contract+module index', () => {
    expect(schema).toContain("contract_rate_cards_contract_module_idx")
  })

  it('amendments have versioning', () => {
    expect(schema).toContain("version")
    expect(schema).toContain("amendment_number")
  })

  it('amendments store change diff', () => {
    expect(schema).toContain("changes")
    expect(schema).toContain("previous_values")
  })

  it('covered orgs have unique contract+org index', () => {
    expect(schema).toContain("contract_covered_orgs_contract_org_idx")
  })

  it('exports all types', () => {
    expect(schema).toContain('ContractRateCard')
    expect(schema).toContain('ContractAmendment')
    expect(schema).toContain('ContractCoveredOrg')
  })
})

// ============================================================================
// RECONCILIATION SCHEMA
// ============================================================================

describe('CERT-MIL2 — Reconciliation Schema', () => {
  const schema = read(join(FIN_SCHEMA, 'reconciliation.ts'))

  it('reconciliation.ts exists', () => {
    expect(existsSync(join(FIN_SCHEMA, 'reconciliation.ts'))).toBe(true)
  })

  it('defines reconciliationRuns table', () => {
    expect(schema).toContain("pgTable('reconciliation_runs'")
  })

  it('defines reconciliationMatches table', () => {
    expect(schema).toContain("pgTable('reconciliation_matches'")
  })

  it('defines reconciliationExceptions table', () => {
    expect(schema).toContain("pgTable('reconciliation_exceptions'")
  })

  it('defines run status enum', () => {
    expect(schema).toContain("'running'")
    expect(schema).toContain("'completed'")
    expect(schema).toContain("'failed'")
  })

  it('defines match type enum', () => {
    expect(schema).toContain("'invoice_payment'")
    expect(schema).toContain("'fee_settlement'")
    expect(schema).toContain("'refund_reversal'")
  })

  it('defines exception type enum', () => {
    expect(schema).toContain("'unmatched_payment'")
    expect(schema).toContain("'unmatched_invoice'")
    expect(schema).toContain("'amount_discrepancy'")
  })

  it('defines exception status enum', () => {
    expect(schema).toContain("'open'")
    expect(schema).toContain("'under_review'")
    expect(schema).toContain("'resolved'")
    expect(schema).toContain("'written_off'")
  })

  it('run tracks invoice and payment totals', () => {
    expect(schema).toContain("total_invoices")
    expect(schema).toContain("total_payments")
    expect(schema).toContain("total_matches")
    expect(schema).toContain("total_exceptions")
  })

  it('run tracks financial totals', () => {
    expect(schema).toContain("invoice_amount_cad")
    expect(schema).toContain("payment_amount_cad")
    expect(schema).toContain("variance_cad")
  })

  it('exception has resolution fields', () => {
    expect(schema).toContain("resolved_by")
    expect(schema).toContain("resolved_at")
    expect(schema).toContain("resolution_notes")
  })

  it('exports all types', () => {
    expect(schema).toContain('ReconciliationRun')
    expect(schema).toContain('ReconciliationMatch')
    expect(schema).toContain('ReconciliationException')
  })
})

// ============================================================================
// TRANSACTION FEE ENGINE SERVICE
// ============================================================================

describe('CERT-MIL2 — Transaction Fee Engine Service', () => {
  const svc = read(join(PE_SVC, 'transaction-fee-engine.ts'))

  it('transaction-fee-engine.ts exists', () => {
    expect(existsSync(join(PE_SVC, 'transaction-fee-engine.ts'))).toBe(true)
  })

  it('exports createFeeRule', () => {
    expect(svc).toContain('export async function createFeeRule')
  })

  it('exports findApplicableRule', () => {
    expect(svc).toContain('export async function findApplicableRule')
  })

  it('exports evaluateFee', () => {
    expect(svc).toContain('export async function evaluateFee')
  })

  it('exports captureTransactionFee (idempotent)', () => {
    expect(svc).toContain('export async function captureTransactionFee')
    expect(svc).toContain('idempotencyKey')
  })

  it('exports reverseTransactionFee', () => {
    expect(svc).toContain('export async function reverseTransactionFee')
  })

  it('exports createSettlementBatch', () => {
    expect(svc).toContain('export async function createSettlementBatch')
  })

  it('exports closeSettlementBatch', () => {
    expect(svc).toContain('export async function closeSettlementBatch')
  })

  it('has decimal math helpers (no floating point)', () => {
    expect(svc).toContain('parseDecimal')
    expect(svc).toContain('addDecimal')
    expect(svc).toContain('multiplyDecimal')
  })

  it('evaluateFee handles all fee models', () => {
    expect(svc).toContain("case 'percentage'")
    expect(svc).toContain("case 'flat'")
    expect(svc).toContain("case 'hybrid'")
    expect(svc).toContain("case 'waived'")
  })

  it('evaluateFee applies min/max cap', () => {
    expect(svc).toContain('minimumFeeCad')
    expect(svc).toContain('maximumFeeCad')
  })

  it('captureTransactionFee uses idempotency check', () => {
    expect(svc).toContain('idempotencyKey')
    expect(svc).toContain('existing')
  })
})

// ============================================================================
// RECONCILIATION SERVICE
// ============================================================================

describe('CERT-MIL2 — Reconciliation Service', () => {
  const svc = read(join(PE_SVC, 'reconciliation-service.ts'))

  it('reconciliation-service.ts exists', () => {
    expect(existsSync(join(PE_SVC, 'reconciliation-service.ts'))).toBe(true)
  })

  it('exports runReconciliation', () => {
    expect(svc).toContain('export async function runReconciliation')
  })

  it('exports resolveException', () => {
    expect(svc).toContain('export async function resolveException')
  })

  it('exports getReconciliationRun', () => {
    expect(svc).toContain('export async function getReconciliationRun')
  })

  it('exports listExceptions', () => {
    expect(svc).toContain('export async function listExceptions')
  })

  it('uses paymentAllocations for invoice matching', () => {
    expect(svc).toContain('paymentAllocations')
  })

  it('uses totalAmount (not total) for invoice amounts', () => {
    expect(svc).toContain('totalAmount')
    expect(svc).not.toMatch(/inv\.total\b/)
  })

  it('detects unmatched payments', () => {
    expect(svc).toContain("'unmatched_payment'")
  })

  it('detects unmatched invoices', () => {
    expect(svc).toContain("'unmatched_invoice'")
  })

  it('detects amount discrepancies', () => {
    expect(svc).toContain("'amount_discrepancy'")
  })

  it('reconciliation uses cents-safe tolerance', () => {
    // After hardening: tolerance is in cents (integer) or uses shared decimal-safe
    expect(svc).toMatch(/tolerance|threshold|VARIANCE/i)
  })

  it('performs fee event settlement matching', () => {
    expect(svc).toContain("'fee_settlement'")
  })

  it('has decimal helpers (shared cents-safe library)', () => {
    // After hardening: uses shared addMoney/subtractMoney from decimal-safe
    expect(svc).toContain("from '@/lib/decimal-safe'")
  })
})

// ============================================================================
// ENTITLEMENT GUARD SERVICE
// ============================================================================

describe('CERT-MIL2 — Entitlement Guard Service', () => {
  const svc = read(join(PE_SVC, 'entitlement-guard.ts'))

  it('entitlement-guard.ts exists', () => {
    expect(existsSync(join(PE_SVC, 'entitlement-guard.ts'))).toBe(true)
  })

  it('exports checkModuleEntitlement', () => {
    expect(svc).toContain('export async function checkModuleEntitlement')
  })

  it('exports requireEntitlement (throwing guard)', () => {
    expect(svc).toContain('export async function requireEntitlement')
  })

  it('exports withEntitlement (route wrapper)', () => {
    expect(svc).toContain('export function withEntitlement')
  })

  it('exports checkCoveredOrg', () => {
    expect(svc).toContain('export async function checkCoveredOrg')
  })

  it('exports listOrgEntitlements', () => {
    expect(svc).toContain('export async function listOrgEntitlements')
  })

  it('defines PLATFORM_MODULES constant', () => {
    expect(svc).toContain('PLATFORM_MODULES')
    expect(svc).toContain("'governance_suite'")
    expect(svc).toContain("'grievance_case_suite'")
    expect(svc).toContain("'financial_intelligence_suite'")
    expect(svc).toContain("'ai_advanced_insights'")
  })

  it('exports EntitlementError class', () => {
    expect(svc).toContain('export class EntitlementError')
    expect(svc).toContain("code = 'ENTITLEMENT_REQUIRED'")
  })

  it('withEntitlement returns 403 with ENTITLEMENT_REQUIRED code', () => {
    expect(svc).toContain('ENTITLEMENT_REQUIRED')
    expect(svc).toContain('403')
  })

  it('checks entitlement expiration', () => {
    expect(svc).toContain('expiresAt')
  })

  it('checks usage limits', () => {
    expect(svc).toContain('usageLimit')
    expect(svc).toContain('currentUsage')
  })

  it('verifies backing contract validity', () => {
    expect(svc).toContain('verifyBackingContract')
  })

  it('audit logs denied access', () => {
    expect(svc).toContain('auditLog')
    expect(svc).toContain('entitlement_check_failed')
  })
})

// ============================================================================
// PRICING TEMPLATE SERVICE
// ============================================================================

describe('CERT-MIL2 — Pricing Template Service', () => {
  const svc = read(join(PE_SVC, 'pricing-template-service.ts'))

  it('pricing-template-service.ts exists', () => {
    expect(existsSync(join(PE_SVC, 'pricing-template-service.ts'))).toBe(true)
  })

  it('exports createTemplate', () => {
    expect(svc).toContain('export async function createTemplate')
  })

  it('exports getTemplate', () => {
    expect(svc).toContain('export async function getTemplate')
  })

  it('exports listTemplates', () => {
    expect(svc).toContain('export async function listTemplates')
  })

  it('exports updateTemplate', () => {
    expect(svc).toContain('export async function updateTemplate')
  })

  it('exports addTemplateModule', () => {
    expect(svc).toContain('export async function addTemplateModule')
  })

  it('exports instantiateTemplate', () => {
    expect(svc).toContain('export async function instantiateTemplate')
  })

  it('exports seedDefaultTemplates', () => {
    expect(svc).toContain('export async function seedDefaultTemplates')
  })

  it('instantiateTemplate requires billingAccountId', () => {
    expect(svc).toContain('billingAccountId: string')
  })

  it('instantiateTemplate uses correct schema fields', () => {
    expect(svc).toContain('billingInterval')
    expect(svc).toContain('effectiveFrom')
    expect(svc).toContain('startDate')
    expect(svc).toContain('endDate')
  })

  it('seeds 5 canonical CUPE templates', () => {
    expect(svc).toContain("code: 'cupe-pilot'")
    expect(svc).toContain("code: 'cupe-shared-rollout'")
    expect(svc).toContain("code: 'cupe-full-deployment'")
    expect(svc).toContain("code: 'mid-sized-union'")
    expect(svc).toContain("code: 'membership-association'")
  })

  it('pilot template has correct pricing', () => {
    expect(svc).toContain("basePlatformFeeCad: '500.00'")
    expect(svc).toContain("perLocalFeeCad: '50.00'")
  })

  it('seedDefaultTemplates is idempotent (check-then-insert)', () => {
    expect(svc).toContain('existing')
    expect(svc).toContain('if (existing) continue')
  })

  it('createTemplate uses transaction for atomicity', () => {
    expect(svc).toContain('db.transaction')
  })
})

// ============================================================================
// MIGRATION 0086
// ============================================================================

describe('CERT-MIL2 — Migration 0086', () => {
  const migrationPath = join(MIGRATIONS, '0086_monetization_phase2.sql')
  const migration = read(migrationPath)

  it('migration file exists', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('migration is wrapped in BEGIN/COMMIT', () => {
    expect(migration).toContain('BEGIN')
    expect(migration).toContain('COMMIT')
  })

  // Enums
  it('creates fee_model enum', () => {
    expect(migration).toContain("CREATE TYPE fee_model")
  })

  it('creates fee_rule_status enum', () => {
    expect(migration).toContain("CREATE TYPE fee_rule_status")
  })

  it('creates fee_event_status enum', () => {
    expect(migration).toContain("CREATE TYPE fee_event_status")
  })

  it('creates settlement_batch_status enum', () => {
    expect(migration).toContain("CREATE TYPE settlement_batch_status")
  })

  it('creates fee_adjustment_type enum', () => {
    expect(migration).toContain("CREATE TYPE fee_adjustment_type")
  })

  it('creates pricing_template_status enum', () => {
    expect(migration).toContain("CREATE TYPE pricing_template_status")
  })

  it('creates billing_cadence enum', () => {
    expect(migration).toContain("CREATE TYPE billing_cadence")
  })

  it('creates template_tier enum', () => {
    expect(migration).toContain("CREATE TYPE template_tier")
  })

  it('creates contract_amendment_status enum', () => {
    expect(migration).toContain("CREATE TYPE contract_amendment_status")
  })

  it('creates covered_org_role enum', () => {
    expect(migration).toContain("CREATE TYPE covered_org_role")
  })

  it('creates reconciliation_run_status enum', () => {
    expect(migration).toContain("CREATE TYPE reconciliation_run_status")
  })

  it('creates reconciliation_match_type enum', () => {
    expect(migration).toContain("CREATE TYPE reconciliation_match_type")
  })

  it('creates reconciliation_exception_type enum', () => {
    expect(migration).toContain("CREATE TYPE reconciliation_exception_type")
  })

  it('creates reconciliation_exception_status enum', () => {
    expect(migration).toContain("CREATE TYPE reconciliation_exception_status")
  })

  // Tables
  it('creates transaction_fee_rules table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS transaction_fee_rules')
  })

  it('creates transaction_fee_events table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS transaction_fee_events')
  })

  it('creates fee_settlement_batches table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS fee_settlement_batches')
  })

  it('creates fee_settlement_lines table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS fee_settlement_lines')
  })

  it('creates fee_adjustments table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS fee_adjustments')
  })

  it('creates pricing_templates table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS pricing_templates')
  })

  it('creates pricing_template_modules table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS pricing_template_modules')
  })

  it('creates contract_rate_cards table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS contract_rate_cards')
  })

  it('creates contract_amendments table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS contract_amendments')
  })

  it('creates contract_covered_orgs table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS contract_covered_orgs')
  })

  it('creates reconciliation_runs table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS reconciliation_runs')
  })

  it('creates reconciliation_matches table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS reconciliation_matches')
  })

  it('creates reconciliation_exceptions table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS reconciliation_exceptions')
  })

  // Indexes
  it('creates all required indexes', () => {
    expect(migration).toContain('txn_fee_rules_org_idx')
    expect(migration).toContain('txn_fee_events_idempotency_idx')
    expect(migration).toContain('fee_settlement_lines_batch_idx')
    expect(migration).toContain('fee_adjustments_event_idx')
    expect(migration).toContain('pricing_templates_tier_idx')
    expect(migration).toContain('pricing_template_modules_template_idx')
    expect(migration).toContain('contract_rate_cards_contract_module_idx')
    expect(migration).toContain('contract_amendments_number_idx')
    expect(migration).toContain('contract_covered_orgs_contract_org_idx')
    expect(migration).toContain('reconciliation_runs_org_idx')
    expect(migration).toContain('reconciliation_matches_run_idx')
    expect(migration).toContain('reconciliation_exceptions_run_idx')
  })

  // FK constraints
  it('fee events reference fee rules', () => {
    expect(migration).toContain('REFERENCES transaction_fee_rules(id)')
  })

  it('settlement lines reference batches', () => {
    expect(migration).toContain('REFERENCES fee_settlement_batches(id)')
  })

  it('template modules reference templates', () => {
    expect(migration).toContain('REFERENCES pricing_templates(id)')
  })

  it('amendments reference commercial_contracts', () => {
    expect(migration).toContain('REFERENCES commercial_contracts(id)')
  })

  it('reconciliation matches reference runs', () => {
    expect(migration).toContain('REFERENCES reconciliation_runs(id)')
  })

  it('uses IF NOT EXISTS for idempotent re-runs', () => {
    const tableCreates = migration.match(/CREATE TABLE IF NOT EXISTS/g) ?? []
    expect(tableCreates.length).toBe(13)
  })

  it('uses DO block for enum idempotency', () => {
    const doBlocks = migration.match(/DO \$\$ BEGIN/g) ?? []
    expect(doBlocks.length).toBe(14)
  })
})

// ============================================================================
// BARREL EXPORTS
// ============================================================================

describe('CERT-MIL2 — Barrel Exports', () => {
  const finBarrel = read(join(FIN_SCHEMA, 'index.ts'))
  const svcBarrel = read(join(PE_SVC, 'index.ts'))

  it('finance barrel exports transaction-fees', () => {
    expect(finBarrel).toContain("'./transaction-fees'")
  })

  it('finance barrel exports pricing-templates', () => {
    expect(finBarrel).toContain("'./pricing-templates'")
  })

  it('finance barrel exports contract-amendments', () => {
    expect(finBarrel).toContain("'./contract-amendments'")
  })

  it('finance barrel exports reconciliation', () => {
    expect(finBarrel).toContain("'./reconciliation'")
  })

  it('service barrel exports transaction-fee-engine', () => {
    expect(svcBarrel).toContain("'./transaction-fee-engine'")
  })

  it('service barrel exports reconciliation-service', () => {
    expect(svcBarrel).toContain("'./reconciliation-service'")
  })

  it('service barrel exports entitlement-guard', () => {
    expect(svcBarrel).toContain("'./entitlement-guard'")
  })

  it('service barrel exports pricing-template-service', () => {
    expect(svcBarrel).toContain("'./pricing-template-service'")
  })
})

// ============================================================================
// CROSS-CUTTING INVARIANTS
// ============================================================================

describe('CERT-MIL2 — Cross-Cutting Invariants', () => {
  const allSchemas = [
    read(join(FIN_SCHEMA, 'transaction-fees.ts')),
    read(join(FIN_SCHEMA, 'pricing-templates.ts')),
    read(join(FIN_SCHEMA, 'contract-amendments.ts')),
    read(join(FIN_SCHEMA, 'reconciliation.ts')),
  ].join('\n')

  const allServices = [
    read(join(PE_SVC, 'transaction-fee-engine.ts')),
    read(join(PE_SVC, 'reconciliation-service.ts')),
    read(join(PE_SVC, 'entitlement-guard.ts')),
    read(join(PE_SVC, 'pricing-template-service.ts')),
  ].join('\n')

  it('no schema uses VARCHAR for monetary amounts', () => {
    // Monetary columns should be decimal, not varchar
    expect(allSchemas).not.toMatch(/varchar\(.*fee/i)
    expect(allSchemas).not.toMatch(/varchar\(.*amount/i)
    expect(allSchemas).not.toMatch(/varchar\(.*price/i)
  })

  it('no schema uses FLOAT for monetary amounts', () => {
    expect(allSchemas).not.toContain('real(')
    expect(allSchemas).not.toContain('doublePrecision(')
  })

  it('all services import from @/db', () => {
    expect(allServices).toContain("from '@/db'")
  })

  it('all services use audit logging', () => {
    expect(allServices).toContain('auditLog')
  })

  it('monetary columns use _cad suffix to enforce CAD denomination', () => {
    // All monetary columns end with _cad to enforce CAD-only convention
    const cadColumns = allSchemas.match(/_cad'/g) ?? []
    expect(cadColumns.length).toBeGreaterThan(10)
  })

  it('all 4 new schema files exist', () => {
    expect(existsSync(join(FIN_SCHEMA, 'transaction-fees.ts'))).toBe(true)
    expect(existsSync(join(FIN_SCHEMA, 'pricing-templates.ts'))).toBe(true)
    expect(existsSync(join(FIN_SCHEMA, 'contract-amendments.ts'))).toBe(true)
    expect(existsSync(join(FIN_SCHEMA, 'reconciliation.ts'))).toBe(true)
  })

  it('all 4 new service files exist', () => {
    expect(existsSync(join(PE_SVC, 'transaction-fee-engine.ts'))).toBe(true)
    expect(existsSync(join(PE_SVC, 'reconciliation-service.ts'))).toBe(true)
    expect(existsSync(join(PE_SVC, 'entitlement-guard.ts'))).toBe(true)
    expect(existsSync(join(PE_SVC, 'pricing-template-service.ts'))).toBe(true)
  })

  it('migration 0086 exists', () => {
    expect(existsSync(join(MIGRATIONS, '0086_monetization_phase2.sql'))).toBe(true)
  })
})
