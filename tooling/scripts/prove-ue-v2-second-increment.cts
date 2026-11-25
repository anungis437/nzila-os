/** Disposable physical-K second-increment proof. It accepts qualified schema exports, never an
 * Azure URL, and keeps all connection secrets in its private output directory. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { RETAINED_AUDIT_CATALOG_QUERY } from './lib/ue-v2-retained-audit-acl'
import { inspectCatalog, catalogDigest } from '../../apps/union-eyes/scripts/bootstrap-v2/installer'
import { nativePostgres16Image } from '../../apps/union-eyes/scripts/bootstrap-v2/native-postgres-image'
import { evaluateCatalogAdmission } from '../../apps/union-eyes/lib/operations/catalog-admission'
import { parseSql } from '../../apps/union-eyes/scripts/lib/sql-census/parse'
import { currentDeadlineGuardBody } from '../../apps/union-eyes/db/auth/business-session-event-guard'
import {
  BUSINESS_SESSION_POLICY,
  BUSINESS_SESSION_CATALOG_PREDICATE,
} from '../../apps/union-eyes/db/auth/business-session-policy'
import { sqlFromGuardedDump } from './lib/ue-guarded-postgres-dump.mjs'
import { MANAGED_PG16_LOGIN_TARGETS } from './lib/ue-managed-pg16-catalog.mjs'
import {
  planCanonicalForwardUpgrade,
  retainedForwardProfile,
  type UpgradeObject,
} from './lib/ue-v2-forward-upgrade'
import {
  assertForwardPreimage,
  readForwardCatalog,
  executeForwardUpgrade,
  verifyForwardTarget,
  forwardDigest,
  normalizeForwardCatalog,
  FORWARD_EVENT_CATALOG_QUERY,
  type ForwardUpgradeBundle,
} from './lib/ue-v2-forward-upgrade-runtime'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  assert(i > 0 && process.argv[i + 1], `${name} required`)
  return path.resolve(process.argv[i + 1])
}
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex')
export function load(dir: string, currentCatalog: boolean) {
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'export-qualification.json'), 'utf8'))
  assert.equal(report.localOnly, true)
  assert.equal(report.restoredDump, 'PASS')
  assert.equal(report.repeat, 'NOOP')
  assert.equal(report.restoredRepeat, 'NOOP')
  assert.equal(report.privilegeStatus, 'PASS_PUBLIC_AND_AUTH_NATIVE_PRIVILEGES')
  assert.deepEqual(report.privilegeMismatches, [])
  assert.deepEqual(Object.keys(report.files).sort(), [
    'receipt-restore.sql',
    'receipt.sql',
    'roles.sql',
    'schema-restore.sql',
    'schema.sql',
  ])
  for (const [file, entry] of Object.entries(report.files) as [string, { sha256: string }][]) {
    assert(/^[a-z-]+\.sql$/.test(file))
    assert.equal(hash(fs.readFileSync(path.join(dir, file))), entry.sha256)
  }
  // The old source used its own historical normalizer. Its hash-verified SQL,
  // not a reinterpreted historical JSON digest, supplies the actual preimage.
  const catalog = currentCatalog
    ? JSON.parse(fs.readFileSync(path.join(dir, 'expected-catalog.json'), 'utf8'))
    : []
  if (currentCatalog)
    assert.equal(catalogDigest(catalog), report.catalogDigest, 'PROOF_EXPORT_CATALOG_HASH')
  return { report, catalog, dir }
}

export const ALIAS_FUNCTION = 'ue_external_sources_match(jsonb)'
const OLD_ALIAS = "linked_entity_type::text='grievance'"
const NEW_ALIAS = "linked_entity_type::text IN ('case','grievance')"

/** Keep f778's original provenance. Only the matched pg_dump client-guard tokens may differ. */
export function assertPhysicalKBinding(physical: ReturnType<typeof load>, admittedDir: string) {
  assert.equal(
    physical.report.applicationSourceSha,
    'f77804b4a8ac0ef8b8ae6c0ab891c1aa42008347',
    'SECOND_PHYSICAL_K_SOURCE_REFUSED',
  )
  const manifest = JSON.parse(fs.readFileSync(path.join(admittedDir, 'manifest.json'), 'utf8'))
  assert.equal(manifest.version, 1)
  assert.equal(
    manifest.applicationSourceSha,
    '6a60c95c9de17e9343e0414bb51766afbc190054',
    'SECOND_ADMITTED_K_SOURCE_REFUSED',
  )
  assert.equal(
    manifest.sourcePlanDigest,
    '6ec71d4631810207ffad4e5b78046be219528d27608a3da13170f3bb96c41161',
    'SECOND_ADMITTED_K_PLAN_REFUSED',
  )
  assert.deepEqual(Object.keys(manifest.files).sort(), [
    'catalog-queries.json',
    'expected-catalog.json',
    'export-qualification.json',
    'schema.sql',
  ])
  for (const [file, expected] of Object.entries(manifest.files))
    assert.equal(
      hash(fs.readFileSync(path.join(admittedDir, file))),
      expected,
      `SECOND_ADMITTED_K_HASH:${file}`,
    )
  const report = JSON.parse(
    fs.readFileSync(path.join(admittedDir, 'export-qualification.json'), 'utf8'),
  )
  assert.equal(
    report.applicationSourceSha,
    manifest.operatorSourceSha,
    'SECOND_K_OPERATOR_BINDING_DIFFERS',
  )
  assert.equal(report.sourcePlanDigest, manifest.sourcePlanDigest)
  assert.equal(report.localOnly, true)
  assert.equal(report.restoredDump, 'PASS')
  assert.equal(report.repeat, 'NOOP')
  assert.equal(report.restoredRepeat, 'NOOP')
  assert.equal(report.privilegeStatus, 'PASS_PUBLIC_AND_AUTH_NATIVE_PRIVILEGES')
  assert.deepEqual(report.privilegeMismatches, [])
  assert.equal(
    hash(fs.readFileSync(path.join(admittedDir, 'schema.sql'))),
    report.files['schema.sql'].sha256,
  )
  assert.equal(
    catalogDigest(physical.catalog),
    report.catalogDigest,
    'SECOND_K_CATALOG_SEMANTICS_DIFFER',
  )
  assert.equal(
    hash(fs.readFileSync(path.join(physical.dir, 'expected-catalog.json'))),
    hash(fs.readFileSync(path.join(admittedDir, 'expected-catalog.json'))),
    'SECOND_K_CATALOG_BYTES_DIFFER',
  )
  assert.equal(
    sqlFromGuardedDump(fs.readFileSync(path.join(physical.dir, 'schema.sql'), 'utf8')),
    sqlFromGuardedDump(fs.readFileSync(path.join(admittedDir, 'schema.sql'), 'utf8')),
    'SECOND_K_SCHEMA_SQL_DIFFERS',
  )
  return {
    applicationSourceSha: manifest.applicationSourceSha,
    admittedOperatorSourceSha: manifest.operatorSourceSha,
    admittedSourcePlanDigest: manifest.sourcePlanDigest,
    physicalExportSourceSha: physical.report.applicationSourceSha,
    physicalExportSourcePlanDigest: physical.report.sourcePlanDigest,
    catalogDigest: report.catalogDigest,
    physicalSqlEquality: 'EXACT_EXCEPT_MATCHED_PG_DUMP_RESTRICTION_TOKENS',
    provenanceRelabeled: false,
  }
}

export function assertOnlyAliasFunctionDelta(before: UpgradeObject[], after: UpgradeObject[]) {
  const previous = new Map(before.map((o) => [`${o.kind}|${o.id}`, o]))
  assert.equal(previous.size, before.length)
  assert.equal(after.length, before.length, 'SECOND_CATALOG_CENSUS_DIFFERS')
  const changed = after.filter((o) => {
    const old = previous.get(`${o.kind}|${o.id}`)
    assert(old, 'SECOND_CATALOG_OBJECT_ADDED')
    return (
      forwardDigest(normalizeForwardCatalog([old])) !== forwardDigest(normalizeForwardCatalog([o]))
    )
  })
  assert.deepEqual(
    changed.map((o) => `${o.kind}|${o.id}`),
    [`function|${ALIAS_FUNCTION}`],
    'SECOND_UNEXPECTED_PHYSICAL_DELTA',
  )
  const old = previous.get(`function|${ALIAS_FUNCTION}`)!
  const wanted = changed[0]
  assert.equal(typeof old.definition.definition, 'string')
  assert.equal(typeof wanted.definition.definition, 'string')
  const priorSql = String(old.definition.definition)
  assert.equal(priorSql.split(OLD_ALIAS).length, 2, 'SECOND_OLD_ALIAS_ANCHOR_DIFFERS')
  assert.equal(
    priorSql.replace(OLD_ALIAS, NEW_ALIAS),
    wanted.definition.definition,
    'SECOND_ALIAS_BODY_DELTA_DIFFERS',
  )
  assert.deepEqual(
    { ...old.definition, definition: null },
    { ...wanted.definition, definition: null },
    'SECOND_FUNCTION_AUTHORITY_CHANGED',
  )
  return {
    object: ALIAS_FUNCTION,
    oldDefinitionSha256: hash(priorSql),
    newDefinitionSha256: hash(String(wanted.definition.definition)),
    authorityUnchanged: true,
  }
}

export function aliasReplacementIndexes(bundle: ForwardUpgradeBundle) {
  return bundle.statements.flatMap((s, index) =>
    s.phase === 'function' &&
    s.object === ALIAS_FUNCTION &&
    /\bCREATE OR REPLACE FUNCTION\b/.test(s.sql)
      ? [index]
      : [],
  )
}

/** The assertion runs after the actual replacement SQL, not before it or at an unrelated owner handoff. */
export function injectAfterActualAlias(
  client: Pick<pg.Client, 'query'>,
  bundle: ForwardUpgradeBundle,
  reason: string,
) {
  const indexes = aliasReplacementIndexes(bundle)
  assert.equal(indexes.length, 1, 'SECOND_EXACT_ALIAS_REPLACEMENT_REQUIRED')
  return async (index: number) => {
    if (!indexes.includes(index)) return
    const body = (
      await client.query(
        "SELECT prosrc FROM pg_proc WHERE oid='public.ue_external_sources_match(jsonb)'::regprocedure",
      )
    ).rows[0].prosrc as string
    assert(body.includes(NEW_ALIAS), 'SECOND_INJECTION_DID_NOT_OBSERVE_NEW_BODY')
    assert(!body.includes(OLD_ALIAS), 'SECOND_INJECTION_STILL_OBSERVED_OLD_BODY')
    throw new Error(reason)
  }
}

export interface PreservationGrant {
  grantor: string
  grantorOid: string
  grantee: string
  granteeOid: string
  privilege: string
  grantable: boolean
}
export interface PreservationAclRow {
  id: string
  kind: string
  owner: string
  ownerOid: string
  rls: boolean
  force: boolean
  rawAcl: string[] | null
  grants: PreservationGrant[]
  columns: {
    number: number
    name: string
    rawAcl: string[] | null
    grants: PreservationGrant[]
  }[]
}

// PostgreSQL supplies the defaults, including sequence ('s') versus table ('r')
// privileges and empty column ('c') privileges. Index/composite relation kinds
// have no default relation ACL; a nonnull ACL on one is refused below.
const expandedGrantsSql = (acl: string) => `COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'grantor',pg_get_userbyid(x.grantor),'grantorOid',x.grantor::text,
  'grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,
  'granteeOid',x.grantee::text,'privilege',x.privilege_type,'grantable',x.is_grantable)
  ORDER BY x.grantor,x.grantee,x.privilege_type,x.is_grantable)
  FROM pg_catalog.aclexplode(NULLIF(${acl},ARRAY[]::aclitem[])) x),'[]'::jsonb)`
export const PRESERVATION_ACL_QUERY = `SELECT n.nspname||'.'||c.relname AS id,
  c.relkind::text AS kind,pg_get_userbyid(c.relowner) AS owner,c.relowner::text AS "ownerOid",
  c.relrowsecurity AS rls,c.relforcerowsecurity AS force,
  CASE WHEN c.relacl IS NULL THEN NULL ELSE ARRAY(SELECT v::text FROM unnest(c.relacl) v ORDER BY v::text) END AS "rawAcl",
  ${expandedGrantsSql(`COALESCE(c.relacl,CASE WHEN c.relkind='S' THEN pg_catalog.acldefault('s',c.relowner)
    WHEN c.relkind IN ('r','p','v','m','f') THEN pg_catalog.acldefault('r',c.relowner)
    ELSE ARRAY[]::aclitem[] END)`)} AS grants,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('number',a.attnum,'name',a.attname,
    'rawAcl',CASE WHEN a.attacl IS NULL THEN NULL ELSE to_jsonb(ARRAY(SELECT v::text FROM unnest(a.attacl) v ORDER BY v::text)) END,
    'grants',${expandedGrantsSql("COALESCE(a.attacl,pg_catalog.acldefault('c',c.relowner))")}) ORDER BY a.attnum)
    FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),'[]'::jsonb) AS columns
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' ORDER BY 1`

/** Compare every effective ACL tuple, not its NULL/explicit-default encoding.
 * Relation/column identities, owners, grantors and grant options remain exact. */
export function preservationAclDigest(rows: PreservationAclRow[]) {
  const grants = (values: PreservationGrant[]) =>
    [...values].sort((a, b) => forwardDigest(a).localeCompare(forwardDigest(b)))
  const normalized = rows.map((row) => {
    assert(
      ['r', 'p', 'v', 'm', 'f', 'S'].includes(row.kind) || row.rawAcl === null,
      `SECOND_UNSUPPORTED_RELATION_ACL_KIND:${row.id}`,
    )
    return {
      id: row.id,
      kind: row.kind,
      owner: row.owner,
      ownerOid: row.ownerOid,
      rls: row.rls,
      force: row.force,
      grants: grants(row.grants),
      columns: row.columns
        .map((column) => ({
          number: column.number,
          name: column.name,
          grants: grants(column.grants),
        }))
        .sort((a, b) => a.number - b.number),
    }
  })
  assert.equal(
    new Set(normalized.map((row) => row.id)).size,
    rows.length,
    'SECOND_DUPLICATE_ACL_RELATION',
  )
  return forwardDigest(normalized.sort((a, b) => a.id.localeCompare(b.id)))
}

export function assertPhysicalKSequenceAcls(rows: PreservationAclRow[]) {
  const ids = [
    'public.rbac_audit_log_sequence_number_seq',
    'public.ue_authority_events_event_seq_seq',
  ]
  for (const [index, id] of ids.entries()) {
    const row = rows.find((value) => value.id === id)
    assert(
      row && row.kind === 'S' && row.owner === 'ue_v2_owner',
      `SECOND_K_SEQUENCE_REQUIRED:${id}`,
    )
    const expected = ['SELECT', 'UPDATE', 'USAGE'].map((privilege) => ({
      grantor: row.owner,
      grantee: row.owner,
      privilege,
      grantable: false,
    }))
    if (index === 1)
      expected.push({
        grantor: row.owner,
        grantee: 'nzila_auth_org_authority_reader',
        privilege: 'USAGE',
        grantable: false,
      })
    const actual = row.grants.map(
      ({ grantor, grantorOid, grantee, granteeOid, privilege, grantable }) => {
        assert.equal(grantorOid, row.ownerOid, `SECOND_K_SEQUENCE_GRANTOR_REQUIRED:${id}`)
        assert.equal(
          grantee === row.owner,
          granteeOid === row.ownerOid,
          `SECOND_K_SEQUENCE_GRANTEE_REQUIRED:${id}`,
        )
        return { grantor, grantee, privilege, grantable }
      },
    )
    const sort = (values: typeof expected) =>
      values.sort((a, b) => forwardDigest(a).localeCompare(forwardDigest(b)))
    assert.deepEqual(sort(actual), sort(expected), `SECOND_K_SEQUENCE_ACL_DIFFERS:${id}`)
  }
  return ids
}

/** Provider-only readback observes every stored relation; executor proof still uses the actual managed operator. */
async function preservationSnapshot(provider: pg.Client, rawAclOutput?: string) {
  const quote = (v: string) => '"' + v.replaceAll('"', '""') + '"'
  const tables = (
    await provider.query<{
      schema: string
      name: string
      columns: string[]
    }>(`SELECT n.nspname AS schema,c.relname AS name,
    ARRAY(SELECT a.attname::text FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum) AS columns
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind IN('r','p') ORDER BY 1,2`)
  ).rows
  const rows = []
  for (const table of tables) {
    const values = (
      await provider.query(`SELECT count(*)::text AS rows,encode(sha256(convert_to(COALESCE(jsonb_agg(v.row ORDER BY v.row),'[]'::jsonb)::text,'UTF8')),'hex') AS digest
      FROM (SELECT to_jsonb(ARRAY[${table.columns.map((c) => quote(c) + '::text').join(',')}])::text AS row FROM ONLY ${quote(table.schema)}.${quote(table.name)}) v`)
    ).rows[0]
    rows.push({ table: table.schema + '.' + table.name, ...values })
  }
  const sequences = []
  for (const seq of (
    await provider.query<{ schema: string; name: string }>(
      `SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind='S' ORDER BY 1,2`,
    )
  ).rows)
    sequences.push({
      ...seq,
      ...(
        await provider.query(
          `SELECT last_value::text,is_called FROM ${quote(seq.schema)}.${quote(seq.name)}`,
        )
      ).rows[0],
    })
  const acls = (await provider.query<PreservationAclRow>(PRESERVATION_ACL_QUERY)).rows
  if (rawAclOutput) fs.writeFileSync(rawAclOutput, JSON.stringify(acls, null, 2))
  const attrs = (
    await provider.query(
      "SELECT rolname,rolsuper,rolbypassrls,rolcanlogin,rolcreatedb,rolcreaterole,rolreplication,rolinherit FROM pg_roles WHERE rolname='uev2admin'",
    )
  ).rows[0]
  const receipt = (await provider.query('SELECT * FROM public.ue_v2_bootstrap_receipt')).rows
  return {
    tables: tables.length,
    rows: rows.reduce((n, r) => n + BigInt(r.rows), 0n).toString(),
    rowDigest: forwardDigest(rows),
    sequences: sequences.length,
    sequenceDigest: forwardDigest(sequences),
    aclDigest: preservationAclDigest(acls),
    operator: attrs,
    receiptDigest: forwardDigest(receipt),
  }
}
async function assertRolledBack(
  provider: pg.Client,
  previous: Awaited<ReturnType<typeof preservationSnapshot>>,
) {
  assert.deepEqual(
    await preservationSnapshot(provider),
    previous,
    'SECOND_ROLLBACK_ROWS_SEQUENCES_RECEIPT_ACLS_ATTRIBUTES_CHANGED',
  )
  const body = (
    await provider.query(
      "SELECT prosrc FROM pg_proc WHERE oid='public.ue_external_sources_match(jsonb)'::regprocedure",
    )
  ).rows[0].prosrc as string
  assert(
    body.includes(OLD_ALIAS) && !body.includes(NEW_ALIAS),
    'SECOND_ROLLBACK_OLD_BODY_NOT_RESTORED',
  )
}
async function proveSemanticRepeat(
  operator: pg.Client,
  runtime: pg.Client,
  provider: pg.Client,
  after: ReturnType<typeof load>,
  queries: string[],
) {
  const before = await readForwardCatalog(runtime, queries)
  const snapshot = await preservationSnapshot(provider)
  const profile = retainedForwardProfile(
    before,
    after.catalog,
    fs.readFileSync(path.join(after.dir, 'schema.sql'), 'utf8'),
  )
  const statements = [
    ...profile.prefix,
    ...(await planCanonicalForwardUpgrade({ before, after: profile.target, dump: profile.dump })),
    ...profile.suffix,
  ]
  const bundle: ForwardUpgradeBundle = {
    version: 1,
    applicationSourceSha: after.report.applicationSourceSha,
    catalogSourceSha: after.report.applicationSourceSha,
    sourcePlanDigest: after.report.sourcePlanDigest,
    catalogQueries: queries,
    before,
    target: profile.target,
    statements,
  }
  assert.equal(
    aliasReplacementIndexes(bundle).length,
    0,
    'SECOND_REPEAT_REPLACES_UNCHANGED_ALIAS_BODY',
  )
  await operator.query('BEGIN')
  let result
  try {
    result = await executeForwardUpgrade(operator, bundle)
    await operator.query('COMMIT')
  } catch (error) {
    await operator.query('ROLLBACK')
    throw error
  }
  const qualification = await verifyForwardTarget(runtime, bundle)
  assert.equal(
    forwardDigest(normalizeForwardCatalog(await readForwardCatalog(runtime, queries))),
    forwardDigest(normalizeForwardCatalog(before)),
    'SECOND_REPEAT_CATALOG_CHANGED',
  )
  assert.deepEqual(
    await preservationSnapshot(provider),
    snapshot,
    'SECOND_REPEAT_PRESERVATION_CHANGED',
  )
  const forged = structuredClone(bundle)
  forged.before[0].definition = {
    ...forged.before[0].definition,
    second_increment_fake_preimage: true,
  }
  await assert.rejects(assertForwardPreimage(runtime, forged), /UE_UPGRADE_LIVE_PREIMAGE_CHANGED/)
  return {
    status: 'PASS_SEMANTIC_IDEMPOTENCE',
    statements: result.statements,
    zeroSqlClaim: false,
    aliasBodyReplacements: 0,
    rowsSequencesReceiptAclsAttributesPreserved: true,
    forgedPreimageRefused: true,
    qualification,
  }
}

async function main() {
  const sourceFiles = [
    'tooling/scripts/prove-ue-v2-second-increment.cts',
    'tooling/scripts/lib/ue-v2-forward-upgrade.ts',
    'tooling/scripts/lib/ue-v2-forward-upgrade-runtime.ts',
    'tooling/scripts/lib/ue-v2-retained-audit-acl.ts',
    'apps/union-eyes/lib/external-resource-read/source.ts',
    'apps/union-eyes/lib/operations/catalog-v2-decisions.json',
    'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json',
  ]
  const sourceHashes = () =>
    Object.fromEntries(sourceFiles.map((file) => [file, hash(fs.readFileSync(file))]))
  const dirty = execFileSync(
    'git',
    [
      'status',
      '--porcelain',
      '--',
      'apps/union-eyes',
      'packages/db',
      'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json',
      ...sourceFiles,
    ],
    { encoding: 'utf8' },
  ).trim()
  assert.equal(dirty, '', 'SECOND_CLEAN_COMMITTED_SOURCE_REQUIRED')
  const toolSources = sourceHashes()
  const qualificationSourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  const original = load(arg('--original-ccc'), false),
    before = load(arg('--physical-k'), true),
    after = load(arg('--after'), true),
    out = arg('--out')
  const currentPlan = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json',
      ),
      'utf8',
    ),
  )
  assert.equal(
    hash(JSON.stringify(currentPlan)),
    after.report.sourcePlanDigest,
    'SECOND_CURRENT_SOURCE_PLAN_DIFFERS',
  )
  const physicalKBinding = assertPhysicalKBinding(before, arg('--admitted-k'))
  const physicalDelta = assertOnlyAliasFunctionDelta(before.catalog, after.catalog)
  assert.equal(
    after.report.applicationSourceSha,
    qualificationSourceSha,
    'SECOND_EXACT_CURRENT_EXPORT_SOURCE_REQUIRED',
  )
  assert.equal(
    original.report.applicationSourceSha,
    'cccfc8c311a1017f80241bf089c00ef0c6828751',
    'PROOF_OLD_SOURCE_MISMATCH',
  )
  fs.mkdirSync(out, { recursive: true, mode: 0o700 })
  const container = `ue-second-increment-${randomUUID()}`,
    image = nativePostgres16Image()
  const password = randomBytes(24).toString('hex'),
    adminPassword = randomBytes(24).toString('hex')
  const loginPasswords = Object.fromEntries(
    Object.keys(MANAGED_PG16_LOGIN_TARGETS).map((name) => [name, randomBytes(24).toString('hex')]),
  )
  const docker = (args: string[]) =>
    execFileSync('docker', args, {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, POSTGRES_PASSWORD: password },
    }).trim()
  const clients: pg.Client[] = []
  let passed = false
  docker([
    'run',
    '-d',
    '--rm',
    '--pull',
    'never',
    '--name',
    container,
    '--memory',
    '2g',
    '--cpus',
    '2',
    '--label',
    'nzila.owner=codex-ue-second-increment',
    '-p',
    '127.0.0.1::5432',
    '-e',
    'POSTGRES_PASSWORD',
    '-e',
    'POSTGRES_USER=azuresu',
    image,
  ])
  const port = Number(
    JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]))[
      '5432/tcp'
    ][0].HostPort,
  )
  fs.writeFileSync(
    path.join(out, 'private-local-state.json'),
    JSON.stringify({ container, port, password, adminPassword, loginPasswords }),
    { mode: 0o600 },
  )
  const open = async (user: string, pass: string, database = 'ue_v2_staging', role?: string) => {
    for (let i = 0; i < 80; i++) {
      const c = new pg.Client({
        host: '127.0.0.1',
        port,
        user,
        password: pass,
        database,
        connectionTimeoutMillis: 1000,
        ...(role ? { options: `-c role=${role}` } : {}),
      })
      try {
        await c.connect()
        clients.push(c)
        return c
      } catch (e) {
        await c.end().catch(() => {})
        if (i === 79) throw e
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    throw new Error('PROOF_LOCAL_DATABASE_NOT_RESPONSIVE')
  }
  try {
    const su = await open('azuresu', password, 'postgres')
    await su.query('CREATE ROLE azure_pg_admin NOLOGIN NOSUPERUSER')
    await su.query(
      `CREATE ROLE uev2admin LOGIN CREATEDB CREATEROLE NOSUPERUSER NOBYPASSRLS PASSWORD '${adminPassword}'`,
    )
    await su.query('GRANT azure_pg_admin TO uev2admin')
    await su.query('CREATE DATABASE ue_v2_staging OWNER uev2admin')
    const provider = await open('azuresu', password)
    await provider.query('ALTER SCHEMA public OWNER TO azure_pg_admin')
    const c = await open('uev2admin', adminPassword)
    await c.query('BEGIN')
    await c.query('ALTER SCHEMA public OWNER TO pg_database_owner')
    await c.query(fs.readFileSync(path.join(before.dir, 'roles.sql'), 'utf8'))
    await c.query('GRANT ue_v2_owner TO uev2admin WITH ADMIN FALSE, INHERIT FALSE, SET TRUE')
    await c.query('ALTER DATABASE ue_v2_staging OWNER TO ue_v2_owner')
    await c.query(
      sqlFromGuardedDump(fs.readFileSync(path.join(before.dir, 'schema-restore.sql'), 'utf8')),
    )
    // Fresh-K's receipt is never loaded: the exact original CCC receipt is the disposable fixture input.
    await c.query(
      sqlFromGuardedDump(fs.readFileSync(path.join(original.dir, 'receipt-restore.sql'), 'utf8')),
    )
    await c.query('RESET ROLE; RESET ALL')
    for (const [login, role] of Object.entries(MANAGED_PG16_LOGIN_TARGETS)) {
      await c.query(
        `CREATE ROLE ${login} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${loginPasswords[login]}'`,
      )
      await c.query(`GRANT ${role} TO ${login} WITH ADMIN FALSE, INHERIT FALSE, SET TRUE`)
      await c.query(`GRANT CONNECT ON DATABASE ue_v2_staging TO ${login}`)
    }
    await c.query('REVOKE ue_v2_owner FROM uev2admin GRANTED BY uev2admin')
    await c.query('COMMIT')
    console.log(
      'SECOND qualified physical-K fixture with original CCC receipt installed; not an Azure snapshot',
    )

    // Owned post-upgrade legacy store, absent from a fresh canonical
    // export. Its rows remain history; the new contract withdraws runtime reads
    // and writes. Its already-contained ACLs must remain closed through this increment.
    await provider.query('CREATE SCHEMA audit_security AUTHORIZATION uev2admin')
    await provider.query(`CREATE TABLE audit_security.audit_logs (
      id integer PRIMARY KEY,payload json,note text)`)
    await provider.query(`INSERT INTO audit_security.audit_logs VALUES
      (1,' { "original": true, "order" : [2,1] } ','Historique — conservé')`)
    await provider.query('ALTER TABLE audit_security.audit_logs OWNER TO uev2admin')
    await provider.query('ALTER TABLE audit_security.audit_logs ENABLE ROW LEVEL SECURITY')
    await provider.query('ALTER TABLE audit_security.audit_logs FORCE ROW LEVEL SECURITY')
    // Physical K already withdrew all ordinary/system legacy audit privileges.

    // A nonempty historical schema, sequence, exact JSON spelling, Unicode and
    // array bounds make a reset, data rewrite or sequence reset observable.
    await provider.query('CREATE SCHEMA drizzle AUTHORIZATION uev2admin')
    await c.query(
      'CREATE TABLE drizzle.original_history (id integer PRIMARY KEY, payload json, note text, array_value text[])',
    )
    await c.query('CREATE SEQUENCE drizzle.original_sequence START 17')
    await c.query("SELECT nextval('drizzle.original_sequence')")
    const json = ' { "a": 1, "b" : [2,3] } '
    await c.query('INSERT INTO drizzle.original_history VALUES (1,$1,$2,$3)', [
      json,
      'Original — données conservées',
      '[0:1]={"a,b",NULL}',
    ])
    const org = randomUUID(),
      user = randomUUID(),
      caseId = randomUUID()
    await provider.query(
      "INSERT INTO public.organizations (id,name,slug,organization_type,hierarchy_path) VALUES ($1,'Preserved synthetic local',$2,'local',ARRAY[]::text[])",
      [org, 'forward-' + org],
    )
    await provider.query(
      'INSERT INTO user_management.users (user_id,email,email_verified) VALUES ($1,$2,true)',
      [user, user + '@example.com'],
    )
    await provider.query(
      "INSERT INTO public.claims (id,claim_id,organization_id,member_id,claim_number,description) VALUES ($1,$1,$2,$3,'PRESERVE-001','Original synthetic case')",
      [caseId, org, user],
    )
    await provider.query(
      'ALTER TABLE public.in_app_notifications ALTER COLUMN updated_at SET DEFAULT pg_catalog.now()',
    )
    // An opaque historical table remains data, even though the current source
    // declares no application authority over it. Its already-contained grants stay closed without discarding its owner, row or stored JSON spelling.
    await provider.query(
      'CREATE TABLE public.ue_governance_job_execution_state (id text PRIMARY KEY,payload json)',
    )
    await provider.query('ALTER TABLE public.ue_governance_job_execution_state OWNER TO uev2admin')
    await provider.query(
      'ALTER TABLE public.ue_governance_job_execution_state ENABLE ROW LEVEL SECURITY',
    )
    await provider.query(
      'ALTER TABLE public.ue_governance_job_execution_state FORCE ROW LEVEL SECURITY',
    )
    await provider.query(
      "INSERT INTO public.ue_governance_job_execution_state VALUES ('original',$1)",
      [json],
    )
    // This retained historical table is already contained in the physical-K preimage.

    // Source-only reproduction of the retained immutable migration helpers and
    // the previous release's exact session-policy guard. No live data or private
    // catalog is needed to reproduce this managed PostgreSQL proof in CI.
    const workbook = await parseSql(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../apps/union-eyes/db/migrations-cache/0013_workbook_credential_payment_authority.sql',
        ),
        'utf8',
      ),
    )
    assert(workbook.ok)
    const names = new Set([
      'ue_is_workbook_system_principal',
      'ue_enforce_workbook_credential_authority',
    ])
    let installed = 0
    for (const [i, node] of workbook.statements.entries()) {
      const name = node.CreateFunctionStmt?.funcname?.at(-1)?.String?.sval
      if (!names.has(name)) continue
      await provider.query(workbook.texts[i])
      await provider.query(
        `ALTER FUNCTION public.${name}() OWNER TO uev2admin; REVOKE ALL ON FUNCTION public.${name}() FROM PUBLIC,union_eyes_runtime,union_eyes_system`,
      )
      installed++
    }
    assert.equal(installed, 2)
    await provider.query(
      'GRANT EXECUTE ON FUNCTION public.ue_is_workbook_system_principal() TO union_eyes_system',
    )
    await provider.query(`ALTER POLICY ue_v2_select ON public.deadline_reassignment_convergence RENAME TO ue_org_isolation_select;
      ALTER POLICY ue_v2_insert ON public.deadline_reassignment_convergence RENAME TO ue_org_isolation_insert;
      DROP POLICY ue_v2_system_select ON public.deadline_reassignment_convergence;
      DROP POLICY ue_v2_system_update ON public.deadline_reassignment_convergence;`)
    await provider.query(
      `CREATE FUNCTION public.ue_guard_deadline_reassignment_convergence_policy() RETURNS event_trigger LANGUAGE plpgsql AS $prior$${currentDeadlineGuardBody(BUSINESS_SESSION_POLICY, BUSINESS_SESSION_CATALOG_PREDICATE)}$prior$`,
    )
    await provider.query(
      'ALTER FUNCTION public.ue_guard_deadline_reassignment_convergence_policy() OWNER TO uev2admin; REVOKE ALL ON FUNCTION public.ue_guard_deadline_reassignment_convergence_policy() FROM PUBLIC,union_eyes_runtime,union_eyes_system',
    )
    await provider.query(
      'CREATE POLICY ue_system_full_access ON public.deadline_reassignment_convergence TO union_eyes_system USING(true) WITH CHECK(true)',
    )
    await provider.query(
      'CREATE TRIGGER ue_workbook_credential_authority BEFORE INSERT OR UPDATE ON public.workbooks FOR EACH ROW EXECUTE FUNCTION public.ue_enforce_workbook_credential_authority()',
    )
    await provider.query(
      "CREATE EVENT TRIGGER ue_guard_deadline_reassignment_convergence_policy ON ddl_command_end WHEN TAG IN('CREATE POLICY','ALTER POLICY') EXECUTE FUNCTION public.ue_guard_deadline_reassignment_convergence_policy()",
    )

    // Physical K already has canonical owners and closed ACLs. No historical owner handoff may occur again.
    const historicalFunctionOwners: string[] = []
    const originalSequenceAcls = (
      await provider.query<PreservationAclRow>(PRESERVATION_ACL_QUERY)
    ).rows.filter((row) => row.kind === 'S')
    assertPhysicalKSequenceAcls(originalSequenceAcls)
    // K already grants authority-reader USAGE on its event sequence. Preserve
    // that grant; only the genuinely owner-only RBAC sequence exercises the
    // equivalent explicit-owner default encoding, through ordinary GRANT.
    const historicalDefaultSequenceAcls = ['public.rbac_audit_log_sequence_number_seq']
    await provider.query(
      'GRANT ALL ON SEQUENCE public.rbac_audit_log_sequence_number_seq TO ue_v2_owner',
    )
    const representedSequenceAcls = (
      await provider.query<PreservationAclRow>(PRESERVATION_ACL_QUERY)
    ).rows.filter((row) => row.kind === 'S')
    assertPhysicalKSequenceAcls(representedSequenceAcls)
    assert.equal(
      preservationAclDigest(representedSequenceAcls),
      preservationAclDigest(originalSequenceAcls),
      'SECOND_SEQUENCE_DEFAULT_REPRESENTATION_CHANGED_PRIVILEGES',
    )
    assert.deepEqual(
      representedSequenceAcls.find((row) => row.id === historicalDefaultSequenceAcls[0])?.rawAcl,
      ['ue_v2_owner=rwU/ue_v2_owner'],
    )
    fs.writeFileSync(
      path.join(out, 'physical-k-sequence-acls-before.json'),
      JSON.stringify(originalSequenceAcls, null, 2),
    )
    fs.writeFileSync(
      path.join(out, 'physical-k-sequence-acls-explicit-owner-default.json'),
      JSON.stringify(representedSequenceAcls, null, 2),
    )

    const oldRuntime = await open(
      'ue_staging_runtime',
      loginPasswords.ue_staging_runtime,
      'ue_v2_staging',
      'union_eyes_runtime',
    )
    const actual = [
      ...(await inspectCatalog(oldRuntime)),
      ...(await oldRuntime.query(FORWARD_EVENT_CATALOG_QUERY)).rows,
      ...(await oldRuntime.query(RETAINED_AUDIT_CATALOG_QUERY)).rows,
    ]
    const queries: string[] = []
    // Produce the source inspector's fixed PostgreSQL-16 query program. This is
    // SQL generation only; only real query results below are native evidence.
    await inspectCatalog({
      query: async (sql: string) =>
        sql.includes('server_version_num')
          ? { rows: [{ version: '160012' }] }
          : (queries.push(sql), { rows: [] }),
    } as unknown as pg.Client)
    queries.push(FORWARD_EVENT_CATALOG_QUERY, RETAINED_AUDIT_CATALOG_QUERY)
    const profile = retainedForwardProfile(
      actual,
      after.catalog,
      fs.readFileSync(path.join(after.dir, 'schema.sql'), 'utf8'),
    )
    const statements = [
      ...profile.prefix,
      ...(await planCanonicalForwardUpgrade({
        before: actual,
        after: profile.target,
        dump: profile.dump,
      })),
      ...profile.suffix,
    ]
    const bundle: ForwardUpgradeBundle = {
      version: 1,
      applicationSourceSha: after.report.applicationSourceSha,
      catalogSourceSha: after.report.applicationSourceSha,
      sourcePlanDigest: after.report.sourcePlanDigest,
      catalogQueries: queries,
      before: actual,
      target: profile.target,
      statements,
    }
    assert.equal(
      aliasReplacementIndexes(bundle).length,
      1,
      'SECOND_EXACT_ALIAS_REPLACEMENT_REQUIRED',
    )
    fs.writeFileSync(path.join(out, 'bundle.json'), JSON.stringify(bundle))
    console.log('PROOF plan compiled', statements.length)
    const ownerHandoffs = statements.filter((s) => s.phase === 'canonical-function-owner')
    assert.deepEqual(
      ownerHandoffs.map((s) => s.object).sort(),
      [...historicalFunctionOwners].sort(),
    )

    const originalSnapshot = await preservationSnapshot(
      provider,
      path.join(out, 'preservation-before-no-bypass-raw-acls.json'),
    )
    await c.query('BEGIN')
    await assert.rejects(
      executeForwardUpgrade(c, bundle, {
        afterStatement: injectAfterActualAlias(c, bundle, 'SECOND_INJECTED_AFTER_ACTUAL_ALIAS'),
      }),
      /SECOND_INJECTED_AFTER_ACTUAL_ALIAS/,
    )
    await c.query('ROLLBACK')
    assert.equal(
      forwardDigest(
        normalizeForwardCatalog([
          ...(await inspectCatalog(oldRuntime)),
          ...(await oldRuntime.query(FORWARD_EVENT_CATALOG_QUERY)).rows,
          ...(await oldRuntime.query(RETAINED_AUDIT_CATALOG_QUERY)).rows,
        ]),
      ),
      forwardDigest(normalizeForwardCatalog(actual)),
      'PROOF_FAILED_UPGRADE_LEFT_CATALOG_CHANGES',
    )
    assert.equal(
      (await c.query('SELECT payload::text FROM drizzle.original_history')).rows[0].payload,
      json,
    )
    await assertRolledBack(provider, originalSnapshot)
    console.log(
      'SECOND actual function replacement failed and rolled back; physical K and all rows/sequence states/receipt/ACLs retained',
    )

    // The managed administrator observed in staging has pre-existing BYPASSRLS.
    // Prove both profiles on this owned disposable server. Only the provider
    // fixture changes that attribute; the upgrade itself must preserve it.
    await c.query('BEGIN')
    const noBypassRehearsal = await executeForwardUpgrade(c, bundle)
    assert.equal(noBypassRehearsal.operatorProfile.rolbypassrls, false)
    await c.query('ROLLBACK')
    assert.equal(
      forwardDigest(
        normalizeForwardCatalog([
          ...(await inspectCatalog(oldRuntime)),
          ...(await oldRuntime.query(FORWARD_EVENT_CATALOG_QUERY)).rows,
          ...(await oldRuntime.query(RETAINED_AUDIT_CATALOG_QUERY)).rows,
        ]),
      ),
      forwardDigest(normalizeForwardCatalog(actual)),
      'PROOF_NOBYPASS_REHEARSAL_LEFT_CATALOG_CHANGES',
    )
    await assertRolledBack(provider, originalSnapshot)
    await provider.query('ALTER ROLE uev2admin BYPASSRLS INHERIT')
    const bypassSnapshot = await preservationSnapshot(
      provider,
      path.join(out, 'preservation-before-bypass-raw-acls.json'),
    )
    await c.query('BEGIN')
    await assert.rejects(
      executeForwardUpgrade(c, bundle, {
        afterStatement: injectAfterActualAlias(
          c,
          bundle,
          'SECOND_INJECTED_BYPASS_AFTER_ACTUAL_ALIAS',
        ),
      }),
      /SECOND_INJECTED_BYPASS_AFTER_ACTUAL_ALIAS/,
    )
    await c.query('ROLLBACK')
    assert.equal(
      forwardDigest(
        normalizeForwardCatalog([
          ...(await inspectCatalog(oldRuntime)),
          ...(await oldRuntime.query(FORWARD_EVENT_CATALOG_QUERY)).rows,
          ...(await oldRuntime.query(RETAINED_AUDIT_CATALOG_QUERY)).rows,
        ]),
      ),
      forwardDigest(normalizeForwardCatalog(actual)),
      'PROOF_BYPASS_FAILED_UPGRADE_LEFT_CATALOG_CHANGES',
    )
    assert.equal(
      (await c.query("SELECT rolbypassrls FROM pg_roles WHERE rolname='uev2admin'")).rows[0]
        .rolbypassrls,
      true,
      'PROOF_EXISTING_OPERATOR_BYPASS_CHANGED',
    )
    await assertRolledBack(provider, bypassSnapshot)
    await c.query('BEGIN')
    const receipt = await executeForwardUpgrade(c, bundle)
    assert.equal(receipt.operatorProfile.rolbypassrls, true)
    await c.query('COMMIT')
    assert.equal(
      (await c.query('SELECT payload::text FROM drizzle.original_history')).rows[0].payload,
      json,
    )
    const runtime = await open(
      'ue_staging_runtime',
      loginPasswords.ue_staging_runtime,
      'ue_v2_staging',
      'union_eyes_runtime',
    )
    const finalQualification = await verifyForwardTarget(runtime, bundle)
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    process.env.UE_ENVIRONMENT = 'staging'
    const admission = await evaluateCatalogAdmission(async (sql) => (await runtime.query(sql)).rows)
    assert.equal(
      admission.ok,
      true,
      `PROOF_PACKAGED_ADMISSION_FAILED:${admission.violations.join('|')}`,
    )
    const originalReceipt = (
      await provider.query('SELECT source_digest FROM public.ue_v2_bootstrap_receipt')
    ).rows
    assert.equal(
      originalReceipt[0].source_digest,
      original.report.sourcePlanDigest,
      'PROOF_ORIGINAL_BOOTSTRAP_RECEIPT_CHANGED',
    )
    assert.deepEqual(
      await preservationSnapshot(
        provider,
        path.join(out, 'preservation-after-commit-raw-acls.json'),
      ),
      bypassSnapshot,
      'SECOND_COMMIT_PRESERVATION_CHANGED',
    )
    const semanticRepeat = await proveSemanticRepeat(c, runtime, provider, after, queries)
    const result = {
      status: 'PASS_DISPOSABLE_MANAGED_SECOND_INCREMENT',
      preimageConstruction:
        'QUALIFIED_F778_PHYSICAL_K_PLUS_ORIGINAL_CCC_RECEIPT_AND_OWNED_RETAINED_FIXTURES_NOT_AZURE_SNAPSHOT',
      physicalKBinding,
      physicalDelta,
      semanticRepeat,
      qualificationSourceSha,
      toolSources,
      image,
      source: after.report.applicationSourceSha,
      physicalPreimageExportSource: before.report.applicationSourceSha,
      originalReceiptSource: original.report.applicationSourceSha,
      injectedFailureRollback: true,
      injectedFailureAfterActualAliasBodyObservedRollback: true,
      operatorProfiles: {
        noBypass: {
          injectedFailureRollback: true,
          fullRehearsalRollback: true,
          originalAttributesPreserved: noBypassRehearsal.operatorAttributesPreserved,
        },
        preexistingBypass: {
          injectedFailureRollback: true,
          committedUpgrade: true,
          originalAttributesPreserved: receipt.operatorAttributesPreserved,
        },
        applicationPrincipalsRemainUnprivileged: admission.ok,
        liveAdministratorAttributesChanged: false,
      },
      originalBootstrapReceiptPreserved: true,
      historicalFunctionOwnerHandoffs: historicalFunctionOwners,
      noRepeatedHistoricalOwnerHandoff: true,
      historicalDefaultSequenceAcls,
      historicalDefaultSequenceAclFamilyQualified: true,
      packagedAdmission: { ok: admission.ok, violations: admission.violations },
      ...receipt,
      finalQualification,
      stagingAcceptance: false,
      productionDeployment: false,
    }
    assert.deepEqual(sourceHashes(), toolSources, 'PROOF_TOOL_SOURCE_CHANGED_DURING_EXECUTION')
    fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
    passed = true
  } finally {
    for (const c of clients) await c.end().catch(() => {})
    if (passed) docker(['rm', '-f', '-v', container])
    else console.log('PROOF failed; owned disposable container retained for diagnosis:', container)
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'PROOF_FAILED')
    process.exitCode = 1
  })
