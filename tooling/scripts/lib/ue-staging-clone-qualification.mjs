/** Signed technical clone qualification. This is not production authority. */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { isolationDefects } from './union-eyes-staging-proof.mjs'
import { evaluateLedgerIntegrity, ledgerDigest } from './union-eyes-migration-ledger.mjs'

export const DOMAIN = 'UE_STAGING_CLONE_QUALIFICATION_V1\n'
export const TRUST_SHA256 = 'f641898c7f07971b975155d0e8c82e97b21e2908ee0cc4424fdfc5b04d22825a'
export const KEY_PATH = 'ops/change-records/CHG-2026-0112.delegated-security.pub'
export const CLONE_HOST = 'nzila-ue-recovery-20261022.postgres.database.azure.com'
export const LIVE_HOST = 'nzila-staging-db.postgres.database.azure.com'
export const DATABASE = 'nzila_os_staging'
export const BASELINE_SNAPSHOT = '6919e4839af8b88d5949bcb070e60187488b2c1dc116c54e35f7e6c7c3c6bae5'
export const BASELINE_LEDGER = 'e3393651c8fddf33e84617e1fa7a2f87cfad8e155ce307ac2c7ba9b3ceffaa90'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const HASH = /^[a-f0-9]{64}$/
const SHA = /^[a-f0-9]{40}$/
const targets = new WeakMap()
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const fail = (message) => { throw new Error(`Clone qualification refused: ${message}`) }
const exact = (object, keys) => {
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).sort().join('|') !== keys.slice().sort().join('|')) fail('Unexpected schema fields')
}

/** Generic crypto primitive for test vectors; production loader additionally pins PEM bytes. */
export function verifyQualificationSignature(bytes, signature, pem) {
  const key = crypto.createPublicKey(pem)
  const text = signature.trim()
  const decoded = Buffer.from(text, 'base64')
  if (key.asymmetricKeyType !== 'ed25519' || !/^[A-Za-z0-9+/]{86}==$/.test(text) || decoded.length !== 64 || decoded.toString('base64') !== text ||
      !crypto.verify(null, Buffer.concat([Buffer.from(DOMAIN), bytes]), key, decoded)) fail('Signature/domain invalid')
}

function confinedFile(base, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some((part) => !part || part === '.' || part === '..')) fail('Unsafe evidence path')
  const root = fs.realpathSync(base)
  const file = fs.realpathSync(path.join(root, relative))
  if (!file.startsWith(root + path.sep) || !fs.statSync(file).isFile()) fail('Evidence escapes custody directory')
  return file
}

function canonicalMigrations(root) {
  return ['migrations-cache', 'migrations-platform'].map((directory) => {
    const base = `apps/union-eyes/db/${directory}`
    const journal = JSON.parse(fs.readFileSync(path.join(root, base, 'meta/_journal.json'), 'utf8'))
    return journal.entries.map((entry) => ({ tag: entry.tag, hash: sha256(fs.readFileSync(path.join(root, base, entry.tag + '.sql'))) }))
  })
}

export function validateQualification(m, proofs, { now = Date.now(), sourceSha, scoped, platform, baselineTables } = {}) {
  exact(m, ['version','kind','mission','changeRecordId','environment','productionAuthorized','qualifiedSourceSha','baselineSourceSha','issuedAt','expiresAt','cloneHost','liveHost','database','baselineSnapshotSha256','baselineLedgerDigest','frontendDigest','backendDigest','scoped','platform','proofs'])
  if (m.version !== 1 || m.kind !== 'staging-clone-qualification' || m.mission !== 'UE-STAGING-RECOVERY-TO-GO' || m.changeRecordId !== 'CHG-2026-0112' ||
      m.environment !== 'STAGING' || m.productionAuthorized !== false || m.cloneHost !== CLONE_HOST || m.liveHost !== LIVE_HOST || m.database !== DATABASE ||
      m.baselineSnapshotSha256 !== BASELINE_SNAPSHOT || m.baselineLedgerDigest !== BASELINE_LEDGER || m.baselineSourceSha !== '65bc9b798a15c3d96c00a60f91cb9cc7de72cf16' ||
      !SHA.test(m.qualifiedSourceSha) || m.qualifiedSourceSha !== sourceSha || !/^sha256:[a-f0-9]{64}$/.test(m.frontendDigest) || !/^sha256:[a-f0-9]{64}$/.test(m.backendDigest)) fail('Mission/target/source/image binding invalid')
  const issued = Date.parse(m.issuedAt), expires = Date.parse(m.expiresAt)
  if (![issued, expires, now].every(Number.isFinite) || issued > now || expires <= now || expires <= issued || expires - issued > 24 * 60 * 60 * 1000 ||
      now - issued > 24 * 60 * 60 * 1000 || expires > Date.parse('2026-10-27T13:16:59Z')) fail('Expired or invalid validity window')
  if (scoped?.length !== 20 || platform?.length !== 16 || JSON.stringify(m.scoped) !== JSON.stringify(scoped) || JSON.stringify(m.platform) !== JSON.stringify(platform)) fail('Exact 20 scoped/16 platform hashes required')
  exact(m.proofs, ['schema','authority','isolation','preservation','restore','images','lineage','ownershipAdapter'])
  if (!proofs || Object.keys(m.proofs).some((kind) => !proofs[kind])) fail('Linked proof missing')
  for (const [kind, proof] of Object.entries(proofs)) {
    if (!Object.hasOwn(m.proofs, kind) || proof.targetHost !== CLONE_HOST || proof.database !== DATABASE || proof.qualifiedSourceSha !== sourceSha) fail('Proof target/source binding invalid')
    const observed = Date.parse(proof.observedAt)
    if (!Number.isFinite(observed) || observed > issued || observed < issued - 24 * 60 * 60 * 1000) fail('Proof freshness invalid')
  }
  const schema = proofs.schema
  if (JSON.stringify(schema.scoped) !== JSON.stringify(scoped) || JSON.stringify(schema.platform) !== JSON.stringify(platform) ||
      !Array.isArray(schema.djangoApplied) || schema.djangoApplied.length < 92 || new Set(schema.djangoApplied).size !== schema.djangoApplied.length ||
      !Array.isArray(schema.djangoPending) || schema.djangoPending.length || schema.migrateCheck?.exitCode !== 0 || schema.migrateCheck?.command !== 'python manage.py migrate --check') fail('Actual migration completion evidence invalid')
  const ledgerHashes = new Set((schema.ledger ?? []).map((row) => row.hash))
  const historical = ['806d257e54f400b3c6aebb44f87d1d187b95867fb01290d29e8e39c9a57965ea','6fe35fcf28c5c7eb6526cc6fc9f8fc0caea211e517d277f46c7b83851f29bef3','79ccce73f37552b45fff57726d7c00f1e5ebe11acd7305f30b74b4583dddad90']
  if (proofs.lineage.bindings?.some((binding, index) => binding.historical !== historical[index]) || ledgerDigest((schema.ledger ?? []).slice(0,15)) !== BASELINE_LEDGER ||
      !evaluateLedgerIntegrity({ rows: schema.ledger ?? [], journals: [{ name: 'scoped', entries: scoped.map((entry,index) => ({ ...entry, hash: index>=10 && index<=12 ? historical[index-10] : entry.hash })) }, { name: 'platform', entries: platform }], attested: schema.attestationAnchors }).ok) fail('Historical ledger/prefix/anchors invalid')
  if (schema.ledger?.length !== 36 || ledgerHashes.size !== 36 || !platform.every((entry) => ledgerHashes.has(entry.hash)) ||
      !scoped.every((entry, index) => ledgerHashes.has(index >= 10 && index <= 12 ? proofs.lineage.bindings?.[index - 10]?.historical : entry.hash))) fail('Actual shared ledger coverage invalid')
  const authority = proofs.authority
  for (const name of ['union_eyes_runtime', 'union_eyes_system']) {
    const role = authority.roles?.find((role) => role.rolname === name)
    if (!role || role.rolsuper !== false || role.rolbypassrls !== false || role.rolcreaterole !== false || role.rolcreatedb !== false) fail('Actual runtime/system role attributes unsafe')
  }
  const requiredTables = ['grievances','documents','grievance_deadlines','deadline_reminders','deadline_reminder_executions','deadline_audit_events','deadline_reassignment_convergence','ue_cognition_memory','ue_reasoning_sessions','ue_copilot_conversations']
  for (const name of requiredTables) {
    const table = authority.rls?.find((table) => table.schema === 'public' && table.relname === name)
    if (!table || table.relrowsecurity !== true || table.relforcerowsecurity !== true || !table.owner || ['union_eyes_runtime','union_eyes_system'].includes(table.owner)) fail('Actual FORCE RLS/catalog ownership invalid')
    const policies = authority.policies?.filter((policy) => policy.schemaname === 'public' && policy.tablename === name)
    if (!policies?.length || policies.some((policy) => String(policy.roles).includes('public') || /coalesce\s*\(\s*nullif/i.test(policy.qual ?? '') || /coalesce\s*\(\s*nullif/i.test(policy.with_check ?? ''))) fail('Actual policy closure invalid')
  }
  const isolation = proofs.isolation
  if (isolationDefects(isolation.result, { databaseBaseline: BASELINE_LEDGER, acceptanceFixture: isolation.result?.fixture }, { releaseSha: sourceSha }).length ||
      isolation.result?.fixture?.databaseName !== DATABASE) fail('Actual two-tenant SQL isolation evidence invalid')
  const preserved = proofs.preservation.tables
  if (!Array.isArray(preserved) || !preserved.length || new Set(preserved.map((item) => item.schema + '.' + item.table)).size !== preserved.length ||
      preserved.some((item) => !item.schema || !item.table || !Array.isArray(item.columns) || !item.columns.length || !Number.isSafeInteger(item.before?.count) || item.before.count < 0 ||
        item.before.count !== item.after?.count || !HASH.test(item.before.sha256 ?? '') || !HASH.test(item.after?.sha256 ?? '') ||
        (item.before.sha256 !== item.after.sha256 && !verifiedMembershipBackfill(item, platform)))) fail('Data preservation counts/digests invalid')
  const covered = new Set(preserved.map((item) => item.schema + '.' + item.table))
  if (!Array.isArray(baselineTables) || !baselineTables.length || baselineTables.some((table) => !covered.has(table))) fail('Preservation coverage omits baseline tables')
  const restore = proofs.restore
  if (restore.sourceServer !== 'nzila-staging-db' || restore.cloneServer !== 'nzila-ue-recovery-20261022' || restore.location !== 'canadacentral' ||
      restore.cloneResourceId !== '/subscriptions/5d819f33-d16f-429c-a3c0-5b0e94740ba3/resourceGroups/nzila-staging-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/nzila-ue-recovery-20261022' ||
      restore.state !== 'Ready' || restore.version !== '15' || !Number.isFinite(Date.parse(restore.completedAt)) || !Number.isFinite(Date.parse(restore.restorePoint)) || Date.parse(restore.restorePoint) > Date.parse(restore.completedAt) ||
      !Number.isFinite(Date.parse(restore.startedAt)) || Date.parse(restore.completedAt) <= Date.parse(restore.startedAt)) fail('Actual restore identity/timing invalid')
  for (const [kind, digest] of [['frontend', m.frontendDigest], ['backend', m.backendDigest]]) {
    const image = proofs.images[kind]
    if (image?.digest !== digest || image?.labels?.['org.opencontainers.image.revision'] !== sourceSha || image?.labels?.['org.opencontainers.image.source'] !== 'https://github.com/anungis437/nzila-os') fail('Actual immutable image provenance invalid')
  }
  const lineage = proofs.lineage
  if (lineage.snapshotSha256 !== BASELINE_SNAPSHOT || lineage.originalLedgerDigest !== BASELINE_LEDGER || lineage.executed?.length !== 3 ||
      !lineage.executed.every((entry, index) => entry.current === scoped[index + 10].hash && Array.isArray(entry.statementDigests) && entry.statementDigests.length && entry.statementDigests.every((hash) => HASH.test(hash))) ||
      JSON.stringify(lineage.bindings?.map(({ tag, current }) => ({ tag, current }))) !== JSON.stringify(scoped.slice(10, 13).map(({ tag, hash }) => ({ tag, current: hash })))) fail('Executed historical lineage evidence invalid')
  const owner = proofs.ownershipAdapter
  if (owner.sourceHash !== '1b383028f528daa86b079662688d072e9c60ac9e96ce607810449b9148c27f48' ||
      owner.originalStatementHash !== 'b3e33c3c4cccfd00a9852c6aadc170eaca41063cc149b96c1809e0bdca011c8d' || !HASH.test(owner.executedStatementHash ?? '') ||
      owner.executedStatementHash === owner.originalStatementHash || owner.executionBytesIdenticalToSource !== false || !owner.exactPatch?.grant || !owner.exactPatch?.revoke ||
      owner.executor?.superuser !== false || owner.executor?.database !== DATABASE || JSON.stringify(owner.membershipsBefore) !== JSON.stringify(owner.membershipsAfter) ||
      owner.readerAttributes?.length !== 1 || Object.entries(owner.readerAttributes[0]).some(([key,value]) => key !== 'rolname' && value !== false) ||
      owner.functionOwners?.length !== 2 || owner.functionOwners.some((row) => row.owner !== 'ue_framework_authority_reader')) fail('Truthful 0017 execution/cleanup evidence invalid')
  return m
}

/** No API can register an arbitrary target: only a fully verified signed receipt can. */
export function loadQualifiedLiveTarget({ receiptPath, signaturePath, receiptSha256, snapshotPath }) {
  const bytes = fs.readFileSync(receiptPath)
  if (!HASH.test(receiptSha256 ?? '') || sha256(bytes) !== receiptSha256) fail('Receipt digest mismatch')
  const pem = fs.readFileSync(path.join(ROOT, KEY_PATH))
  if (sha256(pem) !== TRUST_SHA256) fail('Pinned delegated trust mismatch')
  verifyQualificationSignature(bytes, fs.readFileSync(signaturePath, 'utf8'), pem)
  const m = JSON.parse(bytes)
  const proofs = {}
  for (const [kind, reference] of Object.entries(m.proofs ?? {})) {
    exact(reference, ['path','sha256'])
    const data = fs.readFileSync(confinedFile(path.dirname(receiptPath), reference.path))
    if (!HASH.test(reference.sha256 ?? '') || sha256(data) !== reference.sha256) fail('Linked proof digest mismatch')
    proofs[kind] = JSON.parse(data)
  }
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  const [scoped, platform] = canonicalMigrations(ROOT)
  const snapshotBytes = fs.readFileSync(snapshotPath)
  if (sha256(snapshotBytes) !== BASELINE_SNAPSHOT) fail('Original baseline snapshot mismatch')
  const snapshot = JSON.parse(snapshotBytes)
  const baselineTables = [...new Set(snapshot.rls.filter((table) => table.schema === 'public').map((table) => 'public.' + table.relname))]
  validateQualification(m, proofs, { sourceSha, scoped, platform, baselineTables })
  // Bind every source-critical tracked file to the reviewed commit, excluding
  // the seven unrelated classified untracked residuals retained by the mission.
  const changed = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'tooling/scripts', 'tooling/security', 'apps/union-eyes/backend', 'apps/union-eyes/db', '.github/workflows'], { cwd: ROOT, encoding: 'utf8' }).trim()
  if (changed) fail('Qualified source has uncommitted tracked changes')
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'tooling/scripts', 'tooling/security', 'apps/union-eyes/backend', 'apps/union-eyes/db', '.github/workflows'], { cwd: ROOT, encoding: 'utf8' }).trim()
  if (untracked) fail('Qualified source contains untracked executable files')
  const target = Object.freeze({ host: LIVE_HOST, database: DATABASE, qualificationSha256: receiptSha256, qualifiedSourceSha: sourceSha })
  targets.set(target, { receiptPath, signaturePath, receiptSha256, snapshotPath })
  return target
}

/** The sole observed non-identity transformation is canonical platform 0005's NULL category backfill. */
export function verifiedMembershipBackfill(item, platform) {
  const proof = item.transformation
  const migration = platform.find((entry) => entry.tag === '0005_organization_members_deleted_at')
  return item.schema === 'public' && item.table === 'organization_members' && proof?.kind === 'canonical-null-category-backfill' &&
    proof.migrationSha256 === migration?.hash && HASH.test(proof.migrationSha256 ?? '') &&
    proof.column === 'member_category' && proof.originalValue === null && proof.resultValue === 'full_member' &&
    proof.originalProjectionSha256 === item.before.sha256 && proof.currentSha256 === item.after.sha256 &&
    proof.rowCount === item.before.count && proof.resultValueCount === item.before.count &&
    proof.unexpectedOriginalColumnChanges === 0 && item.before.count > 0
}

export function revalidateQualifiedLiveTarget(target) {
  const options = targets.get(target)
  if (!options) fail('Unverified live target context')
  return loadQualifiedLiveTarget(options)
}

export function qualifiedTargetFromArgs(args, snapshotPath) {
  const names = ['--qualified-clone-receipt','--qualified-clone-signature','--qualified-clone-sha256']
  if (!names.some((name) => args.includes(name))) return undefined
  const values = names.map((name) => {
    if (args.filter((value) => value === name).length !== 1) fail('All three explicit qualification options required exactly once')
    const value = args[args.indexOf(name) + 1]
    if (!value || value.startsWith('--')) fail('Qualification option value missing')
    return value
  })
  if (!snapshotPath) fail('Exact baseline snapshot option required')
  return loadQualifiedLiveTarget({ receiptPath: values[0], signaturePath: values[1], receiptSha256: values[2], snapshotPath })
}
