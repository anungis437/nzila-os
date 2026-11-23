/** The transaction executor for the bounded V2 forward upgrade. No business
 * DML, table drops, session termination, seed or database rebuild is supported. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type pg from 'pg'
import { canonicalCatalogObject } from '../../../apps/union-eyes/scripts/bootstrap-v2/catalog-normalization'
import { qualifyManagedPg16Catalog } from './ue-managed-pg16-catalog.mjs'
import {
  admissionQueries,
  assessCatalogAdmission,
} from '../../../apps/union-eyes/lib/operations/catalog-admission-core.mjs'
import {
  canonicalCatalogContract,
  inspectCanonicalAuthCatalog,
} from '../../../apps/union-eyes/lib/operations/canonical-catalog-admission'
import type { UpgradeObject, UpgradeStatement } from './ue-v2-forward-upgrade'

export interface ForwardUpgradeBundle {
  version: 1
  applicationSourceSha: string
  catalogSourceSha: string
  sourcePlanDigest: string
  catalogQueries: string[]
  before: UpgradeObject[]
  target: UpgradeObject[]
  statements: UpgradeStatement[]
}
const stable = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(stable)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, stable(x)]),
        )
      : v
export const forwardDigest = (v: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(stable(v)) ?? 'undefined')
    .digest('hex')
const q = (s: string) => {
  assert(s && !s.includes('\0'), 'UE_UPGRADE_EMPTY_IDENTIFIER')
  return '"' + s.replaceAll('"', '""') + '"'
}
const objectKey = (o: Pick<UpgradeObject, 'kind' | 'id'>) => `${o.kind}|${o.id}`
const uniqueKey = (o: { kind: string; id: string; definition: unknown }) => {
  if (o.kind !== 'role_membership') return objectKey(o)
  assert(o.definition && typeof o.definition === 'object' && 'grantor' in o.definition)
  return objectKey(o) + `|${String(o.definition.grantor)}`
}
export const FORWARD_EVENT_CATALOG_QUERY = `SELECT 'event_trigger' AS kind,e.evtname AS id,jsonb_build_object(
  'event',e.evtevent,'enabled',e.evtenabled,'tags',e.evttags,'function',n.nspname||'.'||p.proname,
  'function_owner',pg_get_userbyid(p.proowner),'owner',pg_get_userbyid(e.evtowner)) AS definition
  FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid JOIN pg_namespace n ON n.oid=p.pronamespace ORDER BY e.evtname`

const operatorQuery = `SELECT current_user::text AS actor,session_user::text AS session,
  current_database() AS database,current_setting('server_version_num')::int AS version,
  r.rolsuper,r.rolbypassrls,r.rolcanlogin,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolinherit
  FROM pg_roles r WHERE r.rolname=session_user`

export interface ForwardOperatorProfile {
  actor: string
  session: string
  database: string
  version: number
  rolsuper: boolean
  rolbypassrls: boolean
  rolcanlogin: boolean
  rolcreatedb: boolean
  rolcreaterole: boolean
  rolreplication: boolean
  rolinherit: boolean
}

export function assertForwardOperator(profile: ForwardOperatorProfile | undefined) {
  assert(profile, 'UE_UPGRADE_OPERATOR_PROFILE_MISSING')
  assert.equal(profile.actor, 'uev2admin', 'UE_UPGRADE_OPERATOR_ACTOR_REFUSED')
  assert.equal(profile.session, 'uev2admin', 'UE_UPGRADE_OPERATOR_LOGIN_REFUSED')
  assert.equal(profile.database, 'ue_v2_staging', 'UE_UPGRADE_OPERATOR_DATABASE_REFUSED')
  assert(
    profile.version >= 160000 && profile.version < 170000,
    'UE_UPGRADE_OPERATOR_VERSION_REFUSED',
  )
  assert.equal(profile.rolsuper, false, 'UE_UPGRADE_OPERATOR_SUPERUSER_REFUSED')
  // The existing Azure administrator can already have BYPASSRLS. This is the
  // bounded DDL operator, never an application principal. Do not change its
  // attributes to manufacture the local fixture's profile. Both profiles are
  // proved natively; every original attribute is checked again before return.
  for (const attribute of [
    'rolbypassrls',
    'rolcanlogin',
    'rolcreatedb',
    'rolcreaterole',
    'rolreplication',
    'rolinherit',
  ] as const)
    assert.equal(typeof profile[attribute], 'boolean', 'UE_UPGRADE_OPERATOR_ATTRIBUTE_MISSING')
  return profile
}
export function normalizeForwardCatalog(objects: UpgradeObject[]) {
  const result = objects
    .map((o) => canonicalCatalogObject(o))
    .sort((a, b) => uniqueKey(a).localeCompare(uniqueKey(b)))
  assert.equal(
    new Set(result.map(uniqueKey)).size,
    result.length,
    'UE_UPGRADE_DUPLICATE_CATALOG_OBJECT',
  )
  return result
}

export async function readForwardCatalog(
  client: pg.Client,
  queries: string[],
): Promise<UpgradeObject[]> {
  const objects: UpgradeObject[] = []
  for (const sql of queries) objects.push(...(await client.query<UpgradeObject>(sql)).rows)
  return objects.sort((a, b) => objectKey(a).localeCompare(objectKey(b)))
}

export async function assertForwardPreimage(client: pg.Client, bundle: ForwardUpgradeBundle) {
  const actual = await readForwardCatalog(client, bundle.catalogQueries)
  assert.equal(
    forwardDigest(normalizeForwardCatalog(actual)),
    forwardDigest(normalizeForwardCatalog(bundle.before)),
    'UE_UPGRADE_LIVE_PREIMAGE_CHANGED',
  )
  return actual
}

interface StoredRelation {
  schema: string
  table: string
  owner: string
  force: boolean
  columns: string[]
}
const storageQuery = `SELECT n.nspname AS schema,c.relname AS table,pg_get_userbyid(c.relowner) AS owner,c.relforcerowsecurity AS force,
  ARRAY(SELECT a.attname::text FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum) AS columns
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind IN('r','p') ORDER BY n.nspname,c.relname`

/** Only original columns enter the digest. Adding a nullable column must not
 * disguise any modification of the old row. All historical/receipt tables,
 * including tables outside the application's current plan, are covered. */
async function fingerprintRows(client: pg.Client, tables: StoredRelation[]) {
  const result: { table: string; rows: string; sha256: string }[] = []
  const current = new Map(
    (await client.query<StoredRelation>(storageQuery)).rows.map((t) => [
      `${t.schema}.${t.table}`,
      t,
    ]),
  )
  for (const table of tables) {
    const live = current.get(`${table.schema}.${table.table}`)
    assert(
      live && table.columns.every((c) => live.columns.includes(c)),
      'UE_UPGRADE_ORIGINAL_COLUMNS_MISSING',
    )
    assert(
      ['ue_v2_owner', 'uev2admin'].includes(live.owner),
      `UE_UPGRADE_UNRECOGNIZED_DATA_OWNER:${table.schema}.${table.table}`,
    )
    await client.query(live.owner === 'uev2admin' ? 'RESET ROLE' : 'SET LOCAL ROLE ue_v2_owner')
    const name = `${q(table.schema)}.${q(table.table)}`
    // Every relation is ACCESS EXCLUSIVE locked before this uncommitted change.
    // Other sessions cannot observe or use the temporary owner-only read. FORCE
    // is restored in the same transaction before any admission or commit.
    if (live.force) await client.query(`ALTER TABLE ${name} NO FORCE ROW LEVEL SECURITY`)
    const rows = (
      await client.query<{ rows: string; sha256: string }>(`SELECT count(*)::text AS rows,
      pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(COALESCE(pg_catalog.jsonb_agg(d.original_row
        ORDER BY d.original_row),'[]'::jsonb)::text,'UTF8')),'hex') AS sha256
      FROM (SELECT pg_catalog.to_jsonb(ARRAY[${table.columns.map((c) => q(c) + '::text').join(',')}])::text AS original_row FROM ONLY ${name}) d`)
    ).rows
    assert.equal(rows.length, 1, 'UE_UPGRADE_ROW_FINGERPRINT_MISSING')
    result.push({ table: `${table.schema}.${table.table}`, ...rows[0] })
    if (live.force) await client.query(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`)
  }
  return result
}

async function fingerprintSequences(client: pg.Client) {
  const sequences = (
    await client.query<{
      schema: string
      name: string
      owner: string
    }>(`SELECT n.nspname AS schema,c.relname AS name,
    pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind='S' ORDER BY 1,2`)
  ).rows
  const result = []
  for (const seq of sequences) {
    assert(['ue_v2_owner', 'uev2admin'].includes(seq.owner), 'UE_UPGRADE_SEQUENCE_OWNER_REFUSED')
    await client.query(seq.owner === 'uev2admin' ? 'RESET ROLE' : 'SET LOCAL ROLE ue_v2_owner')
    const rows = (
      await client.query(`SELECT last_value::text,is_called FROM ${q(seq.schema)}.${q(seq.name)}`)
    ).rows
    assert.equal(rows.length, 1)
    result.push({ schema: seq.schema, name: seq.name, ...rows[0] })
  }
  return result
}

export async function verifyForwardTarget(
  client: pg.Client,
  bundle: ForwardUpgradeBundle,
  phase: 'RESTORE_OPEN' | 'FINAL' = 'FINAL',
) {
  const actual = await readForwardCatalog(client, bundle.catalogQueries)
  const targetKeys = new Set(bundle.target.map(objectKey))
  const retired = new Set(
    bundle.statements
      .filter((s) => ['retire-function', 'retire-policy'].includes(s.phase))
      .map((s) => `${s.phase === 'retire-function' ? 'function' : 'policy'}|${s.object}`),
  )
  const retained = bundle.before.filter(
    (o) =>
      o.kind !== 'role_membership' && !targetKeys.has(objectKey(o)) && !retired.has(objectKey(o)),
  )
  // Retained historical objects are explicit reference entries; they are never
  // ignored by a comparison or assumed empty. Their complete definitions stay.
  const reference = normalizeForwardCatalog([...bundle.target, ...retained])
  const normalized = normalizeForwardCatalog(actual)
  const operator = (
    await client.query(`SELECT rolname AS name,rolsuper AS superuser,rolcanlogin AS login,
    rolcreatedb AS createdb,rolcreaterole AS createrole FROM pg_roles WHERE rolname='uev2admin'`)
  ).rows[0]
  const bootstrap = (
    await client.query(
      `SELECT rolname AS name,rolsuper AS superuser FROM pg_roles WHERE rolname='azuresu'`,
    )
  ).rows[0]
  const logins = [
    'ue_staging_runtime',
    'ue_staging_system',
    'ue_staging_auth',
    'ue_staging_auth_system',
  ]
  const loginRoles = (
    await client.query(
      `SELECT rolname AS name,rolcanlogin AS login,rolsuper AS superuser,rolbypassrls AS bypassrls,
    rolcreatedb AS createdb,rolcreaterole AS createrole,rolreplication AS replication,rolinherit AS inherit
    FROM pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname`,
      [logins],
    )
  ).rows
  const loginMemberships = (
    await client.query(
      `SELECT r.rolname AS role,u.rolname AS member,g.rolname AS grantor,
    m.admin_option AS admin,m.inherit_option AS inherit,m.set_option AS set
    FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member JOIN pg_roles g ON g.oid=m.grantor
    WHERE u.rolname=ANY($1::text[]) OR r.rolname=ANY($1::text[]) ORDER BY 1,2,3`,
      [logins],
    )
  ).rows
  const proof = qualifyManagedPg16Catalog({
    reference,
    actual: normalized,
    operator,
    bootstrap,
    loginRoles,
    loginMemberships,
    phase,
  })
  const snapshots: Record<string, Record<string, unknown>[]> = {}
  const execute = async (sql: string) => (await client.query(sql)).rows
  for (const query of admissionQueries) snapshots[query.name] = await execute(query.sql)
  const admission = assessCatalogAdmission(
    canonicalCatalogContract(),
    snapshots,
    'staging-forward-upgrade',
  )
  admission.violations.push(...(await inspectCanonicalAuthCatalog(execute, { postgresMajor: 16 })))
  assert.equal(
    admission.violations.length,
    0,
    'UE_UPGRADE_PACKAGED_ADMISSION_FAILED:' + admission.violations.join('|'),
  )
  return {
    phase,
    objects: actual.length,
    retainedObjects: retained.length,
    referenceDigest: proof.referenceSemanticDigest,
    actualDigest: proof.actualSemanticDigest,
  }
}

/** The caller begins/commits or rolls back. Even failure after the last DDL
 * statement must roll back. No exception is converted to a successful receipt. */
export async function executeForwardUpgrade(
  client: pg.Client,
  bundle: ForwardUpgradeBundle,
  options: { afterStatement?: (index: number) => void | Promise<void> } = {},
) {
  assert.equal(bundle.version, 1, 'UE_UPGRADE_BUNDLE_VERSION')
  const actor = assertForwardOperator(
    (await client.query<ForwardOperatorProfile>(operatorQuery)).rows[0],
  )
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('ue-v2-staging-forward-upgrade',0))",
  )
  await client.query("SET LOCAL lock_timeout='10s'")
  await client.query("SET LOCAL statement_timeout='60s'")
  await client.query('SET LOCAL search_path=pg_catalog,public')
  await client.query("SET LOCAL TIME ZONE 'UTC'")
  await client.query("SET LOCAL default_tablespace=''")
  await client.query("SET LOCAL default_table_access_method='heap'")
  // Read names/expressions as the schema owner so PostgreSQL's visibility-based
  // deparser uses the same identities as the real runtime's read-only preflight.
  // The one transaction-only bridge is an explicit preimage addition, not an
  // ignored catalog difference. It is removed before commit.
  await client.query('GRANT ue_v2_owner TO uev2admin WITH ADMIN FALSE, INHERIT FALSE, SET TRUE')
  await client.query('SET LOCAL ROLE ue_v2_owner')
  const beforeWithBridge = await readForwardCatalog(client, bundle.catalogQueries)
  const bridge: UpgradeObject = {
    kind: 'role_membership',
    id: 'ue_v2_owner:uev2admin',
    definition: {
      role: 'ue_v2_owner',
      member: 'uev2admin',
      grantor: 'uev2admin',
      admin: false,
      inherit: false,
      set: true,
    },
  }
  assert(
    !bundle.before.some(
      (o) => objectKey(o) === objectKey(bridge) && o.definition.grantor === 'uev2admin',
    ),
    'UE_UPGRADE_EXISTING_OPERATOR_BRIDGE_REFUSED',
  )
  assert.equal(
    forwardDigest(normalizeForwardCatalog(beforeWithBridge)),
    forwardDigest(normalizeForwardCatalog([...bundle.before, bridge])),
    'UE_UPGRADE_LIVE_PREIMAGE_CHANGED',
  )
  const before = bundle.before
  const events = before.filter((o) => o.kind === 'event_trigger')
  const expectedEvent = before.some(
    (o) => o.kind === 'function' && o.id === 'ue_guard_deadline_reassignment_convergence_policy()',
  )
  assert.equal(events.length, expectedEvent ? 1 : 0, 'UE_UPGRADE_DDL_EVENT_GUARDS_UNKNOWN')
  if (expectedEvent) {
    const event = events[0],
      meta = event.definition
    assert(
      event.id === 'ue_guard_deadline_reassignment_convergence_policy' &&
        meta.function === `public.${event.id}` &&
        meta.event === 'ddl_command_end' &&
        meta.enabled === 'O' &&
        meta.function_owner === 'uev2admin' &&
        typeof meta.owner === 'string' &&
        Array.isArray(meta.tags) &&
        forwardDigest([...meta.tags].sort()) === forwardDigest(['ALTER POLICY', 'CREATE POLICY']),
      'UE_UPGRADE_DDL_EVENT_GUARD_AUTHORITY_CHANGED',
    )
  }
  const operatorSchema = (
    await client.query(
      "SELECT has_schema_privilege('uev2admin','public','USAGE') AS usage,has_schema_privilege('uev2admin','public','CREATE') AS create",
    )
  ).rows[0]
  // Some historical public tables are still owned by the original operator,
  // after the public schema itself moved to the canonical database owner.
  // Temporary namespace access is needed even to lock those retained tables.
  if (!operatorSchema.usage) await client.query('GRANT USAGE ON SCHEMA public TO uev2admin')
  if (!operatorSchema.create) await client.query('GRANT CREATE ON SCHEMA public TO uev2admin')
  const tables = (await client.query<StoredRelation>(storageQuery)).rows
  assert(tables.length > 0, 'UE_UPGRADE_EXISTING_DATA_REQUIRED')
  // The original owner is delegated SET only for this transaction. The exact
  // managed creator edge from azuresu is retained when our own edge is revoked.
  for (const owner of ['uev2admin', 'ue_v2_owner']) {
    const owned = tables.filter((t) => t.owner === owner)
    if (!owned.length) continue
    await client.query(owner === 'uev2admin' ? 'RESET ROLE' : 'SET LOCAL ROLE ue_v2_owner')
    await client.query(
      `LOCK TABLE ${owned.map((t) => `${q(t.schema)}.${q(t.table)}`).join(',')} IN ACCESS EXCLUSIVE MODE`,
    )
  }
  assert(
    tables.every((t) => ['uev2admin', 'ue_v2_owner'].includes(t.owner)),
    'UE_UPGRADE_UNRECOGNIZED_DATA_OWNER',
  )
  const originalRows = await fingerprintRows(client, tables)
  const originalSequences = await fingerprintSequences(client)
  await client.query('RESET ROLE')
  const oldRoles = new Map(before.filter((o) => o.kind === 'role').map((o) => [o.id, o]))
  for (const role of bundle.target.filter((o) => o.kind === 'role')) {
    const previous = oldRoles.get(role.id)
    if (previous) {
      assert.equal(
        forwardDigest(previous.definition),
        forwardDigest(role.definition),
        'UE_UPGRADE_ROLE_ATTRIBUTE_CHANGE_REFUSED',
      )
      continue
    }
    assert.equal(role.id, 'ue_external_read_reader', 'UE_UPGRADE_NEW_ROLE_REFUSED')
    await client.query(
      'CREATE ROLE ue_external_read_reader NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE',
    )
  }
  await client.query(
    'GRANT ue_external_read_reader TO ue_v2_owner WITH ADMIN FALSE, INHERIT FALSE, SET TRUE',
  )
  await client.query('SET LOCAL ROLE ue_v2_owner')
  await client.query(
    'GRANT USAGE,CREATE ON SCHEMA public,user_management TO nzila_auth_org_authority_reader,nzila_auth_provider_reader,nzila_auth_risk_aggregate,ue_framework_authority_reader,ue_external_read_reader',
  )
  // This is pg_dump's standard forward-reference setting, not a runtime guard.
  await client.query('SET LOCAL check_function_bodies=false')
  for (const [index, statement] of bundle.statements.entries()) {
    const role = statement.role ?? 'ue_v2_owner'
    const retainedFunctionOwner =
      bundle.before.some(
        (o) => o.kind === 'function' && o.id === statement.object && o.definition.owner === role,
      ) &&
      ['retained-deadline-guard', 'reset-function-acl', 'retained-helper-acl'].includes(
        statement.phase,
      )
    const relationId =
      statement.phase === 'reset-column-acl'
        ? statement.object.split('.').slice(0, 2).join('.')
        : statement.object
    const retainedTableOwner =
      ['reset-table-acl', 'reset-column-acl'].includes(statement.phase) &&
      bundle.before.some(
        (o) => o.kind === 'relation' && o.id === relationId && o.definition.owner === role,
      )
    const retainedOwner = role === 'uev2admin' && (retainedFunctionOwner || retainedTableOwner)
    assert(
      retainedOwner || bundle.target.some((o) => o.kind === 'role' && o.id === role),
      'UE_UPGRADE_EXECUTOR_ROLE_REFUSED',
    )
    await client.query(`SET LOCAL ROLE ${q(role)}`)
    try {
      await client.query(statement.sql)
    } catch (error) {
      const code = (error as { code?: string }).code
      throw new Error(
        `UE_UPGRADE_STATEMENT_FAILED:${index}:${statement.phase}:${statement.object}:${code ?? 'UNKNOWN'}`,
      )
    }
    await options.afterStatement?.(index)
  }
  await client.query('SET LOCAL ROLE ue_v2_owner')
  const finalRows = await fingerprintRows(client, tables)
  const finalSequences = await fingerprintSequences(client)
  assert.equal(
    forwardDigest(finalRows),
    forwardDigest(originalRows),
    'UE_UPGRADE_ORIGINAL_ROWS_CHANGED',
  )
  assert.equal(
    forwardDigest(finalSequences),
    forwardDigest(originalSequences),
    'UE_UPGRADE_SEQUENCE_VALUES_CHANGED',
  )
  await client.query('SET LOCAL ROLE ue_v2_owner')
  if (!operatorSchema.usage) await client.query('REVOKE USAGE ON SCHEMA public FROM uev2admin')
  if (!operatorSchema.create) await client.query('REVOKE CREATE ON SCHEMA public FROM uev2admin')
  await client.query('RESET ROLE')
  await client.query('REVOKE ue_external_read_reader FROM ue_v2_owner GRANTED BY uev2admin')
  await client.query('SET LOCAL ROLE ue_v2_owner')
  const qualification = await verifyForwardTarget(client, bundle, 'RESTORE_OPEN')
  await client.query('RESET ROLE')
  await client.query('REVOKE ue_v2_owner FROM uev2admin GRANTED BY uev2admin')
  const leftover = (
    await client.query(`SELECT count(*)::int AS n FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid
    JOIN pg_roles u ON u.oid=m.member JOIN pg_roles g ON g.oid=m.grantor
    WHERE g.rolname='uev2admin' AND ((r.rolname='ue_v2_owner' AND u.rolname='uev2admin')
      OR (r.rolname='ue_external_read_reader' AND u.rolname='ue_v2_owner'))`)
  ).rows[0].n
  assert.equal(leftover, 0, 'UE_UPGRADE_TEMPORARY_BRIDGE_LEFT_BEHIND')
  const finalActor = assertForwardOperator(
    (await client.query<ForwardOperatorProfile>(operatorQuery)).rows[0],
  )
  assert.deepEqual(finalActor, actor, 'UE_UPGRADE_OPERATOR_ATTRIBUTES_CHANGED')
  return {
    operatorProfile: actor,
    operatorAttributesPreserved: true,
    qualification,
    originalTables: tables.length,
    originalRows: originalRows.reduce((n, t) => n + BigInt(t.rows), 0n).toString(),
    originalDataDigest: forwardDigest(originalRows),
    sequences: originalSequences.length,
    sequenceDigest: forwardDigest(originalSequences),
    statements: bundle.statements.length,
    planDigest: forwardDigest(bundle.statements),
    temporaryPrivilegesRemoved: true,
    liveDataDeleted: false,
  }
}
