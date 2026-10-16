import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const base = path.join(root, 'docs', 'union-eyes', 'reality-remediation')
const output = path.join(base, 'PHASE_1B_3C_A_RUNTIME_PROOF_PREFLIGHT')
const script = fileURLToPath(import.meta.url)
const hash = (value) => createHash('sha256').update(value).digest('hex')
const digest = (value) => hash(JSON.stringify(value))
const absolute = (file) => path.resolve(root, ...file.split('/'))
const inputNames = {
  B3A: 'PHASE_1B_3A_RLS_TENANT_ISOLATION_SURFACE_CENSUS',
  B3B: 'PHASE_1B_3B_STATIC_RLS_POLICY_CORRECTNESS_RECONCILIATION',
}
const frozenHashes = {
  B3A: '5755b17e89fbb81b3afb1b6fda4e18ba107153cd52680bad21041e466c13a883',
  B3B: 'd65dea976c169acb795c71e5c3491d6478d4dbe0859e9b3b17c6be4691c7f84b',
}
const inputs = Object.fromEntries(
  Object.entries(inputNames).map(([key, name]) => {
    const bytes = readFileSync(path.join(base, `${name}.json`))
    assert.equal(hash(bytes), frozenHashes[key], `FAIL_EVIDENCE_DRIFT: ${key}`)
    return [key, JSON.parse(bytes)]
  }),
)
const { B3A: a, B3B: b } = inputs
const items = b.fixedB3CRuntimeProofPacket.ITEMS
const counts = (records, key) =>
  records.reduce((result, record) => {
    result[record[key]] = (result[record[key]] ?? 0) + 1
    return result
  }, {})
const uniqueIds = (records, key, expected) => {
  const ids = new Set(records.map((record) => record[key]))
  assert.equal(ids.size, records.length, `Duplicate ${key}`)
  assert.ok(!ids.has(undefined), `Missing ${key}`)
  if (expected !== undefined) assert.equal(ids.size, expected)
  return ids
}
uniqueIds(items, 'RUNTIME_PROOF_ITEM_ID', 3124)
uniqueIds(a.relationalSecurityObjects, 'OBJECT_ID', 612)
uniqueIds(a.rlsPolicies, 'POLICY_ID', 1490)
assert.deepEqual(counts(items, 'EXECUTION_CLASSIFICATION'), {
  BLOCKED_BY_KNOWN_STATIC_DEFECT: 663,
  CATALOG_EVIDENCE_ONLY: 640,
  BLOCKED_BY_REQUIREMENT_DECISION: 1007,
  BLOCKED_BY_FIXTURE_OR_ENVIRONMENT_PRECONDITION: 814,
})
assert.equal(b.phaseStatus.PHASE_1B_3B, 'SOURCE_CEILING_ACCEPTED')
assert.equal(b.entryBoundarySourceRegistry.length, 1910)
assert.equal(b.sourceCeilings.length, 2656)
const missingRls = new Set(
  b.staticCorrectnessFindings
    .filter((finding) => finding.FINDING_CLASS === 'RLS_REQUIRED_BUT_NOT_DECLARED')
    .flatMap((finding) => finding.AFFECTED_OBJECT_IDS),
)
const mismatches = new Set(
  b.staticCorrectnessFindings
    .filter((finding) => finding.FINDING_CLASS === 'USING_EXPRESSION_OVERBROAD')
    .flatMap((finding) => finding.AFFECTED_OBJECT_IDS),
)
assert.equal(missingRls.size, 159)
assert.deepEqual(
  mismatches,
  new Set(['union-eyes::public.account_mappings', 'union-eyes::public.holidays']),
)
const scopes = {
  'union-eyes': 'b3ca_union_eyes',
  'financial-service': 'b3ca_financial_service',
}
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const identifier = (value) => `"${String(value).replaceAll('"', '""')}"`
const roles = items
  .filter((item) => item.PROOF_CLASS === 'BYPASSRLS_ROLE')
  .map((item) => item.SOURCE_REFERENCES.DATABASE_ROLE)
assert.equal(roles.length, 2)
const roleSql = roles
  .map((role) => `CREATE ROLE ${identifier(role)} NOLOGIN NOSUPERUSER NOBYPASSRLS;`)
  .join('\n')

const catalogQueries = [
  {
    CATALOG_QUERY_ID: 'IDENTITY',
    SQL: `SELECT current_database() AS database_name, current_user AS current_user,
      version() AS postgres_version, current_setting('search_path') AS search_path;`,
  },
  {
    CATALOG_QUERY_ID: 'ROLES',
    SQL: `SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit, rolconfig
      FROM pg_roles ORDER BY rolname;`,
  },
  {
    CATALOG_QUERY_ID: 'RELATIONS',
    SQL: `SELECT n.nspname AS schema_name, c.relname AS object_name, c.relkind,
      pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity, c.relforcerowsecurity,
      c.relacl::text AS acl,
      ARRAY(SELECT a.attname FROM pg_attribute a WHERE a.attrelid=c.oid
        AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum) AS columns
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog','information_schema')
        AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','f')
      ORDER BY n.nspname,c.relname;`,
  },
  {
    CATALOG_QUERY_ID: 'POLICIES',
    SQL: `SELECT schemaname, tablename, policyname, permissive, roles, cmd,
      qual, with_check FROM pg_policies ORDER BY schemaname,tablename,policyname;`,
  },
  {
    CATALOG_QUERY_ID: 'FUNCTIONS',
    SQL: `SELECT n.nspname AS schema_name, p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS arguments,
      pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS security_definer,
      p.proconfig AS settings, p.proacl::text AS acl,
      ARRAY(SELECT r.rolname FROM pg_roles r
        WHERE has_function_privilege(r.oid,p.oid,'EXECUTE') ORDER BY r.rolname) AS execute_roles
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid);`,
  },
  {
    CATALOG_QUERY_ID: 'PRIVILEGES',
    SQL: `SELECT n.nspname AS schema_name, c.relname AS object_name, r.rolname,
      has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
      has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
      has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,
      has_table_privilege(r.oid,c.oid,'UPDATE') AS can_update,
      has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
      WHERE c.relkind IN ('r','p','v','m','f')
        AND n.nspname NOT IN ('pg_catalog','information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND r.rolname IN (${roles.map(quote).join(',')})
      ORDER BY n.nspname,c.relname,r.rolname;`,
  },
  {
    CATALOG_QUERY_ID: 'SCHEMA_PRIVILEGES',
    SQL: `SELECT n.nspname AS schema_name, pg_get_userbyid(n.nspowner) AS owner,
      n.nspacl::text AS acl, r.rolname,
      has_schema_privilege(r.oid,n.oid,'USAGE') AS usage,
      has_schema_privilege(r.oid,n.oid,'CREATE') AS can_create
      FROM pg_namespace n CROSS JOIN pg_roles r
      WHERE n.nspname NOT IN ('pg_catalog','information_schema')
        AND n.nspname NOT LIKE 'pg_toast%' AND r.rolname IN (${roles.map(quote).join(',')})
      ORDER BY n.nspname,r.rolname;`,
  },
  {
    CATALOG_QUERY_ID: 'DEFAULT_PRIVILEGES',
    SQL: `SELECT pg_get_userbyid(d.defaclrole) AS role_name,
      COALESCE(n.nspname,'GLOBAL') AS schema_name,d.defaclobjtype,d.defaclacl::text AS acl
      FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
      ORDER BY role_name,schema_name,d.defaclobjtype;`,
  },
]

function docker(args, input) {
  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    input,
    timeout: 120000,
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.error) throw result.error
  return result
}

function checkedDocker(args, input) {
  const result = docker(args, input)
  if (result.status !== 0)
    throw new Error(`Docker command failed (${args[0]}): ${result.stderr.trim()}`)
  return result.stdout.trim()
}

function psql(name, database, sql) {
  assert.ok(Object.values(scopes).includes(database) || database === 'postgres')
  return docker(
    [
      'exec',
      '-i',
      name,
      'psql',
      '-X',
      '-q',
      '-U',
      'b3ca_bootstrap',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
      '-A',
      '-t',
      '-f',
      '-',
    ],
    sql,
  )
}

function jsonQuery(name, database, sql) {
  const body = sql.trim().replace(/;$/, '')
  const result = psql(
    name,
    database,
    `BEGIN READ ONLY;\nSELECT COALESCE(json_agg(q),'[]'::json) FROM (${body}) q;\nCOMMIT;`,
  )
  if (result.status !== 0) throw new Error(`Read-only baseline failed: ${result.stderr.trim()}`)
  const json = result.stdout.trim()
  assert.ok(json.startsWith('['), 'Catalog JSON missing')
  return JSON.parse(json)
}

function ownedContainer(name, runId) {
  assert.match(name, /^nzila-ue-b3ca-[a-f0-9]{12}-[12]$/)
  const label = checkedDocker([
    'inspect',
    '--format',
    '{{index .Config.Labels "nzila.ue.b3ca.run"}}',
    name,
  ])
  assert.equal(label, runId, 'Refusing to act on an unowned container')
}

function probeClientConstructors() {
  const source = `
    const assert = require('node:assert/strict');
    const net = require('node:net');
    let attemptedConnections = 0;
    net.Socket.prototype.connect = function () {
      attemptedConnections++;
      throw new Error('Client constructor probe must not open any connection');
    };
    const { createRequire } = require('node:module');
    const req = createRequire(${JSON.stringify(path.join(root, 'apps', 'union-eyes', 'package.json'))});
    (async () => {
      const postgres = req('postgres');
      const sql = postgres({host:'127.0.0.1',port:1,user:'${roles[0]}',
        database:'${scopes['union-eyes']}',max:1,prepare:false});
      assert.equal(typeof sql.begin,'function');
      await sql.end();
      const { Pool } = req('pg');
      const pool = new Pool({host:'127.0.0.1',port:1,user:'${roles[0]}',
        database:'${scopes['union-eyes']}',max:1});
      assert.equal(pool.totalCount,0);
      await pool.end();
      assert.equal(attemptedConnections,0);
      console.log(JSON.stringify({postgres:'CONSTRUCTED_OFFLINE',Pool:'CONSTRUCTED_OFFLINE',
        CONNECTIONS_ATTEMPTED:attemptedConnections}));
    })().catch(error => { console.error(error); process.exitCode=1; });
  `
  const result = spawnSync(process.execPath, ['-e', source], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Offline client probe failed: ${result.stderr.trim()}`)
  return JSON.parse(result.stdout.trim())
}

function runtimeCapture() {
  const contractPath = path.join(root, 'docker-compose.platform-authz-acceptance.yml')
  const contract = readFileSync(contractPath, 'utf8')
  assert.match(contract, /image: postgres:16-alpine/)
  const image = JSON.parse(checkedDocker(['image', 'inspect', 'postgres:16-alpine']))[0]
  assert.ok(image.Id.startsWith('sha256:'))
  const migrationInputs = a.metadata.MIGRATION_MANIFEST.map((entry) => {
    const bytes = readFileSync(absolute(entry.FILE))
    assert.equal(hash(bytes), entry.SHA256, `FAIL_EVIDENCE_DRIFT: ${entry.FILE}`)
    return { ...entry, SQL: bytes.toString('utf8') }
  })
  const runId = randomUUID().replaceAll('-', '').slice(0, 12)
  const lifecycle = []
  const passes = []
  for (const pass of [1, 2]) {
    const name = `nzila-ue-b3ca-${runId}-${pass}`
    let created = false
    try {
      assert.equal(checkedDocker(['ps', '-aq', '--filter', `name=^/${name}$`]), '')
      checkedDocker([
        'run',
        '--detach',
        '--name',
        name,
        '--label',
        `nzila.ue.b3ca.run=${runId}`,
        '--network',
        'none',
        '--tmpfs',
        '/var/lib/postgresql/data:rw,nosuid,nodev',
        '--env',
        'POSTGRES_USER=b3ca_bootstrap',
        '--env',
        'POSTGRES_HOST_AUTH_METHOD=trust',
        image.Id,
      ])
      created = true
      ownedContainer(name, runId)
      let responsive = false
      for (let attempt = 0; attempt < 30; attempt++) {
        const probe = docker(['exec', name, 'pg_isready', '-U', 'b3ca_bootstrap', '-d', 'postgres'])
        if (probe.status === 0) {
          responsive = true
          break
        }
        spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},1000)'])
      }
      assert.ok(responsive, 'Disposable PostgreSQL did not become responsive')
      const inspect = JSON.parse(checkedDocker(['inspect', name]))[0]
      assert.equal(inspect.HostConfig.NetworkMode, 'none')
      assert.deepEqual(inspect.HostConfig.PortBindings, {})
      assert.equal(inspect.Mounts.filter((mount) => mount.Type !== 'tmpfs').length, 0)
      const setup = psql(
        name,
        'postgres',
        `${roleSql}\n${Object.values(scopes)
          .map((database) => `CREATE DATABASE ${identifier(database)};`)
          .join('\n')}`,
      )
      if (setup.status !== 0) throw new Error(`Test-only bootstrap failed: ${setup.stderr.trim()}`)
      const scopeRecords = []
      for (const [scope, database] of Object.entries(scopes)) {
        assert.equal(
          jsonQuery(name, database, catalogQueries[2].SQL).length,
          0,
          'Reset/creation is not a clean user-schema baseline',
        )
        const migrations = migrationInputs.filter(
          (entry) => (scope === 'financial-service') === entry.FILE.includes('/financial-service/'),
        )
        const applications = []
        let failure = null
        for (const entry of migrations) {
          const result = psql(name, database, entry.SQL)
          const applied = result.status === 0
          applications.push({
            FILE: entry.FILE,
            SHA256: entry.SHA256,
            LINEAGE: entry.LINEAGE,
            RESULT: applied ? 'APPLIED' : 'FAILED_POSSIBLY_PARTIALLY_APPLIED',
            DIAGNOSTIC: result.stderr.trim(),
          })
          if (!applied) {
            failure = {
              FILE: entry.FILE,
              ERROR: result.stderr.trim(),
              REMAINING_MIGRATIONS_NOT_ATTEMPTED: migrations
                .slice(applications.length)
                .map((migration) => migration.FILE),
            }
            break
          }
        }
        const snapshot = Object.fromEntries(
          catalogQueries.map((query) => [
            query.CATALOG_QUERY_ID,
            jsonQuery(name, database, query.SQL),
          ]),
        )
        scopeRecords.push({
          DATABASE_SCOPE: scope,
          DATABASE_NAME: database,
          SCHEMA_REPLAY_COMPLETE: failure === null,
          APPLICATIONS: applications,
          FAILURE: failure,
          CATALOG_SNAPSHOT: snapshot,
        })
      }
      const contextSql = `BEGIN READ ONLY;
        SELECT set_config('app.current_user_id','00000000-0000-4000-8000-000000000101',true),
          set_config('app.current_org_id','00000000-0000-4000-8000-000000000001',true);
        SELECT current_setting('app.current_user_id',true),current_setting('app.current_org_id',true);
        ROLLBACK;
        SELECT COALESCE(current_setting('app.current_user_id',true),'')='',
          COALESCE(current_setting('app.current_org_id',true),'')='';`
      const contextResult = psql(name, scopes['union-eyes'], contextSql)
      const contextSupported =
        contextResult.status === 0 &&
        contextResult.stdout.includes(
          '00000000-0000-4000-8000-000000000101|00000000-0000-4000-8000-000000000001',
        ) &&
        contextResult.stdout.split(/\r?\n/).includes('t|t')
      assert.ok(contextSupported, 'Transaction-local set_config/reset baseline failed')
      passes.push({
        PASS: pass,
        CONTAINER_ID: inspect.Id,
        SCOPES: scopeRecords,
        CONTEXT_TRANSPORT_PROBE: {
          SQL: contextSql,
          RESULT: 'PASS',
          CREDENTIAL_CLASS: 'BOOTSTRAP_CATALOG_ONLY',
          APPLICATION_WRAPPERS_EXECUTED: 'NO',
          CROSS_TENANT_ASSERTIONS_EXECUTED: 0,
        },
      })
      lifecycle.push({
        PASS: pass,
        CREATE: 'VERIFIED_CLEAN_TMPFS_NO_NETWORK_NO_PORTS',
        SCHEMA_REPLAY: scopeRecords.every((record) => record.SCHEMA_REPLAY_COMPLETE)
          ? 'PASS'
          : 'FAIL',
        FIXTURE_SEED: 'NOT_EXECUTED_NO_ACCEPTED_PER_OBJECT_FIXTURE_CONTRACT',
        BASELINE_CAPTURE: 'READ_ONLY_CAPTURED_AFTER_SETUP_STOPPED',
        CONTAINER_NAME: name,
      })
    } finally {
      if (created) {
        ownedContainer(name, runId)
        checkedDocker(['rm', '--force', name])
        assert.equal(
          checkedDocker([
            'ps',
            '-aq',
            '--filter',
            `label=nzila.ue.b3ca.run=${runId}`,
            '--filter',
            `name=^/${name}$`,
          ]),
          '',
        )
        const record = lifecycle.find((entry) => entry.PASS === pass)
        if (record) record.DESTROY = 'VERIFIED_ABSENT_NO_PERSISTENT_VOLUME'
      }
    }
  }
  assert.equal(
    digest(passes[0].SCOPES),
    digest(passes[1].SCOPES),
    'Reset/replay catalog or migration outcomes differed',
  )
  return {
    REUSED_HARNESS_PATTERN: 'scripts/platform-authz-acceptance.mjs',
    HARNESS_SELECTION:
      'Existing acceptance schema is a different slice; isolated lifecycle pattern reused, not its database.',
    EXISTING_HARNESS_CONTRACT_SHA256: hash(contract),
    POSTGRES_IMAGE_ID: image.Id,
    POSTGRES_IMAGE_REPOSITORY_DIGESTS: image.RepoDigests,
    MIGRATION_SET_DIGEST: digest(migrationInputs.map(({ SQL, ...entry }) => entry)),
    MIGRATION_MANIFEST: migrationInputs.map(({ SQL, ...entry }) => entry),
    LIFECYCLE: lifecycle,
    PASSES: passes,
    RESET_VERIFIED: true,
    TEARDOWN_VERIFIED: true,
    NO_SCHEMA_REPAIR_ATTEMPTED: true,
    CLIENT_CONSTRUCTOR_PROBE: probeClientConstructors(),
  }
}

function lineage(capture) {
  const records = capture.PASSES[0].SCOPES
  const relationKey = (scope, schema, name) => `${scope}::${schema}.${name}`
  const observed = records.flatMap((record) =>
    record.CATALOG_SNAPSHOT.RELATIONS.map((row) => ({
      ...row,
      OBJECT_ID: relationKey(record.DATABASE_SCOPE, row.schema_name, row.object_name),
    })),
  )
  const expected = new Set(a.relationalSecurityObjects.map((record) => record.OBJECT_ID))
  const actual = new Set(observed.map((record) => record.OBJECT_ID))
  const policies = records.flatMap((record) =>
    record.CATALOG_SNAPSHOT.POLICIES.map((row) => ({
      ...row,
      DATABASE_SCOPE: record.DATABASE_SCOPE,
    })),
  )
  const policyKey = (scope, schema, table, name) => `${scope}::${schema}.${table}::${name}`
  const actualPolicies = new Set(
    policies.map((record) =>
      policyKey(record.DATABASE_SCOPE, record.schemaname, record.tablename, record.policyname),
    ),
  )
  const expectedPolicies = new Set(
    a.rlsPolicies.map((record) =>
      policyKey(record.DATABASE_SCOPE, record.SCHEMA, record.OBJECT_NAME, record.POLICY_NAME),
    ),
  )
  return {
    EXPECTED_ACTIVE_POLICY_IDENTITIES: 1490,
    LOCAL_CATALOG_POLICY_IDENTITIES: policies.length,
    LOCAL_CATALOG_MATCHED_POLICY_IDENTITIES: [...expectedPolicies].filter((key) =>
      actualPolicies.has(key),
    ).length,
    LOCAL_CATALOG_MISSING_POLICY_IDENTITIES: [...expectedPolicies].filter(
      (key) => !actualPolicies.has(key),
    ),
    LOCAL_CATALOG_EXTRA_POLICY_IDENTITIES: [...actualPolicies].filter(
      (key) => !expectedPolicies.has(key),
    ),
    EXPECTED_RELATIONAL_OBJECTS: 612,
    LOCAL_CATALOG_MATCHED_OBJECTS: [...expected].filter((key) => actual.has(key)).length,
    LOCAL_CATALOG_MISSING_EXPECTED_OBJECTS: [...expected].filter((key) => !actual.has(key)),
    LOCAL_CATALOG_EXTRA_RELEVANT_OBJECTS: [...actual].filter((key) => !expected.has(key)),
    OBSERVED_RELATIONS: observed,
  }
}

function catalogEvidence(capture, model) {
  const observed = new Map(model.OBSERVED_RELATIONS.map((record) => [record.OBJECT_ID, record]))
  const objects = new Map(a.relationalSecurityObjects.map((record) => [record.OBJECT_ID, record]))
  const scopesByName = new Map(
    capture.PASSES[0].SCOPES.map((record) => [record.DATABASE_SCOPE, record]),
  )
  return items
    .filter((item) => item.EXECUTION_CLASSIFICATION === 'CATALOG_EVIDENCE_ONLY')
    .map((item) => {
      let queryIds, value, expected, result, limitation
      if (item.PROOF_CLASS === 'OWNER_RLS') {
        const object = objects.get(item.OBJECT_IDS[0])
        value = observed.get(object.OBJECT_ID) ?? null
        expected = {
          OBSERVED_RLS_STATE: object.OBSERVED_RLS_STATE,
          FORCE_ROW_LEVEL_SECURITY: object.FORCE_ROW_LEVEL_SECURITY,
          OWNER_IDENTITY: object.OWNER_IDENTITY,
          OWNER_RUNTIME_BEHAVIOR: 'NOT_EXECUTED',
        }
        queryIds = ['RELATIONS', 'ROLES', 'POLICIES', 'PRIVILEGES']
        if (value === null) result = 'NOT_PRESENT'
        else if (object.OBSERVED_RLS_STATE === 'RLS_ENABLED_AND_FORCED')
          result = value.relrowsecurity && value.relforcerowsecurity ? 'MATCH' : 'MISMATCH'
        else if (object.OBSERVED_RLS_STATE === 'NO_RLS_DECLARATION_OBSERVED')
          result = value.relrowsecurity ? 'MISMATCH' : 'MATCH'
        else result = 'STILL_UNRESOLVED'
        limitation =
          'Local owner and flags only. Owner bypass/FORCE behavior and production identity are not proven.'
      } else if (item.PROOF_CLASS === 'BYPASSRLS_ROLE') {
        value =
          capture.PASSES[0].SCOPES[0].CATALOG_SNAPSHOT.ROLES.find(
            (role) => role.rolname === item.SOURCE_REFERENCES.DATABASE_ROLE,
          ) ?? null
        expected = {
          DATABASE_ROLE: item.SOURCE_REFERENCES.DATABASE_ROLE,
          BYPASSRLS_EXPECTATION: 'SOURCE_CEILING_NO_ACCEPTED_NATIVE_ROLE_ATTRIBUTE',
        }
        queryIds = ['ROLES']
        result = value === null ? 'NOT_PRESENT' : 'STILL_UNRESOLVED'
        limitation =
          'Bounded test-only NOLOGIN/NOBYPASSRLS roles are not deployed client role identity.'
      } else {
        assert.equal(item.PROOF_CLASS, 'GRANT_EFFECT')
        const grant = b.grantReconciliation.find(
          (record) => record.GRANT_ID === item.SOURCE_REFERENCES.GRANT_ID,
        )
        assert.ok(grant)
        const snapshot = scopesByName.get(grant.DATABASE_SCOPE).CATALOG_SNAPSHOT
        expected = {
          GRANT_ID: grant.GRANT_ID,
          OPERATION: grant.OPERATION,
          GRANTEE: grant.GRANTEE,
          OBJECT_SCOPE_SOURCE: grant.OBJECT_SCOPE_SOURCE,
          PRIVILEGES_SOURCE: grant.PRIVILEGES_SOURCE,
          GRANT_OPTION: grant.GRANT_OPTION,
        }
        queryIds = ['PRIVILEGES', 'SCHEMA_PRIVILEGES', 'FUNCTIONS', 'DEFAULT_PRIVILEGES']
        value = {
          TABLE_PRIVILEGES: snapshot.PRIVILEGES.filter((row) => row.rolname === grant.GRANTEE),
          SCHEMA_PRIVILEGES: snapshot.SCHEMA_PRIVILEGES.filter(
            (row) => row.rolname === grant.GRANTEE,
          ),
          FUNCTION_EXECUTE: snapshot.FUNCTIONS.filter((row) =>
            row.execute_roles.includes(grant.GRANTEE),
          ),
          DEFAULT_PRIVILEGES: snapshot.DEFAULT_PRIVILEGES.filter(
            (row) => row.role_name === grant.GRANTEE,
          ),
        }
        result = 'STILL_UNRESOLVED'
        limitation =
          'Exact local ACL snapshot retained. Dynamic grant scope/effective role intent is not inferred; failed schema replay cannot establish accepted grant state.'
      }
      return {
        CATALOG_EVIDENCE_ITEM_ID: `UE-1B3CA-CATALOG-${hash(item.RUNTIME_PROOF_ITEM_ID).slice(0, 16)}`,
        RUNTIME_PROOF_ITEM_ID: item.RUNTIME_PROOF_ITEM_ID,
        OBJECT_IDS: item.OBJECT_IDS,
        CLIENT_IDS: item.CLIENT_IDS,
        POLICY_GROUP_IDS: item.POLICY_GROUP_IDS,
        CATALOG_FACT_REQUIRED: item.PROOF_CLASS,
        CATALOG_QUERY_ID: queryIds,
        OBSERVED_VALUE: value,
        EXPECTED_STATIC_VALUE: expected,
        RESULT: result,
        PARENT_RESOLUTION:
          result === 'MATCH'
            ? 'RESOLVED_BY_LOCAL_CATALOG'
            : ['NOT_PRESENT', 'MISMATCH'].includes(result)
              ? 'LOCAL_CATALOG_MISMATCH'
              : 'LOCAL_CATALOG_STILL_UNRESOLVED',
        LIMITATION: limitation,
      }
    })
}

function report(capture) {
  assert.equal(capture.PASSES.length, 2)
  assert.equal(digest(capture.PASSES[0].SCOPES), digest(capture.PASSES[1].SCOPES))
  assert.ok(capture.RESET_VERIFIED && capture.TEARDOWN_VERIFIED)
  const model = lineage(capture)
  const evidence = catalogEvidence(capture, model)
  uniqueIds(evidence, 'RUNTIME_PROOF_ITEM_ID', 640)
  const evidenceByItem = new Map(evidence.map((record) => [record.RUNTIME_PROOF_ITEM_ID, record]))
  const schemaComplete = capture.PASSES[0].SCOPES.every((record) => record.SCHEMA_REPLAY_COMPLETE)
  const ids = {
    ORG_A: '00000000-0000-4000-8000-000000000001',
    ORG_B: '00000000-0000-4000-8000-000000000002',
    USER_A1: '00000000-0000-4000-8000-000000000101',
    USER_A2: '00000000-0000-4000-8000-000000000102',
    USER_B1: '00000000-0000-4000-8000-000000000201',
    USER_B2: '00000000-0000-4000-8000-000000000202',
  }
  const fixtureManifest = {
    STATUS: 'PLANNED_IDS_ONLY_NOT_SEEDED',
    IDS: ids,
    MEMBERSHIP_PLAN: { USER_A1: 'ORG_A', USER_A2: 'ORG_A', USER_B1: 'ORG_B', USER_B2: 'ORG_B' },
    MEMBERSHIP_INVARIANTS_PROVEN: 'NO',
    FIXTURED_OBJECTS: [],
    FIXTURE_BLOCKED_OBJECTS: b.objectRecords.map((object) => ({
      OBJECT_ID: object.OBJECT_ID,
      REASONS: [
        ...object.FINDING_IDS.map((finding) => `FROZEN_FINDING:${finding}`),
        ...(!schemaComplete ? ['ACCEPTED_SCHEMA_REPLAY_INCOMPLETE'] : []),
        'NO_ACCEPTED_CONCRETE_ROW_FIXTURE_ALLOW_DENY_AND_RESET_CONTRACT',
      ],
    })),
    SEED_SQL: null,
    SEED_BLOCKER:
      'No rows inserted under bootstrap/owner credentials. No dummy table, historical-schema invention, broad grant or policy workaround is authorized.',
  }
  const reconciliation = items.map((item) => {
    const catalog = evidenceByItem.get(item.RUNTIME_PROOF_ITEM_ID)
    const classification = catalog
      ? {
          RESOLVED_BY_LOCAL_CATALOG: 'CATALOG_PROOF_COMPLETE_LOCAL_ENVIRONMENT',
          LOCAL_CATALOG_MISMATCH: 'CATALOG_MISMATCH_LOCAL_ENVIRONMENT',
          LOCAL_CATALOG_STILL_UNRESOLVED: 'CATALOG_UNRESOLVED_LOCAL_ENVIRONMENT',
        }[catalog.PARENT_RESOLUTION]
      : item.EXECUTION_CLASSIFICATION
    const reason = catalog
      ? catalog.LIMITATION
      : item.EXECUTION_CLASSIFICATION === 'BLOCKED_BY_KNOWN_STATIC_DEFECT'
        ? 'Frozen static defect blocker retained; no execution or repair.'
        : item.EXECUTION_CLASSIFICATION === 'BLOCKED_BY_REQUIREMENT_DECISION'
          ? 'Frozen requirement blocker retained; no business-policy decision invented.'
          : 'Local transport alone is insufficient: accepted schema replay/fixture rows, relevant application-client/context wrappers and concrete allow/deny/reset contracts are not established.'
    return {
      RUNTIME_PROOF_ITEM_ID: item.RUNTIME_PROOF_ITEM_ID,
      PROOF_CLASS: item.PROOF_CLASS,
      OBJECT_IDS: item.OBJECT_IDS,
      POLICY_GROUP_IDS: item.POLICY_GROUP_IDS,
      CLIENT_IDS: item.CLIENT_IDS,
      INPUT_CLASSIFICATION: item.EXECUTION_CLASSIFICATION,
      EXECUTION_CLASSIFICATION: classification,
      CATALOG_EVIDENCE_ITEM_ID: catalog?.CATALOG_EVIDENCE_ITEM_ID ?? null,
      REASON: reason,
      EXECUTED: 'NO',
    }
  })
  const classes = {
    READY_FOR_RUNTIME_PROOF: 0,
    BLOCKED_BY_KNOWN_STATIC_DEFECT: 0,
    BLOCKED_BY_REQUIREMENT_DECISION: 0,
    BLOCKED_BY_FIXTURE_OR_ENVIRONMENT_PRECONDITION: 0,
    CATALOG_PROOF_COMPLETE_LOCAL_ENVIRONMENT: 0,
    CATALOG_MISMATCH_LOCAL_ENVIRONMENT: 0,
    CATALOG_UNRESOLVED_LOCAL_ENVIRONMENT: 0,
    ...counts(reconciliation, 'EXECUTION_CLASSIFICATION'),
  }
  const failedSchema = capture.PASSES[0].SCOPES.filter((record) => record.FAILURE).map(
    (record) => ({
      DATABASE_SCOPE: record.DATABASE_SCOPE,
      ...record.FAILURE,
    }),
  )
  const result = {
    metadata: {
      PHASE: 'PHASE_1B_3C_A_RUNTIME_PROOF_PREFLIGHT',
      INPUT_SHA256: frozenHashes,
      B3B_REGENERATED: 'NO',
      HARNESS_VERSION_DIGEST: hash(readFileSync(script)),
      EVIDENCE_SCOPE: 'LOCAL_ISOLATED_DISPOSABLE_DATABASE_ONLY',
      NO_PRODUCTION_STAGING_OR_SHARED_DATABASE_CONNECTIONS: true,
      NOTE: 'A failed exact schema replay is reported, never repaired or treated as a faithful accepted runtime environment.',
    },
    environmentFingerprint: {
      POSTGRES_VERSION: capture.PASSES[0].SCOPES[0].CATALOG_SNAPSHOT.IDENTITY[0].postgres_version,
      DATABASE_NAME: scopes,
      DATABASE_SERVER_FINGERPRINT: capture.PASSES.map((pass) => pass.CONTAINER_ID),
      POSTGRES_IMAGE_ID: capture.POSTGRES_IMAGE_ID,
      POSTGRES_IMAGE_REPOSITORY_DIGESTS: capture.POSTGRES_IMAGE_REPOSITORY_DIGESTS,
      MIGRATION_SET_DIGEST: capture.MIGRATION_SET_DIGEST,
      POLICY_SET_DIGEST: digest(
        capture.PASSES[0].SCOPES.map((record) => record.CATALOG_SNAPSHOT.POLICIES),
      ),
      FIXTURE_MANIFEST_DIGEST: digest(fixtureManifest),
      CATALOG_SNAPSHOT_DIGEST: digest(
        capture.PASSES[0].SCOPES.map((record) => record.CATALOG_SNAPSHOT),
      ),
      HARNESS_VERSION_DIGEST: hash(readFileSync(script)),
      FINAL_DATABASE_STATE: 'DESTROYED_AFTER_CAPTURE',
    },
    databaseLifecycle: {
      PREREQUISITES: [
        'Docker Engine responsive with local postgres:16-alpine image',
        'Node and pnpm dependencies restored from repository lockfile',
        'Exact frozen B3A/B3B inputs and all 23 manifest file hashes',
      ],
      B3C_DB_CREATE:
        'node scripts/ue/prepare-runtime-tenant-isolation-proof.mjs --run (owned tmpfs container creation)',
      B3C_DB_APPLY_ACCEPTED_SCHEMA:
        'Same --run command: unmodified frozen manifest, separate logical-scope databases, stop each scope at first error',
      B3C_DB_SEED_FIXTURES:
        'NOT_EXECUTABLE: no accepted schema/row fixture contracts; no seed performed',
      B3C_DB_VERIFY_BASELINE:
        'Same --run command: exact read-only catalogQueries and transaction-local context transport probe',
      B3C_DB_RESET:
        'Same --run command: destroy first owned container, create a second clean cluster, replay identical inputs',
      B3C_DB_DESTROY:
        'Same --run command: finally-guarded removal of each exact owned container, verify absence',
      MIGRATIONS_EXECUTED_LOCALLY: 'YES',
      LOCAL_MIGRATION_FILES_APPLIED: capture.PASSES[0].SCOPES.flatMap((record) =>
        record.APPLICATIONS.filter((entry) => entry.RESULT === 'APPLIED').map(
          (entry) => entry.FILE,
        ),
      ),
      MIGRATION_APPLICATIONS: capture.PASSES[0].SCOPES.map((record) => ({
        DATABASE_SCOPE: record.DATABASE_SCOPE,
        APPLICATIONS: record.APPLICATIONS,
      })),
      SCHEMA_REPLAY_FAILURES: failedSchema,
      RESET_VERIFIED: 'YES',
      TEARDOWN_VERIFIED: 'YES',
      EXECUTION_EVIDENCE: capture.LIFECYCLE,
      MIGRATION_SET_DIGEST: capture.MIGRATION_SET_DIGEST,
      PRODUCTION_DATABASE_TOUCHED: 'NO',
      STAGING_DATABASE_TOUCHED: 'NO',
      SHARED_DATABASE_TOUCHED: 'NO',
    },
    catalogQueries: catalogQueries.map((query) => ({
      ...query,
      TRANSACTION_MODE: 'BEGIN READ ONLY',
      QUERY_WRITES: 0,
    })),
    catalogEvidence: evidence,
    catalogBaseline: {
      ...model,
      OBSERVED_RELATIONS: undefined,
      SNAPSHOTS: capture.PASSES[0].SCOPES.map((record) => ({
        DATABASE_SCOPE: record.DATABASE_SCOPE,
        CATALOG_SNAPSHOT: record.CATALOG_SNAPSHOT,
      })),
      CATALOG_QUERY_WRITES: 0,
      CATALOG_DDL_EXECUTED_AFTER_BASELINE_SETUP: 0,
      LOCAL_SCHEMA_FIDELITY: schemaComplete
        ? 'CHECK_IDENTITY_DRIFT'
        : 'FAILED_EXACT_REPLAY_PARTIAL_CATALOG_ONLY',
    },
    fixtureManifest,
    databaseRoleFixtures: {
      SQL: roleSql,
      SCOPE: 'ISOLATED_CLUSTER_ONLY',
      ROLES: roles,
      CREDENTIAL_CLASS: 'NOLOGIN_NO_PASSWORD_NO_NATIVE_BYPASS',
      BOOTSTRAP_USER_USE:
        'Schema DDL and read-only catalog/transport only; never ordinary-path fixtures/tests',
      APPLICATION_ROLE_CONNECTIONS_ESTABLISHED: 'NO',
      TEARDOWN: 'Removal of owned tmpfs cluster; no host roles modified',
    },
    clientReadiness: b.databaseClientSourceContracts.map((client) => ({
      CLIENT_ID: client.DB_CLIENT_ID,
      CONSTRUCTOR: client.CONSTRUCTOR,
      LOCAL_RUNTIME_INSTANTIABLE: Object.hasOwn(
        capture.CLIENT_CONSTRUCTOR_PROBE,
        client.CONSTRUCTOR,
      )
        ? 'PARTIAL'
        : 'NO',
      CONSTRUCTOR_PROBE: Object.hasOwn(capture.CLIENT_CONSTRUCTOR_PROBE, client.CONSTRUCTOR)
        ? capture.CLIENT_CONSTRUCTOR_PROBE[client.CONSTRUCTOR]
        : 'NO_DJANGO_RUNTIME_ADAPTER',
      CONNECTIONS_ATTEMPTED: 0,
      LOCAL_CREDENTIAL_CLASS: 'NOT_ESTABLISHED_NOLOGIN_TEST_ROLES',
      CATALOG_ROLE: null,
      PRECONDITION_STATUS: 'BLOCKED',
      REASON:
        'Only installed JS constructors were instantiated offline with network connection attempts prohibited. Django has no local adapter in this harness. Application modules, credentials and local database connections remain unproven.',
    })),
    contextHarnessReadiness: b.contextPrimitiveSourceContracts.map((primitive) => ({
      CONTEXT_PRIMITIVE_ID: primitive.CONTEXT_PRIMITIVE_ID,
      ACCEPTED_VALUES_SET: primitive.VALUES_SET,
      CONTEXT_SET_SUPPORTED: 'TRANSPORT_ONLY',
      CONTEXT_CLEAR_SUPPORTED: 'TRANSPORT_ONLY',
      TRANSACTION_LOCAL_BEHAVIOR_OBSERVABLE: 'YES_TRANSPORT_ONLY',
      APPLICATION_PRIMITIVE_EXECUTED: 'NO',
      PRECONDITION_STATUS: 'BLOCKED_APPLICATION_WRAPPER_AND_ROLE_NOT_PROVEN',
      PROBE: capture.PASSES[0].CONTEXT_TRANSPORT_PROBE,
    })),
    connectionPoolHarnessReadiness: items
      .filter((item) => item.PROOF_CLASS === 'CONNECTION_POOL_CONTEXT_LEAKAGE')
      .map((item) => ({
        RUNTIME_PROOF_ITEM_ID: item.RUNTIME_PROOF_ITEM_ID,
        CLIENT_IDS: item.CLIENT_IDS,
        STATUS: 'NOT_ESTABLISHED',
        SAME_PHYSICAL_POOLED_CONNECTION_OBSERVED: 'NO',
        REASON:
          'Single-session psql context probe is not a relevant application connection pool. No pool leakage or cross-tenant assertion was executed.',
      })),
    runtimeProofItemReconciliation: reconciliation,
    readyRuntimeProofRegister: [],
    blockedRuntimeProofRegister: reconciliation
      .filter((item) => item.EXECUTION_CLASSIFICATION.startsWith('BLOCKED_'))
      .map((item) => ({
        ...item,
        FROZEN_PRECONDITIONS: items.find(
          (source) => source.RUNTIME_PROOF_ITEM_ID === item.RUNTIME_PROOF_ITEM_ID,
        ).REQUIRED_FIX_OR_ACCEPTANCE_PRECONDITION,
      })),
    carryForward: {
      PHASE_1B_3B: 'SOURCE_CEILING_ACCEPTED',
      INPUT_OBJECTS: 612,
      INPUT_ACTIVE_POLICY_IDENTITIES: 1490,
      FINAL_SERVER_ENTRY_DISPOSITIONS: b.entryBoundarySourceRegistry.length,
      KNOWN_REQUIRED_RLS_DECLARATION_GAP_OBJECTS: 159,
      KNOWN_NULLABLE_ORG_SEMANTIC_MISMATCH_OBJECTS: 2,
      B3B_CORRECTNESS_CEILING_RECORD_COUNT: b.sourceCeilings.length,
      PREDECESSOR_CARRY_FORWARD_SHA256: digest(b.predecessorCarryForward),
      PREDECESSOR_CARRY_FORWARD: b.predecessorCarryForward,
    },
    summary: {
      INPUT_RUNTIME_PROOF_ITEMS: 3124,
      CATALOG_ITEMS_INPUT: 640,
      CATALOG_PARENT_RESOLUTION: counts(evidence, 'PARENT_RESOLUTION'),
      POST_PREFLIGHT_CLASSIFICATION: classes,
      READY_RUNTIME_DENOMINATOR: 0,
      REMAINING_COMMAND_BLOCKER_DENOMINATOR: 2484,
      KNOWN_STATIC_DEFECT_BLOCKERS_REMAINING: 663,
      REQUIREMENT_DECISION_BLOCKERS_REMAINING: 1007,
      FIXTURE_ENVIRONMENT_ITEMS_REEVALUATED: 814,
      CATALOG_EVIDENCE_ITEM_RECORDS: 640,
      SCHEMA_REPLAY_COMPLETE: schemaComplete,
      SCHEMA_REPLAY_FAILURES: failedSchema,
    },
    validation: {
      FROZEN_INPUT_HASHES: 'PASS',
      EXACT_ITEM_ACCOUNTING: 'PASS',
      STATIC_BLOCKER_PRESERVATION: 'PASS',
      RESET_AND_REPLAY_COMPARISON: 'PASS',
      TEARDOWN_ABSENCE: 'PASS',
      SCHEMA_REPLAY: schemaComplete ? 'PASS' : 'FAIL',
      LOCAL_CATALOG_CAPTURE: 'PASS_PARTIAL_SCHEMA',
      TENANT_PROOF_CASES_EXECUTED: 0,
      MUTATING_PROOF_TESTS_EXECUTED: 0,
      STATIC_POLICY_FILES_CHANGED: 0,
      APPLICATION_BEHAVIOR_CHANGED: 'NO',
      BUSINESS_REQUIREMENTS_INVENTED: 0,
      FAILURE_IS_NOT_EVIDENCE_DRIFT_OR_STATIC_REOPENING: 'YES',
    },
    phaseStatus: {
      PHASE_1B_3C_A_GATE: 'FAIL',
      PHASE_1B_3C_A: 'BLOCKED_ACCEPTED_SCHEMA_AND_FIXTURE_PREFLIGHT',
      RUNTIME_PROOF_ENVIRONMENT: 'NOT_READY_FAITHFUL_SCHEMA_NOT_ESTABLISHED',
      LOCAL_CATALOG_EVIDENCE: 'CAPTURED_PARTIAL_SCHEMA_ONLY',
      B3C_RUNTIME_PACKET: 'RECONCILED_AFTER_FAILED_PREFLIGHT',
      PHASE_1B_3C: 'NOT_YET_COMPLETE',
      PHASE_1B_3C_B: 'NOT_AUTHORIZED_NO_EXECUTABLE_ITEMS',
      PHASE_1B_3C_B_STARTED: 'NO',
      LOCAL_RUNTIME_CATALOG_PROVEN: 'YES',
      LOCAL_RUNTIME_CATALOG_PROOF_SCOPE: 'DISPOSABLE_PARTIAL_SCHEMA_ONLY',
      PRODUCTION_RUNTIME_CATALOG_PROVEN: 'NO',
      DEPLOYED_PRODUCTION_ROLE_IDENTITY_PROVEN: 'NO',
      DEPLOYED_PRODUCTION_OWNER_IDENTITY_PROVEN: 'NO',
      DEPLOYED_PRODUCTION_GRANT_STATE_PROVEN: 'NO',
      RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
      TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
      PRIVILEGED_DB_RUNTIME_BEHAVIOR_PROVEN: 'NO',
      PRODUCT_READY: 'NO',
      PHASE_1C: 'NOT_AUTHORIZED',
      PHASE_1D: 'NOT_AUTHORIZED',
      PHASE_2: 'NOT_AUTHORIZED',
    },
    runtimeCapture: capture,
  }
  validateReport(result)
  return result
}

function validateReport(result) {
  const rows = result.runtimeProofItemReconciliation
  assert.deepEqual(
    uniqueIds(rows, 'RUNTIME_PROOF_ITEM_ID', 3124),
    uniqueIds(items, 'RUNTIME_PROOF_ITEM_ID', 3124),
  )
  assert.equal(result.catalogEvidence.length, 640)
  assert.equal(result.readyRuntimeProofRegister.length, 0)
  const inputMap = new Map(items.map((item) => [item.RUNTIME_PROOF_ITEM_ID, item]))
  for (const row of rows) {
    const input = inputMap.get(row.RUNTIME_PROOF_ITEM_ID)
    assert.equal(row.INPUT_CLASSIFICATION, input.EXECUTION_CLASSIFICATION)
    assert.deepEqual(row.OBJECT_IDS, input.OBJECT_IDS)
    assert.deepEqual(row.CLIENT_IDS, input.CLIENT_IDS)
    assert.deepEqual(row.POLICY_GROUP_IDS, input.POLICY_GROUP_IDS)
    assert.equal(row.EXECUTED, 'NO')
    if (row.INPUT_CLASSIFICATION !== 'CATALOG_EVIDENCE_ONLY')
      assert.equal(row.EXECUTION_CLASSIFICATION, row.INPUT_CLASSIFICATION)
  }
  assert.equal(
    Object.values(result.summary.CATALOG_PARENT_RESOLUTION).reduce((sum, value) => sum + value, 0),
    640,
  )
  assert.equal(
    Object.values(result.summary.POST_PREFLIGHT_CLASSIFICATION).reduce(
      (sum, value) => sum + value,
      0,
    ),
    3124,
  )
  assert.equal(result.blockedRuntimeProofRegister.length, 2484)
  assert.equal(
    result.carryForward.PREDECESSOR_CARRY_FORWARD_SHA256,
    digest(b.predecessorCarryForward),
  )
  assert.equal(result.catalogBaseline.CATALOG_QUERY_WRITES, 0)
  assert.equal(result.catalogBaseline.CATALOG_DDL_EXECUTED_AFTER_BASELINE_SETUP, 0)
  assert.equal(result.databaseLifecycle.PRODUCTION_DATABASE_TOUCHED, 'NO')
  assert.equal(result.databaseLifecycle.STAGING_DATABASE_TOUCHED, 'NO')
  assert.equal(result.databaseLifecycle.SHARED_DATABASE_TOUCHED, 'NO')
  assert.equal(result.summary.POST_PREFLIGHT_CLASSIFICATION.BLOCKED_BY_KNOWN_STATIC_DEFECT, 663)
  assert.equal(result.summary.POST_PREFLIGHT_CLASSIFICATION.BLOCKED_BY_REQUIREMENT_DECISION, 1007)
  assert.equal(
    result.summary.POST_PREFLIGHT_CLASSIFICATION.BLOCKED_BY_FIXTURE_OR_ENVIRONMENT_PRECONDITION,
    814,
  )
  assert.equal(result.clientReadiness.length, 8)
  assert.equal(result.contextHarnessReadiness.length, 9)
  assert.equal(result.connectionPoolHarnessReadiness.length, 8)
  assert.equal(result.runtimeCapture.CLIENT_CONSTRUCTOR_PROBE.CONNECTIONS_ATTEMPTED, 0)
  assert.equal(result.validation.TENANT_PROOF_CASES_EXECUTED, 0)
  assert.equal(result.validation.MUTATING_PROOF_TESTS_EXECUTED, 0)
  assert.equal(result.phaseStatus.PHASE_1B_3C_B_STARTED, 'NO')
  assert.equal(result.fixtureManifest.FIXTURED_OBJECTS.length, 0)
  uniqueIds(result.fixtureManifest.FIXTURE_BLOCKED_OBJECTS, 'OBJECT_ID', 612)
}

function markdown(result) {
  const summary = result.summary
  const baseline = result.catalogBaseline
  return `# Phase 1B.3C-A — disposable runtime preflight

## Gate and boundary

\`PHASE_1B_3C_A_GATE = FAIL\`. No executable tenant-isolation items.

Exact accepted-schema replay and concrete fixture/client/pool contracts are not established.
This is a failed runtime-environment preflight, not reopening B3B or permission to repair migrations.
The two isolated clusters were destroyed after capture. No production, staging, shared database,
application runtime, external authentication, cross-org read, or mutating proof test was touched.

## Existing harness and lifecycle

Reuses the Docker/Postgres lifecycle pattern from
[\`platform-authz-acceptance.mjs\`](../../../scripts/platform-authz-acceptance.mjs).
That harness's authorization-only bootstrap is not an adequate UE schema, and the UE backend
compose file is a persistent-service template. No existing database/container/volume was reused.

Prerequisites: local Docker Engine; local \`postgres:16-alpine\` image; Node/pnpm dependencies
from the lockfile; exact frozen inputs and migration hashes.

\`\`\`powershell
node scripts\\ue\\prepare-runtime-tenant-isolation-proof.mjs --run
\`\`\`

This creates a no-network/no-port tmpfs cluster, creates separate databases for the two frozen
logical scopes, replays the exact 23-file manifest until the first error in each scope, captures
read-only catalog facts, probes transaction-local context transport, destroys the cluster,
repeats from a clean second cluster, compares replay/catalog evidence, and verifies teardown.
Fixture seeding is blocked: no accepted per-object fixture/reset contracts. It is not silently skipped
as a successful seed step. The command writes failure evidence and exits 1 for the failed gate.
It never accepts an external connection string. Cleanup acts only on the exact run-labelled containers.

Reset/replay comparison: **PASS**. Teardown/absence: **PASS**.
Image: \`${result.environmentFingerprint.POSTGRES_IMAGE_ID}\`.

### Replay blockers

${summary.SCHEMA_REPLAY_FAILURES.map(
  (failure) =>
    `- **${failure.DATABASE_SCOPE}**: \`${failure.FILE}\`\n\n\`\`\`text\n${failure.ERROR}\n\`\`\`\n`,
).join('\n')}

The failed file may have committed earlier statements; the partial catalog is explicitly retained.
Remaining files in that scope were not applied. No missing relation, type, role, extension,
historical bootstrap or predicate was fabricated to force setup to succeed.

## Catalog baseline

| Measure | Count |
|---|---:|
| Frozen relational objects | 612 |
| Local matched objects | ${baseline.LOCAL_CATALOG_MATCHED_OBJECTS} |
| Missing expected objects | ${baseline.LOCAL_CATALOG_MISSING_EXPECTED_OBJECTS.length} |
| Extra local relevant objects | ${baseline.LOCAL_CATALOG_EXTRA_RELEVANT_OBJECTS.length} |
| Frozen active policy identities | 1,490 |
| Local policy identities | ${baseline.LOCAL_CATALOG_POLICY_IDENTITIES} |
| Matched policy identities | ${baseline.LOCAL_CATALOG_MATCHED_POLICY_IDENTITIES} |

Exact SQL, per-scope raw snapshots, owners, roles, RLS flags, policies, table/schema/default
ACLs, function owners/security/search-path/execute roles and every missing/extra identity
are in the [JSON artifact](./PHASE_1B_3C_A_RUNTIME_PROOF_PREFLIGHT.json).
Catalog query writes: **0**. Catalog DDL after setup: **0**.
Catalog evidence applies only to this incomplete disposable schema, never to deployed state.

## 640 catalog parent items

${Object.entries(summary.CATALOG_PARENT_RESOLUTION)
  .map(([key, value]) => `- \`${key}\`: **${value}**`)
  .join('\n')}

Sum: **640**, consumed exactly once. Missing objects are local lineage mismatches, not new static
defects or proof of deployed absence. Grants/native role expectations remain unresolved where
the frozen intent is not concrete or schema replay failed.

## Fixture/client/context/pool readiness

- Six deterministic org/user IDs and exclusive membership plan are recorded, **not seeded**.
- Fixtured objects: **0**. All **612** objects have explicit fixture blockers.
- Installed JS constructors instantiated offline with **0** connection attempts: **7** client
  records are **PARTIAL**, constructor-only; the Django client is **NO**, no harness adapter.
  No application client module, local database connection or ordinary-path credential is proven.
- All **9** context primitives retain their frozen value contracts. PostgreSQL \`set_config(...,true)\`
  and rollback/clear were observed in a bootstrap transport-only session; no application wrapper ran.
- All **8** application pool items remain unprepared. A psql session is not a connection pool.
- Test-only roles are bounded NOLOGIN/NOSUPERUSER/NOBYPASSRLS roles. No broad grants or fixture bypass.

## 3,124-item reconciliation

${Object.entries(summary.POST_PREFLIGHT_CLASSIFICATION)
  .map(([key, value]) => `- \`${key}\`: **${value}**`)
  .join('\n')}

Ready runtime denominator: **0**. Remaining command blockers: **2,484** =
**663** static-defect + **1,007** requirement-decision + **814** fixture/environment.
All 159 missing-RLS facts and two nullable-org mismatches remain frozen blockers.
Catalog items do not become command tests.

\`\`\`text
PHASE_1B_3C_A_GATE = FAIL
RUNTIME_PROOF_ENVIRONMENT = NOT_READY_FAITHFUL_SCHEMA_NOT_ESTABLISHED
PHASE_1B_3C = NOT_YET_COMPLETE
PHASE_1B_3C_B = NOT_AUTHORIZED_NO_EXECUTABLE_ITEMS
PHASE_1B_3C_B_STARTED = NO
TENANT_ISOLATION_RUNTIME_PROVEN = NO
RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN = NO
PRIVILEGED_DB_RUNTIME_BEHAVIOR_PROVEN = NO
PRODUCT_READY = NO
\`\`\`

## Validation

\`\`\`powershell
node --check scripts\\ue\\prepare-runtime-tenant-isolation-proof.mjs
node scripts\\ue\\prepare-runtime-tenant-isolation-proof.mjs --self-test
node scripts\\ue\\prepare-runtime-tenant-isolation-proof.mjs
node scripts\\ue\\prepare-runtime-tenant-isolation-proof.mjs --check
pnpm exec prettier --check scripts\\ue\\prepare-runtime-tenant-isolation-proof.mjs docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A_RUNTIME_PROOF_PREFLIGHT.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A_RUNTIME_PROOF_PREFLIGHT.md
pnpm validate:docs
\`\`\`

Default generation and \`--check\` only reconcile saved capture; they never reconnect to a database
or regenerate B3B. Self-tests validate exact accounting and read-only query contracts.
Passing artifact validation is not a passing C-A runtime gate.
`
}

const args = process.argv.slice(2)
assert.ok(
  args.length <= 1 && args.every((arg) => ['--run', '--check', '--self-test'].includes(arg)),
  'Usage: node scripts\\ue\\prepare-runtime-tenant-isolation-proof.mjs [--run|--check|--self-test]',
)
if (args.includes('--self-test')) {
  for (const query of catalogQueries) {
    assert.match(query.SQL.trim(), /^SELECT /)
    assert.doesNotMatch(
      query.SQL,
      /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\s+(?:TABLE|ROLE|DATABASE|INTO|FROM)/i,
    )
  }
  assert.equal(new Set(roles).size, 2)
  assert.match(roleSql, /NOLOGIN NOSUPERUSER NOBYPASSRLS/)
  assert.ok(Object.values(scopes).every((database) => database.startsWith('b3ca_')))
  const prior = JSON.parse(readFileSync(`${output}.json`, 'utf8'))
  validateReport(prior)
  assert.deepEqual(
    uniqueIds(prior.catalogEvidence, 'RUNTIME_PROOF_ITEM_ID', 640),
    new Set(
      items
        .filter((item) => item.EXECUTION_CLASSIFICATION === 'CATALOG_EVIDENCE_ONLY')
        .map((item) => item.RUNTIME_PROOF_ITEM_ID),
    ),
  )
  console.log(
    'PASS: frozen denominator, read-only queries, local role scope, capture and blocker preservation self-tests.',
  )
} else {
  const capture = args.includes('--run')
    ? runtimeCapture()
    : JSON.parse(readFileSync(`${output}.json`, 'utf8')).runtimeCapture
  const result = report(capture)
  const config = await resolveConfig(script)
  const outputs = [
    [`${output}.json`, await format(JSON.stringify(result), { ...config, parser: 'json' })],
    [`${output}.md`, await format(markdown(result), { ...config, parser: 'markdown' })],
  ]
  for (const [file, contents] of outputs) {
    if (args.includes('--check'))
      assert.equal(readFileSync(file, 'utf8'), contents, `Stale ${path.basename(file)}`)
    else writeFileSync(file, contents)
  }
  for (const [key, name] of Object.entries(inputNames))
    assert.equal(hash(readFileSync(path.join(base, `${name}.json`))), frozenHashes[key])
  console.log(
    JSON.stringify(
      {
        GATE: result.phaseStatus.PHASE_1B_3C_A_GATE,
        CLASSIFICATIONS: result.summary.POST_PREFLIGHT_CLASSIFICATION,
        CATALOG: result.summary.CATALOG_PARENT_RESOLUTION,
        MATCHED_OBJECTS: result.catalogBaseline.LOCAL_CATALOG_MATCHED_OBJECTS,
        POLICIES: result.catalogBaseline.LOCAL_CATALOG_POLICY_IDENTITIES,
        RESET: 'VERIFIED',
        TEARDOWN: 'VERIFIED',
        READY: 0,
      },
      null,
      2,
    ),
  )
  if (args.includes('--run')) process.exitCode = 1
}
