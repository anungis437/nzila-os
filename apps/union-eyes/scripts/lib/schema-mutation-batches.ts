/**
 * Batch program for the schema census (UE-CONV-H-007) and the mutation-scope baseline (UE-CONV-K-006).
 *
 * Program `applyNow` stays false. A mutation batch sets `applyNow` only when the live scan no longer
 * counts its source statements. A schema retirement batch sets `sourceRetired` when those Drizzle
 * declarations are gone from the schema barrel. The census file stays until VS Code regenerates it.
 * This module does not edit either ratchet file, does not emit SQL, and does not start a database.
 * A hold batch never shrinks a ratchet.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import * as declarations from '../../db/schema'
import { BASELINE, scanUnscopedMutations } from './mutation-scope-scan'
import { buildReachIndex, productionReferences, tableIsReachable, type ReachIndex } from './production-reachability'

const REGISTER = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/register')
const ORACLE = path.resolve(__dirname, '../../../../tooling/db/canonical-schema/oracle-binding.json')

const DJANGO_BASE_DEFAULTS = new Set(['id', 'created_at', 'updated_at'])

export interface CensusEntry {
  table: string
  defects: string[]
  columnsMissing: string[]
  requiredUndeclared: string[]
}

export interface DispositionEntry {
  disposition: string
  reason: string
  registryClass: string
}

type Execution = 'cursor' | 'cursor-then-vs' | 'prepared-evolve' | 'baseline-rewrite' | 'implemented' | 'hold'

export interface BatchSpec {
  id: string
  order: number
  ratchet: 'census' | 'mutation-scope'
  execution: Execution
  shrink: 'census' | 'mutation-baseline' | 'none'
  action: string
  proof: string
}

export interface SchemaAssignment {
  table: string
  batchId: string
  disposition: string
  registryClass: string
  defects: string[]
  reachable: boolean
  djangoDefined: boolean
  blockers: string[]
  /** Set when the schema barrel no longer exports this census table. */
  declarationRemoved?: boolean
  /** Why a live-unreferenced declaration stays. */
  holdReason?: string
}

/** Kept because another declaration or a raw SQL reader still names them. */
const REQUIRED_DECLARATION: Record<string, string> = {
  budget_pool: 'budgetReservations.poolId references budgetPool, and finance summary plus financial-insights read budget_pool. The declaration stays.',
  dues_rates: 'memberDuesLedgerRelations names duesRates. The declaration stays.',
  payment_cycles: 'payments.paymentCycleId and paymentsRelations.cycle reference paymentCycles. The declaration stays. Do not drop the physical foreign key.',
  payment_disputes: 'paymentsRelations.disputes references paymentDisputes. The declaration stays.',
}

/** Dead-module declarations a kept relation, public export, or shadow schema still names. */
const REQUIRED_DEAD_MODULE: Record<string, string> = {
  clc_webhook_log: 'clc_sync_log relations name clcWebhookLog. The declaration stays.',
  committee_memberships: 'committees relations name committeeMemberships. The declaration stays.',
  event_reminders: 'calendar_events relations name eventReminders. The declaration stays.',
  grievance_approvals: 'grievance_communications relations name grievanceApprovals. The declaration stays.',
  grievance_assignments: 'grievance_transitions relations name grievanceAssignments. The declaration stays.',
  grievance_stages: 'grievance_transitions references grievanceStages. The declaration stays. Do not drop the physical foreign key.',
  grievance_workflows: 'grievance_stages.workflowId references grievanceWorkflows. The declaration stays. Do not drop the physical foreign key.',
  member_documents: 'Member profile relations name memberDocuments, and the financial-service shadow schema still declares member_documents. The union-eyes declaration stays.',
  notification_log: 'clc_sync_log relations name notificationLog. The declaration stays.',
  organization_contacts: 'clc_sync_log relations name organizationContacts. The declaration stays.',
  organization_sharing_settings: 'cross_org_access_log relations name organizationSharingSettings. The declaration stays.',
  role_tenure_history: 'steward_assignments relations name roleTenureHistory. The declaration stays.',
  room_bookings: 'calendar_events relations name roomBookings. The financial-service shadow schema also declares room_bookings. The union-eyes declaration stays.',
  segment_executions: 'member_segments relations name segmentExecutions. The declaration stays.',
  segment_exports: 'member_segments relations name segmentExports. The declaration stays.',
  user_sessions: 'domains/member/user-management.ts re-exports userSessions, and organizationUsers relations name it. The public declaration stays.',
}

/**
 * Service readers and writers. None of these is reached from an App Router entry.
 * The declaration stays because retiring it would drop the canonical shape those
 * services still import. This is not a finished persona and it does not apply a
 * shape migration for the census column gaps.
 */
const SERVICE_RETAINED: Record<string, string> = {
  accessibility_audits: 'lib/accessibility/accessibility-service.ts inserts and updates accessibilityAudits. The domain declaration stays. No route reaches that service. The census column gap is not evolved here.',
  accessibility_issues: 'lib/accessibility/accessibility-service.ts inserts accessibilityIssues for an audit. The domain declaration stays. No route reaches that service. The census column gap is not evolved here.',
  financial_audit_log: 'lib/services/audit-trail-service.ts inserts and queries financialAuditLog. The signature AuditTrailService is a different class and does not own this table. The declaration stays. Do not invent a finance officer. The census column gap is not evolved here.',
  gss_applications: 'services/lmbp-immigration-service.ts inserts, selects, and updates gssApplications, including met2WeekTarget. lmbp-immigration-schema.ts re-exports domains/compliance/immigration.ts. The declaration stays. No route reaches that service.',
  indigenous_member_data: 'lib/services/indigenous-data-service.ts and services/indigenous-data-service.ts read and write indigenousMemberData through the domain declaration. indigenous-data-schema.ts re-exports it. OCAP columns stay. Do not invent a band-council grant. No route reaches either service.',
  member_addresses: 'services/tax-slip-service.ts selects memberAddresses by userId and addressType. The declaration stays for that mailing-address read. Tax-slip generation still has no route caller. The census column gap is not evolved here.',
}

export interface MutationAssignment {
  key: string
  file: string
  table: string
  batchId: string
  baselineCount: number
  liveCount: number
  execution: Execution
  shrink: 'mutation-baseline' | 'none'
  action: string
}

export interface BatchProgram {
  schemaVersion: 1
  mission: 'UE-CURSOR-FINAL-CLOSURE'
  applyNow: false
  note: string
  censusCount: number
  sourceMutationBaselineSum: number
  mutationBaselineSum: number
  mutationLiveSum: number
  graphComplete: boolean
  unresolvedCount: number
  unresolvedSample: string[]
  batches: Array<BatchSpec & { applyNow: boolean; entryCount: number; statementCount: number; liveStatementCount: number; sourceRetired?: boolean }>
  schema: SchemaAssignment[]
  sourceMutations: MutationAssignment[]
  mutations: MutationAssignment[]
}

const NOTE = 'Derived batch program for every remaining schema-census entry and the original mutation-scope statements. Program applyNow stays false. A mutation batch sets applyNow only when the live scan no longer counts every source statement in that batch, and the baseline file then shrinks to that scan. This file does not remove a census entry. Hold batches do not shrink either ratchet. Do not edit the mutation scanner or the route-coverage scanner to change a count. Do not regenerate a baseline except to record statements the live scan no longer counts. Finance issuance stays fail-closed. services/financial-service is not an approval path.'

const BATCHES: BatchSpec[] = [
  {
    id: 'mutation-finance-latent',
    order: 1,
    ratchet: 'mutation-scope',
    execution: 'cursor',
    shrink: 'mutation-baseline',
    action: 'Before any financial-service job is mounted, put the job tenant into the WHERE of each flagged update. dues_transactions uses eq(organizationId, tenantId) with the tenantId argument, not the id just loaded. payments and notification_queue declare tenantId; call inOrganization(row.tenantId, callerTenantId), implemented as equality on that column. The caller tenant comes from the job argument. Do not copy the tenant off the row loaded by the same id. Do not insert an unused organization identifier to satisfy the scanner. Do not issue a financial mandate. services/financial-service is not an approval path. Do not edit the mutation scanner.',
    proof: 'apps/union-eyes/lib/__tests__/mutation-scope-ratchet.test.ts and apps/union-eyes/lib/finance/__tests__/finance-canonical.test.ts',
  },
  {
    id: 'mutation-clc-sync-log',
    order: 2,
    ratchet: 'mutation-scope',
    execution: 'cursor',
    shrink: 'mutation-baseline',
    action: 'clc_sync_log is TENANT_RLS_REQUIRED and is served by the organization-scoped routes app/api/clc/sync, app/api/clc/dashboard and app/api/clc/remittances. The partnership service has no caller organization and no production, dynamic, or worker importer. It must not insert or update that table. Django ClcSyncLogViewSet still names the relation and is not changed here. Do not drop the relation. Do not edit the mutation scanner.',
    proof: 'apps/union-eyes/lib/services/external-data/__tests__/clc-partnership-service.test.ts',
  },
  {
    id: 'mutation-pilot-rebind',
    order: 3,
    ratchet: 'mutation-scope',
    execution: 'cursor',
    shrink: 'mutation-baseline',
    action: 'The rebind compares verifiedOrganizationId with the previous organization. The scanner ignores comments when it measures the distance to .where( and when it reads the predicate, so a comment cannot hide that predicate and cannot supply an organization token. Whitespace between statements still counts. The compare-and-set is unchanged.',
    proof: 'apps/union-eyes/lib/__tests__/mutation-scope-ratchet.test.ts',
  },
  {
    id: 'mutation-workbook-unclaimed',
    order: 4,
    ratchet: 'mutation-scope',
    execution: 'cursor',
    shrink: 'mutation-baseline',
    action: 'A workbook has no organization until it is claimed. The Stripe fulfilment update and the claim update require claimedByUserId to be null beside the existing credential guards. Fulfilment still requires a null payment reference and a null claim token. Claim still requires the single-use token, a null claimedAt, and an unexpired token, and writes the organization returned for the authenticated user. In-process PGlite proves one of two serialized transactions wins and the other caller organization is not stored. Native two-session proof stays READY_FOR_VS_EXECUTION. Do not invent an organization column.',
    proof: 'apps/union-eyes/db/__tests__/workbook-unclaimed-owner.pglite.test.ts',
  },
  {
    id: 'mutation-location-retention',
    order: 5,
    ratchet: 'mutation-scope',
    execution: 'cursor',
    shrink: 'mutation-baseline',
    action: 'Each retention delete names the owning userId and expiresAt. The sweep reads the expired owners, deletes that user\'s expired rows, and writes one deletion log in the same transaction. A runtime session cannot see another member\'s rows, so complete coverage still requires the system role. In-process PGlite proves both members\' expired rows go, live rows stay, and a failed log rolls the deletes back. Native combined-schema proof stays READY_FOR_VS_EXECUTION.',
    proof: 'apps/union-eyes/lib/__tests__/mutation-scope-ratchet.test.ts',
  },
  {
    id: 'schema-retire-declaration',
    order: 6,
    ratchet: 'census',
    execution: 'cursor-then-vs',
    shrink: 'census',
    action: 'Delete the Drizzle declaration and the schema-folder relations that only name it. Do not DROP the database relation. Do not hand-delete the census row. The census shrinks only when VS Code regenerates it with UE_CENSUS_WRITE=1 on a disposable database after the declaration is gone.',
    proof: 'apps/union-eyes/db/__tests__/schema-retire-declaration.test.ts',
  },
  {
    id: 'schema-retire-blocked',
    order: 7,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'The reference scan still finds a production file. Do not delete the declaration in the retire batch.',
    proof: 'apps/union-eyes/db/__tests__/schema-mutation-batches.test.ts',
  },
  {
    id: 'schema-live-unreferenced',
    order: 8,
    ratchet: 'census',
    execution: 'cursor-then-vs',
    shrink: 'census',
    action: 'The registry class is live and the reference scan finds no production file. Retire the Drizzle declaration only. Do not DROP the live relation and do not hand-delete the census row.',
    proof: 'apps/union-eyes/db/__tests__/canonical-schema-census.postgres.test.ts',
  },
  {
    id: 'schema-live-unreferenced-blocked',
    order: 9,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'A production file names this relation. Reclassify it before any retirement.',
    proof: 'apps/union-eyes/db/__tests__/schema-mutation-batches.test.ts',
  },
  {
    id: 'schema-verify-dead-module',
    order: 10,
    ratchet: 'census',
    execution: 'cursor-then-vs',
    shrink: 'census',
    action: 'No production entry reaches a file that names this relation, and no kept declaration names it. Retire the app Drizzle declaration together with dead importers and their tests. Do not delete a shadow pgTable file and do not DROP the relation. grievance_communications is not in this batch.',
    proof: 'apps/union-eyes/db/__tests__/canonical-schema-census.postgres.test.ts',
  },
  {
    id: 'schema-verify-dead-required',
    order: 10.5,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'A kept Drizzle relation, a public schema export, a compatibility re-export, or a service that still reads or writes this declaration keeps it. accessibility_audits, accessibility_issues, financial_audit_log, gss_applications, indigenous_member_data, and member_addresses stay because those services name them. The sixteen dependency holds stay because a kept relation or the public user_sessions export names them. Duplicate pgTable bodies for accessibility, indigenous data, and LMBP immigration now re-export the domain declaration. None of these six services is reached from an App Router entry, so retention is not a finished persona. Census column gaps are not evolved here. Do not retire any of these to shrink the census. Do not DROP the relation.',
    proof: 'apps/union-eyes/db/__tests__/schema-mutation-batches.test.ts',
  },
  {
    id: 'schema-verify-unproven',
    order: 11,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'The import graph has an unresolved relative or @/ import, so a dead-module classification would be unsafe. Do not retire these declarations until the graph is complete.',
    proof: 'apps/union-eyes/db/__tests__/schema-mutation-batches.test.ts',
  },
  {
    id: 'schema-django-defined',
    order: 12,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'Django still defines this relation. Do not retire the declaration and do not generate a stub-evolution migration for it.',
    proof: 'apps/union-eyes/db/__tests__/schema-mutation-batches.test.ts',
  },
  {
    id: 'schema-evolve-reachable',
    order: 13,
    ratchet: 'census',
    execution: 'prepared-evolve',
    shrink: 'census',
    action: 'Platform migration 0031_reachable_stub_shape evolves data_anonymization_log, employment_history, job_classifications, and member_leaves. Platform migrations 0039_committee_memberships_shape and 0041_room_bookings_shape evolve committee_memberships and room_bookings the same way. Additive columns and defaults only. NOT NULL only when the relation is empty. No keys, no RLS, no DROP. Revised in place before any apply: existing columns must match the expected type, and the migration refuses a change to constraint, index, policy, or grant definitions, or to row security. It is registered UNQUALIFIED. Do not apply it here. Census regeneration after apply is READY_FOR_VS_EXECUTION.',
    proof: 'apps/union-eyes/scripts/generate-stub-evolution.ts and apps/union-eyes/db/__tests__/canonical-schema-census.postgres.test.ts',
  },
  {
    id: 'schema-verify-reachable-blocked',
    order: 14,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'A production entry reaches the relation and the stub generator refuses it (enum collision, pgvector, a required column without a Django base default, or an absent table). Do not generate a tranche for it.',
    proof: 'apps/union-eyes/scripts/generate-stub-evolution.ts',
  },
  {
    id: 'schema-contained-deny-all',
    order: 15,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'No runtime authority is granted. Do not evolve the stub and do not grant the runtime role access. The census entry stays until a capability is enabled and a reviewed migration lands, or the declaration is retired under a later decision.',
    proof: 'apps/union-eyes/db/__tests__/canonical-schema-disposition.test.ts',
  },
  {
    id: 'schema-global-reference',
    order: 16,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'Global reference data. Shape and seed need an owner decision. Do not emit a tenant migration.',
    proof: 'apps/union-eyes/db/__tests__/canonical-schema-disposition.test.ts',
  },
  {
    id: 'schema-system-only',
    order: 17,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'System-only shape. Do not emit a tenant migration.',
    proof: 'apps/union-eyes/db/__tests__/canonical-schema-disposition.test.ts',
  },
  {
    id: 'schema-create-relation',
    order: 18,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'The declared relation is absent. Do not invent a CREATE. These names stay equal to tooling/db/canonical-schema/oracle-binding.json dispositionExcluded. Keys and RLS need a reviewed design.',
    proof: 'tooling/db/canonical-schema/oracle-binding.json',
  },
  {
    id: 'schema-individual-decision',
    order: 19,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'Enum-name collision, pgvector, or a missing runtime privilege. The stub generator already refuses these. Do not evolve them in a tranche.',
    proof: 'apps/union-eyes/scripts/generate-stub-evolution.ts',
  },
  {
    id: 'schema-registry-gap',
    order: 20,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'No storage-authority entry. Classify the relation before any evolution.',
    proof: 'apps/union-eyes/db/__tests__/canonical-schema-disposition.test.ts',
  },
  {
    id: 'schema-separate-database',
    order: 21,
    ratchet: 'census',
    execution: 'hold',
    shrink: 'none',
    action: 'The relation belongs to another database. Do not evolve it on this lineage.',
    proof: 'apps/union-eyes/db/__tests__/canonical-schema-disposition.test.ts',
  },
]

/** Counts at preparation. The baseline file may shrink. These counts stay. */
export const SOURCE_MUTATION_COUNTS: Record<string, number> = {
  'app/api/payments/webhooks/stripe/route.ts|workbooks': 1,
  'app/api/workbook/[id]/claim/route.ts|workbooks': 1,
  'lib/pilot/pilot-ownership.ts|pilot_applications': 1,
  'lib/services/external-data/clc-partnership-service.ts|clc_sync_log': 1,
  'services/financial-service/src/jobs/arrears-management-workflow.ts|dues_transactions': 1,
  'services/financial-service/src/jobs/payment-collection-workflow.ts|dues_transactions': 1,
  'services/financial-service/src/jobs/payment-collection-workflow.ts|payments': 3,
  'services/financial-service/src/services/notification-service.ts|notification_queue': 2,
  'services/geofence-privacy-service.ts|geofence_events': 1,
  'services/geofence-privacy-service.ts|location_tracking': 1,
}

const MUTATION_BATCH: Record<string, string> = {
  'app/api/payments/webhooks/stripe/route.ts|workbooks': 'mutation-workbook-unclaimed',
  'app/api/workbook/[id]/claim/route.ts|workbooks': 'mutation-workbook-unclaimed',
  'lib/pilot/pilot-ownership.ts|pilot_applications': 'mutation-pilot-rebind',
  'lib/services/external-data/clc-partnership-service.ts|clc_sync_log': 'mutation-clc-sync-log',
  'services/financial-service/src/jobs/arrears-management-workflow.ts|dues_transactions': 'mutation-finance-latent',
  'services/financial-service/src/jobs/payment-collection-workflow.ts|dues_transactions': 'mutation-finance-latent',
  'services/financial-service/src/jobs/payment-collection-workflow.ts|payments': 'mutation-finance-latent',
  'services/financial-service/src/services/notification-service.ts|notification_queue': 'mutation-finance-latent',
  'services/geofence-privacy-service.ts|geofence_events': 'mutation-location-retention',
  'services/geofence-privacy-service.ts|location_tracking': 'mutation-location-retention',
}

function loadCensus(): CensusEntry[] {
  return JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-census.json'), 'utf8')).entries as CensusEntry[]
}

function loadDisposition(): Record<string, DispositionEntry> {
  return JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-disposition.json'), 'utf8')).entries as Record<string, DispositionEntry>
}

function declaredByName(): Map<string, PgTable> {
  const seen = new Map<string, PgTable>()
  for (const value of Object.values(declarations as Record<string, unknown>)) {
    if (!is(value, PgTable)) continue
    const config = getTableConfig(value)
    const qualified = config.schema && config.schema !== 'public' ? `${config.schema}.${config.name}` : config.name
    if (!seen.has(qualified)) seen.set(qualified, value)
  }
  return seen
}

function enumVariants(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const value of declaredByName().values()) {
    for (const column of getTableConfig(value).columns as Array<{ getSQLType(): string; enumValues?: readonly string[]; baseColumn?: { enumValues?: readonly string[] } }>) {
      const values = column.enumValues?.length ? column.enumValues : column.baseColumn?.enumValues
      if (!values?.length) continue
      const type = column.getSQLType().replace(/\[\]$/, '')
      out.set(type, new Set([...(out.get(type) ?? []), JSON.stringify([...values])]))
    }
  }
  return out
}

function evolutionBlockers(table: string, entry: CensusEntry, declared: Map<string, PgTable>, enums: Map<string, Set<string>>): string[] {
  const blockers: string[] = []
  if (entry.defects.includes('TABLE_ABSENT')) blockers.push('table-absent')
  if (table.includes('.')) blockers.push('non-public-schema')
  const value = declared.get(table)
  if (!value) {
    blockers.push('no-declaration')
    return blockers.sort()
  }
  for (const column of getTableConfig(value).columns as Array<{ name: string; getSQLType(): string; enumValues?: readonly string[]; baseColumn?: { enumValues?: readonly string[] } }>) {
    const type = column.getSQLType()
    if (type.startsWith('vector')) blockers.push('pgvector')
    const values = column.enumValues?.length ? column.enumValues : column.baseColumn?.enumValues
    const base = type.replace(/\[\]$/, '')
    if (values?.length && (enums.get(base)?.size ?? 0) > 1) blockers.push(`enum-collision:${base}`)
  }
  for (const column of entry.requiredUndeclared) {
    if (!DJANGO_BASE_DEFAULTS.has(column)) blockers.push(`required-undeclared:${column}`)
  }
  return [...new Set(blockers)].sort()
}

function schemaBatch(entry: CensusEntry, disposition: string, index: ReachIndex, blockers: string[]): string {
  const refs = productionReferences(index, entry.table)
  const reachable = tableIsReachable(index, entry.table)
  switch (disposition) {
    case 'CONTAINED_DENY_ALL':
      return 'schema-contained-deny-all'
    case 'GLOBAL_REFERENCE_SHAPE':
      return 'schema-global-reference'
    case 'SYSTEM_ONLY_SHAPE':
      return 'schema-system-only'
    case 'SEPARATE_DATABASE':
      return 'schema-separate-database'
    case 'REGISTRY_GAP':
      return 'schema-registry-gap'
    case 'INDIVIDUAL_DECISION':
      return 'schema-individual-decision'
    case 'CREATE_RELATION_REQUIRED':
      return 'schema-create-relation'
    case 'RETIRE_DECLARATION':
      if (entry.table === 'grievance_communications') return 'schema-django-defined'
      return refs.length === 0 ? 'schema-retire-declaration' : 'schema-retire-blocked'
    case 'LIVE_UNREFERENCED':
      if (REQUIRED_DECLARATION[entry.table] || refs.length > 0) return 'schema-live-unreferenced-blocked'
      return 'schema-live-unreferenced'
    case 'VERIFY_UNREACHABLE_THEN_RETIRE':
      if (!reachable && !index.graphComplete) return 'schema-verify-unproven'
      if (!reachable) return (REQUIRED_DEAD_MODULE[entry.table] || SERVICE_RETAINED[entry.table]) ? 'schema-verify-dead-required' : 'schema-verify-dead-module'
      if (blockers.length > 0) return 'schema-verify-reachable-blocked'
      return 'schema-evolve-reachable'
    default:
      throw new Error(`no schema batch for ${entry.table} (${disposition})`)
  }
}

function mutationEntry(key: string, baselineCount: number, live: Record<string, number>, clcReachable: boolean, byId: Map<string, BatchSpec>): MutationAssignment {
  const [file, table] = [key.slice(0, key.lastIndexOf('|')), key.slice(key.lastIndexOf('|') + 1)]
  const batchId = MUTATION_BATCH[key]
  const spec = byId.get(batchId)
  if (!spec) throw new Error(`missing batch spec ${batchId}`)
  const liveCount = live[key] ?? 0
  let action = spec.action
  if (batchId === 'mutation-clc-sync-log' && liveCount > 0) {
    action = clcReachable
      ? 'A production entry reaches clc-partnership-service.ts. Add the caller organizationId to the clc_sync_log update WHERE and to the insert that creates the row.'
      : 'No production entry reaches clc-partnership-service.ts. Prove there is no dynamic import, worker, or test-only caller, then delete the uncalled update or add the caller organizationId. Unreachable alone is not enough to delete it.'
  }
  if (liveCount === 0) {
    action = 'The live scan no longer counts this statement. The caller tenant or the owning predicate is in the statement the scanner reads.'
  }
  return {
    key,
    file,
    table,
    batchId,
    baselineCount,
    liveCount,
    execution: liveCount === 0 ? 'implemented' : spec.execution,
    shrink: 'mutation-baseline',
    action,
  }
}

export function buildSchemaMutationBatches(live: Record<string, number> = scanUnscopedMutations()): BatchProgram {
  const census = loadCensus()
  const disposition = loadDisposition()
  const declared = declaredByName()
  const enums = enumVariants()
  const index = buildReachIndex(census.map((entry) => entry.table))
  const schema: SchemaAssignment[] = census.map((entry) => {
    const record = disposition[entry.table]
    if (!record) throw new Error(`census table has no disposition: ${entry.table}`)
    const blockers = evolutionBlockers(entry.table, entry, declared, enums)
    const refs = productionReferences(index, entry.table)
    const row: SchemaAssignment = {
      table: entry.table,
      batchId: schemaBatch(entry, record.disposition, index, blockers),
      disposition: record.disposition,
      registryClass: record.registryClass,
      defects: [...entry.defects],
      reachable: tableIsReachable(index, entry.table),
      djangoDefined: index.djangoTables.has(entry.table),
      blockers,
    }
    if (!declared.has(entry.table)) row.declarationRemoved = true
    const holdReason = REQUIRED_DECLARATION[entry.table]
      ?? REQUIRED_DEAD_MODULE[entry.table]
      ?? SERVICE_RETAINED[entry.table]
      ?? (record.disposition === 'LIVE_UNREFERENCED' && refs.length > 0
        ? `A production file reads this relation: ${refs.join(', ')}`
        : undefined)
    if (holdReason) row.holdReason = holdReason
    return row
  }).sort((a, b) => a.table.localeCompare(b.table))

  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).entries as Record<string, number>
  const regressions = Object.entries(live).filter(([key, count]) => (baseline[key] ?? 0) < count)
  if (regressions.length) throw new Error(`mutation scan regressed: ${regressions.map(([key]) => key).join(', ')}`)
  const unknown = Object.keys(baseline).filter((key) => !MUTATION_BATCH[key])
  if (unknown.length) throw new Error(`mutation baseline key has no batch: ${unknown.join(', ')}`)

  const byId = new Map(BATCHES.map((batch) => [batch.id, batch]))
  const clcReachable = index.reachable.has('lib/services/external-data/clc-partnership-service.ts')
  const sourceMutations = Object.entries(SOURCE_MUTATION_COUNTS).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => mutationEntry(key, count, live, clcReachable, byId))
  const mutations: MutationAssignment[] = Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b)).map(([key, baselineCount]) => mutationEntry(key, baselineCount, live, clcReachable, byId))

  const createRelation = schema.filter((entry) => entry.batchId === 'schema-create-relation').map((entry) => entry.table).sort()
  const excluded = [...(JSON.parse(readFileSync(ORACLE, 'utf8')).dispositionExcluded as string[])].sort()
  if (createRelation.join() !== excluded.join()) {
    throw new Error(`CREATE_RELATION_REQUIRED drifted from dispositionExcluded: ${createRelation.join(', ')} vs ${excluded.join(', ')}`)
  }

  const used = new Set([...schema.map((entry) => entry.batchId), ...sourceMutations.map((entry) => entry.batchId)])
  const batches = BATCHES.filter((batch) => used.has(batch.id)).map((batch) => {
    const schemaEntries = schema.filter((entry) => entry.batchId === batch.id)
    const sourceEntries = sourceMutations.filter((entry) => entry.batchId === batch.id)
    const implemented = sourceEntries.length > 0 && sourceEntries.every((entry) => entry.liveCount === 0)
    const execution: Execution = implemented ? 'implemented' : batch.execution
    const sourceRetired = (batch.id === 'schema-retire-declaration' || batch.id === 'schema-live-unreferenced')
      && schemaEntries.length > 0
      && schemaEntries.every((entry) => !declared.has(entry.table))
    const retiredAction = batch.id === 'schema-live-unreferenced'
      ? 'bank_accounts, bank_reconciliations, erp_invoices, clc_remittance_mapping, and grievance_timeline are no longer union-eyes Drizzle declarations. Django still defines those relations. packages/db exec-data.ts still declares erp_invoices for the console reader. No DROP was added. The census file still lists them. Census regeneration is READY_FOR_VS_EXECUTION. budget_pool, dues_rates, gl_account_mappings, grievance_settlements, integration_webhooks, payment_cycles, payment_disputes, and safety_training_records stay declared because a kept declaration or a production SQL reader names them. Do not hand-delete the census row. Do not DROP the relation.'
      : 'org_usage, signature_templates, and signature_webhooks_log are no longer Drizzle declarations. signature_documents.template_id stays a column without a Drizzle foreign key. Django SignatureTemplates and SignatureWebhooksLog stay, and their view sets stay. The unwired admin-actions module no longer returns a storage figure. No DROP was added. The census file still lists the three tables. Census regeneration is READY_FOR_VS_EXECUTION. Do not hand-delete the census row. Do not DROP the relation.'
    const row: BatchSpec & { applyNow: boolean; entryCount: number; statementCount: number; liveStatementCount: number; sourceRetired?: boolean } = {
      ...batch,
      action: sourceRetired ? retiredAction : batch.action,
      execution,
      applyNow: implemented,
      entryCount: schemaEntries.length + sourceEntries.length,
      statementCount: sourceEntries.reduce((sum, entry) => sum + entry.baselineCount, 0),
      liveStatementCount: sourceEntries.reduce((sum, entry) => sum + entry.liveCount, 0),
    }
    if (sourceRetired) row.sourceRetired = true
    return row
  })

  return {
    schemaVersion: 1,
    mission: 'UE-CURSOR-FINAL-CLOSURE',
    applyNow: false,
    note: NOTE,
    censusCount: census.length,
    sourceMutationBaselineSum: Object.values(SOURCE_MUTATION_COUNTS).reduce((sum, count) => sum + count, 0),
    mutationBaselineSum: Object.values(baseline).reduce((sum, count) => sum + count, 0),
    mutationLiveSum: sourceMutations.reduce((sum, entry) => sum + entry.liveCount, 0),
    graphComplete: index.graphComplete,
    unresolvedCount: index.unresolved.length,
    unresolvedSample: index.unresolved.slice(0, 30),
    batches,
    schema,
    sourceMutations,
    mutations,
  }
}
