/** Column-authority component for owned disposable canonical V2 databases.
 * Caller supplies real restricted LOGINs and production-issued opaque sessions.
 * This module creates no principals, grants, metadata or target-row fixtures. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { AuthenticatedOrgBinding } from '../../../../packages/platform-auth/src/org-binding'
import { appendCanonicalAuditLog } from '../../lib/audit/canonical-audit-chain'
import {
  withRuntimeColumnScope,
  runtimeFieldHistory,
  createPreparedRuntimeQualification,
  assertRuntimeQualificationActive,
  type PublicRuntimeIdentity,
} from './runtime-session-proof'
import { CURRENT_REWARDS_TABLES, REWARD_RUNTIME_COLUMN_CONTRACTS } from './rewards-storage-contract'

export const COLUMN_ACTOR_CLASSES = ['MEMBER', 'ORG_ADMIN', 'PLATFORM_ADMIN'] as const
export type ColumnActorClass = (typeof COLUMN_ACTOR_CLASSES)[number]
export interface RuntimeColumnFixture {
  recipientUserId: string
  programId: string
  awardTypeId: string
  withBinding<T>(operation: (binding: AuthenticatedOrgBinding) => Promise<T>): Promise<T>
}
export interface RuntimeColumnActor extends RuntimeColumnFixture {
  actorClass: ColumnActorClass
  /** Separate active same-organization recipient for a rolled-back positive. */
  probeRecipientUserId: string
}
export interface RuntimeColumnSecurityInput {
  operatorClient: pg.Client
  runtimeClient: pg.Client
  systemClient: pg.Client
  /** Exact owned database name from the caller's disposable fixture receipt. */
  disposableDatabase: string
  actors: readonly RuntimeColumnActor[]
  foreign: RuntimeColumnFixture
}
export interface ColumnTableReport {
  table: string
  status: 'PASS' | 'FAIL'
  cases: string[]
  failure?: string
  failedProof?: string
}
interface HistoryDigest {
  table: string
  sha256: string
  rows: number
}
type ContextChange = 'user' | 'org' | 'bearer' | 'foreign-org' | 'foreign-user'
type RuntimeTable = keyof typeof REWARD_RUNTIME_COLUMN_CONTRACTS
const tables = ['recognition_programs', 'recognition_award_types', 'recognition_awards'] as const
const quote = (name: string) => {
  assert.ok(
    name.length > 0 && Buffer.byteLength(name) <= 63 && !name.includes('\0'),
    'VALID_PHYSICAL_IDENTIFIER_REQUIRED',
  )
  return `"${name.replaceAll('"', '""')}"`
}
const relation = (name: string) => `public.${quote(name)}`
const projection = (table: RuntimeTable) =>
  REWARD_RUNTIME_COLUMN_CONTRACTS[table].select.map(quote).join(',')
const dialect = new PgDialect()

/** Pure counterexample checks are shared with focused tests. Actual role and
 * session values must come from live SQL/production binding at the call site. */
export interface ColumnActorFacts {
  user_id: string
  organization_id: string
  role: string
  member_active: boolean
  user_active: boolean
  lifecycle_state: string
  is_system_admin: boolean
}
export function assertLiveColumnBinding(binding: AuthenticatedOrgBinding) {
  assert.equal(binding.authority, 'pg-session', 'PRODUCTION_OPAQUE_SESSION_REQUIRED')
  assert.ok(binding.sessionToken.length >= 32, 'OPAQUE_BEARER_REQUIRED')
  assert.ok(
    binding.expiresAt instanceof Date &&
      Number.isFinite(binding.expiresAt.getTime()) &&
      binding.expiresAt.getTime() > Date.now(),
    'LIVE_FINITE_SESSION_REQUIRED',
  )
}
export function assertColumnActorFacts(
  actorClass: ColumnActorClass,
  binding: AuthenticatedOrgBinding,
  facts: ColumnActorFacts,
) {
  assertLiveColumnBinding(binding)
  assert.equal(facts.user_id, binding.userId, 'ACTUAL_ACTOR_FACTS_REQUIRED')
  assert.equal(facts.organization_id, binding.organizationId, 'ACTUAL_ORGANIZATION_FACTS_REQUIRED')
  assert.ok(
    facts.member_active && facts.user_active && facts.lifecycle_state === 'active',
    'LIVE_CANONICAL_MEMBERSHIP_REQUIRED',
  )
  assert.equal(facts.role, binding.role, 'ACTUAL_ROLE_FACTS_REQUIRED')
  assert.equal(
    facts.is_system_admin,
    binding.isSystemAdmin === true,
    'ACTUAL_SYSTEM_ADMIN_FACT_REQUIRED',
  )
  assert.equal(
    facts.role,
    actorClass === 'MEMBER' ? 'member' : 'admin',
    'EXACT_ACTOR_CLASS_ROLE_REQUIRED',
  )
  assert.equal(
    facts.is_system_admin,
    actorClass === 'PLATFORM_ADMIN',
    'EXACT_ACTOR_CLASS_ADMIN_FLAG_REQUIRED',
  )
}

export function assertCommittedColumnPair(
  rows: readonly Record<string, unknown>[],
  own: { id: string; org: string; actor: string },
  foreign: { id: string; org: string; actor: string },
) {
  assert.notEqual(own.id, foreign.id, 'INDEPENDENT_NOMINATION_IDS_REQUIRED')
  assert.notEqual(own.org, foreign.org, 'INDEPENDENT_ORGANIZATIONS_REQUIRED')
  assert.notEqual(own.actor, foreign.actor, 'INDEPENDENT_ACTORS_REQUIRED')
  for (const expected of [own, foreign]) {
    const matches = rows.filter((row) => row.id === expected.id)
    assert.equal(matches.length, 1, 'COMMITTED_OWN_AND_FOREIGN_ROWS_REQUIRED')
    assert.equal(matches[0].org_id, expected.org, 'COMMITTED_ORGANIZATION_MISMATCH')
    assert.equal(matches[0].issuer_user_id, expected.actor, 'COMMITTED_ISSUER_MISMATCH')
    assert.equal(matches[0].status, 'pending', 'COMMITTED_PENDING_NOMINATION_REQUIRED')
  }
}

function databaseCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  const value = error.code
  return typeof value === 'string' && /^[A-Z0-9]{5}$/.test(value) ? value : undefined
}
function sanitizedFailure(error: unknown) {
  // PG messages/query parameters and opaque bindings never enter receipts.
  const code = databaseCode(error)
  return code
    ? `COLUMN_PROOF_DATABASE_FAILURE_${code}`
    : 'COLUMN_PROOF_ASSERTION_OR_CALLBACK_FAILURE'
}
export async function requireColumnPermissionDenial(
  client: pg.Client,
  sql: string,
  parameters: unknown[] = [],
) {
  let attempted = false
  await assert.rejects(
    async () => {
      attempted = true
      await client.query(sql, parameters)
    },
    (error: unknown) => error instanceof pg.DatabaseError && databaseCode(error) === '42501',
    'EXPLICIT_SQL_PERMISSION_DENIAL_REQUIRED',
  )
  assert.ok(attempted)
}
const denied = requireColumnPermissionDenial
export async function requireColumnReadDenial(
  client: pg.Client,
  sql: string,
  parameters: unknown[],
) {
  try {
    assert.equal(
      (await client.query(sql, parameters)).rowCount,
      0,
      'PERSISTED_FOREIGN_OR_INVALID_CONTEXT_ROW_VISIBLE',
    )
  } catch (error) {
    if (!(error instanceof pg.DatabaseError) || databaseCode(error) !== '42501') throw error
  }
}
const snapshot = (client: pg.Client) =>
  runtimeFieldHistory(client, [...CURRENT_REWARDS_TABLES, 'audit_logs'])

/** No connection is opened here. The supplied clients must already belong to
 * the same explicitly named owned loopback database and exact role graph. */
export function createRuntimeColumnQualification(input: RuntimeColumnSecurityInput) {
  const reports: ColumnTableReport[] = tables.map((table) => ({ table, status: 'FAIL', cases: [] }))
  const rollbacks: {
    actorClass: ColumnActorClass
    operation: string
    before: HistoryDigest[]
    after: HistoryDigest[]
  }[] = []
  const nominationIds: string[] = []
  let currentProof = 'SOURCE_AND_CLIENT_PRECONDITIONS'
  let postgresMajor: 15 | 16 | undefined
  const auditHashes = new Map<string, string>()
  const identities = new Map<
    RuntimeColumnFixture,
    Pick<AuthenticatedOrgBinding, 'userId' | 'organizationId'>
  >()
  const mark = (table: RuntimeTable, actorClass: ColumnActorClass, proof: string) =>
    reports.find((row) => row.table === table)!.cases.push(`${actorClass}:${proof}`)
  const actorFacts = async (actor: RuntimeColumnActor, binding: AuthenticatedOrgBinding) => {
    const facts = (
      await input.operatorClient.query<ColumnActorFacts>(
        `SELECT u.user_id,m.organization_id,m.role,m.is_active AS member_active,u.is_active AS user_active,u.lifecycle_state,u.is_system_admin
      FROM user_management.users u JOIN user_management.organization_users m USING(user_id) WHERE u.user_id=$1 AND m.organization_id=$2`,
        [binding.userId, binding.organizationId],
      )
    ).rows
    assert.equal(facts.length, 1)
    assert.ok(facts[0])
    assertColumnActorFacts(actor.actorClass, binding, facts[0])
  }
  const scoped = async <T>(
    client: pg.Client,
    binding: PublicRuntimeIdentity,
    role: 'union_eyes_runtime' | 'union_eyes_system',
    operation: () => Promise<T>,
    options: {
      commit?: boolean
      change?: ContextChange
      foreign?: PublicRuntimeIdentity
      constraints?: boolean
    } = {},
  ) => {
    const fixture = [input.foreign, ...input.actors].find((candidate) => {
      const identity = identities.get(candidate)
      return (
        identity?.userId === binding.userId && identity.organizationId === binding.organizationId
      )
    })
    assert.ok(fixture, 'ORIGINAL_PRODUCTION_BINDING_RUNNER_REQUIRED')
    return withRuntimeColumnScope({
      client,
      database: input.disposableDatabase,
      withBinding: fixture.withBinding,
      expected: binding,
      role,
      commit: options.commit,
      constraints: options.constraints,
      change: options.change,
      foreign: options.foreign,
      operation,
    })
  }
  const nominate = async (
    fixture: RuntimeColumnFixture,
    binding: PublicRuntimeIdentity,
    recipient: string,
  ) => {
    const id = randomUUID()
    const result = await input.runtimeClient.query(
      `INSERT INTO public.recognition_awards
      (id,org_id,program_id,award_type_id,recipient_user_id,issuer_user_id,reason,status,metadata_json,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,'pending','{"nomination":true}'::jsonb,statement_timestamp())
      RETURNING ${projection('recognition_awards')}`,
      [
        id,
        binding.organizationId,
        fixture.programId,
        fixture.awardTypeId,
        recipient,
        binding.userId,
        'Synthetic nonfinancial column qualification',
      ],
    )
    assert.equal(result.rowCount, 1, 'RESTRICTED_PENDING_NOMINATION_REQUIRED')
    assert.deepEqual(
      Object.keys(result.rows[0]).sort(),
      [...REWARD_RUNTIME_COLUMN_CONTRACTS.recognition_awards.select].sort(),
      'EXACT_SAFE_RETURNING_REQUIRED',
    )
    for (const [name, expected] of Object.entries({
      id,
      org_id: binding.organizationId,
      program_id: fixture.programId,
      award_type_id: fixture.awardTypeId,
      recipient_user_id: recipient,
      issuer_user_id: binding.userId,
    }))
      assert.equal(result.rows[0][name], expected, 'EXACT_NOMINATION_RESULT_REQUIRED')
    assert.equal(result.rows[0].status, 'pending')
    for (const name of ['created_at', 'updated_at'])
      assert.ok(
        Number.isFinite(new Date(result.rows[0][name]).getTime()),
        'FINITE_NOMINATION_CLOCK_REQUIRED',
      )
    const tx = {
      execute: async (statement: SQL) => {
        const compiled = dialect.sqlToQuery(statement)
        return (await input.runtimeClient.query(compiled.sql, compiled.params)).rows
      },
    }
    const audit = await appendCanonicalAuditLog(
      tx as unknown as Parameters<typeof appendCanonicalAuditLog>[0],
      {
        organizationId: binding.organizationId,
        userId: binding.userId,
        action: 'rewards.award.nominate',
        resourceType: 'recognition_awards',
        resourceId: id,
        details: {
          awardTypeId: fixture.awardTypeId,
          recipientUserId: recipient,
          status: 'pending',
        },
      },
    )
    auditHashes.set(id, audit.contentHash)
    return id
  }
  let activeSignal: AbortSignal | undefined
  const check = () => assertRuntimeQualificationActive(activeSignal)
  let physicalColumns: { table: string; name: string; number: number }[] = []
  let foreignBinding: PublicRuntimeIdentity
  let foreignId: string
  const prepare = async (signal?: AbortSignal) => {
    activeSignal = signal
    check()
    assert.deepEqual(
      Object.keys(REWARD_RUNTIME_COLUMN_CONTRACTS).sort(),
      [...tables].sort(),
      'EXACT_CURRENT_COLUMN_CONTRACTS_REQUIRED',
    )
    currentProof = 'EXACT_ACTOR_CLASSES'
    assert.deepEqual(
      input.actors.map((actor) => actor.actorClass).sort(),
      [...COLUMN_ACTOR_CLASSES].sort(),
      'EXACT_THREE_ACTOR_CLASSES_REQUIRED',
    )
    currentProof = 'OWNED_DISPOSABLE_NAME'
    assert.match(input.disposableDatabase, /^ue_[a-zA-Z0-9_]+$/)
    currentProof = 'DISTINCT_CLIENTS'
    assert.notEqual(input.operatorClient, input.runtimeClient)
    assert.notEqual(input.operatorClient, input.systemClient)
    assert.notEqual(input.runtimeClient, input.systemClient)
    for (const client of [input.operatorClient, input.runtimeClient, input.systemClient]) {
      check()
      currentProof = 'SAME_OWNED_SERVER'
      assert.ok(
        ['localhost', '127.0.0.1', '::1'].includes(client.host),
        'OWNED_LOOPBACK_CLIENT_REQUIRED',
      )
      assert.equal(client.host, input.operatorClient.host, 'SAME_OWNED_SERVER_REQUIRED')
      assert.equal(client.port, input.operatorClient.port, 'SAME_OWNED_SERVER_PORT_REQUIRED')
      assert.equal(
        (await client.query('SELECT pg_catalog.current_database() AS database')).rows[0].database,
        input.disposableDatabase,
      )
      currentProof = 'SUPPORTED_NATIVE_POSTGRES'
      const major = Math.floor(
        Number((await client.query('SHOW server_version_num')).rows[0].server_version_num) / 10_000,
      )
      assert.ok(major === 15 || major === 16, 'QUALIFIED_NATIVE_POSTGRES_15_OR_16_REQUIRED')
      if (postgresMajor !== undefined) assert.equal(major, postgresMajor)
      postgresMajor = major
    }
    currentProof = 'SOURCE_PHYSICAL_COLUMNS'
    physicalColumns = (
      await input.operatorClient.query<{ table: string; name: string; number: number }>(
        `SELECT c.relname AS table,a.attname AS name,a.attnum::int AS number
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND a.attnum<>0 AND NOT a.attisdropped
      ORDER BY c.relname,a.attnum`,
        [tables],
      )
    ).rows
    for (const table of tables)
      for (const name of REWARD_RUNTIME_COLUMN_CONTRACTS[table].select) {
        assert.ok(
          physicalColumns.some(
            (column) => column.table === table && column.name === name && column.number > 0,
          ),
          'SOURCE_COLUMN_MISSING_FROM_FIXTURE',
        )
      }
    for (const fixture of [input.foreign, ...input.actors]) {
      check()
      currentProof =
        fixture === input.foreign
          ? 'FOREIGN_COMMITTED_NOMINATION_AND_AUDIT'
          : 'ACTOR_COMMITTED_NOMINATION_AND_AUDIT'
      await fixture.withBinding(async (binding) => {
        assertLiveColumnBinding(binding)
        assert.notEqual(fixture.recipientUserId, binding.userId)
        const actor = input.actors.find((candidate) => candidate === fixture)
        if (actor) {
          assert.notEqual(actor.probeRecipientUserId, binding.userId)
          assert.notEqual(actor.recipientUserId, actor.probeRecipientUserId)
          await actorFacts(actor, binding)
        }
        identities.set(fixture, { userId: binding.userId, organizationId: binding.organizationId })
        const id = await scoped(
          input.runtimeClient,
          binding,
          'union_eyes_runtime',
          () => nominate(fixture, binding, fixture.recipientUserId),
          { commit: true, constraints: true },
        )
        nominationIds.push(id)
      })
    }
    assert.equal(
      new Set([...identities.values()].map((identity) => identity.userId)).size,
      4,
      'INDEPENDENT_ACTOR_IDENTITIES_REQUIRED',
    )
    foreignBinding = identities.get(input.foreign)!
    foreignId = nominationIds[0]
    // These actual role denials are shared prerequisites, executed once per
    // actor before any table can pass. Each records its own complete history.
    for (const actor of input.actors) {
      const binding = identities.get(actor)!
      const baseline = await snapshot(input.operatorClient)
      const probe = async (name: string, operation: () => Promise<void>) => {
        check()
        currentProof = `${actor.actorClass}:${name}`
        await operation()
        check()
        const after = await snapshot(input.operatorClient)
        assert.deepEqual(after, baseline, 'ACTUAL_ROLLBACK_OR_DENIAL_HISTORY_CHANGED')
        check()
        rollbacks.push({ actorClass: actor.actorClass, operation: name, before: baseline, after })
      }
      for (const role of [
        'ue_v2_owner',
        'union_eyes_system',
        'nzila_auth_gateway',
        'nzila_auth_system_gateway',
      ]) {
        await probe(`role-escalation-${role}`, () =>
          scoped(input.runtimeClient, binding, 'union_eyes_runtime', () =>
            denied(input.runtimeClient, `SET LOCAL ROLE ${quote(role)}`),
          ),
        )
        for (const table of tables)
          mark(table, actor.actorClass, `ROLE_ESCALATION_${role.toUpperCase()}_DENIED`)
      }
    }
    check()
  }
  const qualify = async (selectedTable: (typeof tables)[number], signal?: AbortSignal) => {
    activeSignal = signal
    check()
    for (const [index, actor] of input.actors.entries()) {
      check()
      // Re-enter the production binder; no retained session object can replace
      // its current server-side revocation/membership revalidation.
      currentProof = `${actor.actorClass}:FRESH_PRODUCTION_BINDING`
      const binding = await actor.withBinding(async (current) => {
        currentProof = `${actor.actorClass}:FRESH_ACTOR_FACTS_AND_COMMITTED_PAIR`
        await actorFacts(actor, current)
        return { userId: current.userId, organizationId: current.organizationId }
      })
      {
        assert.equal(binding.userId, identities.get(actor)!.userId, 'ORIGINAL_ACTOR_REQUIRED')
        assert.equal(
          binding.organizationId,
          identities.get(actor)!.organizationId,
          'ORIGINAL_ORGANIZATION_REQUIRED',
        )
        const ownId = nominationIds[index + 1]
        const persisted = (
          await input.operatorClient.query(
            'SELECT id,org_id,issuer_user_id,status FROM public.recognition_awards WHERE id=ANY($1::uuid[])',
            [[ownId, foreignId]],
          )
        ).rows
        assertCommittedColumnPair(
          persisted,
          { id: ownId, org: binding.organizationId, actor: binding.userId },
          { id: foreignId, org: foreignBinding.organizationId, actor: foreignBinding.userId },
        )
        const audited = (
          await input.operatorClient.query(
            'SELECT resource_id::text AS id,user_id,organization_id,action,content_hash FROM public.audit_logs WHERE resource_id::text=ANY($1::text[]) AND resource_type=$2',
            [[ownId, foreignId], 'recognition_awards'],
          )
        ).rows
        assert.equal(audited.length, 2, 'COMMITTED_COUPLED_NOMINATION_AUDITS_REQUIRED')
        for (const expected of [
          { id: ownId, user: binding.userId, org: binding.organizationId },
          { id: foreignId, user: foreignBinding.userId, org: foreignBinding.organizationId },
        ]) {
          const row = audited.find((row) => row.id === expected.id)
          assert.ok(row, 'COMMITTED_NOMINATION_AUDIT_MISSING')
          assert.equal(
            row.content_hash,
            auditHashes.get(expected.id),
            'EXACT_CANONICAL_AUDIT_HASH_REQUIRED',
          )
          assert.equal(row.action, 'rewards.award.nominate')
          assert.equal(row.user_id, expected.user)
          assert.equal(row.organization_id, expected.org)
        }
        const baseline = await snapshot(input.operatorClient)
        const validColumns =
          'id,org_id,program_id,award_type_id,recipient_user_id,issuer_user_id,reason,status,metadata_json,updated_at'
        const probe = async (name: string, operation: () => Promise<void>) => {
          check()
          currentProof = `${actor.actorClass}:${name}`
          await operation()
          check()
          const after = await snapshot(input.operatorClient)
          assert.deepEqual(after, baseline, 'ACTUAL_ROLLBACK_OR_DENIAL_HISTORY_CHANGED')
          check()
          rollbacks.push({ actorClass: actor.actorClass, operation: name, before: baseline, after })
        }
        for (const table of [selectedTable]) {
          const ownKey =
            table === 'recognition_awards'
              ? ownId
              : table === 'recognition_programs'
                ? actor.programId
                : actor.awardTypeId
          const foreignKey =
            table === 'recognition_awards'
              ? foreignId
              : table === 'recognition_programs'
                ? input.foreign.programId
                : input.foreign.awardTypeId
          await probe(`${table}:safe-read`, () =>
            scoped(input.runtimeClient, binding, 'union_eyes_runtime', async () => {
              for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
                assert.equal(
                  (
                    await input.runtimeClient.query(
                      'SELECT has_table_privilege(current_user,$1,$2) AS allowed',
                      [`public.${table}`, operation],
                    )
                  ).rows[0].allowed,
                  false,
                  'BROAD_TABLE_AUTHORITY_FORBIDDEN',
                )
              }
              const own = await input.runtimeClient.query(
                `SELECT ${projection(table)} FROM ${relation(table)} WHERE id=$1`,
                [ownKey],
              )
              assert.equal(own.rowCount, 1, 'POSITIVE_SOURCE_COLUMN_READ_REQUIRED')
              assert.deepEqual(
                Object.keys(own.rows[0]).sort(),
                [...REWARD_RUNTIME_COLUMN_CONTRACTS[table].select].sort(),
              )
              await requireColumnReadDenial(
                input.runtimeClient,
                `SELECT ${projection(table)} FROM ${relation(table)} WHERE id=$1`,
                [foreignKey],
              )
            }),
          )
          mark(table, actor.actorClass, 'COLUMN_SOURCE_AUTHORIZED_SELECT')
          mark(table, actor.actorClass, 'BROAD_TABLE_ACLS_ABSENT')
          mark(table, actor.actorClass, 'COMMITTED_FOREIGN_ROW_HIDDEN')
          for (const column of physicalColumns.filter(
            (column) =>
              column.table === table &&
              !REWARD_RUNTIME_COLUMN_CONTRACTS[table].select.includes(column.name),
          )) {
            await probe(`${table}:excluded-select-${column.name}`, () =>
              scoped(input.runtimeClient, binding, 'union_eyes_runtime', () =>
                denied(
                  input.runtimeClient,
                  `SELECT ${quote(column.name)} FROM ${relation(table)} WHERE id=$1`,
                  [ownKey],
                ),
              ),
            )
            mark(
              table,
              actor.actorClass,
              `COLUMN_EXCESS_SELECT_${column.name.toUpperCase()}_DENIED`,
            )
          }
          for (const change of ['user', 'org', 'bearer', 'foreign-org', 'foreign-user'] as const) {
            await probe(`${table}:context-${change}`, () =>
              scoped(
                input.runtimeClient,
                binding,
                'union_eyes_runtime',
                async () => {
                  await requireColumnReadDenial(
                    input.runtimeClient,
                    `SELECT ${projection(table)} FROM ${relation(table)} WHERE id=ANY($1::uuid[])`,
                    [[ownKey, foreignKey]],
                  )
                },
                { change, foreign: foreignBinding },
              ),
            )
            mark(
              table,
              actor.actorClass,
              `COLUMN_INVALID_${change.toUpperCase().replace('-', '_')}_DENIED`,
            )
          }
          const excluded =
            table === 'recognition_programs'
              ? 'currency'
              : table === 'recognition_award_types'
                ? 'default_credit_amount'
                : 'approved_by_user_id'
          for (const [operation, sql, params] of [
            ['SELECT', `SELECT * FROM ${relation(table)}`, []],
            ['INSERT', `INSERT INTO ${relation(table)} (${quote(excluded)}) VALUES($1)`, [null]],
            ['UPDATE', `UPDATE ${relation(table)} SET id=id WHERE id=$1`, [ownKey]],
            ['DELETE', `DELETE FROM ${relation(table)} WHERE id=$1`, [ownKey]],
          ] as const) {
            await probe(`${table}:broad-${operation}`, () =>
              scoped(input.runtimeClient, binding, 'union_eyes_runtime', () =>
                denied(input.runtimeClient, sql, [...params]),
              ),
            )
            mark(table, actor.actorClass, `SOURCE_UNAUTHORIZED_${operation}_DENIED`)
            await probe(`${table}:system-broad-${operation}`, () =>
              scoped(input.systemClient, binding, 'union_eyes_system', () =>
                denied(input.systemClient, sql, [...params]),
              ),
            )
            mark(table, actor.actorClass, `SYSTEM_SOURCE_UNAUTHORIZED_${operation}_DENIED`)
          }
          if (table === 'recognition_awards')
            for (const column of physicalColumns.filter(
              (column) =>
                column.table === table &&
                column.number > 0 &&
                !REWARD_RUNTIME_COLUMN_CONTRACTS.recognition_awards.insert!.includes(column.name),
            )) {
              await probe(`${table}:excluded-insert-${column.name}`, () =>
                scoped(input.runtimeClient, binding, 'union_eyes_runtime', () =>
                  denied(
                    input.runtimeClient,
                    `INSERT INTO ${relation(table)}(${validColumns},${quote(column.name)}) VALUES($1,$2,$3,$4,$5,$6,'Synthetic forbidden excess column','pending','{"nomination":true}'::jsonb,statement_timestamp(),NULL)`,
                    [
                      randomUUID(),
                      binding.organizationId,
                      actor.programId,
                      actor.awardTypeId,
                      actor.probeRecipientUserId,
                      binding.userId,
                    ],
                  ),
                ),
              )
              mark(
                table,
                actor.actorClass,
                `COLUMN_EXCESS_INSERT_${column.name.toUpperCase()}_DENIED`,
              )
            }
          await probe(`${table}:system-safe-read`, () =>
            scoped(input.systemClient, binding, 'union_eyes_system', async () => {
              for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
                assert.equal(
                  (
                    await input.systemClient.query(
                      'SELECT has_table_privilege(current_user,$1,$2) AS allowed',
                      [`public.${table}`, operation],
                    )
                  ).rows[0].allowed,
                  false,
                  'SYSTEM_TABLE_AUTHORITY_FORBIDDEN',
                )
              }
              await denied(
                input.systemClient,
                `SELECT ${projection(table)} FROM ${relation(table)}`,
              )
            }),
          )
          mark(table, actor.actorClass, 'SYSTEM_COLUMN_ACCESS_DENIED')
        }
        if (selectedTable === 'recognition_awards') {
          await probe('authorized-nomination-and-audit-rollback', () =>
            scoped(
              input.runtimeClient,
              binding,
              'union_eyes_runtime',
              async () => {
                await nominate(actor, binding, actor.probeRecipientUserId)
              },
              { constraints: true },
            ),
          )
          mark(
            'recognition_awards',
            actor.actorClass,
            'COLUMN_SOURCE_AUTHORIZED_INSERT_AND_AUDIT_ROLLED_BACK',
          )
          for (const [label, issuer, recipient, status, org] of [
            [
              'issuer',
              foreignBinding.userId,
              actor.probeRecipientUserId,
              'pending',
              binding.organizationId,
            ],
            ['recipient', binding.userId, foreignBinding.userId, 'pending', binding.organizationId],
            ['self', binding.userId, binding.userId, 'pending', binding.organizationId],
            [
              'status',
              binding.userId,
              actor.probeRecipientUserId,
              'approved',
              binding.organizationId,
            ],
            [
              'organization',
              binding.userId,
              actor.probeRecipientUserId,
              'pending',
              foreignBinding.organizationId,
            ],
          ] as const) {
            await probe(`nomination-conflicting-${label}`, () =>
              scoped(input.runtimeClient, binding, 'union_eyes_runtime', () =>
                denied(
                  input.runtimeClient,
                  `INSERT INTO public.recognition_awards(${validColumns}) VALUES($1,$2,$3,$4,$5,$6,'Synthetic forbidden nomination',$7,'{"nomination":true}'::jsonb,statement_timestamp())`,
                  [
                    randomUUID(),
                    org,
                    actor.programId,
                    actor.awardTypeId,
                    recipient,
                    issuer,
                    status,
                  ],
                ),
              ),
            )
            mark(
              'recognition_awards',
              actor.actorClass,
              `COLUMN_CONFLICTING_${label.toUpperCase()}_DENIED`,
            )
          }
          await probe('nomination-conflicting-metadata', () =>
            scoped(input.runtimeClient, binding, 'union_eyes_runtime', () =>
              denied(
                input.runtimeClient,
                `INSERT INTO public.recognition_awards(${validColumns}) VALUES($1,$2,$3,$4,$5,$6,'Synthetic forbidden metadata','pending','{}'::jsonb,statement_timestamp())`,
                [
                  randomUUID(),
                  binding.organizationId,
                  actor.programId,
                  actor.awardTypeId,
                  actor.probeRecipientUserId,
                  binding.userId,
                ],
              ),
            ),
          )
          mark('recognition_awards', actor.actorClass, 'COLUMN_CONFLICTING_METADATA_DENIED')
          for (const column of ['approved_by_user_id', 'approved_at', 'issued_at']) {
            const value = column === 'approved_by_user_id' ? '$7::text' : 'clock_timestamp()'
            const parameters = [
              randomUUID(),
              binding.organizationId,
              actor.programId,
              actor.awardTypeId,
              actor.probeRecipientUserId,
              binding.userId,
            ]
            if (column === 'approved_by_user_id') parameters.push(foreignBinding.userId)
            await probe(`nomination-excess-${column}`, () =>
              scoped(input.runtimeClient, binding, 'union_eyes_runtime', () =>
                denied(
                  input.runtimeClient,
                  `INSERT INTO public.recognition_awards(${validColumns},${quote(column)}) VALUES($1,$2,$3,$4,$5,$6,'Synthetic forbidden nomination','pending','{"nomination":true}'::jsonb,statement_timestamp(),${value})`,
                  parameters,
                ),
              ),
            )
            mark(
              'recognition_awards',
              actor.actorClass,
              `COLUMN_EXCESS_${column.toUpperCase()}_DENIED`,
            )
          }
          for (const table of [
            'reward_wallet_ledger',
            'reward_budget_envelopes',
            'reward_redemptions',
          ]) {
            for (const [operation, sql, params] of [
              ['SELECT', `SELECT * FROM ${relation(table)}`, []],
              ['INSERT', `INSERT INTO ${relation(table)}(id) VALUES($1)`, [randomUUID()]],
              ['UPDATE', `UPDATE ${relation(table)} SET id=id`, []],
              ['DELETE', `DELETE FROM ${relation(table)}`, []],
            ] as const)
              for (const [principal, client] of [
                ['runtime', input.runtimeClient],
                ['system', input.systemClient],
              ] as const) {
                await probe(`${principal}:${table}:${operation}`, () =>
                  scoped(
                    client,
                    binding,
                    principal === 'runtime' ? 'union_eyes_runtime' : 'union_eyes_system',
                    () => denied(client, sql, [...params]),
                  ),
                )
                mark(
                  'recognition_awards',
                  actor.actorClass,
                  `${principal.toUpperCase()}_RAW_${table.toUpperCase()}_${operation}_DENIED`,
                )
              }
          }
        }
        mark(selectedTable, actor.actorClass, 'COLUMN_HISTORY_UNCHANGED')
      }
    }
    reports.find((report) => report.table === selectedTable)!.status = 'PASS'
  }
  const fail = (error: unknown) => {
    for (const report of reports) {
      report.status = 'FAIL'
      report.failure = sanitizedFailure(error)
      report.failedProof = currentProof
    }
  }
  const runner = createPreparedRuntimeQualification({
    tables,
    prepare,
    qualify,
    report: (table) => reports.find((report) => report.table === table)!,
    fail,
  })
  return {
    ...runner,
    result: () => ({
      status: reports.every((report) => report.status === 'PASS')
        ? ('PASS_COMPONENT_MATRIX' as const)
        : ('FAIL' as const),
      denominator: tables.length,
      qualified: reports.filter((report) => report.status === 'PASS').length,
      reports,
      rollbackProofs: rollbacks,
      committedSyntheticNominationIds: nominationIds,
      nativeActorClassQualification: {
        result: reports.every((report) => report.status === 'PASS')
          ? ('PASS' as const)
          : ('NOT_PROVEN' as const),
        requiredClasses: COLUMN_ACTOR_CLASSES,
        denominator: tables.length,
        qualified: reports.every((report) => report.status === 'PASS') ? tables.length : 0,
        actorTableCells: tables.length * COLUMN_ACTOR_CLASSES.length,
        databaseActorBinding: 'LIVE_CANONICAL_USER_MEMBERSHIP_AND_SESSION' as const,
        tableMutationRollbackMarker: 'NOT_EMITTED_USE_ACTUAL_COLUMN_OPERATION_PROOFS' as const,
      },
      sourceColumnContracts: REWARD_RUNTIME_COLUMN_CONTRACTS,
      observedPostgresMajor: postgresMajor ?? null,
      fixtureDisposition: nominationIds.length
        ? ('COMMITTED_SYNTHETIC_ROWS_RETAINED_UNTIL_CALLER_DISPOSES_OWNED_DATABASE' as const)
        : ('NO_COMMITTED_NOMINATION_PROVEN' as const),
      wholeSecurityQualification: 'NOT_PROVEN' as const,
      applicationActorMapping: 'NOT_PROVEN' as const,
    }),
  }
}
export async function qualifyRuntimeColumnSecurity(input: RuntimeColumnSecurityInput) {
  const prepared = createRuntimeColumnQualification(input)
  for (const table of tables) await prepared.qualifyTable(table)
  return prepared.result()
}
