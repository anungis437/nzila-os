/** Source-specific qualification of protected case writes on one owned database.
 * Synthetic institutional adoption below is fixture data only. Every vote,
 * acceptance and mutation uses its original production-issued canonical session.
 * No released SQL, role grants, journal seeds or caller verdicts are substituted.
 */
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import type pg from 'pg'
import postgres from 'postgres'
import { and, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'
import { claims } from '../../db/schema/claims-schema'
import { authenticatedOrgBindingSql } from '../../../../packages/platform-auth/src/org-binding'
import type { RLSTx } from '../../lib/db/with-rls-context'
import { persistAtomicAudit } from '../../lib/audit/atomic-audit'
import { activeMembershipSource } from '../../lib/authority/store/active-membership-source'
import { drizzleExecutor } from '../../lib/authority/store/route-adapter'
import {
  acceptInstrument,
  activateIssuanceRule,
  assignCase,
  draftIssuanceRule,
  issueMandate,
  requestIssuanceApproval,
  requestRuleAdoption,
} from '../../lib/authority/store/lifecycle'
import { recordApprovalDecision } from '../../lib/authority/store/mutations'
import {
  ensureCaseAuthorityScope,
  proposeCaseScope,
  applyCaseScope,
} from '../../lib/authority/store/case-scope'
import { DEFAULT_ISSUANCE_TEMPLATES, type IssuanceRuleTemplate } from '../../lib/authority/issuance'
import { AUTHORITY_PHYSICAL_GUARDS } from '../../db/auth/authority-physical-guards'
import type { SqlExecutor } from '../../lib/authority/store/executor'
import { isUuid } from '../../lib/authority/store/executor'
import type { V2Plan } from './source'
import type { RuntimeSessionFactory } from './runtime-column-fixtures'
import type { ColumnTableReport } from './runtime-column-security'
import { assertRestrictedRuntimeTransaction } from './runtime-session-proof'

export const GUARDED_CASE_RUNTIME_TABLES = [
  'claims',
  'claim_updates',
  'claim_status_transitions',
  'case_authority_scopes',
  'case_respondents',
  'case_scope_proposals',
] as const
export const GUARDED_CASE_ACTOR_CLASSES = ['MEMBER', 'ORG_ADMIN', 'PLATFORM_ADMIN'] as const
export const GUARDED_CASE_PARTIES = ['ORG_A', 'ORG_B'] as const
export const GUARDED_CASE_ACTOR_WITNESSES = [
  'LIVE_SOURCE_CLASS_VERIFIED',
  'OWN_TENANT_READ_OBSERVED',
  'FOREIGN_TENANT_READ_DENIED',
  'MISSING_USER_READ_DENIED',
  'MISSING_ORG_READ_DENIED',
  'MISSING_BEARER_READ_DENIED',
  'FOREIGN_ORG_CONTEXT_READ_DENIED',
  'RAW_PROTECTED_WRITE_DENIED_42501',
  'DENIED_WRITE_HISTORY_UNCHANGED',
] as const
type GuardedActorClass = (typeof GUARDED_CASE_ACTOR_CLASSES)[number]
type GuardedTable = (typeof GUARDED_CASE_RUNTIME_TABLES)[number]
type Row = Record<string, unknown>
export interface GuardedCaseRuntimeResult {
  reports: ColumnTableReport[]
  seedRows: Partial<Record<GuardedTable, [Row, Row]>>
  /** The live institutional parties a later source workflow continues from (complete runs only). */
  parties?: [GuardedCaseParty, GuardedCaseParty]
}
/** A party exactly as the guarded workflow left it: its people, its case and its case assignment. */
export interface GuardedCaseParty {
  party: FixtureParty
  claimRowId: string
  caseId: string
  assignmentRelationshipId: string
}
type Actor = { userId: string; organizationId: string }
export type GuardedActor = Actor
export interface FixtureParty {
  organizationId: string
  member: Actor
  officer: Actor
  handler: Actor
  executives: [Actor, Actor, Actor]
  classes: [Actor, Actor, Actor]
}
export interface GuardedCaseRuntimeInput {
  operator: pg.Client
  runtime: pg.Client
  system: pg.Client
  sessions: RuntimeSessionFactory
  plan: V2Plan
  organizationIds: readonly [string, string]
}
const deps = { memberships: activeMembershipSource }
export const exactDenied = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const value = error as { code?: unknown; cause?: unknown }
  return value.code === '42501' || exactDenied(value.cause)
}
const missingAudit = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const value = error as { message?: unknown; cause?: unknown }
  return (
    (typeof value.message === 'string' &&
      /CASE_TRANSITION_AUDIT_REQUIRED|CASE_HISTORY_AUDIT_REQUIRED/.test(value.message)) ||
    missingAudit(value.cause)
  )
}
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
export const failureSummary = (error: unknown, extraMarkers: readonly string[] = []): string => {
  if (!error || typeof error !== 'object') return 'GUARDED_CASE_UNKNOWN_FAILURE'
  const value = error as { cause?: unknown; code?: unknown; name?: unknown; message?: unknown }
  if (value.cause) return failureSummary(value.cause, extraMarkers)
  const name =
    typeof value.name === 'string' &&
    [
      'Error',
      'PostgresError',
      'DrizzleQueryError',
      'AssertionError',
      'AuthOrgBindingError',
      'AuthorityStoreError',
    ].includes(value.name)
      ? value.name
      : 'Error'
  const code =
    typeof value.code === 'string' &&
    (/^[0-9A-Z]{5}$/.test(value.code) ||
      [
        'ERR_ASSERTION',
        'DENIED',
        'INVALID_CONTEXT',
        'PRECONDITION',
        'SESSION_AUTHORITY_REQUIRED',
      ].includes(value.code))
      ? value.code
      : 'UNKNOWN'
  const message = typeof value.message === 'string' ? value.message : ''
  const marker = [
    'ACTOR_NOT_SESSION',
    'AUDIT_LINK_MISSING',
    'CASE_HISTORY_ORIGIN_REQUIRED',
    'CASE_TRANSITION_JOURNAL_IMMUTABLE',
    'CASE_TRANSITION_AUDIT_REQUIRED',
    'CASE_TRANSITION_HISTORY_REQUIRED',
    'CASE_HISTORY_AUDIT_REQUIRED',
    'EXACT_STATE_PROJECTION_REQUIRED',
    'PRIMARY_CASE_HANDLER_REQUIRED',
    'GUARDED_CASE_ASSIGNMENT_PROJECTION_REQUIRED',
    'GUARDED_CASE_CANONICAL_TRIAGE_REQUIRED',
    'GUARDED_CASE_CANONICAL_INVESTIGATION_REQUIRED',
    'NO_ADOPTED_CASE_SCOPE_AMENDMENT_RULE',
    ...extraMarkers,
  ].find((item) => message.startsWith(item))
  return `${name}:${code}${marker ? ':' + marker : ''}:sha256=${createHash('sha256').update(message).digest('hex')}`
}
const requiredCases = [
  'OWN_SOURCE_OPERATION_ROWS_VERIFIED',
  'BIDIRECTIONAL_TENANT_READ_ISOLATION',
  'MISSING_AND_FOREIGN_CONTEXT_DENIED',
  'TITLE_ONLY_INSTITUTIONAL_POWER_DENIED',
  'FAILED_MUTATION_HISTORY_UNCHANGED',
  'ORIGINAL_HISTORY_BYTES_PRESERVED',
  'SOURCE_SYSTEM_BOUNDARY_VERIFIED',
] as const
/** Every report must carry its own observed positive and refusal evidence. */
export function guardedCaseReportComplete(report: ColumnTableReport): boolean {
  if (
    !GUARDED_CASE_RUNTIME_TABLES.some((table) => table === report.table) ||
    report.status !== 'PASS' ||
    Object.hasOwn(report, 'failure') ||
    Object.hasOwn(report, 'failedProof') ||
    !report.cases.every((name) => name.startsWith(`${report.table}:`))
  )
    return false
  if (
    !requiredCases.every(
      (name) => report.cases.filter((value) => value === `${report.table}:${name}`).length === 1,
    )
  )
    return false
  const sourceRollback = ['claims', 'claim_updates', 'claim_status_transitions'].includes(
    report.table,
  )
    ? 'OWN_SOURCE_TRANSITION_AND_AUDIT_OUTBOX_ROLLBACK_VERIFIED'
    : 'OWN_APPROVED_AMENDMENT_UPDATE_AND_ROLLBACK_VERIFIED'
  if (report.cases.filter((name) => name === `${report.table}:${sourceRollback}`).length !== 2)
    return false
  const audit =
    report.table === 'claims'
      ? 'MISSING_CREATE_AUDIT_ROLLS_BACK_CLAIM_AND_TRIGGERED_JOURNAL'
      : report.table === 'claim_updates'
        ? 'MISSING_HISTORY_AUDIT_ROLLS_BACK_OWN_ROW'
        : report.table === 'claim_status_transitions'
          ? 'MISSING_CREATE_AUDIT_ROLLS_BACK_TRIGGERED_ROW'
          : null
  if (
    audit !== null &&
    report.cases.filter((name) => name === `${report.table}:${audit}`).length !== 1
  )
    return false
  const actorCases = GUARDED_CASE_ACTOR_CLASSES.flatMap((actor) =>
    GUARDED_CASE_PARTIES.flatMap((party) =>
      GUARDED_CASE_ACTOR_WITNESSES.map((witness) => `${report.table}:${actor}:${party}:${witness}`),
    ),
  )
  if (!actorCases.every((name) => report.cases.filter((value) => value === name).length === 1))
    return false
  const allowed = new Set([
    ...requiredCases.map((name) => `${report.table}:${name}`),
    `${report.table}:${sourceRollback}`,
    ...(audit ? [`${report.table}:${audit}`] : []),
    ...actorCases,
  ])
  return report.cases.every((name) => allowed.has(name))
}
export function guardedCaseFixtureDependency(
  plan: Pick<V2Plan, 'tables'>,
  name: string,
  visited: readonly string[] = [],
): boolean {
  if (GUARDED_CASE_RUNTIME_TABLES.some((table) => table === name)) return true
  if (visited.includes(name)) return false
  return (
    plan.tables
      .find((table) => table.name === name)
      ?.foreignKeys.some((fk) =>
        guardedCaseFixtureDependency(plan, fk.table, [...visited, name]),
      ) === true
  )
}
/** Foreign-key consumers receive only coherent rows actually observed above. */
export function assertGuardedCaseSeedRows(
  result: GuardedCaseRuntimeResult,
  organizations: readonly [string, string],
): void {
  for (const table of GUARDED_CASE_RUNTIME_TABLES) {
    const reports = result.reports.filter((report) => report.table === table)
    assert.equal(reports.length, 1, `UNIQUE_GUARDED_CASE_REPORT_REQUIRED:${table}`)
    assert(guardedCaseReportComplete(reports[0]), `COMPLETE_GUARDED_CASE_REPORT_REQUIRED:${table}`)
    const rows = result.seedRows[table]
    assert(rows && rows.length === 2, `GUARDED_CASE_ACTUAL_ROW_PAIR_REQUIRED:${table}`)
    assert(
      rows.every((row) => isUuid(row.id)),
      `GUARDED_CASE_CANONICAL_ROW_ID_REQUIRED:${table}`,
    )
    assert.notEqual(rows[0].id, rows[1].id, `GUARDED_CASE_DISTINCT_ROW_PAIR_REQUIRED:${table}`)
    for (const [party, row] of rows.entries()) {
      assert.match(
        String(row.ue_v2_ctid),
        /^\(\d+,\d+\)$/,
        `GUARDED_CASE_OBSERVED_ROW_LOCATION_REQUIRED:${table}`,
      )
      if (table !== 'claim_updates')
        assert.equal(
          row.organization_id,
          organizations[party],
          `GUARDED_CASE_ROW_ORGANIZATION_REQUIRED:${table}`,
        )
    }
  }
  for (const party of [0, 1]) {
    const claim = result.seedRows.claims![party],
      update = result.seedRows.claim_updates![party]
    const journal = result.seedRows.claim_status_transitions![party],
      scope = result.seedRows.case_authority_scopes![party]
    assert(isUuid(claim.claim_id), 'GUARDED_CASE_LOGICAL_ID_REQUIRED')
    assert.equal(update.claim_id, claim.id, 'GUARDED_CASE_HISTORY_PARENT_REQUIRED')
    assert.equal(journal.claim_id, claim.id, 'GUARDED_CASE_JOURNAL_PARENT_REQUIRED')
    assert.equal(update.transition_id, journal.id, 'GUARDED_CASE_HISTORY_JOURNAL_REQUIRED')
    assert.equal(update.created_by, journal.changed_by, 'GUARDED_CASE_HISTORY_ACTOR_REQUIRED')
    assert.equal(claim.status, journal.to_status, 'GUARDED_CASE_STATUS_JOURNAL_REQUIRED')
    assert.equal(scope.claim_id, claim.claim_id, 'GUARDED_CASE_SCOPE_CLAIM_REQUIRED')
    assert.equal(scope.case_id, claim.claim_id, 'GUARDED_CASE_SCOPE_LOGICAL_ID_REQUIRED')
    assert.equal(
      result.seedRows.case_respondents![party].scope_id,
      scope.id,
      'GUARDED_CASE_RESPONDENT_SCOPE_REQUIRED',
    )
    assert.equal(
      result.seedRows.case_scope_proposals![party].scope_id,
      scope.id,
      'GUARDED_CASE_PROPOSAL_SCOPE_REQUIRED',
    )
    assert.equal(
      result.seedRows.case_respondents![party].proposal_id,
      result.seedRows.case_scope_proposals![party].id,
      'GUARDED_CASE_RESPONDENT_PROPOSAL_REQUIRED',
    )
  }
}

const guardedHistoryTables = [
  ...new Set([
    ...AUTHORITY_PHYSICAL_GUARDS.tables,
    ...GUARDED_CASE_RUNTIME_TABLES,
    'audit_logs',
    'notification_queue',
    'notification_delivery_log',
  ]),
]
export type HistorySnapshot = Map<string, { ids: string[]; digest: string }>
/** Exact row bytes of every named relation (each keyed by a uuid `id`), read by the owner. */
export async function readFixtureHistory(
  operator: pg.Client,
  tables: readonly string[],
  original?: HistorySnapshot,
): Promise<HistorySnapshot> {
  const rows = (
    await operator.query<{ source_table: string; id: string; row: string }>(
      tables
        .map(
          (name, index) =>
            `SELECT '${name}'::text AS source_table,id::text AS id,to_jsonb(t)::text AS row FROM public.${quote(name)} t${original ? ` WHERE id=ANY($${index + 1}::uuid[])` : ''}`,
        )
        .join(' UNION ALL ') + ' ORDER BY source_table,id',
      original ? tables.map((name) => original.get(name)!.ids) : [],
    )
  ).rows
  const grouped = new Map(tables.map((name) => [name, [] as { id: string; row: string }[]]))
  for (const row of rows) {
    const target = grouped.get(row.source_table)
    assert(target, 'UNEXPECTED_GUARDED_HISTORY_RELATION')
    target.push({ id: row.id, row: row.row })
  }
  return new Map(
    [...grouped].map(([name, values]) => [
      name,
      {
        ids: values.map((row) => row.id),
        digest: createHash('sha256').update(JSON.stringify(values)).digest('hex'),
      },
    ]),
  )
}
export async function assertFixtureHistory(
  operator: pg.Client,
  tables: readonly string[],
  before: HistorySnapshot,
  label: string,
  originalOnly = false,
) {
  const after = await readFixtureHistory(operator, tables, originalOnly ? before : undefined)
  for (const [name, expected] of before)
    assert.equal(after.get(name)?.digest, expected.digest, `${label}:${name}`)
}
const history = (operator: pg.Client) => readFixtureHistory(operator, guardedHistoryTables)
const assertHistory = (operator: pg.Client, before: HistorySnapshot, originalOnly = false) =>
  assertFixtureHistory(
    operator,
    guardedHistoryTables,
    before,
    'GUARDED_CASE_HISTORY_CHANGED',
    originalOnly,
  )

/** One canonical active login and membership, written by the owner exactly as prepareParty does. */
export async function createGuardedActor(
  operator: pg.Client,
  organizationId: string,
  role: string,
  systemAdmin = false,
): Promise<Actor> {
  const userId = randomUUID()
  await operator.query(
    "INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state,is_system_admin,email_verified) VALUES($1,$2,true,'active',$3,true)",
    [userId, `guarded-${userId}@example.invalid`, systemAdmin],
  )
  await operator.query(
    'INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,$3,true)',
    [userId, organizationId, role],
  )
  return { userId, organizationId }
}

async function prepareParty(operator: pg.Client, organizationId: string): Promise<FixtureParty> {
  const roles = [
    'member',
    'officer',
    'steward',
    'president',
    'vice_president',
    'secretary_treasurer',
    'member',
    'admin',
    'member',
  ]
  const actors: Actor[] = []
  for (const [index, role] of roles.entries())
    actors.push(await createGuardedActor(operator, organizationId, role, index === 8))
  return {
    organizationId,
    member: actors[0],
    officer: actors[1],
    handler: actors[2],
    executives: [actors[3], actors[4], actors[5]],
    classes: [actors[6], actors[7], actors[8]],
  }
}

export type GuardedWithin = <T>(
  actor: Actor,
  operation: (tx: RLSTx, exec: SqlExecutor) => Promise<T>,
  options?: {
    rollback?: boolean
    missing?: 'user' | 'org' | 'bearer'
    foreignOrg?: string
    actorClass?: GuardedActorClass
  },
) => Promise<T>
/**
 * The owned loopback database, a genuinely restricted runtime LOGIN and a production-issued
 * canonical session for every actor transaction. Shared by every source-workflow fixture.
 */
export function openGuardedSessionHarness(
  input: Pick<GuardedCaseRuntimeInput, 'operator' | 'runtime' | 'system' | 'sessions'>,
): { databaseName: string; within: GuardedWithin; end: () => Promise<void> } {
  const databaseName = input.operator.database
  assert.ok(typeof databaseName === 'string', 'GUARDED_CASE_DATABASE_REQUIRED')
  assert.match(databaseName, /^ue_[a-zA-Z0-9_]+$/)
  for (const client of [input.operator, input.runtime, input.system]) {
    assert.ok(
      ['localhost', '127.0.0.1', '::1'].includes(client.host),
      'GUARDED_CASE_LOOPBACK_REQUIRED',
    )
    assert.equal(client.host, input.operator.host, 'GUARDED_CASE_SAME_HOST_REQUIRED')
    assert.equal(client.port, input.operator.port, 'GUARDED_CASE_SAME_SERVER_REQUIRED')
    assert.equal(client.database, input.operator.database, 'GUARDED_CASE_SAME_DATABASE_REQUIRED')
  }
  assert.equal(
    input.runtime.database,
    input.operator.database,
    'GUARDED_CASE_SAME_DATABASE_REQUIRED',
  )
  assert.equal(input.runtime.port, input.operator.port, 'GUARDED_CASE_SAME_SERVER_REQUIRED')
  assert.notEqual(input.runtime.user, input.operator.user, 'GUARDED_CASE_RESTRICTED_LOGIN_REQUIRED')
  const connection = postgres({
    host: input.runtime.host,
    port: input.runtime.port,
    database: input.runtime.database,
    username: input.runtime.user,
    password: input.runtime.password,
    max: 1,
    prepare: false,
    onnotice: () => {},
  })
  const database = drizzle(connection, { schema })
  const within: GuardedWithin = (actor, operation, options = {}) =>
    input.sessions
      .withActor(
        actor.userId,
        actor.organizationId,
      )((binding) =>
        database.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL search_path = pg_catalog, public, pg_temp`)
          await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`)
          await tx.execute(authenticatedOrgBindingSql(binding))
          const exec = drizzleExecutor(tx)
          await assertRestrictedRuntimeTransaction(exec, 'union_eyes_runtime', databaseName)
          const live = (
            await exec.query<{ actor: string; org: string; live: boolean; login: string }>(
              "SELECT current_setting('app.current_user_id') AS actor,current_setting('app.current_org_id') AS org,user_management.auth_business_org_authorized($1::uuid,NULL::text[]) AS live,session_user AS login",
              [actor.organizationId],
            )
          ).rows[0]
          assert.equal(live.actor, actor.userId)
          assert.equal(live.org, actor.organizationId)
          assert.equal(live.live, true)
          assert.equal(live.login, input.runtime.user)
          if (options.actorClass) {
            assert.equal(binding.role, options.actorClass === 'ORG_ADMIN' ? 'admin' : 'member')
            assert.equal(binding.isSystemAdmin, options.actorClass === 'PLATFORM_ADMIN')
          }
          if (options.missing)
            await exec.query("SELECT set_config($1,'',true)", [
              {
                user: 'app.current_user_id',
                org: 'app.current_org_id',
                bearer: 'app.current_session_token',
              }[options.missing],
            ])
          if (options.foreignOrg)
            await exec.query("SELECT set_config('app.current_org_id',$1,true)", [
              options.foreignOrg,
            ])
          const { withCanonicalTenantScope } =
            await import('../../lib/db/canonical-transaction-scope')
          const value = await withCanonicalTenantScope(tx, binding, () => operation(tx, exec))
          await tx.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`)
          if (options.rollback) throw new GuardedRollback(value)
          return value
        }),
      )
      .catch((error) => {
        if (options.rollback && error instanceof GuardedRollback) return error.value as never
        throw error
      })
  return { databaseName, within, end: () => connection.end({ timeout: 5 }) }
}

/** Independent approvers vote in their own canonical sessions; the decision ids are returned. */
export async function voteGuardedApproval(
  within: GuardedWithin,
  party: FixtureParty,
  request: string,
  approvers: readonly Actor[] = party.executives.slice(1),
): Promise<string[]> {
  const decisions: string[] = []
  for (const approver of approvers)
    decisions.push(
      (
        await within(approver, (_tx, exec) =>
          recordApprovalDecision(exec, deps, {
            organizationId: party.organizationId,
            approvalRequestId: request,
            approverUserId: approver.userId,
            decision: 'approved',
          }),
        )
      ).decisionId,
    )
  return decisions
}

/** The real adoption ceremony: draft, request, two independent votes, then a separate activation. */
export async function adoptGuardedIssuanceRule(
  within: GuardedWithin,
  party: FixtureParty,
  template: Omit<IssuanceRuleTemplate, 'rationale'>,
): Promise<{ ruleId: string; approvalRequestId: string; decisionIds: string[] }> {
  const drafter = party.executives[0]
  const id = await within(drafter, (_tx, exec) =>
    draftIssuanceRule(exec, deps, {
      ...template,
      organizationId: party.organizationId,
      draftedBy: drafter.userId,
    }),
  )
  const request = await within(drafter, (_tx, exec) =>
    requestRuleAdoption(exec, deps, {
      organizationId: party.organizationId,
      ruleId: id,
      actorUserId: drafter.userId,
      sourceInstrument: `Disposable qualification only; source protocol ${id}`,
      namedApproverIds: party.executives.slice(1).map((actor) => actor.userId),
    }),
  )
  const decisionIds = await voteGuardedApproval(within, party, request)
  await within(party.executives[1], (_tx, exec) =>
    activateIssuanceRule(exec, deps, {
      organizationId: party.organizationId,
      ruleId: id,
      actorUserId: party.executives[1].userId,
      approvalRequestId: request,
    }),
  )
  return { ruleId: id, approvalRequestId: request, decisionIds }
}

/**
 * Case status transitions queue a sealed member notification in the same transaction, so the
 * disposable run needs a correspondence signing key. A synthetic key is scoped to this run and
 * the caller's value is restored afterwards (same pattern as member-letter-delivery.native).
 */
const SYNTHETIC_CORRESPONDENCE_KEY = 'synthetic-native-guarded-case-correspondence-key-0001'
export async function qualifyGuardedCaseRuntimeSecurity(
  input: GuardedCaseRuntimeInput,
): Promise<GuardedCaseRuntimeResult> {
  const priorKey = process.env.EVIDENCE_SEAL_KEY
  process.env.EVIDENCE_SEAL_KEY = SYNTHETIC_CORRESPONDENCE_KEY
  try {
    return await qualifyGuardedCaseRuntimeSecurityWithKey(input)
  } finally {
    if (priorKey === undefined) delete process.env.EVIDENCE_SEAL_KEY
    else process.env.EVIDENCE_SEAL_KEY = priorKey
  }
}
async function qualifyGuardedCaseRuntimeSecurityWithKey(
  input: GuardedCaseRuntimeInput,
): Promise<GuardedCaseRuntimeResult> {
  assert(input.plan.authExecution, 'GUARDED_CASE_CANONICAL_AUTH_REQUIRED')
  assert.equal(new Set(input.organizationIds).size, 2, 'GUARDED_CASE_TWO_ORGANIZATIONS_REQUIRED')
  const harness = openGuardedSessionHarness(input)
  const within = harness.within
  const cases = new Map<GuardedTable, string[]>(
    GUARDED_CASE_RUNTIME_TABLES.map((table) => [table, []]),
  )
  const observed = new Map<GuardedTable, [string[], string[]]>(
    GUARDED_CASE_RUNTIME_TABLES.map((table) => [table, [[], []]]),
  )
  try {
    for (const table of GUARDED_CASE_RUNTIME_TABLES) {
      const source = input.plan.tables.find((entry) => entry.name === table)
      assert.equal(
        source?.source,
        'apps/union-eyes/backend/grievances/models.py',
        `GUARDED_CASE_SOURCE_REQUIRED:${table}`,
      )
      assert.equal(source.authority?.classification, 'TENANT_RLS_REQUIRED')
    }
    const original = await history(input.operator)
    const parties: FixtureParty[] = []
    for (const org of input.organizationIds) parties.push(await prepareParty(input.operator, org))
    const mark = (table: GuardedTable, name: (typeof requiredCases)[number]) => {
      const key = `${table}:${name}`
      assert(!cases.get(table)!.includes(key), `DUPLICATE_GUARDED_CASE_OBSERVATION:${key}`)
      cases.get(table)!.push(key)
    }
    const createClaim = async (actor: Actor, audited = true) =>
      within(actor, async (tx) => {
        const { requireCaseFilingCapacity } = await import('../../lib/cases/case-authorization')
        await requireCaseFilingCapacity(tx, actor, 'member')
        const [row] = await tx
          .insert(claims)
          .values({
            id: randomUUID(),
            claimId: randomUUID(),
            organizationId: actor.organizationId,
            memberId: actor.userId,
            claimNumber: `GUARDED-${randomUUID()}`,
            claimType: 'other',
            status: 'submitted',
            priority: 'medium',
            description: 'Disposable guarded runtime qualification case',
          })
          .returning()
        assert(row, 'GUARDED_CASE_CREATION_ROW_REQUIRED')
        if (audited)
          await persistAtomicAudit(tx, {
            organizationId: actor.organizationId,
            userId: actor.userId,
            action: 'claim.create',
            resourceType: 'claims',
            resourceId: row.claimId,
            details: { qualification: 'disposable guarded case fixture' },
          })
        return row
      })
    const transitionCase: typeof import('../../lib/workflow-engine').updateClaimStatusById = async (
      ...args
    ) => {
      const { updateClaimStatusById } = await import('../../lib/workflow-engine')
      return updateClaimStatusById(...args)
    }
    const vote = (party: FixtureParty, request: string, approvers = party.executives.slice(1)) =>
      voteGuardedApproval(within, party, request, approvers)
    const adopt = async (party: FixtureParty, template: Omit<IssuanceRuleTemplate, 'rationale'>) =>
      (await adoptGuardedIssuanceRule(within, party, template)).ruleId
    const created: Array<{
      party: FixtureParty
      claim: typeof claims.$inferSelect
      scopeId: string
      ruleId: string
      proposalId: string
      approvalId: string
      assignmentRelationshipId: string
    }> = []
    for (const [index, party] of parties.entries()) {
      const claim = await createClaim(party.member)
      observed.get('claims')![index] = [claim.id]
      const scope = await within(party.member, (_tx, exec) =>
        ensureCaseAuthorityScope(exec, deps, {
          organizationId: party.organizationId,
          actorUserId: party.member.userId,
          caseId: claim.claimId,
        }),
      )
      assert.equal(typeof scope.id, 'string')
      observed.get('case_authority_scopes')![index] = [String(scope.id)]
      for (const [domain, operation] of [
        ['supervisory', 'issue'],
        ['case_assignment', 'issue'],
      ] as const) {
        const template = DEFAULT_ISSUANCE_TEMPLATES.find(
          (entry) => entry.domain === domain && entry.operation === operation,
        )
        assert(template, 'GUARDED_CASE_EXISTING_ISSUANCE_TEMPLATE_REQUIRED')
        const { rationale: _rationale, ...source } = template
        await adopt(party, source)
      }
      const ruleId = await adopt(party, {
        domain: 'case_assignment',
        operation: 'amend',
        issuerCapacities: ['officer'],
        allowedPowers: ['scope'],
        maxTermDays: 365,
        requiresAcceptance: false,
        requiredIndependentApprovals: 0,
      })
      const mandateId = randomUUID()
      const mandate = {
        id: mandateId,
        instrumentId: mandateId,
        organizationId: party.organizationId,
        issuerUserId: party.executives[0].userId,
        holderUserId: party.officer.userId,
        kind: 'supervisory' as const,
        powers: ['read', 'assign'],
        scope: { resourceIds: [claim.claimId] },
        sourceInstrument: `Disposable scope qualification only ${mandateId}`,
        effectiveAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 86_400_000),
      }
      const request = await within(party.executives[0], (_tx, exec) =>
        requestIssuanceApproval(exec, deps, {
          ...mandate,
          namedApproverIds: [party.executives[1].userId],
        }),
      )
      await vote(party, request, [party.executives[1]])
      await within(party.executives[0], (_tx, exec) =>
        issueMandate(exec, deps, { ...mandate, approvalRequestId: request }),
      )
      await within(party.officer, (_tx, exec) =>
        acceptInstrument(exec, {
          organizationId: party.organizationId,
          instrumentType: 'mandate',
          instrumentId: mandateId,
          holderUserId: party.officer.userId,
        }),
      )
      const assignmentRelationshipId = await within(party.officer, async (tx, exec) => {
        const relationshipId = await assignCase(exec, deps, {
          organizationId: party.organizationId,
          issuerUserId: party.officer.userId,
          caseId: claim.claimId,
          assigneeUserId: party.handler.userId,
          effectiveAt: new Date(Date.now() - 60_000),
        })
        // The live claims assignment handler couples the governed relationship and its workflow projection in one transaction.
        const [projected] = await tx.update(claims)
          .set({ assignedTo: party.handler.userId, assignedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(claims.claimId, claim.claimId), eq(claims.organizationId, party.organizationId)))
          .returning({ assignedTo: claims.assignedTo })
        assert.equal(projected?.assignedTo, party.handler.userId, 'GUARDED_CASE_ASSIGNMENT_PROJECTION_REQUIRED')
        return relationshipId
      })
      const transition = await within(party.handler, (tx) =>
        transitionCase(
          claim.claimId,
          // Exercise the legacy assignment alias; the source workflow must persist canonical triage (under_review).
          // Triage -> investigation has no elapsed-time minimum and still requires a real assignment.
          'assigned',
          party.handler.userId,
          'Disposable source workflow qualification',
          tx,
        ),
      )
      assert.equal(transition.success, true, transition.error)
      assert.equal(transition.claim?.status, 'under_review', 'GUARDED_CASE_CANONICAL_TRIAGE_REQUIRED')
      const proposal = await within(party.officer, (_tx, exec) =>
        proposeCaseScope(exec, deps, {
          organizationId: party.organizationId,
          actorUserId: party.officer.userId,
          caseId: claim.claimId,
          expectedRevision: 0,
          unitId: null,
          territoryId: null,
          respondentUserIds: [party.classes[0].userId],
          namedApproverIds: party.executives.slice(1).map((actor) => actor.userId),
        }),
      )
      await vote(party, proposal.approvalRequestId)
      await within(party.officer, (_tx, exec) =>
        applyCaseScope(exec, deps, {
          organizationId: party.organizationId,
          actorUserId: party.officer.userId,
          caseId: claim.claimId,
          proposalId: proposal.proposalId,
        }),
      )
      created.push({
        party,
        claim,
        scopeId: String(scope.id),
        ruleId,
        proposalId: proposal.proposalId,
        approvalId: proposal.approvalRequestId,
        assignmentRelationshipId,
      })
      for (const table of [
        'case_scope_proposals',
        'case_respondents',
        'claim_updates',
        'claim_status_transitions',
      ] as const) {
        const where =
          table === 'case_scope_proposals'
            ? 'id=$1'
            : table === 'case_respondents'
              ? 'scope_id=$1'
              : 'claim_id=$1'
        const key =
          table === 'case_scope_proposals'
            ? proposal.proposalId
            : table === 'case_respondents'
              ? scope.id
              : claim.id
        const rows = await within(party.member, (_tx, exec) =>
          exec.query<{ id: string }>(
            `SELECT id::text AS id FROM public.${quote(table)} WHERE ${where}`,
            [key],
          ),
        )
        assert(rows.rows.length > 0, `OWN_GUARDED_POSITIVE_ROWS_REQUIRED:${table}`)
        observed.get(table)![index] = rows.rows.map((row) => row.id)
      }
    }
    for (const { party, claim, scopeId } of created) {
      // Each of the three affected rows is actually observed during the source
      // transition, then the complete history/audit/outbox change is rolled back.
      const transitionBefore = await history(input.operator)
      const rolled = await within(
        party.handler,
        async (tx, exec) => {
          const change = await transitionCase(
            claim.claimId,
            'investigation',
            party.handler.userId,
            'Disposable rollback qualification',
            tx,
          )
          assert.equal(change.success, true, `GUARDED_CASE_CANONICAL_INVESTIGATION_REQUIRED:${change.error ?? 'unknown'}`)
          assert.equal(change.claim?.status, 'investigation')
          const journal = (
            await exec.query<{ id: string }>(
              `SELECT id::text FROM public.claim_status_transitions
          WHERE claim_id=$1 AND from_status='under_review' AND to_status='investigation' AND transaction_id=txid_current()`,
              [claim.id],
            )
          ).rows
          assert.equal(journal.length, 1, 'GUARDED_TRANSITION_OWN_JOURNAL_REQUIRED')
          const updates = (
            await exec.query<{ id: string }>(
              `SELECT id::text FROM public.claim_updates
          WHERE claim_id=$1 AND transition_id=$2 AND created_by=$3`,
              [claim.id, journal[0].id, party.handler.userId],
            )
          ).rows
          assert.equal(updates.length, 1, 'GUARDED_TRANSITION_OWN_HISTORY_REQUIRED')
          return {
            claims: change.claim.id,
            claim_status_transitions: journal[0].id,
            claim_updates: updates[0].id,
          }
        },
        { rollback: true },
      )
      for (const table of ['claims', 'claim_updates', 'claim_status_transitions'] as const) {
        assert.equal(typeof rolled[table], 'string')
        cases.get(table)!.push(`${table}:OWN_SOURCE_TRANSITION_AND_AUDIT_OUTBOX_ROLLBACK_VERIFIED`)
      }
      await assertHistory(input.operator, transitionBefore)
      const revocation = await within(party.officer, (_tx, exec) =>
        proposeCaseScope(exec, deps, {
          organizationId: party.organizationId,
          actorUserId: party.officer.userId,
          caseId: claim.claimId,
          expectedRevision: 1,
          unitId: null,
          territoryId: null,
          respondentUserIds: [],
          namedApproverIds: party.executives.slice(1).map((actor) => actor.userId),
        }),
      )
      await vote(party, revocation.approvalRequestId)
      const scopeBefore = await history(input.operator)
      const applyAndRead = async (_tx: RLSTx, exec: SqlExecutor) => {
        await applyCaseScope(exec, deps, {
          organizationId: party.organizationId,
          actorUserId: party.officer.userId,
          caseId: claim.claimId,
          proposalId: revocation.proposalId,
        })
        assert.equal(
          (
            await exec.query<{ revision: number }>(
              'SELECT revision FROM public.case_authority_scopes WHERE id=$1',
              [scopeId],
            )
          ).rows[0].revision,
          2,
        )
        const proposal = (
          await exec.query<Row>(
            'SELECT applied_by,applied_at FROM public.case_scope_proposals WHERE id=$1',
            [revocation.proposalId],
          )
        ).rows[0]
        assert.equal(proposal.applied_by, party.officer.userId)
        assert(proposal.applied_at)
        const respondent = (
          await exec.query<Row>(
            'SELECT revoked_by,revoked_at,revoked_proposal_id FROM public.case_respondents WHERE scope_id=$1',
            [scopeId],
          )
        ).rows
        assert.equal(respondent.length, 1)
        assert.equal(respondent[0].revoked_by, party.officer.userId)
        assert(respondent[0].revoked_at)
        assert.equal(respondent[0].revoked_proposal_id, revocation.proposalId)
      }
      await within(party.officer, applyAndRead, { rollback: true })
      await assertHistory(input.operator, scopeBefore)
      // Successful, approved revocation is a distinct UPDATE positive for each
      // table, following the independently verified rollback of that same path.
      await within(party.officer, applyAndRead)
      for (const table of [
        'case_authority_scopes',
        'case_respondents',
        'case_scope_proposals',
      ] as const)
        cases.get(table)!.push(`${table}:OWN_APPROVED_AMENDMENT_UPDATE_AND_ROLLBACK_VERIFIED`)
    }
    for (const table of GUARDED_CASE_RUNTIME_TABLES) {
      assert(
        observed.get(table)!.every((ids) => ids.length > 0),
        `BOTH_GUARDED_POSITIVE_ROWS_REQUIRED:${table}`,
      )
      mark(table, 'OWN_SOURCE_OPERATION_ROWS_VERIFIED')
      for (const [index, { party }] of created.entries()) {
        const expected = observed.get(table)![index],
          foreign = observed.get(table)![1 - index]
        await within(party.member, async (_tx, exec) => {
          const visible = (
            await exec.query<{ id: string }>(
              `SELECT id::text AS id FROM public.${quote(table)} WHERE id=ANY($1::uuid[])`,
              [[...expected, ...foreign]],
            )
          ).rows.map((row) => row.id)
          assert(
            expected.every((id) => visible.includes(id)),
            `GUARDED_OWN_ROWS_NOT_VISIBLE:${table}`,
          )
          assert(
            foreign.every((id) => !visible.includes(id)),
            `GUARDED_FOREIGN_ROWS_VISIBLE:${table}`,
          )
        })
        for (const options of [
          { missing: 'bearer' as const },
          { foreignOrg: created[1 - index].party.organizationId },
        ])
          await within(
            party.member,
            async (_tx, exec) => {
              assert.equal(
                (
                  await exec.query(
                    `SELECT id FROM public.${quote(table)} WHERE id=ANY($1::uuid[])`,
                    [expected],
                  )
                ).rows.length,
                0,
                `GUARDED_INVALID_CONTEXT_VISIBLE:${table}`,
              )
            },
            options,
          )
      }
      mark(table, 'BIDIRECTIONAL_TENANT_READ_ISOLATION')
      mark(table, 'MISSING_AND_FOREIGN_CONTEXT_DENIED')
    }
    // Independent lower-capacity sessions exercise actual protected SQL, not
    // an invented positive justified by member/admin/platform titles.
    for (const table of GUARDED_CASE_RUNTIME_TABLES) {
      for (const [partyIndex, fixture] of created.entries()) {
        const { party, claim, scopeId } = fixture
        const expected = observed.get(table)![partyIndex]
        const foreign = observed.get(table)![1 - partyIndex]
        const ids = [...expected, ...foreign]
        const partyName = GUARDED_CASE_PARTIES[partyIndex]
        assert(partyName, 'GUARDED_CLASS_PARTY_REQUIRED')
        for (const [classIndex, actor] of party.classes.entries()) {
          const actorClass = GUARDED_CASE_ACTOR_CLASSES[classIndex]
          assert(actorClass, 'GUARDED_ACTOR_CLASS_REQUIRED')
          const classMark = (witness: (typeof GUARDED_CASE_ACTOR_WITNESSES)[number]) => {
            const key = `${table}:${actorClass}:${partyName}:${witness}`
            assert(!cases.get(table)!.includes(key), `DUPLICATE_GUARDED_CLASS_OBSERVATION:${key}`)
            cases.get(table)!.push(key)
          }
          const before = await history(input.operator)
          await within(
            actor,
            async (_tx, exec) => {
              const visible = (
                await exec.query<{ id: string }>(
                  `SELECT id::text AS id FROM public.${quote(table)} WHERE id=ANY($1::uuid[])`,
                  [ids],
                )
              ).rows.map((row) => row.id)
              assert(
                expected.every((id) => visible.includes(id)),
                `GUARDED_CLASS_OWN_ROWS_NOT_VISIBLE:${table}`,
              )
              assert(
                foreign.every((id) => !visible.includes(id)),
                `GUARDED_CLASS_FOREIGN_ROWS_VISIBLE:${table}`,
              )
            },
            { actorClass },
          )
          await assertHistory(input.operator, before)
          classMark('LIVE_SOURCE_CLASS_VERIFIED')
          classMark('OWN_TENANT_READ_OBSERVED')
          classMark('FOREIGN_TENANT_READ_DENIED')
          for (const [missing, witness] of [
            ['user', 'MISSING_USER_READ_DENIED'],
            ['org', 'MISSING_ORG_READ_DENIED'],
            ['bearer', 'MISSING_BEARER_READ_DENIED'],
          ] as const) {
            await within(
              actor,
              async (_tx, exec) => {
                assert.equal(
                  (
                    await exec.query(
                      `SELECT id FROM public.${quote(table)} WHERE id=ANY($1::uuid[])`,
                      [ids],
                    )
                  ).rows.length,
                  0,
                  `GUARDED_CLASS_MISSING_CONTEXT_VISIBLE:${table}:${missing}`,
                )
              },
              { actorClass, missing },
            )
            await assertHistory(input.operator, before)
            classMark(witness)
          }
          await within(
            actor,
            async (_tx, exec) => {
              assert.equal(
                (
                  await exec.query(
                    `SELECT id FROM public.${quote(table)} WHERE id=ANY($1::uuid[])`,
                    [ids],
                  )
                ).rows.length,
                0,
                `GUARDED_CLASS_FOREIGN_CONTEXT_VISIBLE:${table}`,
              )
            },
            { actorClass, foreignOrg: created[1 - partyIndex].party.organizationId },
          )
          await assertHistory(input.operator, before)
          classMark('FOREIGN_ORG_CONTEXT_READ_DENIED')
          await assert.rejects(
            within(
              actor,
              async (tx, exec) => {
                if (table === 'claims')
                  return exec.query("UPDATE public.claims SET status='investigation' WHERE id=$1", [
                    claim.id,
                  ])
                if (table === 'claim_updates')
                  return tx.insert(schema.claimUpdates).values({
                    claimId: claim.id,
                    updateType: 'status_change',
                    message: 'forged status history',
                    createdBy: actor.userId,
                    isInternal: false,
                    visibilityScope: 'member',
                    metadata: {},
                  })
                if (table === 'claim_status_transitions')
                  return exec.query(
                    "INSERT INTO public.claim_status_transitions(id,organization_id,claim_id,to_status,changed_by) VALUES($1,$2,$3,'investigation',$4)",
                    [randomUUID(), party.organizationId, claim.id, actor.userId],
                  )
                if (table === 'case_authority_scopes')
                  return exec.query(
                    'UPDATE public.case_authority_scopes SET revision=revision+1 WHERE id=$1',
                    [scopeId],
                  )
                if (table === 'case_respondents')
                  return exec.query(
                    'UPDATE public.case_respondents SET recorded_by=$1 WHERE scope_id=$2',
                    [actor.userId, scopeId],
                  )
                return exec.query(
                  'UPDATE public.case_scope_proposals SET proposed_by=$1 WHERE id=$2',
                  [actor.userId, fixture.proposalId],
                )
              },
              { actorClass },
            ),
            exactDenied,
            `RAW_GUARDED_POWER_MUST_DENY_42501:${table}`,
          )
          await assertHistory(input.operator, before)
          classMark('RAW_PROTECTED_WRITE_DENIED_42501')
          classMark('DENIED_WRITE_HISTORY_UNCHANGED')
        }
      }
      mark(table, 'TITLE_ONLY_INSTITUTIONAL_POWER_DENIED')
      mark(table, 'FAILED_MUTATION_HISTORY_UNCHANGED')
    }
    const auditBefore = await history(input.operator)
    await assert.rejects(createClaim(created[0].party.member, false), missingAudit)
    await assertHistory(input.operator, auditBefore)
    cases.get('claims')!.push('claims:MISSING_CREATE_AUDIT_ROLLS_BACK_CLAIM_AND_TRIGGERED_JOURNAL')
    cases
      .get('claim_status_transitions')!
      .push('claim_status_transitions:MISSING_CREATE_AUDIT_ROLLS_BACK_TRIGGERED_ROW')
    const historyAuditBefore = await history(input.operator)
    await assert.rejects(
      within(created[0].party.member, (tx) =>
        tx.insert(schema.claimUpdates).values({
          claimId: created[0].claim.id,
          updateType: 'comment',
          message: 'Disposable missing-audit rollback',
          createdBy: created[0].party.member.userId,
          isInternal: false,
          visibilityScope: 'member',
          metadata: {},
        }),
      ),
      missingAudit,
    )
    await assertHistory(input.operator, historyAuditBefore)
    cases.get('claim_updates')!.push('claim_updates:MISSING_HISTORY_AUDIT_ROLLS_BACK_OWN_ROW')
    for (const table of ['claim_updates', 'claim_status_transitions'] as const)
      await assert.rejects(
        within(created[0].party.handler, (_tx, exec) =>
          exec.query(`UPDATE public.${quote(table)} SET id=id WHERE id=$1`, [
            observed.get(table)![0][0],
          ]),
        ),
        exactDenied,
      )
    await assert.rejects(
      within(created[0].party.member, (_tx, exec) =>
        exec.query('DELETE FROM public.claims WHERE id=$1', [created[0].claim.id]),
      ),
      exactDenied,
    )
    await assertHistory(input.operator, original, true)
    for (const table of GUARDED_CASE_RUNTIME_TABLES) mark(table, 'ORIGINAL_HISTORY_BYTES_PRESERVED')
    // SYSTEM is the actual separate restricted LOGIN, never an end-user bearer.
    for (const table of GUARDED_CASE_RUNTIME_TABLES) {
      await input.system.query('BEGIN')
      try {
        await input.system.query('SET LOCAL search_path = pg_catalog, public, pg_temp')
        await input.system.query('SET LOCAL ROLE union_eyes_system')
        await assertRestrictedRuntimeTransaction(
          input.system,
          'union_eyes_system',
          harness.databaseName,
        )
        const allowed = ['claims', 'claim_updates', 'claim_status_transitions'].includes(table)
        const operation = () =>
          input.system.query(
            `SELECT id::text FROM public.${quote(table)} WHERE id=ANY($1::uuid[])`,
            [observed.get(table)!.flat()],
          )
        if (allowed)
          assert.equal((await operation()).rows.length, observed.get(table)!.flat().length)
        else await assert.rejects(operation(), exactDenied)
      } finally {
        await input.system.query('ROLLBACK')
      }
      mark(table, 'SOURCE_SYSTEM_BOUNDARY_VERIFIED')
    }
    const seedRows: GuardedCaseRuntimeResult['seedRows'] = {}
    for (const table of GUARDED_CASE_RUNTIME_TABLES) {
      const pair: Row[] = []
      for (const [index, { party, claim }] of created.entries()) {
        const id =
          table === 'claim_status_transitions'
            ? (
                await within(party.member, (_tx, exec) =>
                  exec.query<{ id: string }>(
                    "SELECT id::text AS id FROM public.claim_status_transitions WHERE claim_id=$1 AND from_status='submitted' AND to_status='under_review'",
                    [claim.id],
                  ),
                )
              ).rows[0]?.id
            : observed.get(table)![index][0]
        assert(id, `SOURCE_GUARDED_PARENT_ID_REQUIRED:${table}`)
        const rows = await within(party.member, (_tx, exec) =>
          exec.query<Row>(
            `SELECT *,ctid::text AS ue_v2_ctid FROM public.${quote(table)} WHERE id=$1`,
            [id],
          ),
        )
        assert.equal(rows.rows.length, 1, `SOURCE_GUARDED_PARENT_ROW_REQUIRED:${table}`)
        pair.push(rows.rows[0])
      }
      seedRows[table] = [pair[0], pair[1]]
    }
    const reports = GUARDED_CASE_RUNTIME_TABLES.map((table) => {
      const report: ColumnTableReport = { table, status: 'PASS', cases: cases.get(table)! }
      assert(guardedCaseReportComplete(report), `INCOMPLETE_GUARDED_CASE_REPORT:${table}`)
      return report
    })
    const [first, second] = created.map((entry): GuardedCaseParty => ({
      party: entry.party,
      claimRowId: entry.claim.id,
      caseId: entry.claim.claimId,
      assignmentRelationshipId: entry.assignmentRelationshipId,
    }))
    assert(first && second && created.length === 2, 'GUARDED_CASE_TWO_PARTIES_REQUIRED')
    const result: GuardedCaseRuntimeResult = { reports, seedRows, parties: [first, second] }
    assertGuardedCaseSeedRows(result, input.organizationIds)
    return result
  } catch (error) {
    return {
      reports: GUARDED_CASE_RUNTIME_TABLES.map((table) => ({
        table,
        status: 'FAIL',
        cases: cases.get(table)!,
        failure: failureSummary(error),
      })),
      seedRows: {},
    }
  } finally {
    await harness.end()
  }
}
class GuardedRollback<T = unknown> extends Error {
  constructor(readonly value: T) {
    super('Guarded fixture rollback')
  }
}
