/**
 * Shared, synthetic catalogue sessions for the S2.02 tests. Shapes follow the operator in
 * ue-v2-staging-catalog-exec.mjs; no value here comes from a live database.
 */
import { createHash } from 'node:crypto'
import { CATALOG_SCHEMA, PRIVILEGED_LOGIN, RUNTIME_LOGIN, RUNTIME_ROLE, STATS_SETTLE_MS, sealForRecipient } from './ue-v2-staging-catalog-exec.mjs'

const sha = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')

export function fixtureQuery(id, rows) {
  return { id, rowCount: rows.length, rows }
}

export const FIXTURE_TABLES = [{ schema: 'public', name: 'members' }, { schema: 'public', name: 'claims' }]
export const FIXTURE_LEDGER = [{ id: 1, hash: 'abc', created_at: '1767225600000' }, { id: 2, hash: 'def', created_at: '1767312000000' }]
const STRUCTURE = [{ columns: 9, digest: 'f'.repeat(32) }]
const RELATIONS = [{ relations: 4, digest: 'e'.repeat(32), policy_digest: 'd'.repeat(32) }]

function sharedQueries(user) {
  return [
    fixtureQuery('migration_relations', [{ schema: 'drizzle', name: '__drizzle_migrations', schema_usage: user !== RUNTIME_ROLE, can_select: user !== RUNTIME_ROLE }]),
    fixtureQuery('migration_columns', [
      { table_schema: 'drizzle', table_name: '__drizzle_migrations', column_name: 'id', data_type: 'integer' },
      { table_schema: 'drizzle', table_name: '__drizzle_migrations', column_name: 'hash', data_type: 'text' },
      { table_schema: 'drizzle', table_name: '__drizzle_migrations', column_name: 'created_at', data_type: 'bigint' },
    ]),
    fixtureQuery('effective_roles', [{ rolname: user }]),
    fixtureQuery('structure', STRUCTURE),
    fixtureQuery('relation_metadata', RELATIONS),
    fixtureQuery('tables', FIXTURE_TABLES),
  ]
}

/** Plane A as staging actually is: the runtime role, forced RLS, no migration-ledger access. */
export function runtimeCatalog(overrides = {}) {
  const matrix = FIXTURE_TABLES.map((table) => ({ ...table, owner: 'ue_v2_owner', rls: true, force: true, schema_usage: true, can_select: table.name === 'members', acts_as_owner: false, rls_active: true }))
  return {
    schema: CATALOG_SCHEMA,
    plane: 'runtime',
    rolledBack: true,
    observedAt: '2026-11-26T10:00:00.000Z',
    snapshot: '900:900:',
    identity: { version: 'PostgreSQL 16', database: 'ue_v2_staging', user: RUNTIME_ROLE, session_user: RUNTIME_LOGIN, transaction_read_only: 'on', default_read_only: 'on', isolation: 'read committed' },
    privilege: { user: RUNTIME_ROLE, login: RUNTIME_LOGIN, rolsuper: false, rolbypassrls: false, loginBypassrls: false, classification: 'LIMITED_RUNTIME', readOnlyCredential: false },
    queries: [
      fixtureQuery('identity', [{ version: 'PostgreSQL 16', database: 'ue_v2_staging', user: RUNTIME_ROLE, session_user: RUNTIME_LOGIN, transaction_read_only: 'on' }]),
      ...sharedQueries(RUNTIME_ROLE),
      fixtureQuery('roles', [{ rolname: RUNTIME_ROLE, rolsuper: false, rolbypassrls: false, rolcanlogin: false }]),
      fixtureQuery('memberships', []),
      fixtureQuery('relations', FIXTURE_TABLES.map((table) => ({ ...table, relkind: 'r' }))),
      fixtureQuery('rls', FIXTURE_TABLES.map((table) => ({ ...table, relrowsecurity: true, relforcerowsecurity: true }))),
      fixtureQuery('policies', []),
      fixtureQuery('function', [{ schema: 'user_management', name: 'auth_business_org_authorized', args: 'uuid, text[]' }]),
      fixtureQuery('security_definer', []),
      fixtureQuery('event_trigger', [{ evtname: 'ue_guard_deadline_reassignment_convergence_policy', evtenabled: 'O' }]),
      fixtureQuery('audit', [{ schema: 'audit_security', rel: 'audit_logs', schema_usage: false, current_select: false, current_insert: false }]),
      fixtureQuery('audit_grants', [{ rolname: 'uev2admin', privilege_type: 'SELECT' }]),
      fixtureQuery('sequences', []),
      fixtureQuery('privilege_matrix', matrix),
      { id: 'drizzle_rows', classification: 'PRIVILEGE_DENIED', reason: 'MIGRATION_LEDGER_NOT_READABLE_BY_ROLE' },
    ],
    counts: [
      { schema: 'public', name: 'members', countScope: 'ROLE_VISIBLE', visibleToConnectedRole: true, globalTotal: false, classification: 'OBSERVED', n: '0' },
      { schema: 'public', name: 'claims', countScope: null, visibleToConnectedRole: false, globalTotal: false, classification: 'PRIVILEGE_DENIED', reason: 'NO_SELECT_OR_SCHEMA_USAGE' },
    ],
    ...overrides,
  }
}

export const FIXTURE_COUNTS = { 'public.members': '41', 'public.claims': '7' }

export function modificationRows(change = 0) {
  return FIXTURE_TABLES.map((table, index) => ({ oid: String(16384 + index), ...table, ins: String(10 + index + change), upd: '0', del: '0', filenode: String(16400 + index) }))
}

export function modificationDigest(rows) {
  return sha(rows.map((item) => [item.oid, item.schema, item.name, item.ins, item.upd, item.del, item.filenode].join(':')).join('\n'))
}

/** Plane B, opened form: the admin login with BYPASSRLS, one REPEATABLE READ transaction. */
export function privilegedCatalog(overrides = {}) {
  const matrix = FIXTURE_TABLES.map((table) => ({ ...table, owner: 'ue_v2_owner', rls: true, force: true, schema_usage: true, can_select: true, acts_as_owner: true, rls_active: false }))
  const tables = overrides.tables ?? FIXTURE_TABLES
  return {
    schema: CATALOG_SCHEMA,
    plane: 'privileged',
    rolledBack: true,
    observedAt: '2026-11-26T11:00:00.000Z',
    sessionEndedAt: '2026-11-26T11:00:03.000Z',
    snapshot: '1000:1000:',
    identity: { version: 'PostgreSQL 16', database: 'ue_v2_staging', user: PRIVILEGED_LOGIN, session_user: PRIVILEGED_LOGIN, transaction_read_only: 'on', default_read_only: 'on', isolation: 'repeatable read', track_counts: 'on', snapshot: '1000:1000:' },
    privilege: { user: PRIVILEGED_LOGIN, login: PRIVILEGED_LOGIN, rolsuper: false, rolbypassrls: true, loginBypassrls: true, classification: 'ELEVATED', readOnlyCredential: false },
    modificationDigest: modificationDigest(modificationRows()),
    settledModificationDigest: modificationDigest(modificationRows()),
    statsSettledMs: STATS_SETTLE_MS + 500,
    queries: [
      fixtureQuery('identity', [{ version: 'PostgreSQL 16', database: 'ue_v2_staging', user: PRIVILEGED_LOGIN, session_user: PRIVILEGED_LOGIN, transaction_read_only: 'on', isolation: 'repeatable read' }]),
      ...sharedQueries(PRIVILEGED_LOGIN).map((item) => item.id === 'tables' ? fixtureQuery('tables', tables) : item),
      fixtureQuery('privilege_matrix', matrix),
      { ...fixtureQuery('drizzle_rows', FIXTURE_LEDGER), ledgerDigest: sha(FIXTURE_LEDGER) },
      { id: 'modification_counters', rowCount: FIXTURE_TABLES.length, rowsSealed: true },
      { id: 'settled_counters', rowCount: FIXTURE_TABLES.length, rowsSealed: true },
    ],
    counts: tables.map((table) => ({ schema: table.schema, name: table.name, countScope: 'GLOBAL', visibleToConnectedRole: true, globalTotal: true, classification: 'OBSERVED', n: FIXTURE_COUNTS[`${table.schema}.${table.name}`] ?? '0' })),
    ...overrides,
  }
}

/** The same transformation the operator applies before anything leaves the container. */
export function sealPrivileged(opened, recipientPublicKey, { run = '45999999999', source = 'a'.repeat(40), counters = modificationRows(), settled = counters } = {}) {
  const catalog = structuredClone(opened)
  const sensitive = { counts: [], ledgers: [], modificationCounters: counters, settledCounters: settled }
  for (const count of catalog.counts) {
    if (count.classification === 'OBSERVED') {
      sensitive.counts.push({ schema: count.schema, name: count.name, n: count.n })
      count.n = null
      count.sealed = true
    }
  }
  const ledger = catalog.queries.find((item) => item.id === 'drizzle_rows')
  if (Array.isArray(ledger?.rows)) {
    sensitive.ledgers.push({ relation: 'drizzle.__drizzle_migrations', rows: ledger.rows })
    catalog.queries = catalog.queries.map((item) => item.id === 'drizzle_rows' ? { id: 'drizzle_rows', rowCount: ledger.rows.length, rowsSealed: true, ledgerDigest: sha(ledger.rows) } : item)
  }
  const aad = ['ue-v2-staging-catalog-sealed/v1', run, source, catalog.observedAt, catalog.snapshot, 'privileged', sha(JSON.stringify(catalog))].join('|')
  catalog.sealed = sealForRecipient(JSON.stringify(sensitive), recipientPublicKey, aad)
  return catalog
}
