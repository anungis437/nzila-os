import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const TRUST_SHA256 = 'f641898c7f07971b975155d0e8c82e97b21e2908ee0cc4424fdfc5b04d22825a'
export const DOMAIN = 'UE_STAGING_SECURITY_REVIEW_V1\n'
export const RECEIPT_PATH = 'ops/change-records/CHG-2026-0112.delegated-security-review.json'
export const SIGNATURE_PATH = 'ops/change-records/CHG-2026-0112.delegated-security-review.sig'
export const KEY_PATH = 'ops/change-records/CHG-2026-0112.delegated-security.pub'
export const BASE = '65bc9b798a15c3d96c00a60f91cb9cc7de72cf16'
export const RESOURCES = Object.freeze({ subscription: '5d819f33-d16f-429c-a3c0-5b0e94740ba3', tenant: '5082b8be-b04d-4a13-b61c-b6397670177b', app: 'nzila-os-union-eyes-staging', appResourceGroup: 'nzila-canada-staging-rg', server: 'nzila-staging-db', databaseResourceGroup: 'nzila-staging-rg', database: 'nzila_os_staging', clone: 'nzila-ue-recovery-20261022', keyVault: 'nzila-staging-kv', region: 'canadacentral' })
const HASH = /^[a-f0-9]{64}$/
const SHA = /^[a-f0-9]{40}$/
const END = Date.parse('2026-10-27T13:16:59Z')
const EXACT_PATHS = new Set([
  '.gitattributes',
  'tooling/repo-inventory/output/inventory.json', 'tooling/repo-inventory/output/inventory.md',
  'tooling/repo-inventory/output/repo-inventory.json', 'tooling/repo-inventory/output/repo-inventory.md',
  '.github/workflows/security-design-review.yml', '.github/workflows/ue-build-push-proof.yml', '.github/workflows/ue-staging-discovery.yml',
  '.github/workflows/deploy-union-eyes.yml',
  '.github/workflows/deploy-union-eyes.yml',
  KEY_PATH, 'ops/change-records/CHG-2026-0112.json', 'ops/change-records/CHG-2026-0112.staging-authorization.md',
  'packages/platform-auth/src/entra/config.ts', 'packages/platform-auth/src/entra/issuer.ts', 'packages/platform-auth/src/entra/issuer.test.ts',
  'packages/platform-change-management/src/approvals.ts', 'packages/platform-change-management/src/types.ts', 'packages/platform-change-management/src/schemas.ts', 'packages/platform-change-management/src/staging-authorization.test.ts',
  'tooling/scripts/apply-union-eyes-scoped-migrations-existing-env.mjs', 'tooling/scripts/lib/ue-staging-historical-lineage.mjs', 'tooling/scripts/lib/ue-staging-historical-lineage.test.mjs', 'tooling/scripts/lib/union-eyes-migration-ledger.mjs', 'tooling/scripts/lib/union-eyes-scoped-migrations.mjs', 'tooling/scripts/ue-staging-discovery.mjs', 'tooling/scripts/ue-staging-reconcile-lineage.mjs',
  'tooling/scripts/lib/ue-staging-0017-ownership.mjs', 'tooling/scripts/lib/ue-staging-0017-ownership.test.mjs',
  'tooling/scripts/lib/union-eyes-deployment-safety.mjs', 'tooling/scripts/lib/union-eyes-deployment-safety.test.mjs',
  'tooling/security/ue-staging-delegated-review.mjs', 'tooling/security/ue-staging-delegated-review.test.mjs',
  'tooling/scripts/lib/ue-staging-0017-ownership.mjs', 'tooling/scripts/lib/ue-staging-0017-ownership.test.mjs',
  'tooling/scripts/lib/ue-staging-clone-qualification.mjs', 'tooling/scripts/lib/ue-staging-clone-qualification.test.mjs',
  'tooling/scripts/lib/union-eyes-deployment-safety.mjs', 'tooling/scripts/lib/union-eyes-deployment-safety.test.mjs',
])
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const fail = message => { throw new Error(message) }
function exactKeys(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail(`Invalid fields: ${name}`)
}
export function allowedPath(name) {
  return typeof name === 'string' && !name.includes('\\') && !name.split('/').some(part => ['.', '..', ''].includes(part)) && !/[\x00-\x1f]/.test(name) && (EXACT_PATHS.has(name) || name.startsWith('apps/union-eyes/'))
}

/** Signature verifies immutable UTF-8 bytes, never JSON reserialization. */
export function verifyEnvelope(bytes, signatureText, pem, now = Date.now()) {
  if (sha256(pem) !== TRUST_SHA256) fail('Untrusted public key bytes')
  verifyDetached(bytes, signatureText, pem)
  return validateManifest(JSON.parse(bytes.toString('utf8')), now)
}
export function verifyDetached(bytes, signatureText, pem) {
  const key = crypto.createPublicKey(pem)
  if (key.asymmetricKeyType !== 'ed25519') fail('Wrong key algorithm')
  const signature = signatureText.trim()
  if (!/^[A-Za-z0-9+/]{86}==$/.test(signature)) fail('Noncanonical detached signature')
  const decoded = Buffer.from(signature, 'base64')
  if (decoded.length !== 64 || decoded.toString('base64') !== signature || !crypto.verify(null, Buffer.concat([Buffer.from(DOMAIN), bytes]), key, decoded)) fail('Signature invalid')
}
export function validateManifest(m, now = Date.now()) {
  exactKeys(m, ['version','purpose','repository','pullRequest','branch','baseSha','sourceSha','sourceTree','mission','changeRecordId','environment','owner','operator','instructionSha256','issuedAt','expiresAt','resources','productionAuthorized','runtimeProofRequired','signedReleaseRequired','files','reviews','tests','limitations'], 'manifest')
  if (m.version !== 1 || m.purpose !== 'staging-security-review' || m.repository !== 'anungis437/nzila-os' || m.pullRequest !== 984 || m.branch !== 'ops/ue-staging-recovery-20261022' || m.baseSha !== BASE || !SHA.test(m.sourceSha) || !SHA.test(m.sourceTree)) fail('Source/repository/PR binding invalid')
  if (m.mission !== 'UE-STAGING-RECOVERY-TO-GO' || m.changeRecordId !== 'CHG-2026-0112' || m.environment !== 'STAGING' || m.owner !== 'anungis437' || m.operator !== 'Codex' || m.instructionSha256 !== '681844e4f18424c1e592dfd1db205afc66d5c7a3d647c91006dc8f5d2dcbb2e3') fail('Mission or attribution invalid')
  if (m.productionAuthorized !== false || m.runtimeProofRequired !== true || m.signedReleaseRequired !== true) fail('Production/proof boundary invalid')
  exactKeys(m.resources, Object.keys(RESOURCES), 'resources')
  if (!Object.entries(RESOURCES).every(([k,v]) => m.resources[k] === v)) fail('Resource scope invalid')
  const issued = Date.parse(m.issuedAt), expires = Date.parse(m.expiresAt)
  if (![issued,expires,now].every(Number.isFinite) || issued > now || now >= expires || expires > END || expires <= issued || now - issued > 72*60*60*1000) fail('Review validity window invalid')
  if (!Array.isArray(m.files) || !m.files.length || new Set(m.files.map(f=>f.path)).size !== m.files.length) fail('Missing or duplicate source coverage')
  for (const f of m.files) {
    exactKeys(f, ['path','status','previousPath','blobSha','sha256','baseBlobSha','baseSha256'], 'file')
    if (!allowedPath(f.path) || (f.previousPath !== null && !allowedPath(f.previousPath)) || !['added','modified','removed','renamed'].includes(f.status)) fail('Unreviewable source path/status')
    if ((f.status === 'removed' ? f.blobSha !== null || f.sha256 !== null : !SHA.test(f.blobSha) || !HASH.test(f.sha256)) || (f.status === 'added' ? f.baseBlobSha !== null || f.baseSha256 !== null : !SHA.test(f.baseBlobSha) || !HASH.test(f.baseSha256)) || (f.status === 'renamed' ? !f.previousPath : f.previousPath !== null)) fail('File hash/status binding invalid')
  }
  for (const required of [KEY_PATH,'.github/workflows/security-design-review.yml','tooling/security/ue-staging-delegated-review.mjs']) if (!m.files.some(f=>f.path===required && f.status !== 'removed')) fail('Gate amendment itself missing from review')
  if (!Array.isArray(m.reviews) || !m.reviews.length || !Array.isArray(m.tests) || !m.tests.length || !Array.isArray(m.limitations)) fail('Review/test evidence missing')
  for (const review of m.reviews) {
    exactKeys(review,['kind','agentTask','reviewedAt','report','reportSha256','unresolvedP0','unresolvedP1'], 'review')
    if (review.kind !== 'separate-agent-review' || typeof review.agentTask !== 'string' || !/^\/root\/[a-z0-9_]+$/.test(review.agentTask) || !review.report || sha256(Buffer.from(review.report)) !== review.reportSha256 || !Number.isFinite(Date.parse(review.reviewedAt)) || Date.parse(review.reviewedAt)>issued || review.unresolvedP0 !== 0 || review.unresolvedP1 !== 0) fail('Agent review attribution/report/findings invalid')
  }
  for (const test of m.tests) {
    exactKeys(test,['command','result','passed','logSha256'], 'test')
    if (typeof test.command !== 'string' || !test.command || test.result !== 'PASS' || !Number.isInteger(test.passed) || test.passed < 1 || !HASH.test(test.logSha256)) fail('Actual passing test evidence missing')
  }
  return m
}

/** API adapter is read-only; all failures throw, including incomplete pagination. */
export async function verifyPullRequest(m, api) {
  const pr = await api.get('pulls/984')
  if (pr.number !== 984 || pr.state !== 'open' || pr.user?.login !== 'anungis437' || pr.base?.ref !== 'main' || pr.base?.sha !== BASE || pr.base?.repo?.full_name !== m.repository || pr.head?.repo?.full_name !== m.repository || pr.head?.ref !== m.branch || !SHA.test(pr.head.sha)) fail('Actual PR identity invalid')
  const evidence = await api.get(`git/commits/${pr.head.sha}`)
  if (evidence.parents?.length !== 1 || evidence.parents[0].sha !== m.sourceSha) fail('Evidence commit must be direct sole-parent child of reviewed source')
  const source = await api.get(`git/commits/${m.sourceSha}`)
  if (source.tree?.sha !== m.sourceTree) fail('Actual reviewed tree differs')
  const changes = await api.pages(`commits/${pr.head.sha}`, 'files')
  if (changes.length !== 2 || ![RECEIPT_PATH,SIGNATURE_PATH].every(name=>changes.some(f=>f.filename===name && ['added','modified'].includes(f.status)))) fail('Evidence commit contains unreviewed edits')
  const files = await api.pages('pulls/984/files')
  if (files.length !== pr.changed_files || files.length > 3000) fail('Incomplete paginated PR coverage')
  const actual = files.filter(f=>![RECEIPT_PATH,SIGNATURE_PATH].includes(f.filename))
  if (actual.length !== m.files.length) fail('Source coverage differs from actual PR')
  const sourceTree = await api.get(`git/trees/${m.sourceTree}?recursive=1`)
  const baseCommit = await api.get(`git/commits/${BASE}`)
  const baseTree = await api.get(`git/trees/${baseCommit.tree.sha}?recursive=1`)
  if (sourceTree.truncated || baseTree.truncated) fail('Truncated source tree')
  const blob = async (sha, expected) => { const b=await api.get(`git/blobs/${sha}`); const bytes=Buffer.from(b.content??'','base64'); if(b.encoding!=='base64' || b.sha!==sha || sha256(bytes)!==expected) fail('Git blob bytes differ from signed review');return bytes }
  for (const f of m.files) {
    const a=actual.find(a=>a.filename===f.path)
    if (!a || a.status !== f.status || (a.previous_filename??null)!==f.previousPath) fail('Actual changed-file identity differs')
    const s=sourceTree.tree.find(t=>t.path===f.path)
    let sourceBytes,baseBytes
    if(f.status==='removed'){if(s)fail('Removed source still exists')}else{if(s?.type!=='blob'||s.sha!==f.blobSha||a.sha!==f.blobSha)fail('Source blob identity differs');sourceBytes=await blob(f.blobSha,f.sha256)}
    if(f.status!=='added'){const b=baseTree.tree.find(t=>t.path===(f.previousPath??f.path));if(b?.type!=='blob'||b.sha!==f.baseBlobSha)fail('Base blob identity differs');baseBytes=await blob(f.baseBlobSha,f.baseSha256)}
    if(f.path===KEY_PATH&&sha256(sourceBytes)!==TRUST_SHA256)fail('Reviewed key differs from owner trust')
    if(f.path==='.gitattributes'&&(f.status!=='modified'||sourceBytes.toString('utf8').trimEnd()!==baseBytes.toString('utf8').trimEnd()+'\n'+KEY_PATH+' -text'))fail('Only exact public-key byte preservation attribute is permitted')
  }
  // Detect a head update during verification; no race-induced stale success.
  if ((await api.get('pulls/984')).head.sha !== pr.head.sha) fail('PR head changed during verification')
  return { sourceSha:m.sourceSha,evidenceSha:pr.head.sha,files:m.files.length }
}

async function main() {
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'))
  if(process.env.GITHUB_REPOSITORY!=='anungis437/nzila-os'||event.pull_request?.number!==984)fail('Alternative only applies to mission PR984')
  const token=process.env.GITHUB_TOKEN
  const get=async endpoint=>{const response=await fetch(`https://api.github.com/repos/anungis437/nzila-os/${endpoint}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});if(!response.ok)fail(`GitHub read failed ${response.status}`);return response.json()}
  const pages=async(endpoint,field)=>{const all=[];for(let page=1;page<=31;page++){const result=await get(`${endpoint}${endpoint.includes('?')?'&':'?'}per_page=100&page=${page}`);const rows=field?result[field]:result;if(!Array.isArray(rows))fail('Invalid paginated response');all.push(...rows);if(rows.length<100)return all}fail('Pagination exceeds bound')}
  const pr=await get('pulls/984')
  const content=async name=>{const result=await get(`contents/${name}?ref=${pr.head.sha}`);if(result.encoding!=='base64'||result.type!=='file')fail('Evidence content unavailable');return Buffer.from(result.content,'base64')}
  const bytes=await content(RECEIPT_PATH), signature=await content(SIGNATURE_PATH)
  const pem=fs.readFileSync(new URL('../../'+KEY_PATH,import.meta.url))
  const manifest=verifyEnvelope(bytes,signature.toString('utf8'),pem)
  // Verify that fetched evidence belongs to the same observed head.
  const api={get:async endpoint=>{const r=await get(endpoint);if(endpoint==='pulls/984'&&r.head.sha!==pr.head.sha)fail('Head changed while fetching evidence');return r},pages}
  console.log(JSON.stringify(await verifyPullRequest(manifest,api)))
  console.log('Delegated staging security review verified (agent review, sole-owner authorization); production authorization unchanged')
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1})
