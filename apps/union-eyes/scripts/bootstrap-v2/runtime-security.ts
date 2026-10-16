import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { insertWriteOwnedFeeAdjustment } from '../../services/platform-economics/fee-adjustment-insert'
import {
  feeAdjustmentFixture,
  qualifyFeeAdjustmentWriteOwnedResult,
} from './fee-adjustment-native-proof'
import { hash, quote, type V2Plan } from './source'
import { OWNERSHIP_PROTECTED_CLASSES, type SecurityRule } from './security'
import { ENFORCEMENT_GEOMETRY_OVERRIDES } from '../rls-enforcement/enforcement-geometry-overrides'
import type { SystemMutationContract } from './system-mutation-contracts'

const organizationIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
]
const userIds = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']
const sessionTokens = ['ue-v2-runtime-party-a-only', 'ue-v2-runtime-party-b-only']
interface Column {
  table: string
  name: string
  type: string
  notnull: boolean
  identity: string
  generated: string
  default: string | null
  labels: string[] | null
}
interface ForeignKey {
  constraint: string
  table: string
  column: string
  parent: string
  referenced: string
}
type Row = Record<string, unknown>
const relation = (name: string) =>
  name.includes('.') ? name.split('.').map(quote).join('.') : `public.${quote(name)}`
const failureText = (error: unknown) => (error instanceof Error ? error.message : String(error))
const code = (error: unknown) => (error instanceof pg.DatabaseError ? error.code : undefined)
export const syntheticParameter = (type: string, value: unknown): unknown =>
  value !== null && (type === 'json' || type === 'jsonb') ? JSON.stringify(value) : value

function value(column: Column, party: number, organizationId: string, userId: string): unknown {
  const geometry = ENFORCEMENT_GEOMETRY_OVERRIDES.find((entry) => entry.table === column.table)
  if (geometry?.kind === 'EXPLICIT_DIRECT_COLUMN_OVERRIDE' && geometry.orgColumn === column.name)
    return organizationId
  if (column.table === 'voting_sessions') {
    if (column.name === 'meeting_type' || column.name === 'type') return 'convention'
  }
  if (column.table === 'organizations' && column.name === 'id') return organizationId
  if (['organization_id', 'org_id', 'source_organization_id'].includes(column.name))
    return organizationId
  if (['user_id', 'claimed_by_user_id'].includes(column.name) && !column.type.endsWith('[]'))
    return userId
  if (column.labels?.length) return column.labels[0]
  if (column.type.endsWith('[]')) return []
  if (column.type === 'uuid') {
    const digest = hash(`${column.table}:${column.name}:${party}`)
    return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`
  }
  if (column.type === 'boolean') return false
  const numeric = column.type.match(/^numeric\((\d+),\s*(\d+)\)$/)
  if (numeric) {
    const precision = Number(numeric[1])
    const scale = Number(numeric[2])
    return ((party % (10 ** Math.min(precision, 6) - 1)) + 1) / 10 ** scale
  }
  if (/^(smallint|integer|bigint|numeric|real|double precision)/.test(column.type)) return party + 1
  if (column.type === 'jsonb' || column.type === 'json') return {}
  if (column.type === 'bytea') return Buffer.from(`synthetic-${party}`)
  if (column.type.startsWith('timestamp')) {
    const day = party + (column.name === 'ends_at' ? 2 : 1)
    return new Date(Date.UTC(2026, 0, day)).toISOString()
  }
  if (column.type === 'date')
    return new Date(Date.UTC(2026, 0, party + 1)).toISOString().slice(0, 10)
  if (column.type.startsWith('time')) return '00:00:00'
  if (column.type === 'interval') return '1 second'
  if (column.type === 'inet' || column.type === 'cidr')
    return `192.0.${Math.floor(party / 254) % 256}.${(party % 254) + 1}`
  if (column.type === 'tsvector') return ''
  const vectorSize = column.type.match(/^(?:vector|halfvec)\((\d+)\)$/)?.[1]
  if (vectorSize)
    return `[${Array(Number(vectorSize))
      .fill(party + 1)
      .join(',')}]`
  if (column.name === 'timezone') return 'UTC'
  if (/email/.test(column.name)) return `ue-v2-${party}@example.invalid`
  const limit = Number(column.type.match(/\((\d+)\)/)?.[1] ?? 100)
  return `${party}-${hash(`${column.table}:${column.name}`).slice(0, 12)}`.slice(0, limit)
}

export async function* iterateRuntimeSecurityReports(
  seedClient: pg.Client,
  runtimeClient: pg.Client,
  systemClient: pg.Client,
  plan: V2Plan,
  rules: SecurityRule[],
  frameworkProof?: {
    result: 'PASS' | 'FAIL'
    tableReports: { table: string; status: 'PASS' | 'FAIL'; cases: string[] }[]
  },
  systemContracts?: SystemMutationContract[],
  systemWriter?: PostgresJsDatabase,
) {
  const actorOrganizations = [...organizationIds]
  const actorUsers = [...userIds]
  const actorSessions = [...sessionTokens]
  const sameOrgParent = 'ue-v2-runtime-same-org-parent'
  if (plan.authExecution) {
    for (const party of [0, 1]) {
      await seedClient.query('INSERT INTO user_management.users(user_id,email) VALUES ($1,$2)', [
        userIds[party],
        `ue-v2-runtime-${party}@example.invalid`,
      ])
      await seedClient.query(
        'INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES ($1,$2,$3,true)',
        [userIds[party], organizationIds[party], party === 0 ? 'member' : 'admin'],
      )
      const digest = createHash('sha256').update(sessionTokens[party]).digest('hex')
      await seedClient.query(
        "INSERT INTO user_management.user_sessions(user_id,organization_id,session_token,session_token_hash,expires_at,is_active) VALUES ($1,$2,$3,$3,now()+interval '1 hour',true)",
        [userIds[party], organizationIds[party], digest],
      )
    }
    await seedClient.query('INSERT INTO user_management.users(user_id,email) VALUES ($1,$2)', [
      sameOrgParent,
      'ue-v2-runtime-same-org-parent@example.invalid',
    ])
    await seedClient.query(
      "INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES ($1,$2,'member',true)",
      [sameOrgParent, organizationIds[0]],
    )
  }
  const columns = (
    await seedClient.query<Column>(`
    SELECT CASE WHEN n.nspname='public' THEN c.relname ELSE n.nspname||'.'||c.relname END AS table,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,
      a.attnotnull AS notnull,a.attidentity AS identity,a.attgenerated AS generated,
      pg_get_expr(d.adbin,d.adrelid) AS default,
      (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=a.atttypid) AS labels
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname IN ('public','user_management') AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY c.relname,a.attnum
  `)
  ).rows
  const foreignKeys = (
    await seedClient.query<ForeignKey>(`
    SELECT fk.conname AS "constraint",CASE WHEN cn.nspname='public' THEN child.relname ELSE cn.nspname||'.'||child.relname END AS table,ca.attname AS column,
      CASE WHEN pn.nspname='public' THEN parent.relname ELSE pn.nspname||'.'||parent.relname END AS parent,pa.attname AS referenced
    FROM pg_constraint fk JOIN pg_class child ON child.oid=fk.conrelid JOIN pg_class parent ON parent.oid=fk.confrelid
    JOIN pg_namespace cn ON cn.oid=child.relnamespace JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    CROSS JOIN LATERAL unnest(fk.conkey,fk.confkey) keys(child_key,parent_key)
    JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=keys.child_key
    JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=keys.parent_key
    WHERE fk.contype='f' AND cn.nspname IN ('public','user_management')
    ORDER BY child.relname,fk.conname,keys.child_key
  `)
  ).rows
  const cache = new Map<string, [Row, Row]>()
  if (plan.authExecution) {
    const actors = await seedClient.query<Row>(
      'SELECT ctid::text AS ue_v2_ctid,* FROM user_management.users WHERE user_id=ANY($1::text[])',
      [userIds],
    )
    const actorA = actors.rows.find((row) => row.user_id === userIds[0])
    const actorB = actors.rows.find((row) => row.user_id === userIds[1])
    assert(actorA && actorB, 'UE_V2_CANONICAL_RUNTIME_ACTOR_FIXTURES_REQUIRED')
    cache.set('user_management.users', [actorA, actorB])
  }
  const seedFailures = new Map<string, string>()
  const proposed = new Map<string, [Row, Row]>()
  const fixtureRows = new Map<string, (party: number) => Row>()
  for (const table of plan.tables) {
    const geometry = ENFORCEMENT_GEOMETRY_OVERRIDES.find((entry) => entry.table === table.name)
    const tenantAlias =
      geometry?.kind === 'EXPLICIT_DIRECT_COLUMN_OVERRIDE' ? geometry.orgColumn : undefined
    const syntheticRow = (party: number) =>
      Object.fromEntries(
        columns
          .filter((column) => column.table === table.name && !column.generated && !column.identity)
          .filter(
            (column) =>
              (column.notnull && !column.default) ||
              (column.table === 'organizations' && column.name === 'id') ||
              ['organization_id', 'org_id', 'user_id', 'claimed_by_user_id'].includes(
                column.name,
              ) ||
              column.name === tenantAlias ||
              foreignKeys.some((fk) => fk.parent === table.name && fk.referenced === column.name),
          )
          .map((column) => {
            const modelColumn = plan.currentModels.models
              .find((model) => model.table === table.name)
              ?.columns.find((field) => field.name === column.name)
            const scalarDefault = modelColumn?.clientDefault
            const scalar =
              scalarDefault !== null &&
              scalarDefault !== undefined &&
              typeof scalarDefault !== 'object'
                ? scalarDefault
                : modelColumn?.choices?.[0]
            return [
              column.name,
              ['organization_id', 'org_id', 'user_id', 'claimed_by_user_id'].includes(
                column.name,
              ) || column.name === tenantAlias
                ? value(column, party, actorOrganizations[party], actorUsers[party])
                : (scalar ?? value(column, party, actorOrganizations[party], actorUsers[party])),
            ]
          }),
      )
    fixtureRows.set(table.name, syntheticRow)
    proposed.set(table.name, [syntheticRow(0), syntheticRow(1)])
  }
  const seed = async (name: string, chain: string[] = []): Promise<[Row, Row]> => {
    if (cache.has(name)) return cache.get(name)!
    if (seedFailures.has(name))
      throw new Error(`UE_V2_SYNTHETIC_PARENT_FAILED:${name}:${seedFailures.get(name)}`)
    const rows = proposed.get(name)
    if (!rows) throw new Error(`UE_V2_SYNTHETIC_SOURCE_TABLE_REQUIRED:${name}`)
    if (chain.includes(name)) return rows
    const tableForeignKeys = foreignKeys.filter((fk) => fk.table === name)
    for (const fk of tableForeignKeys) {
      const column = columns.find((entry) => entry.table === name && entry.name === fk.column)!
      const rule = rules.find((entry) => entry.table === name)
      if (
        !column.notnull &&
        !(fk.column in rows[0]) &&
        !rule?.predicate?.includes(quote(fk.column))
      )
        continue
      const parents = fk.parent === name ? rows : await seed(fk.parent, [...chain, name])
      for (const party of [0, 1]) rows[party][fk.column] = parents[party][fk.referenced]
    }
    await seedClient.query('SAVEPOINT ue_v2_seed')
    try {
      const inserted: Row[] = []
      for (const row of rows) {
        const names = Object.keys(row)
        const result = await seedClient.query<Row>(
          `INSERT INTO ${relation(name)} (${names.map(quote).join(',')}) VALUES (${names.map((_, index) => `$${index + 1}`).join(',')}) RETURNING *,ctid::text AS ue_v2_ctid`,
          names.map((column) => row[column]),
        )
        inserted.push(result.rows[0])
      }
      await seedClient.query('RELEASE SAVEPOINT ue_v2_seed')
      const pair: [Row, Row] = [inserted[0], inserted[1]]
      cache.set(name, pair)
      return pair
    } catch (error: unknown) {
      await seedClient.query('ROLLBACK TO SAVEPOINT ue_v2_seed')
      await seedClient.query('RELEASE SAVEPOINT ue_v2_seed')
      seedFailures.set(name, failureText(error))
      throw error
    }
  }
  const scoped = async <T>(
    client: pg.Client,
    role: string,
    party: number,
    operation: () => Promise<T>,
    missing?: 'user' | 'org' | 'bearer',
  ) => {
    await client.query('BEGIN')
    try {
      await client.query(`SET LOCAL ROLE ${quote(role)}`)
      await client.query(
        "SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true)",
        [
          missing === 'user' ? '' : actorUsers[party],
          missing === 'org' ? '' : actorOrganizations[party],
        ],
      )
      if (plan.authExecution)
        await client.query("SELECT set_config('app.current_session_token',$1,true)", [
          missing === 'bearer' ? '' : actorSessions[party],
        ])
      return await operation()
    } finally {
      await client.query('ROLLBACK')
    }
  }
  const freshInsertFixture = async (
    target: string,
    seedTarget = false,
    actorClass: 'MEMBER' | 'ORG_ADMIN' | 'PLATFORM_ADMIN' = 'MEMBER',
  ): Promise<{ row: Row; party: number }> => {
    const party = actorOrganizations.length
    actorOrganizations.push(randomUUID())
    actorUsers.push(randomUUID())
    actorSessions.push(`ue-v2-positive-insert-${randomUUID()}`)
    const fresh = new Map<string, Row>()
    await seedClient.query('BEGIN')
    try {
      if (plan.authExecution) {
        const actor = await seedClient.query<Row>(
          'INSERT INTO user_management.users(user_id,email,is_system_admin) VALUES ($1,$2,$3) RETURNING *',
          [
            actorUsers[party],
            `ue-v2-positive-${party}@example.invalid`,
            actorClass === 'PLATFORM_ADMIN',
          ],
        )
        fresh.set('user_management.users', actor.rows[0])
        await seedClient.query(
          'INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES ($1,$2,$3,true)',
          [
            actorUsers[party],
            actorOrganizations[party],
            actorClass === 'MEMBER' ? 'member' : 'admin',
          ],
        )
        const digest = createHash('sha256').update(actorSessions[party]).digest('hex')
        await seedClient.query(
          "INSERT INTO user_management.user_sessions(user_id,organization_id,session_token,session_token_hash,expires_at,is_active) VALUES ($1,$2,$3,$3,now()+interval '1 hour',true)",
          [actorUsers[party], actorOrganizations[party], digest],
        )
      }
      const prepare = async (name: string, chain: string[] = []): Promise<Row> => {
        if (fresh.has(name)) return fresh.get(name)!
        assert(!chain.includes(name), `UE_V2_POSITIVE_INSERT_CYCLIC_FIXTURE_REQUIRED:${name}`)
        const factory = fixtureRows.get(name)
        assert(factory, `UE_V2_POSITIVE_INSERT_PARENT_SOURCE_REQUIRED:${name}`)
        const row = factory(party)
        const rule = rules.find((entry) => entry.table === name)
        for (const fk of foreignKeys.filter((entry) => entry.table === name)) {
          const column = columns.find((entry) => entry.table === name && entry.name === fk.column)!
          if (
            !column.notnull &&
            !(fk.column in row) &&
            !rule?.predicate?.includes(quote(fk.column))
          )
            continue
          assert(fk.parent !== target, `UE_V2_POSITIVE_INSERT_TARGET_PARENT_CYCLE:${target}`)
          const parent = await prepare(fk.parent, [...chain, name])
          row[fk.column] = parent[fk.referenced]
        }
        if (name === target && !seedTarget) return row
        const names = Object.keys(row)
        const inserted = await seedClient.query<Row>(
          `INSERT INTO ${relation(name)} (${names.map(quote).join(',')}) VALUES (${names.map((_, index) => `$${index + 1}`).join(',')}) RETURNING *,ctid::text AS ue_v2_ctid`,
          names.map((name) => row[name]),
        )
        fresh.set(name, inserted.rows[0])
        return inserted.rows[0]
      }
      const row = await prepare(target)
      await seedClient.query('SET CONSTRAINTS ALL IMMEDIATE')
      await seedClient.query('COMMIT')
      return { row, party }
    } catch (error) {
      await seedClient.query('ROLLBACK')
      throw error
    }
  }
  const denied = async (operation: () => Promise<pg.QueryResult>) => {
    try {
      const result = await operation()
      assert.equal(result.rowCount, 0, 'UE_V2_CROSS_TENANT_MUTATION_SUCCEEDED')
    } catch (error: unknown) {
      if (code(error) !== '42501') throw error
    }
  }
  const reports: { table: string; status: 'PASS' | 'FAIL'; cases: string[]; failure?: string }[] =
    []
  const relevant = systemContracts
    ? rules.filter((rule) =>
        rule.systemPrivileges.some((privilege) =>
          ['INSERT', 'UPDATE', 'DELETE'].includes(privilege),
        ),
      )
    : rules.filter(
        (rule) =>
          /RLS_REQUIRED$/.test(rule.classification) ||
          rule.classification === 'FRAMEWORK_DEDICATED_EXECUTION_CONTEXT' ||
          rule.classification === 'PLATFORM_METADATA_DEDICATED_EXECUTION_CONTEXT' ||
          (rule.classification === 'UNOWNED_CURRENT_SOURCE' &&
            plan.tables
              .find((table) => table.name === rule.table)
              ?.columns.some((column) =>
                ['organization_id', 'org_id', 'user_id'].includes(column.name),
              )),
      )
  for (const rule of relevant) {
    const cases: string[] = []
    try {
      if (rule.status !== 'COMPLETE') throw new Error('UE_V2_CURRENT_SECURITY_SOURCE_UNRESOLVED')
      if (systemContracts) {
        const contract = systemContracts.find((contract) => contract.table === rule.table)
        assert(contract, `UE_V2_SYSTEM_MUTATION_CONTRACT_REQUIRED:${rule.table}`)
        const candidate = await freshInsertFixture(
          rule.table,
          !rule.systemPrivileges.includes('INSERT'),
        )
        if (contract.preallocateInsertIdentity) candidate.row[contract.selector] = randomUUID()
        const writable = columns.find(
          (column) =>
            column.table === rule.table &&
            column.name === contract.updateColumn &&
            !column.generated,
        )
        const insertColumns = columns.filter(
          (column) =>
            column.table === rule.table &&
            !column.generated &&
            !column.identity &&
            column.name in candidate.row,
        )
        const projection = (names: string[]) =>
          names.length
            ? ` RETURNING ${names.map((name) => (name === '*' ? '*' : quote(name))).join(',')}`
            : ''
        const snapshot = async () =>
          (
            await seedClient.query(
              `SELECT to_jsonb(t) AS row FROM ${relation(rule.table)} t ORDER BY ${quote(contract.selector)}`,
            )
          ).rows
        const before = await snapshot()
        const selectorValue = candidate.row[contract.selector]
        const deniedSystem = async (statement: string, parameters: unknown[] = []) =>
          assert.rejects(
            scoped(systemClient, 'union_eyes_system', candidate.party, () =>
              systemClient.query(statement, parameters),
            ),
            (error: unknown) => code(error) === '42501',
          )
        const insertSql = `INSERT INTO ${relation(rule.table)} (${insertColumns.map((column) => quote(column.name)).join(',')}) VALUES (${insertColumns.map((_, index) => `$${index + 1}`).join(',')})`
        const insertParameters = insertColumns.map((column) =>
          syntheticParameter(column.type, candidate.row[column.name]),
        )
        await scoped(systemClient, 'union_eyes_system', candidate.party, async () => {
          const actor = (
            await systemClient.query<{ role: string; superuser: boolean; bypass: boolean }>(
              'SELECT current_user AS role,rolsuper AS superuser,rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user',
            )
          ).rows[0]
          assert.deepEqual(actor, { role: 'union_eyes_system', superuser: false, bypass: false })
          cases.push('GENUINE_NOINHERIT_SYSTEM_ROLE_NO_SUPERUSER_NO_BYPASSRLS')
          let key = selectorValue
          if (rule.systemPrivileges.includes('INSERT')) {
            if (contract.writeOwnedFeeResult) {
              const inserted = await insertWriteOwnedFeeAdjustment(
                drizzle(systemClient),
                feeAdjustmentFixture(candidate.row),
              )
              key = inserted.id
              await systemClient.query('SET CONSTRAINTS ALL IMMEDIATE')
              cases.push('SOURCE_AUTHORIZED_INSERT_WRITE_OWNED_COMPLETE_RESULT_AND_CONSTRAINTS')
            } else {
              const inserted = await systemClient.query(
                insertSql + projection(contract.insertReturning),
                insertParameters,
              )
              assert.equal(inserted.rowCount, 1, `UE_V2_SYSTEM_INSERT_DENIED:${rule.table}`)
              if (contract.insertReturning.length) {
                const expectedColumns = contract.insertReturning.includes('*')
                  ? columns
                      .filter((column) => column.table === rule.table)
                      .map((column) => column.name)
                  : contract.insertReturning
                assert.deepEqual(Object.keys(inserted.rows[0]).sort(), [...expectedColumns].sort())
                key = inserted.rows[0][contract.selector] ?? key
              }
              await systemClient.query('SET CONSTRAINTS ALL IMMEDIATE')
              cases.push('SOURCE_AUTHORIZED_INSERT_RETURNING_SHAPE_AND_CONSTRAINTS')
            }
          }
          if (rule.systemPrivileges.includes('UPDATE')) {
            assert(writable, `UE_V2_SYSTEM_UPDATE_COLUMN_REQUIRED:${rule.table}`)
            assert(key !== undefined, `UE_V2_SYSTEM_CALLER_SELECTOR_VALUE_REQUIRED:${rule.table}`)
            const result = await systemClient.query(
              `UPDATE ${relation(rule.table)} SET ${quote(writable.name)}=$1 WHERE ${quote(contract.selector)}=$2` +
                projection(contract.updateReturning),
              [contract.updateValue, key],
            )
            assert.equal(
              result.rowCount,
              1,
              `UE_V2_SYSTEM_CALLER_UPDATE_SELECTOR_DENIED:${rule.table}`,
            )
            if (contract.updateReturning.length) {
              const expectedColumns = contract.updateReturning.includes('*')
                ? columns
                    .filter((column) => column.table === rule.table)
                    .map((column) => column.name)
                : contract.updateReturning
              assert.deepEqual(Object.keys(result.rows[0]).sort(), [...expectedColumns].sort())
              assert.equal(result.rows[0][contract.selector], key)
              if (contract.updateReturning.includes('*')) {
                const actual = result.rows[0][writable.name]
                assert.equal(
                  actual instanceof Date ? actual.toISOString() : actual,
                  contract.updateValue,
                )
              }
            }
            await systemClient.query('SET CONSTRAINTS ALL IMMEDIATE')
            cases.push('SOURCE_AUTHORIZED_UPDATE_CALLER_SELECTOR_RETURNING_SHAPE_AND_CONSTRAINTS')
          }
          if (rule.systemPrivileges.includes('DELETE')) {
            assert(key !== undefined, `UE_V2_SYSTEM_DELETE_SELECTOR_VALUE_REQUIRED:${rule.table}`)
            assert.equal(
              (
                await systemClient.query(
                  `DELETE FROM ${relation(rule.table)} WHERE ${quote(contract.selector)}=$1`,
                  [key],
                )
              ).rowCount,
              1,
            )
            await systemClient.query('SET CONSTRAINTS ALL IMMEDIATE')
            cases.push('SOURCE_AUTHORIZED_DELETE_CALLER_SELECTOR_AND_CONSTRAINTS')
          }
        })
        assert.deepEqual(
          await snapshot(),
          before,
          `UE_V2_SYSTEM_MUTATION_ROLLBACK_RESIDUE:${rule.table}`,
        )
        cases.push('SYSTEM_MUTATIONS_ROLLED_BACK_WITH_EXACT_ROW_SNAPSHOT')
        if (contract.writeOwnedFeeResult)
          cases.push(
            ...(await qualifyFeeAdjustmentWriteOwnedResult(
              seedClient,
              systemClient,
              feeAdjustmentFixture(candidate.row),
              systemWriter,
            )),
          )
        for (const operation of [
          { privilege: 'INSERT', sql: insertSql, parameters: insertParameters },
          {
            privilege: 'UPDATE',
            sql: `UPDATE ${relation(rule.table)} SET ${quote(contract.selector)}=$1`,
            parameters: [selectorValue],
          },
          { privilege: 'DELETE', sql: `DELETE FROM ${relation(rule.table)}`, parameters: [] },
          { privilege: 'SELECT', sql: `SELECT * FROM ${relation(rule.table)}`, parameters: [] },
        ].filter((operation) => !rule.systemPrivileges.includes(operation.privilege))) {
          await deniedSystem(operation.sql, operation.parameters)
          cases.push(`SYSTEM_SOURCE_UNAUTHORIZED_${operation.privilege}_DENIED`)
        }
        for (const role of ['ue_v2_owner', 'union_eyes_system']) {
          await assert.rejects(
            runtimeClient.query(`SET ROLE ${quote(role)}`),
            (error: unknown) => code(error) === '42501',
          )
        }
        cases.push('ORDINARY_LOGIN_CANNOT_ESCALATE_TO_SYSTEM_OR_OWNER')
        reports.push({ table: rule.table, status: 'PASS', cases })
        yield reports[reports.length - 1]
        continue
      }
      if (
        rule.classification === 'FRAMEWORK_DEDICATED_EXECUTION_CONTEXT' ||
        rule.classification === 'PLATFORM_METADATA_DEDICATED_EXECUTION_CONTEXT'
      ) {
        const proof = frameworkProof?.tableReports.find((entry) => entry.table === rule.table)
        assert.equal(
          frameworkProof?.result,
          'PASS',
          'UE_V2_FRAMEWORK_SEPARATE_CONTEXT_PROOF_REQUIRED',
        )
        assert.equal(proof?.status, 'PASS', 'UE_V2_FRAMEWORK_TABLE_PROOF_REQUIRED')
        assert(proof && proof.cases.length > 0, 'UE_V2_FRAMEWORK_NONEMPTY_PROOF_REQUIRED')
        reports.push({ table: rule.table, status: 'PASS', cases: proof.cases })
        yield reports[reports.length - 1]
        continue
      }
      const priorSeeds = new Set(cache.keys())
      await seedClient.query('BEGIN')
      let rows: [Row, Row]
      try {
        rows = await seed(rule.table)
        await seedClient.query('SET CONSTRAINTS ALL IMMEDIATE')
        await seedClient.query('COMMIT')
      } catch (error: unknown) {
        await seedClient.query('ROLLBACK')
        for (const key of cache.keys()) if (!priorSeeds.has(key)) cache.delete(key)
        throw error
      }
      if (rule.runtimePrivileges.includes('SELECT')) {
        for (const party of [0, 1]) {
          await scoped(runtimeClient, 'union_eyes_runtime', party, async () => {
            const visible = await runtimeClient.query<{ row: string }>(
              `SELECT ctid::text AS row FROM ${relation(rule.table)}`,
            )
            assert(
              visible.rows.some((row) => row.row === rows[party].ue_v2_ctid),
              'UE_V2_OWN_TENANT_ROW_INACCESSIBLE',
            )
            assert(
              !visible.rows.some((row) => row.row === rows[1 - party].ue_v2_ctid),
              'UE_V2_FOREIGN_TENANT_ROW_VISIBLE',
            )
          })
        }
        cases.push('ORG_A_B_BIDIRECTIONAL_READ_ISOLATION')
        if (plan.authExecution) {
          await scoped(runtimeClient, 'union_eyes_runtime', 0, async () => {
            await runtimeClient.query("SELECT set_config('app.current_org_id',$1,true)", [
              organizationIds[1],
            ])
            assert.equal(
              (await runtimeClient.query(`SELECT * FROM ${relation(rule.table)}`)).rowCount,
              0,
            )
          })
          cases.push('FORGED_FOREIGN_ORGANIZATION_CONTEXT_DENIED')
          await scoped(
            runtimeClient,
            'union_eyes_runtime',
            0,
            async () => {
              assert.equal(
                (await runtimeClient.query(`SELECT * FROM ${relation(rule.table)}`)).rowCount,
                0,
              )
            },
            'bearer',
          )
          cases.push('MISSING_SESSION_BEARER_DENIED')
        }
        await scoped(
          runtimeClient,
          'union_eyes_runtime',
          0,
          async () => {
            const result = await runtimeClient.query(`SELECT * FROM ${relation(rule.table)}`)
            assert.equal(result.rowCount, 0)
          },
          'user',
        )
        cases.push('MISSING_AUTHENTICATED_USER_DENIED')
        if (
          plan.authExecution ||
          (rule.classification !== 'USER_RLS_REQUIRED' &&
            rule.classification !== 'MIXED_GLOBAL_TENANT_RLS_REQUIRED')
        ) {
          await scoped(
            runtimeClient,
            'union_eyes_runtime',
            0,
            async () => {
              const result = await runtimeClient.query(`SELECT * FROM ${relation(rule.table)}`)
              assert.equal(result.rowCount, 0)
            },
            'org',
          )
          cases.push('MISSING_ORGANIZATION_DENIED')
        }
        await assert.rejects(
          scoped(runtimeClient, 'union_eyes_runtime', 0, async () => {
            await runtimeClient.query('SET LOCAL row_security = off')
            await runtimeClient.query(`SELECT * FROM ${relation(rule.table)}`)
          }),
          (error: unknown) => code(error) === '42501',
        )
        cases.push('ORDINARY_ROLE_ROW_SECURITY_BYPASS_DENIED')
      }
      if (rule.runtimePrivileges.includes('UPDATE')) {
        const writable = columns.find(
          (column) => column.table === rule.table && !column.generated && !column.identity,
        )!
        await denied(() =>
          scoped(runtimeClient, 'union_eyes_runtime', 0, () =>
            runtimeClient.query(
              `UPDATE ${relation(rule.table)} SET ${quote(writable.name)}=${quote(writable.name)} WHERE ctid=$1::tid`,
              [rows[1].ue_v2_ctid],
            ),
          ),
        )
        cases.push('FOREIGN_TENANT_UPDATE_DENIED')
        await scoped(runtimeClient, 'union_eyes_runtime', 0, async () => {
          const result = await runtimeClient.query(
            `UPDATE ${relation(rule.table)} SET ${quote(writable.name)}=$1`,
            [syntheticParameter(writable.type, rows[0][writable.name])],
          )
          assert.equal(result.rowCount, 1, 'UE_V2_OWN_TENANT_UPDATE_DENIED')
        })
        cases.push('OWN_TENANT_UPDATE_ALLOWED_AND_ROLLED_BACK')
        for (const fk of foreignKeys.filter((entry) => entry.table === rule.table)) {
          const parent = plan.tables.find((entry) => entry.name === fk.parent)
          if (
            !parent ||
            !(
              (plan.authExecution &&
                fk.parent === 'user_management.users' &&
                fk.referenced === 'user_id') ||
              OWNERSHIP_PROTECTED_CLASSES.some(
                (classification) => classification === parent.authority?.classification,
              )
            )
          )
            continue
          await seedClient.query('BEGIN')
          const priorParentSeeds = new Set(cache.keys())
          let parentRows: [Row, Row]
          try {
            parentRows = await seed(fk.parent)
            await seedClient.query('SET CONSTRAINTS ALL IMMEDIATE')
            await seedClient.query('COMMIT')
          } catch (error: unknown) {
            await seedClient.query('ROLLBACK')
            for (const key of cache.keys()) if (!priorParentSeeds.has(key)) cache.delete(key)
            throw error
          }
          await denied(() =>
            scoped(runtimeClient, 'union_eyes_runtime', 0, () =>
              runtimeClient.query(
                `UPDATE ${relation(rule.table)} SET ${quote(fk.column)}=$1 WHERE ctid=$2::tid`,
                [parentRows[1][fk.referenced], rows[0].ue_v2_ctid],
              ),
            ),
          )
          cases.push(`EXISTING_FOREIGN_TENANT_FK_DENIED:${fk.column}`)
          if (
            plan.authExecution &&
            fk.parent === 'user_management.users' &&
            fk.referenced === 'user_id'
          ) {
            const updateParent = () =>
              scoped(runtimeClient, 'union_eyes_runtime', 0, () =>
                runtimeClient.query(
                  `UPDATE ${relation(rule.table)} SET ${quote(fk.column)}=$1 WHERE ctid=$2::tid`,
                  [sameOrgParent, rows[0].ue_v2_ctid],
                ),
              )
            if (rule.table === 'ai_usage_metrics' && fk.column === 'user_id') {
              await denied(updateParent)
              cases.push(`SAME_ORG_OTHER_USER_OWN_PARENT_DENIED:${fk.column}`)
            } else {
              const result = await updateParent()
              assert.equal(result.rowCount, 1, 'UE_V2_SAME_ORG_ATTRIBUTION_PARENT_DENIED')
              cases.push(`SAME_ORG_ATTRIBUTION_PARENT_ALLOWED_AND_ROLLED_BACK:${fk.column}`)
            }
          }
        }
      }
      if (rule.runtimePrivileges.includes('INSERT')) {
        const insertColumns = columns.filter(
          (column) => column.table === rule.table && !column.identity && !column.generated,
        )
        const uniqueKeys = await seedClient.query<{ columns: (string | null)[] }>(
          `SELECT array_agg(a.attname::text ORDER BY key.position) AS columns
           FROM pg_index i
           CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY key(number,position)
           LEFT JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=key.number
           WHERE i.indrelid=$1::regclass AND i.indisunique AND key.position<=i.indnkeyatts
           GROUP BY i.indexrelid`,
          [relation(rule.table)],
        )
        const ownInsert = { ...rows[0] }
        let requiresFreshActor = false
        for (const key of uniqueKeys.rows) {
          if (
            key.columns.some((name) =>
              columns.some(
                (column) =>
                  column.table === rule.table && column.name === name && Boolean(column.identity),
              ),
            )
          )
            continue
          const mutable = insertColumns.find(
            (column) =>
              key.columns.includes(column.name) &&
              ![
                'organization_id',
                'org_id',
                'source_organization_id',
                'user_id',
                'claimed_by_user_id',
              ].includes(column.name) &&
              !foreignKeys.some((fk) => fk.table === rule.table && fk.column === column.name) &&
              !column.labels?.length &&
              (column.type === 'uuid' || /^(?:character varying|varchar|text)/.test(column.type)),
          )
          if (!mutable) {
            requiresFreshActor = true
            continue
          }
          ownInsert[mutable.name] =
            mutable.type === 'uuid'
              ? randomUUID()
              : `ue-v2-${randomUUID()}`.slice(
                  0,
                  Number(mutable.type.match(/\((\d+)\)/)?.[1] ?? 100),
                )
        }
        const positive = requiresFreshActor
          ? await freshInsertFixture(rule.table)
          : { row: ownInsert, party: 0 }
        const positiveColumns = insertColumns.filter((column) => column.name in positive.row)
        await scoped(runtimeClient, 'union_eyes_runtime', positive.party, async () => {
          const inserted = await runtimeClient.query(
            `INSERT INTO ${relation(rule.table)} (${positiveColumns.map((column) => quote(column.name)).join(',')}) VALUES (${positiveColumns.map((_, index) => `$${index + 1}`).join(',')})`,
            positiveColumns.map((column) =>
              syntheticParameter(column.type, positive.row[column.name]),
            ),
          )
          assert.equal(inserted.rowCount, 1, `UE_V2_OWN_TENANT_INSERT_DENIED:${rule.table}`)
          await runtimeClient.query('SET CONSTRAINTS ALL IMMEDIATE')
        })
        cases.push('OWN_TENANT_INSERT_ALLOWED_CONSTRAINT_VERIFIED_AND_ROLLED_BACK')
        await assert.rejects(
          scoped(runtimeClient, 'union_eyes_runtime', 0, () =>
            runtimeClient.query(
              `INSERT INTO ${relation(rule.table)} (${insertColumns.map((column) => quote(column.name)).join(',')}) VALUES (${insertColumns.map((_, index) => `$${index + 1}`).join(',')})`,
              insertColumns.map((column) => syntheticParameter(column.type, rows[1][column.name])),
            ),
          ),
          (error: unknown) => code(error) === '42501',
        )
        cases.push('FOREIGN_TENANT_INSERT_RLS_DENIED')
        const authParents = plan.authExecution
          ? foreignKeys.filter(
              (fk) =>
                fk.table === rule.table &&
                fk.parent === 'user_management.users' &&
                fk.referenced === 'user_id',
            )
          : []
        if (authParents.length) {
          const keys = await seedClient.query<{ columns: string[] }>(
            `SELECT array_agg(a.attname::text ORDER BY key.position) AS columns
             FROM pg_index i
             CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY key(number,position)
             LEFT JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=key.number
             WHERE i.indrelid=$1::regclass AND i.indisunique AND key.position<=i.indnkeyatts
             GROUP BY i.indexrelid`,
            [relation(rule.table)],
          )
          assert(
            insertColumns.some((column) => column.name === 'id' && column.type === 'uuid') &&
              keys.rows.length > 0 &&
              keys.rows.every((key) => key.columns.length === 1 && key.columns[0] === 'id'),
            `UE_V2_AUTH_PARENT_INSERT_UNIQUE_FIXTURE_REQUIRED:${rule.table}`,
          )
          for (const fk of authParents) {
            const insertParent = (parentUserId: string) =>
              scoped(runtimeClient, 'union_eyes_runtime', 0, () =>
                runtimeClient.query(
                  `INSERT INTO ${relation(rule.table)} (${insertColumns.map((column) => quote(column.name)).join(',')}) VALUES (${insertColumns.map((_, index) => `$${index + 1}`).join(',')})`,
                  insertColumns.map((column) =>
                    syntheticParameter(
                      column.type,
                      column.name === 'id'
                        ? randomUUID()
                        : column.name === fk.column
                          ? parentUserId
                          : rows[0][column.name],
                    ),
                  ),
                ),
              )
            assert.equal(
              (await insertParent(userIds[0])).rowCount,
              1,
              'UE_V2_OWN_AUTH_PARENT_INSERT_DENIED',
            )
            cases.push(`OWN_AUTH_PARENT_INSERT_ALLOWED_AND_ROLLED_BACK:${fk.column}`)
            await assert.rejects(
              insertParent(userIds[1]),
              (error: unknown) => code(error) === '42501',
            )
            cases.push(`OWN_ORG_FOREIGN_AUTH_PARENT_INSERT_DENIED:${fk.column}`)
            if (rule.table === 'ai_usage_metrics' && fk.column === 'user_id') {
              await assert.rejects(
                insertParent(sameOrgParent),
                (error: unknown) => code(error) === '42501',
              )
              cases.push(`SAME_ORG_OTHER_USER_OWN_PARENT_INSERT_DENIED:${fk.column}`)
            } else {
              assert.equal(
                (await insertParent(sameOrgParent)).rowCount,
                1,
                'UE_V2_SAME_ORG_ATTRIBUTION_PARENT_INSERT_DENIED',
              )
              cases.push(`SAME_ORG_ATTRIBUTION_PARENT_INSERT_ALLOWED_AND_ROLLED_BACK:${fk.column}`)
            }
          }
        }
      }
      if (rule.runtimePrivileges.includes('DELETE')) {
        await denied(() =>
          scoped(runtimeClient, 'union_eyes_runtime', 0, () =>
            runtimeClient.query(`DELETE FROM ${relation(rule.table)} WHERE ctid=$1::tid`, [
              rows[1].ue_v2_ctid,
            ]),
          ),
        )
        cases.push('FOREIGN_TENANT_DELETE_DENIED')
      }
      if (rule.systemPrivileges.includes('SELECT')) {
        await scoped(systemClient, 'union_eyes_system', 0, async () => {
          const visible = await systemClient.query<{ row: string }>(
            `SELECT ctid::text AS row FROM ${relation(rule.table)}`,
          )
          assert(rows.every((seeded) => visible.rows.some((row) => row.row === seeded.ue_v2_ctid)))
        })
        cases.push('EXPLICIT_SOURCE_AUTHORIZED_SYSTEM_READ')
      }
      if (plan.authExecution) {
        for (const actorClass of ['MEMBER', 'ORG_ADMIN', 'PLATFORM_ADMIN'] as const) {
          const own = await freshInsertFixture(rule.table, true, actorClass)
          const writable = columns.find(
            (column) => column.table === rule.table && !column.generated && !column.identity,
          )!
          const mutations = [
            {
              privilege: 'UPDATE',
              sql: `UPDATE ${relation(rule.table)} SET ${quote(writable.name)}=${quote(writable.name)} WHERE ctid=$1::tid`,
              ownSql: `UPDATE ${relation(rule.table)} SET ${quote(writable.name)}=$1`,
              ownParameters: [syntheticParameter(writable.type, own.row[writable.name])],
            },
            {
              privilege: 'DELETE',
              sql: `DELETE FROM ${relation(rule.table)} WHERE ctid=$1::tid`,
              ownSql: `DELETE FROM ${relation(rule.table)}`,
              ownParameters: [],
            },
          ].filter((entry) => rule.runtimePrivileges.includes(entry.privilege))
          if (rule.runtimePrivileges.includes('SELECT')) {
            await scoped(runtimeClient, 'union_eyes_runtime', own.party, async () => {
              assert.equal(
                (
                  await runtimeClient.query(
                    `SELECT 1 FROM ${relation(rule.table)} WHERE ctid=$1::tid`,
                    [own.row.ue_v2_ctid],
                  )
                ).rowCount,
                1,
                `UE_V2_ACTOR_OWN_READ_DENIED:${rule.table}:${actorClass}`,
              )
              assert.equal(
                (
                  await runtimeClient.query(
                    `SELECT 1 FROM ${relation(rule.table)} WHERE ctid=$1::tid`,
                    [rows[0].ue_v2_ctid],
                  )
                ).rowCount,
                0,
                `UE_V2_ACTOR_FOREIGN_READ_ALLOWED:${rule.table}:${actorClass}`,
              )
            })
            for (const missing of ['user', 'org', 'bearer'] as const)
              await scoped(
                runtimeClient,
                'union_eyes_runtime',
                own.party,
                async () => {
                  assert.equal(
                    (await runtimeClient.query(`SELECT 1 FROM ${relation(rule.table)}`)).rowCount,
                    0,
                    `UE_V2_ACTOR_MISSING_${missing}_READ_ALLOWED:${rule.table}:${actorClass}`,
                  )
                },
                missing,
              )
            cases.push(`${actorClass}:OWN_READ_ALLOWED_FOREIGN_READ_DENIED`)
            cases.push(`${actorClass}:MISSING_USER_ORGANIZATION_AND_BEARER_READ_DENIED`)
          }
          for (const mutation of mutations) {
            await scoped(runtimeClient, 'union_eyes_runtime', own.party, async () => {
              assert.equal(
                (await runtimeClient.query(mutation.ownSql, mutation.ownParameters)).rowCount,
                1,
                `UE_V2_ACTOR_OWN_${mutation.privilege}_DENIED:${rule.table}:${actorClass}`,
              )
              await runtimeClient.query('SET CONSTRAINTS ALL IMMEDIATE')
            })
            await denied(() =>
              scoped(runtimeClient, 'union_eyes_runtime', own.party, () =>
                runtimeClient.query(mutation.sql, [rows[0].ue_v2_ctid]),
              ),
            )
            await denied(() =>
              scoped(
                runtimeClient,
                'union_eyes_runtime',
                own.party,
                () => runtimeClient.query(mutation.ownSql, mutation.ownParameters),
                'bearer',
              ),
            )
            cases.push(
              `${actorClass}:OWN_${mutation.privilege}_ALLOWED_CONSTRAINT_VERIFIED_FOREIGN_AND_UNAUTHENTICATED_DENIED`,
            )
          }
          if (rule.runtimePrivileges.includes('INSERT')) {
            const candidate = await freshInsertFixture(rule.table, false, actorClass)
            const candidateColumns = columns.filter(
              (column) =>
                column.table === rule.table &&
                !column.generated &&
                !column.identity &&
                column.name in candidate.row,
            )
            const sql = `INSERT INTO ${relation(rule.table)} (${candidateColumns.map((column) => quote(column.name)).join(',')}) VALUES (${candidateColumns.map((_, index) => `$${index + 1}`).join(',')})`
            const parameters = candidateColumns.map((column) =>
              syntheticParameter(column.type, candidate.row[column.name]),
            )
            const countBefore = (
              await seedClient.query<{ count: string }>(
                `SELECT count(*)::text AS count FROM ${relation(rule.table)}`,
              )
            ).rows[0].count
            await scoped(runtimeClient, 'union_eyes_runtime', candidate.party, async () => {
              assert.equal(
                (await runtimeClient.query(sql, parameters)).rowCount,
                1,
                `UE_V2_ACTOR_OWN_INSERT_DENIED:${rule.table}:${actorClass}`,
              )
              await runtimeClient.query('SET CONSTRAINTS ALL IMMEDIATE')
            })
            await assert.rejects(
              scoped(
                runtimeClient,
                'union_eyes_runtime',
                candidate.party,
                () => runtimeClient.query(sql, parameters),
                'bearer',
              ),
              (error: unknown) => code(error) === '42501',
            )
            assert.equal(
              (
                await seedClient.query<{ count: string }>(
                  `SELECT count(*)::text AS count FROM ${relation(rule.table)}`,
                )
              ).rows[0].count,
              countBefore,
              `UE_V2_ACTOR_INSERT_ROLLBACK_RESIDUE:${rule.table}:${actorClass}`,
            )
            await assert.rejects(
              scoped(runtimeClient, 'union_eyes_runtime', 0, () =>
                runtimeClient.query(sql, parameters),
              ),
              (error: unknown) => code(error) === '42501',
            )
            const parentConstraints = new Map<string, ForeignKey[]>()
            for (const fk of foreignKeys.filter((entry) => entry.table === rule.table)) {
              const parent = plan.tables.find((table) => table.name === fk.parent)
              const parentClassification =
                rules.find((entry) => entry.table === fk.parent)?.classification ??
                parent?.authority?.classification
              if (
                fk.parent === 'user_management.users' ||
                OWNERSHIP_PROTECTED_CLASSES.some(
                  (classification) => classification === parentClassification,
                )
              )
                parentConstraints.set(fk.constraint, [
                  ...(parentConstraints.get(fk.constraint) ?? []),
                  fk,
                ])
            }
            for (const [constraint, keys] of parentConstraints) {
              const parentName = keys[0].parent
              if (!cache.has(parentName)) {
                const priorParentSeeds = new Set(cache.keys())
                await seedClient.query('BEGIN')
                try {
                  await seed(parentName)
                  await seedClient.query('SET CONSTRAINTS ALL IMMEDIATE')
                  await seedClient.query('COMMIT')
                } catch (error: unknown) {
                  await seedClient.query('ROLLBACK')
                  for (const name of cache.keys())
                    if (!priorParentSeeds.has(name)) cache.delete(name)
                  throw error
                }
              }
              const parent = cache.get(parentName)?.[0]
              assert(
                parent,
                `UE_V2_ACTOR_FOREIGN_PARENT_FIXTURE_REQUIRED:${rule.table}:${constraint}`,
              )
              const foreign = { ...candidate.row }
              for (const key of keys) foreign[key.column] = parent[key.referenced]
              const foreignColumns = columns.filter(
                (column) =>
                  column.table === rule.table &&
                  !column.generated &&
                  !column.identity &&
                  column.name in foreign,
              )
              assert(
                keys.every((key) => foreignColumns.some((column) => column.name === key.column)),
                `UE_V2_ACTOR_FOREIGN_PARENT_WRITABLE_COLUMNS_REQUIRED:${rule.table}:${constraint}`,
              )
              await assert.rejects(
                scoped(runtimeClient, 'union_eyes_runtime', candidate.party, () =>
                  runtimeClient.query(
                    `INSERT INTO ${relation(rule.table)} (${foreignColumns.map((column) => quote(column.name)).join(',')}) VALUES (${foreignColumns.map((_, index) => `$${index + 1}`).join(',')})`,
                    foreignColumns.map((column) =>
                      syntheticParameter(column.type, foreign[column.name]),
                    ),
                  ),
                ),
                (error: unknown) => code(error) === '42501',
              )
              cases.push(`${actorClass}:EXISTING_FOREIGN_PARENT_INSERT_DENIED:${constraint}`)
            }
            cases.push(
              `${actorClass}:OWN_INSERT_ALLOWED_CONSTRAINT_VERIFIED_FOREIGN_AND_UNAUTHENTICATED_DENIED`,
            )
          }
          const fixtureColumns = columns.filter(
            (column) =>
              column.table === rule.table &&
              !column.generated &&
              !column.identity &&
              column.name in own.row,
          )
          for (const operation of [
            { privilege: 'SELECT', sql: `SELECT * FROM ${relation(rule.table)}`, parameters: [] },
            {
              privilege: 'UPDATE',
              sql: `UPDATE ${relation(rule.table)} SET ${quote(writable.name)}=$1`,
              parameters: [syntheticParameter(writable.type, own.row[writable.name])],
            },
            { privilege: 'DELETE', sql: `DELETE FROM ${relation(rule.table)}`, parameters: [] },
            {
              privilege: 'INSERT',
              sql: `INSERT INTO ${relation(rule.table)} (${fixtureColumns.map((column) => quote(column.name)).join(',')}) VALUES (${fixtureColumns.map((_, index) => `$${index + 1}`).join(',')})`,
              parameters: fixtureColumns.map((column) =>
                syntheticParameter(column.type, own.row[column.name]),
              ),
            },
          ].filter((operation) => !rule.runtimePrivileges.includes(operation.privilege))) {
            await assert.rejects(
              scoped(runtimeClient, 'union_eyes_runtime', own.party, () =>
                runtimeClient.query(operation.sql, operation.parameters),
              ),
              (error: unknown) => code(error) === '42501',
            )
            cases.push(`${actorClass}:SOURCE_UNAUTHORIZED_${operation.privilege}_DENIED`)
          }
          assert.equal(
            (
              await seedClient.query(`SELECT 1 FROM ${relation(rule.table)} WHERE ctid=$1::tid`, [
                own.row.ue_v2_ctid,
              ])
            ).rowCount,
            1,
            `UE_V2_ACTOR_FIXTURE_ROLLBACK_RESIDUE:${rule.table}:${actorClass}`,
          )
          cases.push(`${actorClass}:FIXTURE_MUTATIONS_ROLLED_BACK`)
        }
      }
      reports.push({ table: rule.table, status: 'PASS', cases })
    } catch (error: unknown) {
      reports.push({ table: rule.table, status: 'FAIL', cases, failure: failureText(error) })
    }
    yield reports[reports.length - 1]
  }
  for (const target of ['ue_v2_owner', 'union_eyes_system']) {
    await assert.rejects(
      runtimeClient.query(`SET ROLE ${quote(target)}`),
      (error: unknown) => code(error) === '42501',
    )
  }
  const qualified = reports.filter((report) => report.status === 'PASS').length
  const actorTables = relevant.filter(
    (rule) =>
      rule.classification !== 'FRAMEWORK_DEDICATED_EXECUTION_CONTEXT' &&
      rule.classification !== 'PLATFORM_METADATA_DEDICATED_EXECUTION_CONTEXT',
  )
  const actorQualified = actorTables.filter((rule) => {
    const report = reports.find((report) => report.table === rule.table)
    return (
      report?.status === 'PASS' &&
      ['MEMBER', 'ORG_ADMIN', 'PLATFORM_ADMIN'].every((actorClass) =>
        report.cases.includes(`${actorClass}:FIXTURE_MUTATIONS_ROLLED_BACK`),
      )
    )
  }).length
  return {
    status: qualified === reports.length ? 'PASS_COMPONENT_MATRIX' : 'FAIL',
    denominator: relevant.length,
    qualified,
    failed: reports.length - qualified,
    reports,
    syntheticOnly: true,
    realLeastPrivilegeLoginUsed: true,
    ...(systemContracts
      ? {
          nativeSystemMutationQualification: {
            result: qualified === relevant.length ? 'PASS' : 'FAIL',
            sourcePlanDigest: hash(JSON.stringify(plan)),
            contractDigest: hash(JSON.stringify(systemContracts)),
            denominator: relevant.length,
            qualified,
            sourceAuthorizedPrivilegesOnly: true,
            callerContracts: systemContracts,
            actualCallerExecution: 'NOT_PROVEN',
            wholeSecurityQualification: 'NOT_PROVEN',
          },
        }
      : {}),
    nativeActorClassQualification: {
      result: plan.authExecution && actorQualified === actorTables.length ? 'PASS' : 'NOT_PROVEN',
      requiredClasses: ['MEMBER', 'ORG_ADMIN', 'PLATFORM_ADMIN', 'UNAUTHENTICATED'],
      denominator: actorTables.length,
      qualified: actorQualified,
      sourceAuthorizedPrivilegesOnly: true,
      databaseActorBinding: 'LIVE_CANONICAL_USER_MEMBERSHIP_AND_SESSION',
      applicationActorMapping: 'NOT_PROVEN',
    },
    applicationActorMapping: 'NOT_PROVEN',
    insertAndAllActorClasses: 'NOT_PROVEN',
    wholeSecurityQualification: 'NOT_PROVEN',
  }
}

export async function proveRuntimeSecurity(
  ...args: Parameters<typeof iterateRuntimeSecurityReports>
) {
  const iterator = iterateRuntimeSecurityReports(...args)
  let next = await iterator.next()
  while (!next.done) next = await iterator.next()
  return next.value
}
