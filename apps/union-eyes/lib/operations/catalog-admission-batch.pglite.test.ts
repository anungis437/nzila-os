import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_EXECUTION_ROLES } from '@nzila/db/auth-storage-authority'
import { admissionQueries, assessCatalogAdmission, catalogContractDigest, type CatalogRow } from './catalog-admission-core.mjs'
import { canonicalAdmissionQueriesForMajor, canonicalCatalogContract, CANONICAL_AUTH_QUERIES, inspectCanonicalAuthCatalog } from './canonical-catalog-admission'
import { catalogSnapshotExecutor, compileCatalogSnapshot } from './catalog-admission-batch'
import { CATALOG_POSTGRES_VERSION_QUERY, evaluateCatalogAdmission } from './catalog-admission'
import historicalContract from './catalog-authority-contract.json'
import { EXTERNAL_READ_OWNER } from '../external-resource-read/source'


// Independent brute-force SQL oracles: retain the original ordinary-column
// scan and policy values while checking the expanded security census too.
const legacyPolicyQuery = `SELECT relation.relname AS table_name,
                 pol.polname,
                 pol.polcmd,
                 pol.polpermissive,
                 0=ANY(pol.polroles) AS public_role,
                 pg_get_expr(pol.polqual, pol.polrelid) AS qual,
                 pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check,
                 COALESCE(array_agg(role.rolname) FILTER (WHERE role.rolname IS NOT NULL), ARRAY[]::name[]) AS roles
          FROM pg_policy pol
          JOIN pg_class relation ON relation.oid = pol.polrelid
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          LEFT JOIN pg_roles role ON role.oid = ANY (pol.polroles)
          WHERE namespace.nspname = 'public'
          GROUP BY relation.relname, pol.polname, pol.polcmd, pol.polpermissive, pol.polqual, pol.polwithcheck, pol.polrelid, pol.polroles`
const catalogRoles = [...Object.values(AUTH_EXECUTION_ROLES), 'union_eyes_runtime', 'union_eyes_system']
const catalogRoleLiterals = catalogRoles.map(role => `'${role}'`).join(',')
const legacyColumnsQuery = `SELECT r.rolname AS role,n.nspname AS schema_name,c.relname AS table_name,v.privilege,
    array_agg(a.attname::text ORDER BY a.attname) AS all_columns,
    COALESCE(array_agg(a.attname::text ORDER BY a.attname) FILTER (WHERE has_column_privilege(r.oid,c.oid,a.attnum,v.privilege)),ARRAY[]::text[]) AS allowed_columns
    FROM pg_roles r CROSS JOIN pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) v(privilege)
    WHERE r.rolname IN (${catalogRoleLiterals}) AND (n.nspname='user_management' OR
      (n.nspname='public' AND c.relname IN ('platform_identity_bindings','organization_members') AND r.rolname LIKE 'nzila_auth_%'))
      AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
    GROUP BY r.rolname,n.nspname,c.relname,v.privilege`
// Explicit system-column ACLs are now part of the source security contract.
// This remains the independent per-column has_column_privilege scan, rather
// than the production query's factored table-grant optimization.
const completeColumnsQuery = legacyColumnsQuery.replace('a.attnum>0', 'a.attnum<>0')

let database: PGlite | undefined
afterEach(async () => { vi.unstubAllEnvs(); await database?.close(); database = undefined })

const policyQuery = admissionQueries.find(query => query.name === 'policies')!.sql
const records = (rows: CatalogRow[]) => rows.map(row => JSON.stringify(row)).sort()
const policyIdentities = (rows: CatalogRow[]) => rows.map(row => `${row.table_name}\0${row.polname}`)

function expectPolicyValuesEqual(legacy: CatalogRow[], actual: CatalogRow[]) {
  const normalize = (rows: CatalogRow[]) => rows.map(row => {
    expect(Array.isArray(row.roles)).toBe(true)
    expect((row.roles as unknown[]).every(role => typeof role === 'string')).toBe(true)
    // Policies use an unordered role-membership list (length/includes in the
    // actual assessor). Preserve every member/duplicate; normalize no other array.
    return { ...row, roles: [...row.roles as string[]].sort() }
  })
  expect(records(normalize(actual))).toEqual(records(normalize(legacy)))
  return { rawPolicyRowOrderEqual: JSON.stringify(policyIdentities(actual)) === JSON.stringify(policyIdentities(legacy)) }
}

async function query(statement: string) {
  return (await database!.query<CatalogRow>(statement)).rows
}

// These fixtures create no auth functions. Explicitly declare that source fact
// for policy-only assessment; the immutable legacy production contract still
// fails closed when it has no current function authority.
const policyPayload = { ...historicalContract.payload, currentFunctions: [], requiredContainedParentPolicies: [], requiredPhysicalTriggers: [] }
const policyContract = { payload: policyPayload, digest: catalogContractDigest(policyPayload) }
async function assessFixture(execute: (statement: string) => Promise<CatalogRow[]>, canonical = false) {
  const snapshots: Record<string, CatalogRow[]> = {}
  for (const item of admissionQueries) snapshots[item.name] = await execute(item.sql)
  const report = assessCatalogAdmission(canonical ? canonicalCatalogContract() : policyContract, snapshots, 'local-catalog-transport-equivalence')
  if (canonical) {
    report.violations.push(...await inspectCanonicalAuthCatalog(execute, { postgresMajor: 16 }))
    report.ok = report.violations.length === 0
  }
  return report
}

describe('catalog snapshot PostgreSQL semantics', () => {
  it('preserves actual catalog scalar types, nulls, record keys and ordered text arrays', async () => {
    database = new PGlite()
    const statements = [
      `SELECT oid::text AS oid, relname::name AS name, relkind, relrowsecurity AS enabled,
        ARRAY['search_path=pg_catalog','b','a']::text[] AS settings, NULL::text AS absent,
        19::smallint AS trigger_type FROM pg_class ORDER BY oid DESC LIMIT 3`,
      `SELECT value FROM (VALUES ('second'),('first')) AS wanted(value) ORDER BY value DESC`,
      `SELECT oid::text AS oid FROM pg_class WHERE false`,
    ]
    const serial = await Promise.all(statements.map(statement => database!.query<CatalogRow>(statement).then(result => result.rows)))
    const batched = (await database.query<CatalogRow>(compileCatalogSnapshot(statements))).rows
    const replay = catalogSnapshotExecutor(statements, batched)
    for (let index = 0; index < statements.length; index++) {
      const actual = await replay(statements[index])
      expect(actual).toEqual(serial[index])
      if (actual.length) expect(Object.keys(actual[0])).toEqual(Object.keys(serial[index][0]))
    }
  }, 20_000)

  it('executes the legacy plan without requiring the absent canonical schema', async () => {
    database = new PGlite()
    await database.exec('CREATE ROLE union_eyes_runtime NOLOGIN; CREATE ROLE union_eyes_system NOLOGIN')
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const statements = admissionQueries.map(query => query.sql)
    // The source contract added current function descriptor inspection.
    // Existing core census plus the source-owned private execution role.
    // Fifteen core reads include the independent current physical-trigger census.
    expect(statements).toHaveLength(15)
    const serial = await evaluateCatalogAdmission(async statement => (await database!.query<CatalogRow>(statement)).rows)
    const envelope = (await database.query<CatalogRow>(compileCatalogSnapshot(statements))).rows
    expect(await evaluateCatalogAdmission(catalogSnapshotExecutor(statements, envelope))).toEqual(serial)
    expect(serial.ok).toBe(false)
    expect(serial.violations).toContain('current function source contract is missing')
    expect((await database.query("SELECT oid FROM pg_namespace WHERE nspname='user_management'")).rows).toEqual([])
  }, 20_000)

  it('compares all 61 source PG16 catalog reads while preserving rejection of the actual unsupported PGlite version', async () => {
    database = new PGlite()
    // Disposable local PostgreSQL catalog only; no Azure/live database or auth mock.
    for (const role of [...Object.values(AUTH_EXECUTION_ROLES), 'union_eyes_runtime', 'union_eyes_system']) {
      await database.exec(`CREATE ROLE "${role}" NOLOGIN`)
    }
    await database.exec(`CREATE ROLE "${EXTERNAL_READ_OWNER}" NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
    await database.exec('CREATE SCHEMA user_management')
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    vi.stubEnv('UE_ENVIRONMENT', 'local-catalog-transport-equivalence')
    // PGlite currently embeds a newer server. Use the explicit source dialect
    // for transport equivalence; never spoof the production version query.
    const version = Number((await query(CATALOG_POSTGRES_VERSION_QUERY))[0].server_version_num)
    expect(Number.isSafeInteger(version)).toBe(true)
    expect([15, 16]).not.toContain(Math.floor(version / 10000))
    await expect(evaluateCatalogAdmission(query)).rejects.toThrow('CANONICAL_POSTGRES_VERSION_UNSUPPORTED')
    const statements = [...admissionQueries.map(query => query.sql), ...canonicalAdmissionQueriesForMajor(16)]
    // Fourteen core reads, thirty existing canonical reads, seven protected
    // external reads and the additive contained-parent policy census.
    // The new physical contract contributes four reads plus the core trigger census; the audit author
    // guard (db/auth/audit-author-guards.ts) is a further physical contract with its own four reads.
    expect(statements).toHaveLength(61)
    const serialRows = new Map<string, CatalogRow[]>(), serialCalls: string[] = []
    const serialReport = await assessFixture(async statement => {
      serialCalls.push(statement)
      const rows = (await database!.query<CatalogRow>(statement)).rows
      serialRows.set(statement, rows)
      return rows
    }, true)
    // The read-only inspector can request source identities in a different
    // order than the batch pack. Preserve every identity and duplicate; the
    // replay below still checks exact SQL/hash, every row and the full verdict.
    expect([...serialCalls].sort()).toEqual([...statements].sort())
    const envelope = (await database.query<CatalogRow>(compileCatalogSnapshot(statements))).rows
    const replay = catalogSnapshotExecutor(statements, envelope)
    for (const statement of statements) expect(await replay(statement)).toEqual(serialRows.get(statement))
    const batchedReport = await assessFixture(replay, true)
    expect(batchedReport).toEqual(serialReport)
    // This intentionally incomplete local schema must remain inadmissible.
    expect(serialReport.ok).toBe(false)
    expect(batchedReport.violations).not.toHaveLength(0)
  }, 20_000)
})

describe('policy role-vector aggregation', () => {
  it('preserves every policy value, PUBLIC membership and role multiset across policy forms and owners', async () => {
    database = new PGlite()
    await database.exec(`CREATE ROLE policy_zeta NOLOGIN; CREATE ROLE policy_alpha NOLOGIN; CREATE ROLE policy_middle NOLOGIN;
      CREATE ROLE "policy spaced role" NOLOGIN; CREATE ROLE policy_owner_one NOLOGIN; CREATE ROLE policy_owner_two NOLOGIN;
      CREATE TABLE public.policy_public_cases(id integer); CREATE TABLE public.policy_single_cases(id integer); CREATE TABLE public."Policy Multi Cases"(id integer);
      ALTER TABLE public.policy_public_cases OWNER TO policy_owner_one; ALTER TABLE public.policy_single_cases OWNER TO policy_owner_two; ALTER TABLE public."Policy Multi Cases" OWNER TO policy_owner_one;
      ALTER TABLE public.policy_public_cases ENABLE ROW LEVEL SECURITY; ALTER TABLE public.policy_single_cases ENABLE ROW LEVEL SECURITY; ALTER TABLE public."Policy Multi Cases" ENABLE ROW LEVEL SECURITY;
      CREATE POLICY public_all ON public.policy_public_cases AS PERMISSIVE FOR ALL TO PUBLIC USING(id>0) WITH CHECK(id<100);
      CREATE POLICY public_select ON public.policy_public_cases AS RESTRICTIVE FOR SELECT TO PUBLIC USING(id>1);
      CREATE POLICY single_select ON public.policy_single_cases AS PERMISSIVE FOR SELECT TO policy_zeta USING(id>0);
      CREATE POLICY single_insert ON public.policy_single_cases AS PERMISSIVE FOR INSERT TO policy_alpha WITH CHECK(id>0);
      CREATE POLICY single_delete ON public.policy_single_cases AS RESTRICTIVE FOR DELETE TO "policy spaced role" USING(id>0);
      CREATE POLICY multi_forward ON public."Policy Multi Cases" AS PERMISSIVE FOR ALL TO policy_zeta,policy_alpha,policy_middle USING(id>0) WITH CHECK(id<20);
      CREATE POLICY multi_reverse ON public."Policy Multi Cases" AS RESTRICTIVE FOR ALL TO policy_middle,policy_alpha,policy_zeta USING(id>0) WITH CHECK(id<20);
      CREATE POLICY restrictive_update ON public."Policy Multi Cases" AS RESTRICTIVE FOR UPDATE TO policy_zeta USING(id>1) WITH CHECK(id<30);`)
    const legacy = await query(legacyPolicyQuery), actual = await query(policyQuery)
    expectPolicyValuesEqual(legacy, actual)
    expect(actual).toHaveLength(8)
    const policies = new Map(actual.map(row => [row.polname, row]))
    expect(policies.get('public_all')?.roles).toEqual([])
    expect(policies.get('public_select')?.roles).toEqual([])
    expect(policies.get('single_select')?.roles).toEqual(['policy_zeta'])
    expect(policies.get('single_insert')?.roles).toEqual(['policy_alpha'])
    expect(policies.get('single_delete')?.roles).toEqual(['policy spaced role'])
    expect(policies.get('multi_forward')?.roles).toEqual(['policy_alpha', 'policy_middle', 'policy_zeta'])
    expect(policies.get('multi_reverse')?.roles).toEqual(policies.get('multi_forward')?.roles)
    expect(policies.get('single_select')?.qual).not.toBeNull()
    expect(policies.get('single_select')?.with_check).toBeNull()
    expect(policies.get('single_insert')?.qual).toBeNull()
    expect(policies.get('single_insert')?.with_check).not.toBeNull()
    expect(policies.get('public_all')?.qual).not.toBeNull()
    expect(policies.get('public_all')?.with_check).not.toBeNull()
    expect(policies.get('multi_forward')?.table_name).toBe('Policy Multi Cases')
    const owners = await query("SELECT pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'")
    expect(new Set(owners.map(row => row.owner))).toEqual(new Set(['policy_owner_one', 'policy_owner_two']))
    const kinds = await query('SELECT polname,polpermissive FROM pg_policy')
    expect(kinds.find(row => row.polname === 'multi_forward')?.polpermissive).toBe(true)
    expect(kinds.find(row => row.polname === 'multi_reverse')?.polpermissive).toBe(false)
  }, 20_000)

  it.each([
    { name: 'admits a scoped catalog', mutation: '', ok: true, violation: '' },
    { name: 'refuses a malicious PUBLIC grant', mutation: 'GRANT SELECT ON public.claims TO PUBLIC', ok: false, violation: 'PUBLIC holds SELECT on public.claims' },
    { name: 'refuses substituting a foreign runtime-policy role', mutation: 'ALTER POLICY claim_runtime ON public.claims TO policy_foreign', ok: false, violation: 'has no runtime SELECT policy' },
    { name: 'refuses a permissive true runtime policy', mutation: 'ALTER POLICY claim_runtime ON public.claims USING(true) WITH CHECK(true)', ok: false, violation: 'runtime policy claim_runtime is permissive' },
    { name: 'admits restored scoped authority', mutation: 'ALTER POLICY claim_runtime ON public.claims USING(true) WITH CHECK(true); ALTER POLICY claim_runtime ON public.claims USING(id>0) WITH CHECK(id>0)', ok: true, violation: '' },
  ])('$name using the unchanged actual assessor', async ({ mutation, ok, violation }) => {
    database = new PGlite()
    await database.exec(`CREATE ROLE union_eyes_runtime NOLOGIN; CREATE ROLE union_eyes_system NOLOGIN; CREATE ROLE policy_foreign NOLOGIN;
      CREATE SCHEMA user_management; CREATE SCHEMA audit_security;
      GRANT USAGE ON SCHEMA user_management TO union_eyes_runtime,union_eyes_system; GRANT USAGE ON SCHEMA audit_security TO union_eyes_runtime;
      CREATE TABLE public.claims(id integer); ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY; ALTER TABLE public.claims FORCE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE,DELETE ON public.claims TO union_eyes_runtime; GRANT SELECT ON public.claims TO union_eyes_system;
      CREATE POLICY claim_runtime ON public.claims FOR ALL TO union_eyes_runtime USING(id>0) WITH CHECK(id>0);
      CREATE POLICY claim_system ON public.claims FOR SELECT TO union_eyes_system USING(id>0);`)
    if (mutation) await database.exec(mutation)
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    vi.stubEnv('UE_ENVIRONMENT', 'local-policy-catalog-regression')
    let legacyPolicies: CatalogRow[] = [], actualPolicies: CatalogRow[] = []
    const legacy = await assessFixture(async statement => {
      const rows = await query(statement === policyQuery ? legacyPolicyQuery : statement)
      if (statement === policyQuery) legacyPolicies = rows
      return rows
    })
    const actual = await assessFixture(async statement => {
      const rows = await query(statement)
      if (statement === policyQuery) actualPolicies = rows
      return rows
    })
    const { rawPolicyRowOrderEqual } = expectPolicyValuesEqual(legacyPolicies, actualPolicies)
    const { violations: legacyViolations, ...legacyDecision } = legacy
    const { violations: actualViolations, ...actualDecision } = actual
    expect(actualDecision).toEqual(legacyDecision)
    expect(actual.ok, actual.violations.join('\n')).toBe(ok)
    // SQL never ordered policy rows. A different violation order is permitted
    // only when those rows changed order; preserve every violation/duplicate.
    if (JSON.stringify(actualViolations) !== JSON.stringify(legacyViolations)) expect(rawPolicyRowOrderEqual).toBe(false)
    expect([...actualViolations].sort()).toEqual([...legacyViolations].sort())
    if (violation) expect(actualViolations.some(message => message.includes(violation))).toBe(true)
  }, 20_000)
})

describe('factored canonical column privilege inspection', () => {
  it('matches PostgreSQL column checks across grants, PUBLIC, inheritance, owners and relation forms', async () => {
    database = new PGlite()
    for (const role of catalogRoles) await database.exec(`CREATE ROLE "${role}" NOLOGIN`)
    await database.exec(`CREATE ROLE column_parent NOLOGIN; CREATE SCHEMA user_management;
      CREATE TABLE user_management.column_fixture(zeta integer,alpha integer,middle integer);
      CREATE TABLE user_management.zero_columns();
      CREATE TABLE public.platform_identity_bindings(zeta integer,alpha integer,middle integer);
      CREATE TABLE public.organization_members(zeta integer,alpha integer);
      CREATE TABLE public.excluded_public(zeta integer); CREATE VIEW user_management.excluded_view AS SELECT 1 AS zeta;`)
    const check = async (name: string) => {
      const legacy = await query(legacyColumnsQuery), actual = await query(CANONICAL_AUTH_QUERIES.columns)
      const complete = await query(completeColumnsQuery)
      expect(records(actual), `${name}: complete independent census`).toEqual(records(complete))
      const key = (row: CatalogRow) => [row.role, row.schema_name, row.table_name, row.privilege].join('\0')
      const original = new Map(legacy.map(row => [key(row), new Set(row.all_columns as string[])]))
      const ordinary = actual.filter(row => original.has(key(row))).map(row => ({ ...row,
        all_columns: (row.all_columns as string[]).filter(column => original.get(key(row))!.has(column)),
        allowed_columns: (row.allowed_columns as string[]).filter(column => original.get(key(row))!.has(column)),
      }))
      expect(records(ordinary), `${name}: unchanged ordinary-column semantics`).toEqual(records(legacy))
      expect(actual.some(row => ['excluded_public', 'excluded_view'].includes(String(row.table_name))), name).toBe(false)
      const systemOnly = actual.filter(row => row.table_name === 'zero_columns')
      expect(systemOnly.length, name).toBe(catalogRoles.length * 4)
      for (const row of systemOnly) expect(row.all_columns, name).toEqual(['cmax', 'cmin', 'ctid', 'tableoid', 'xmax', 'xmin'])
      expect(actual.some(row => row.schema_name === 'public' && ['union_eyes_runtime', 'union_eyes_system'].includes(String(row.role))), name).toBe(false)
      return ordinary
    }
    expect((await check('no grants')).every(row => (row.allowed_columns as string[]).length === 0)).toBe(true)
    await database.exec('GRANT SELECT(xmin) ON user_management.column_fixture TO nzila_auth_lookup')
    const ordinaryWithSystem = await check('explicit system-column-only SELECT')
    const lookupSelect = (rows: CatalogRow[]) => rows.find(row => row.role === 'nzila_auth_lookup' && row.table_name === 'column_fixture' && row.privilege === 'SELECT')!
    expect(lookupSelect(ordinaryWithSystem).allowed_columns).toEqual([])
    expect(lookupSelect(await query(CANONICAL_AUTH_QUERIES.columns)).allowed_columns).toEqual(['xmin'])
    await database.exec('REVOKE SELECT(xmin) ON user_management.column_fixture FROM nzila_auth_lookup')
    await check('revoked system-column-only SELECT')
    expect(lookupSelect(await query(CANONICAL_AUTH_QUERIES.columns)).allowed_columns).toEqual([])
    const changes = [
      { name: 'direct independent column grants for all four privileges', sql: 'GRANT SELECT(alpha),INSERT(middle),UPDATE(zeta),REFERENCES(alpha) ON user_management.column_fixture TO nzila_auth_gateway' },
      { name: 'PUBLIC column grant', sql: 'GRANT SELECT(middle) ON user_management.column_fixture TO PUBLIC' },
      { name: 'PUBLIC table grant', sql: 'GRANT REFERENCES ON user_management.column_fixture TO PUBLIC' },
      { name: 'inherited table grant', sql: 'REVOKE REFERENCES ON user_management.column_fixture FROM PUBLIC; GRANT SELECT,UPDATE ON user_management.column_fixture TO column_parent; ALTER ROLE nzila_auth_gateway INHERIT; GRANT column_parent TO nzila_auth_gateway' },
      { name: 'NOINHERIT membership', sql: 'ALTER ROLE nzila_auth_lookup NOINHERIT; GRANT column_parent TO nzila_auth_lookup' },
      { name: 'table grant is not negated by column revoke', sql: 'GRANT SELECT ON user_management.column_fixture TO nzila_auth_identity; REVOKE SELECT(alpha) ON user_management.column_fixture FROM nzila_auth_identity' },
      { name: 'relation ownership', sql: 'ALTER TABLE user_management.column_fixture OWNER TO nzila_auth_system_gateway' },
      { name: 'owner table privilege revoked with column grant retained', sql: 'REVOKE SELECT ON user_management.column_fixture FROM nzila_auth_system_gateway; GRANT SELECT(alpha) ON user_management.column_fixture TO nzila_auth_system_gateway' },
      { name: 'dropped column', sql: 'ALTER TABLE user_management.column_fixture DROP COLUMN middle' },
      { name: 'partitioned, quoted and generated columns', sql: `CREATE TABLE user_management.partition_parent(zeta integer,alpha integer) PARTITION BY RANGE(zeta);
          CREATE TABLE user_management.partition_child PARTITION OF user_management.partition_parent FOR VALUES FROM(0) TO(10);
          GRANT SELECT ON user_management.partition_parent TO nzila_auth_lookup;
          CREATE TABLE user_management."Quoted Table"("Zed Column" integer,"alpha column" integer);
          GRANT UPDATE("Zed Column") ON user_management."Quoted Table" TO nzila_auth_provider;
          CREATE TABLE user_management.generated_fixture(base integer,derived integer GENERATED ALWAYS AS(base+1) STORED);
          GRANT INSERT ON user_management.generated_fixture TO nzila_auth_tenant_admin;` },
      { name: 'public projections retain role filters and PUBLIC ACLs', sql: 'GRANT SELECT(alpha),UPDATE(zeta) ON public.platform_identity_bindings TO PUBLIC; GRANT SELECT ON public.organization_members TO nzila_auth_gateway' },
    ]
    for (const { name, sql } of changes) {
      await database.exec(sql)
      const rows = await check(name)
      if (name === 'PUBLIC column grant') expect(rows.filter(row => row.table_name === 'column_fixture' && row.privilege === 'SELECT').every(row => (row.allowed_columns as string[]).includes('middle'))).toBe(true)
      if (name === 'PUBLIC table grant') expect(rows.filter(row => row.table_name === 'column_fixture' && row.privilege === 'REFERENCES').every(row => (row.allowed_columns as string[]).length === 3)).toBe(true)
      if (name === 'dropped column') expect(rows.filter(row => row.table_name === 'column_fixture').every(row => !(row.all_columns as string[]).includes('middle'))).toBe(true)
    }
  }, 20_000)
})
