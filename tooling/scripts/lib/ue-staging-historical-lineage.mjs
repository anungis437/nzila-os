/** Exact, opt-in clone recovery. Historical ledger rows are never rewritten or stamped. */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { computeMigrationHash, scopedLedgerJournal } from './union-eyes-scoped-migrations.mjs'
import { platformLedgerJournal } from './union-eyes-platform-migrations.mjs'
import { revalidateQualifiedLiveTarget } from './ue-staging-clone-qualification.mjs'
import { evaluateLedgerIntegrity, ledgerDigest, readAttestedLedgers } from './union-eyes-migration-ledger.mjs'

export const TARGET_HOST = 'nzila-ue-recovery-20261022.postgres.database.azure.com'
export const TARGET_DATABASE = 'nzila_os_staging'
export const SNAPSHOT_SHA256 = '6919e4839af8b88d5949bcb070e60187488b2c1dc116c54e35f7e6c7c3c6bae5'
export const BASELINE_LEDGER_DIGEST = 'e3393651c8fddf33e84617e1fa7a2f87cfad8e155ce307ac2c7ba9b3ceffaa90'
export const SOURCE_SHA = '65bc9b798a15c3d96c00a60f91cb9cc7de72cf16'
export const BINDINGS = Object.freeze([
  Object.freeze({ tag: '0010_tenant_isolation_rls_foundation', historical: '806d257e54f400b3c6aebb44f87d1d187b95867fb01290d29e8e39c9a57965ea', current: '9bfd46947d9d25539b32e72edccea1c1862c6c4f2c46bac2ae10a0a228ee75f5', historicalSource: '59fe35c53905eb52852468a796f48d6ad4bddc50' }),
  Object.freeze({ tag: '0011_storage_authority_rls_completion', historical: '6fe35fcf28c5c7eb6526cc6fc9f8fc0caea211e517d277f46c7b83851f29bef3', current: 'fbf17ed35fb5c5efbb1c415f66ae2bb1fdf79e7ba1b8cfd8c711f40c6ea53c37', historicalSource: '5accb40f34986f7c11d286262f11ce49886f074f' }),
  Object.freeze({ tag: '0012_storage_authority_rls_final_closure', historical: '79ccce73f37552b45fff57726d7c00f1e5ebe11acd7305f30b74b4583dddad90', current: '3891b11704a9934b0e408b6d1b0b38c9b1dd90bfcbaa71aa16e92b6e0f17c312', historicalSource: 'b75237dd405e4a7731b172e54f36b626bea9c14a' }),
])
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const verifiedSnapshots = new WeakSet()
const verifiedContexts = new WeakMap()
function freezeEvidence(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeEvidence(child)
    Object.freeze(value)
  }
  return value
}
const canonicalJSON = (value) => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)))
    : item)

function targetBinding(qualifiedTarget) {
  return qualifiedTarget ? revalidateQualifiedLiveTarget(qualifiedTarget)
    : { host: TARGET_HOST, database: TARGET_DATABASE, qualificationSha256: null }
}

export function validateTarget(connectionString, qualifiedTarget) {
  const target = targetBinding(qualifiedTarget)
  const url = new URL(connectionString)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== target.host ||
      decodeURIComponent(url.pathname.slice(1)) !== TARGET_DATABASE || (url.port && url.port !== '5432')) {
    throw new Error('Recovery target must be the exact authorized staging clone/database')
  }
  // pg connection-string query parameters can override authority routing before
  // connect (including host/port). Do not pass a connection string to pg at all.
  // Reject every query option rather than maintaining an incomplete denylist.
  if ([...url.searchParams.keys()].length || url.hash) throw new Error('Recovery connection URL query options and fragments are forbidden')
  return {
    host: target.host, port: 5432, database: target.database,
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: true, servername: target.host },
  }
}

export function readBaseline(snapshotPath) {
  const bytes = fs.readFileSync(snapshotPath)
  if (sha256(bytes) !== SNAPSHOT_SHA256) throw new Error('Baseline snapshot digest mismatch')
  const snapshot = JSON.parse(bytes)
  if (!snapshot.tlsVerified || snapshot.identity?.[0]?.database !== TARGET_DATABASE) throw new Error('Unqualified baseline identity/TLS')
  validateBaselineRows(snapshot.ledger)
  freezeEvidence(snapshot)
  verifiedSnapshots.add(snapshot)
  return snapshot
}

function requireVerifiedSnapshot(snapshot) {
  if (!verifiedSnapshots.has(snapshot)) throw new Error('Use readBaseline with the exact reviewed snapshot bytes')
  validateBaselineRows(snapshot.ledger)
}

export function validateBaselineRows(rows) {
  if (rows.length !== 15 || new Set(rows.map((row) => row.hash)).size !== 15 ||
      new Set(rows.map((row) => Number(row.id))).size !== 15 || ledgerDigest(rows) !== BASELINE_LEDGER_DIGEST) {
    throw new Error('Exact 15-row baseline ledger mismatch, duplicate or unknown lineage')
  }
  for (const binding of BINDINGS) {
    if (!rows.some((row) => row.hash === binding.historical) || rows.some((row) => row.hash === binding.current)) {
      throw new Error('Mixed or missing historical lineage')
    }
  }
}

function plans(migrationsDir) {
  return BINDINGS.map((binding) => {
    const migration = computeMigrationHash(migrationsDir, binding.tag)
    if (migration.hash !== binding.current) throw new Error(`Canonical source mismatch: ${binding.tag}`)
    const statements = migration.sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)
    return { ...binding, statements, statementDigests: statements.map(sha256) }
  })
}

/** These are reviewed historical identities, not blanket unknown-hash exceptions. */
export function historicalJournal(journal) {
  return { ...journal, entries: journal.entries.map((entry) => ({
    ...entry, hash: BINDINGS.find((binding) => binding.current === entry.hash)?.historical ?? entry.hash,
  })) }
}

/** Both reviewed UE journals share the physical ledger; neither is an unknown-hash waiver. */
export function lineageJournals({ journalPath, migrationsDir }) {
  const platformDir = path.join(path.dirname(migrationsDir), 'migrations-platform')
  return [historicalJournal(scopedLedgerJournal({ journalPath, migrationsDir })),
    platformLedgerJournal({ journalPath: path.join(platformDir, 'meta', '_journal.json'), migrationsDir: platformDir })]
}

async function readRows(client) {
  return (await client.query('SELECT id, hash, created_at::text FROM drizzle.__drizzle_migrations ORDER BY id')).rows
}
const canonicalRows = (rows) => JSON.stringify(rows.map((row) => ({ id: Number(row.id), hash: row.hash, created_at: String(row.created_at) })))

async function assertIdentity(client, qualifiedTarget) {
  const target = targetBinding(qualifiedTarget)
  if (client.connectionParameters?.host !== target.host || client.connectionParameters?.database !== target.database) {
    throw new Error('Connected client is not the authorized staging clone')
  }
  const { rows } = await client.query('SELECT current_database() AS database, ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()')
  if (rows[0]?.database !== TARGET_DATABASE || rows[0]?.ssl !== true) throw new Error('Database identity or TLS session mismatch')
}

export function assertPublicPolicyNonRegression(current, baseline) {
  const permitted = new Set(baseline.filter((policy) => String(policy.roles).includes('public')).map(canonicalJSON))
  if (current.some((policy) => !permitted.has(canonicalJSON(policy)))) {
    throw new Error('Recovery introduced or altered a PUBLIC policy outside the exact baseline')
  }
}

async function postconditions(client, executionPlans, snapshot) {
  // Every present table passed to a policy helper must retain ENABLE + FORCE RLS.
  const names = [...new Set(executionPlans.flatMap((plan) => [...plan.statements.join('\n').matchAll(/SELECT\s+ue_create_\w+\('([^']+)'/g)].map((match) => match[1])))]
  const tables = (await client.query(`SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname=ANY($1::text[]) ORDER BY c.relname`, [names])).rows
  if (!tables.length || tables.some((table) => !table.relrowsecurity || !table.relforcerowsecurity)) throw new Error('Recovery FORCE RLS postcondition failed')
  const roles = (await client.query("SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('union_eyes_runtime','union_eyes_system') ORDER BY rolname")).rows
  if (roles.length !== 2 || roles.some((role) => role.rolsuper || role.rolbypassrls)) throw new Error('Runtime/system role isolation postcondition failed')
  const publicPolicies = (await client.query("SELECT schemaname, tablename, policyname, permissive, roles::text, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND 'public'=ANY(roles) ORDER BY tablename, policyname")).rows
  // Historical replay must not introduce/widen PUBLIC policies, but is not the
  // later 0015 security-closure gate. Known unchanged legacy policies remain
  // explicitly pending there; this receipt never claims tenant isolation.
  assertPublicPolicyNonRegression(publicPolicies, snapshot.policies)
  return { tables, roles, publicPolicies, finalSecurityClosureRequired: true }
}

/** Strict read-only preflight. No schema, lock, ledger or receipt write. */
export async function planClone(client, { snapshot, journalPath, migrationsDir, qualifiedTarget }) {
  const target = targetBinding(qualifiedTarget)
  requireVerifiedSnapshot(snapshot)
  const executionPlans = plans(migrationsDir)
  await assertIdentity(client, qualifiedTarget)
  const rows = await readRows(client)
  validateBaselineRows(rows)
  if (canonicalRows(rows) !== canonicalRows(snapshot.ledger)) throw new Error('Baseline row metadata changed')
  const anchors = await readAttestedLedgers(client)
  const integrity = evaluateLedgerIntegrity({ rows, journals: lineageJournals({ journalPath, migrationsDir }), attested: anchors })
  if (!integrity.ok) throw new Error(`Historical ledger integrity: ${integrity.violations.join('; ')}`)
  return { targetHost: target.host, database: target.database, sourceSha: SOURCE_SHA,
      qualificationSha256: target.qualificationSha256,
    snapshotSha256: SNAPSHOT_SHA256, originalLedgerDigest: BASELINE_LEDGER_DIGEST,
    attestationAnchors: anchors, planned: executionPlans.map(({ statements: _statements, ...evidence }) => evidence), mutation: false }
}

/** Actual DDL and durable receipt commit together; ledger and old anchors stay byte-equivalent. */
export async function reconcileClone(client, { snapshot, journalPath, migrationsDir, qualifiedTarget }) {
  const target = targetBinding(qualifiedTarget)
  requireVerifiedSnapshot(snapshot)
  const executionPlans = plans(migrationsDir)
  await client.query('BEGIN')
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('ue-staging-lineage-recovery-20261022'))")
    await client.query('LOCK TABLE drizzle.__drizzle_migrations IN SHARE ROW EXCLUSIVE MODE')
    await assertIdentity(client, qualifiedTarget)
    const before = await readRows(client)
    validateBaselineRows(before)
    if (canonicalRows(before) !== canonicalRows(snapshot.ledger)) throw new Error('Baseline row metadata changed')
    const attestationsTable = await client.query("SELECT to_regclass('drizzle.bootstrap_attestations') AS regclass")
    if (attestationsTable.rows[0]?.regclass) await client.query('LOCK TABLE drizzle.bootstrap_attestations IN SHARE MODE')
    const anchors = await readAttestedLedgers(client)
    const integrity = evaluateLedgerIntegrity({ rows: before, journals: lineageJournals({ journalPath, migrationsDir }), attested: anchors })
    if (!integrity.ok) throw new Error(`Historical ledger integrity: ${integrity.violations.join('; ')}`)
    await client.query(`CREATE TABLE IF NOT EXISTS drizzle.ue_staging_lineage_recovery
      (recovery_id text PRIMARY KEY, payload jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now())`)
    const existing = await client.query("SELECT payload FROM drizzle.ue_staging_lineage_recovery WHERE recovery_id='20261022-clone-0010-0012'")
    if (existing.rows.length) throw new Error('Recovery already recorded; validate the existing receipt instead of replaying')
    for (const plan of executionPlans) for (const statement of plan.statements) await client.query(statement)
    const checks = await postconditions(client, executionPlans, snapshot)
    const after = await readRows(client)
    if (canonicalRows(before) !== canonicalRows(after) || JSON.stringify(anchors) !== JSON.stringify(await readAttestedLedgers(client))) {
      throw new Error('Recovery altered historical ledger rows or attestation anchors')
    }
    const receipt = {
      version: 1, targetHost: target.host, database: target.database, sourceSha: SOURCE_SHA,
      qualificationSha256: target.qualificationSha256,
      snapshotSha256: SNAPSHOT_SHA256, originalLedgerDigest: BASELINE_LEDGER_DIGEST,
      originalLedgerRows: before, attestationAnchors: anchors,
      executed: executionPlans.map(({ statements: _statements, ...evidence }) => evidence),
      postconditions: checks, observedAt: new Date().toISOString(),
      qualification: 'HISTORICAL_LINEAGE_DDL_RECONCILED_ONLY',
    }
    await client.query("INSERT INTO drizzle.ue_staging_lineage_recovery (recovery_id,payload) VALUES ('20261022-clone-0010-0012',$1::jsonb)", [JSON.stringify(receipt)])
    await client.query('COMMIT')
    return receipt
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

/** Explicit adapter for future executor/status callers. No production default helper changes. */
export async function recoveryContext(client, { snapshot, journalPath, migrationsDir, qualifiedTarget }) {
  const target = targetBinding(qualifiedTarget)
  requireVerifiedSnapshot(snapshot)
  await assertIdentity(client, qualifiedTarget)
  const rows = await readRows(client)
  if (canonicalRows(rows.slice(0, 15)) !== canonicalRows(snapshot.ledger)) throw new Error('Recovery baseline prefix changed')
  const result = await client.query("SELECT payload FROM drizzle.ue_staging_lineage_recovery WHERE recovery_id='20261022-clone-0010-0012'")
  const receipt = result.rows[0]?.payload
  const expected = plans(migrationsDir).map(({ statements: _statements, ...evidence }) => evidence)
  if (!receipt || receipt.targetHost !== target.host || receipt.database !== target.database || (receipt.qualificationSha256 ?? null) !== target.qualificationSha256 || receipt.sourceSha !== SOURCE_SHA ||
      receipt.version !== 1 || receipt.qualification !== 'HISTORICAL_LINEAGE_DDL_RECONCILED_ONLY' ||
      receipt.snapshotSha256 !== SNAPSHOT_SHA256 || receipt.originalLedgerDigest !== BASELINE_LEDGER_DIGEST ||
      canonicalRows(receipt.originalLedgerRows ?? []) !== canonicalRows(snapshot.ledger) || canonicalJSON(receipt.executed) !== canonicalJSON(expected)) {
    throw new Error('Recovery receipt absent or inconsistent')
  }
  const anchors = await readAttestedLedgers(client)
  if (canonicalJSON(anchors.slice(0, receipt.attestationAnchors?.length)) !== canonicalJSON(receipt.attestationAnchors)) {
    throw new Error('Recovery attestation anchors changed')
  }
  const journals = lineageJournals({ journalPath, migrationsDir })
  const integrity = evaluateLedgerIntegrity({ rows, journals, attested: anchors })
  if (!integrity.ok) throw new Error(`Recovered ledger integrity: ${integrity.violations.join('; ')}`)
  await postconditions(client, plans(migrationsDir), snapshot)
  const context = {
    receipt,
    target,
    journal: journals[0],
    journals,
    appliedHashes: new Set([...rows.map((row) => row.hash), ...BINDINGS.map((binding) => binding.current)]),
  }
  verifiedContexts.set(context, { client, options: { snapshot, journalPath, migrationsDir, qualifiedTarget } })
  return context
}

/** Caller cannot fabricate an alias context; revalidate live state before each use. */
export async function validateRecoveryContext(client, context) {
  const registered = verifiedContexts.get(context)
  if (!registered || registered.client !== client) throw new Error('Unverified staging recovery context')
  return recoveryContext(client, registered.options)
}
