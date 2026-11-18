/** Read-only module-admission metadata component. No commercial write/provider proof. */
import assert from 'node:assert/strict'
import type pg from 'pg'
import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  commercialContracts,
  contractLineItems,
  orgEntitlements,
} from '../../db/schema/domains/finance/contracts'
import { contractCoveredOrgs } from '../../db/schema/domains/finance/contract-amendments'
import { MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS } from './module-admission-storage-contract'
import {
  COLUMN_ACTOR_CLASSES,
  assertColumnActorFacts,
  requireColumnPermissionDenial,
  requireColumnReadDenial,
  type ColumnActorFacts,
  type ColumnTableReport,
  type RuntimeColumnActor,
  type RuntimeColumnFixture,
} from './runtime-column-security'
import {
  requireSameOwnedRuntimeClients,
  createPreparedRuntimeQualification,
  assertRuntimeQualificationActive,
  runtimeFieldHistory,
  runtimeIdentifier as quote,
  withRuntimeColumnScope,
  type PublicRuntimeIdentity,
  type RuntimeContextChange,
} from './runtime-session-proof'
type Row = Record<string, unknown>
export const MODULE_ADMISSION_RUNTIME_SELECTORS = {
  commercial_contracts: ['id'],
  contract_line_items: ['id'],
  org_entitlements: ['id'],
  contract_covered_orgs: ['contract_id', 'organization_id'],
} as const
const declarations = [commercialContracts, contractLineItems, orgEntitlements, contractCoveredOrgs]
const tables = Object.keys(
  MODULE_ADMISSION_RUNTIME_SELECTORS,
) as (keyof typeof MODULE_ADMISSION_RUNTIME_SELECTORS)[]
export function assertModuleAdmissionSelectors() {
  assert.deepEqual(
    Object.keys(MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS).sort(),
    [...tables].sort(),
    'EXACT_FOUR_MODULE_PROJECTIONS_REQUIRED',
  )
  for (const declaration of declarations) {
    const table = getTableConfig(declaration)
    const keys =
      MODULE_ADMISSION_RUNTIME_SELECTORS[
        table.name as keyof typeof MODULE_ADMISSION_RUNTIME_SELECTORS
      ]
    assert.ok(keys, 'SOURCE_SELECTOR_REQUIRED')
    const keyNames = [...keys].sort()
    const uniqueKeys = [
      table.columns.filter((column) => column.primary).map((column) => column.name),
      ...table.indexes
        .filter((index) => index.config.unique)
        .map((index) =>
          index.config.columns.map((column) => ('name' in column ? column.name : '')),
        ),
    ]
    assert.ok(
      uniqueKeys.some((unique) => JSON.stringify([...unique].sort()) === JSON.stringify(keyNames)),
      'DECLARED_UNIQUE_PUBLISHED_SELECTOR_REQUIRED',
    )
    assert.ok(
      keys.every((key) =>
        MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS[table.name].select.includes(key),
      ),
      'UNPUBLISHED_SELECTOR_FORBIDDEN',
    )
  }
}
export function assertModuleAdmissionCommittedPair(
  rows: readonly Row[],
  pair: readonly [Row, Row],
  keys: readonly string[],
) {
  const signature = (row: Row) => JSON.stringify(keys.map((key) => row[key]))
  assert.ok(
    keys.every((key) => pair.every((row) => row[key] !== undefined && row[key] !== null)),
    'NONNULL_SOURCE_SELECTOR_REQUIRED',
  )
  assert.notEqual(signature(pair[0]), signature(pair[1]), 'INDEPENDENT_MODULE_ROWS_REQUIRED')
  for (const expected of pair)
    assert.equal(
      rows.filter((row) => signature(row) === signature(expected)).length,
      1,
      'BOTH_COMMITTED_MODULE_ROWS_REQUIRED',
    )
}
export interface ModuleAdmissionRuntimeInput {
  operatorClient: pg.Client
  runtimeClient: pg.Client
  systemClient: pg.Client
  disposableDatabase: string
  actors: readonly RuntimeColumnActor[]
  foreign: RuntimeColumnFixture
  rows: Readonly<Record<string, readonly [Row, Row]>>
}
export function createModuleAdmissionRuntimeQualification(input: ModuleAdmissionRuntimeInput) {
  const reports: ColumnTableReport[] = tables.map((table) => ({ table, status: 'FAIL', cases: [] }))
  const historyProofs: {
    actorClass: string
    operation: string
    before: Awaited<ReturnType<typeof runtimeFieldHistory>>
    after: Awaited<ReturnType<typeof runtimeFieldHistory>>
  }[] = []
  let currentProof = 'SOURCE_AND_CLIENT_PRECONDITIONS'
  const mark = (table: string, actor: string, proof: string) =>
    reports.find((report) => report.table === table)!.cases.push(`${actor}:${proof}`)
  const identities = new Map<RuntimeColumnFixture, PublicRuntimeIdentity>()
  let activeSignal: AbortSignal | undefined
  const check = () => assertRuntimeQualificationActive(activeSignal)
  let foreign: PublicRuntimeIdentity
  let columns: { table: string; name: string; number: number }[] = []
  let baseline: Awaited<ReturnType<typeof runtimeFieldHistory>>
  const prepare = async (signal?: AbortSignal) => {
    activeSignal = signal
    check()
    assertModuleAdmissionSelectors()
    assert.deepEqual(
      input.actors.map((actor) => actor.actorClass).sort(),
      [...COLUMN_ACTOR_CLASSES].sort(),
      'EXACT_THREE_ACTOR_CLASSES_REQUIRED',
    )
    requireSameOwnedRuntimeClients(
      input.operatorClient,
      [input.runtimeClient, input.systemClient],
      input.disposableDatabase,
    )
    for (const client of [input.operatorClient, input.runtimeClient, input.systemClient]) {
      check()
      assert.equal(
        (await client.query('SELECT current_database() AS database')).rows[0].database,
        input.disposableDatabase,
      )
      const major = Math.floor(
        Number((await client.query('SHOW server_version_num')).rows[0].server_version_num) / 10_000,
      )
      assert.ok(major === 15 || major === 16, 'QUALIFIED_NATIVE_POSTGRES_15_OR_16_REQUIRED')
    }
    for (const fixture of [input.foreign, ...input.actors])
      await fixture.withBinding(async (binding) => {
        check()
        const facts = (
          await input.operatorClient.query<ColumnActorFacts>(
            `SELECT u.user_id,m.organization_id,m.role,m.is_active AS member_active,u.is_active AS user_active,u.lifecycle_state,u.is_system_admin FROM user_management.users u JOIN user_management.organization_users m USING(user_id) WHERE u.user_id=$1 AND m.organization_id=$2`,
            [binding.userId, binding.organizationId],
          )
        ).rows
        assert.equal(facts.length, 1, 'ACTUAL_CANONICAL_ACTOR_REQUIRED')
        const actor = input.actors.find((actor) => actor === fixture)
        assertColumnActorFacts(actor?.actorClass ?? 'MEMBER', binding, facts[0])
        identities.set(fixture, { userId: binding.userId, organizationId: binding.organizationId })
      })
    assert.equal(
      new Set([...identities.values()].map((identity) => identity.userId)).size,
      4,
      'INDEPENDENT_ACTORS_REQUIRED',
    )
    foreign = identities.get(input.foreign)!
    columns = (
      await input.operatorClient.query<{ table: string; name: string; number: number }>(
        `SELECT c.relname AS table,a.attname AS name,a.attnum::int AS number FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND a.attnum<>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`,
        [tables],
      )
    ).rows
    baseline = await runtimeFieldHistory(input.operatorClient, [...tables, 'audit_logs'])
    check()
  }
  const qualify = async (selectedTable: (typeof tables)[number], signal?: AbortSignal) => {
    activeSignal = signal
    check()
    for (const actor of input.actors) {
      check()
      const expected = identities.get(actor)!
      assert.notEqual(
        expected.organizationId,
        foreign.organizationId,
        'FOREIGN_ORGANIZATION_REQUIRED',
      )
      const scoped = <T>(
        client: pg.Client,
        operation: () => Promise<T>,
        change?: RuntimeContextChange,
      ) =>
        withRuntimeColumnScope({
          client,
          database: input.disposableDatabase,
          withBinding: actor.withBinding,
          role: client === input.systemClient ? 'union_eyes_system' : 'union_eyes_runtime',
          expected,
          foreign,
          change,
          operation,
        })
      const probe = async (name: string, operation: () => Promise<unknown>) => {
        check()
        currentProof = `${actor.actorClass}:${name}`
        await operation()
        check()
        const after = await runtimeFieldHistory(input.operatorClient, [...tables, 'audit_logs'])
        assert.deepEqual(after, baseline, 'READONLY_OR_DENIAL_HISTORY_CHANGED')
        check()
        historyProofs.push({
          actorClass: actor.actorClass,
          operation: name,
          before: baseline,
          after,
        })
      }
      for (const table of [selectedTable]) {
        const contract = MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS[table]
        const keys = MODULE_ADMISSION_RUNTIME_SELECTORS[table]
        const pair = input.rows[table]
        assert.ok(pair, 'COMMITTED_METADATA_PAIR_REQUIRED')
        const projection = contract.select.map(quote).join(',')
        const where = keys.map((key, index) => `${quote(key)}=$${index + 1}`).join(' AND ')
        const params = (row: Row) => keys.map((key) => row[key])
        const ownerRows = (
          await input.operatorClient.query(
            `SELECT ${projection} FROM public.${quote(table)} WHERE (${where}) OR (${keys.map((key, index) => `${quote(key)}=$${index + keys.length + 1}`).join(' AND ')})`,
            [...params(pair[0]), ...params(pair[1])],
          )
        ).rows
        assertModuleAdmissionCommittedPair(ownerRows, pair, keys)
        await probe(`${table}:source-select-and-foreign-denial`, () =>
          scoped(input.runtimeClient, async () => {
            for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
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
            const own = await input.runtimeClient.query(
              `SELECT ${projection} FROM public.${quote(table)} WHERE ${where}`,
              params(pair[0]),
            )
            assert.equal(own.rowCount, 1, 'POSITIVE_MODULE_ADMISSION_PROJECTION_REQUIRED')
            assert.deepEqual(
              Object.keys(own.rows[0]).sort(),
              [...contract.select].sort(),
              'EXACT_SOURCE_PROJECTION_REQUIRED',
            )
            assert.deepEqual(
              own.rows[0],
              ownerRows.find((row) => keys.every((key) => row[key] === pair[0][key])),
              'EXACT_COMMITTED_MODULE_PROJECTION_REQUIRED',
            )
            await requireColumnReadDenial(
              input.runtimeClient,
              `SELECT ${projection} FROM public.${quote(table)} WHERE ${where}`,
              params(pair[1]),
            )
          }),
        )
        mark(table, actor.actorClass, 'COLUMN_SOURCE_AUTHORIZED_SELECT')
        mark(table, actor.actorClass, 'BROAD_TABLE_ACLS_ABSENT')
        mark(table, actor.actorClass, 'COMMITTED_FOREIGN_ROW_HIDDEN')
        for (const column of columns.filter(
          (column) => column.table === table && !contract.select.includes(column.name),
        )) {
          await probe(`${table}:excluded-${column.name}`, () =>
            scoped(input.runtimeClient, () =>
              requireColumnPermissionDenial(
                input.runtimeClient,
                `SELECT ${quote(column.name)} FROM public.${quote(table)} WHERE ${where}`,
                params(pair[0]),
              ),
            ),
          )
          mark(table, actor.actorClass, `COLUMN_EXCESS_SELECT_${column.name.toUpperCase()}_DENIED`)
        }
        for (const change of ['user', 'org', 'bearer', 'foreign-org', 'foreign-user'] as const) {
          await probe(`${table}:missing-${change}`, () =>
            scoped(
              input.runtimeClient,
              () =>
                requireColumnReadDenial(
                  input.runtimeClient,
                  `SELECT ${projection} FROM public.${quote(table)}`,
                  [],
                ),
              change,
            ),
          )
          mark(
            table,
            actor.actorClass,
            `COLUMN_INVALID_${change.toUpperCase().replace('-', '_')}_DENIED`,
          )
        }
        for (const [operation, sql, parameters] of [
          ['SELECT', `SELECT * FROM public.${quote(table)}`, []],
          [
            'INSERT',
            `INSERT INTO public.${quote(table)} (${quote(keys[0])}) VALUES($1)`,
            [pair[0][keys[0]]],
          ],
          [
            'UPDATE',
            `UPDATE public.${quote(table)} SET ${quote(keys[0])}=${quote(keys[0])} WHERE ${where}`,
            params(pair[0]),
          ],
          ['DELETE', `DELETE FROM public.${quote(table)} WHERE ${where}`, params(pair[0])],
        ] as const)
          for (const client of [input.runtimeClient, input.systemClient]) {
            await probe(
              `${table}:${client === input.systemClient ? 'system' : 'runtime'}-${operation}`,
              () =>
                scoped(client, () => requireColumnPermissionDenial(client, sql, [...parameters])),
            )
            mark(
              table,
              actor.actorClass,
              `${client === input.systemClient ? 'SYSTEM_' : ''}SOURCE_UNAUTHORIZED_${operation}_DENIED`,
            )
          }
        await probe(`${table}:system-source-projection`, () =>
          scoped(input.systemClient, () =>
            requireColumnPermissionDenial(
              input.systemClient,
              `SELECT ${projection} FROM public.${quote(table)}`,
            ),
          ),
        )
        mark(table, actor.actorClass, 'SYSTEM_COLUMN_ACCESS_DENIED')
        for (const role of [
          'ue_v2_owner',
          'union_eyes_system',
          'nzila_auth_gateway',
          'nzila_auth_system_gateway',
        ]) {
          await probe(`${table}:role-${role}`, () =>
            scoped(input.runtimeClient, () =>
              requireColumnPermissionDenial(input.runtimeClient, `SET LOCAL ROLE ${quote(role)}`),
            ),
          )
          mark(table, actor.actorClass, `ROLE_ESCALATION_${role.toUpperCase()}_DENIED`)
        }
        mark(table, actor.actorClass, 'COLUMN_READONLY_HISTORY_UNCHANGED')
      }
    }
    reports.find((report) => report.table === selectedTable)!.status = 'PASS'
  }
  const fail = (error: unknown) => {
    for (const report of reports) {
      report.status = 'FAIL'
      report.failedProof = currentProof
      report.failure =
        error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string' &&
        /^[A-Z0-9]{5}$/.test(error.code)
          ? `MODULE_COLUMN_DATABASE_FAILURE_${error.code}`
          : 'MODULE_COLUMN_ASSERTION_OR_CALLBACK_FAILURE'
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
        ? 'PASS_COMPONENT_MATRIX'
        : 'FAIL',
      reports,
      historyProofs,
      sourceColumnContracts: MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS,
      fixtureDisposition: 'CALLER_DISPOSES_OWNED_DATABASE',
      wholeSecurityQualification: 'NOT_PROVEN',
      applicationActorMapping: 'NOT_PROVEN',
    }),
  }
}
export async function qualifyModuleAdmissionRuntimeSecurity(input: ModuleAdmissionRuntimeInput) {
  const prepared = createModuleAdmissionRuntimeQualification(input)
  for (const table of tables) await prepared.qualifyTable(table)
  return prepared.result()
}
