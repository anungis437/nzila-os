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
export const PR_BINDINGS = Object.freeze({
  984: Object.freeze({ base: BASE, branch: 'ops/ue-staging-recovery-20261022', author: 'anungis437' }),
  986: Object.freeze({ base: '441556737ffe0e36c6ec9bf6bd9c24bab5302559', branch: 'fix/ue-auth-storage-callers-20261022', author: 'anungisa' }),
  990: Object.freeze({ base: '9bb8a3fd224ca581838d433688b04860f2e9efc8', branch: 'fix/ue-native-intake-audit-20261022', author: 'anungisa' }),
})
export const RESOURCES = Object.freeze({ subscription: '5d819f33-d16f-429c-a3c0-5b0e94740ba3', tenant: '5082b8be-b04d-4a13-b61c-b6397670177b', app: 'nzila-os-union-eyes-staging', appResourceGroup: 'nzila-canada-staging-rg', server: 'nzila-staging-db', databaseResourceGroup: 'nzila-staging-rg', database: 'nzila_os_staging', clone: 'nzila-ue-recovery-20261022', keyVault: 'nzila-staging-kv', region: 'canadacentral' })
const HASH = /^[a-f0-9]{64}$/
const SHA = /^[a-f0-9]{40}$/
const END = Date.parse('2026-10-27T13:16:59Z')
const EXACT_PATHS = new Set([
  'packages/db/src/auth-storage-authority/duplicate-declarations.ts',
  'packages/db/src/auth-storage-authority/entries.ts',
  '.gitattributes',
  'tooling/repo-inventory/output/inventory.json', 'tooling/repo-inventory/output/inventory.md',
  'tooling/repo-inventory/output/repo-inventory.json', 'tooling/repo-inventory/output/repo-inventory.md',
  '.github/workflows/security-design-review.yml', '.github/workflows/ue-build-push-proof.yml', '.github/workflows/ue-staging-discovery.yml',
  '.github/workflows/deploy-union-eyes.yml',
  '.github/workflows/e2e.yml',
  'tooling/ci/ue-e2e-shard-receipts.mjs', 'tooling/ci/ue-e2e-shard-receipts.test.mjs',
  'tooling/contract-tests/ci-feedback-performance.test.ts',
  '.github/workflows/deploy-union-eyes.yml',
  KEY_PATH, 'ops/change-records/CHG-2026-0112.json', 'ops/change-records/CHG-2026-0112.staging-authorization.md',
  'packages/platform-auth/src/entra/config.ts', 'packages/platform-auth/src/entra/issuer.ts', 'packages/platform-auth/src/entra/issuer.test.ts',
  'packages/platform-auth/src/entra/session-policy.ts', 'packages/platform-auth/src/entra/session-policy.test.ts',
  'packages/platform-change-management/src/approvals.ts', 'packages/platform-change-management/src/types.ts', 'packages/platform-change-management/src/schemas.ts', 'packages/platform-change-management/src/staging-authorization.test.ts',
  'tooling/scripts/apply-union-eyes-scoped-migrations-existing-env.mjs', 'tooling/scripts/lib/ue-staging-historical-lineage.mjs', 'tooling/scripts/lib/ue-staging-historical-lineage.test.mjs', 'tooling/scripts/lib/union-eyes-migration-ledger.mjs', 'tooling/scripts/lib/union-eyes-scoped-migrations.mjs', 'tooling/scripts/ue-staging-discovery.mjs', 'tooling/scripts/ue-staging-reconcile-lineage.mjs',
  'tooling/scripts/lib/ue-staging-0017-ownership.mjs', 'tooling/scripts/lib/ue-staging-0017-ownership.test.mjs',
  'tooling/scripts/lib/union-eyes-deployment-safety.mjs', 'tooling/scripts/lib/union-eyes-deployment-safety.test.mjs',
  'ops/change-records/CHG-2026-0112.owner-instruction.json',
  'tooling/security/ue-staging-delegated-review.mjs', 'tooling/security/ue-staging-delegated-review.test.mjs',
  'tooling/scripts/lib/ue-staging-0017-ownership.mjs', 'tooling/scripts/lib/ue-staging-0017-ownership.test.mjs',
  'tooling/scripts/lib/ue-staging-clone-qualification.mjs', 'tooling/scripts/lib/ue-staging-clone-qualification.test.mjs',
  'tooling/scripts/lib/union-eyes-deployment-safety.mjs', 'tooling/scripts/lib/union-eyes-deployment-safety.test.mjs',
])
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
// This follow-up authorizes only its reviewed application repair and gate amendment.
// It cannot carry dependency, migration, role/grant, trust-key or production-policy changes.
const NATIVE_INTAKE_PATHS = new Set([
  'apps/union-eyes/app/[locale]/dashboard/layout.tsx',
  'apps/union-eyes/app/[locale]/dashboard/__tests__/canonical-dashboard-layout.test.tsx',
  'apps/union-eyes/app/api/cases/intake/route.ts',
  'apps/union-eyes/app/api/__tests__/cases-intake.route.test.ts',
  'apps/union-eyes/lib/audit/canonical-nar-proof.ts',
  'apps/union-eyes/lib/audit/__tests__/canonical-nar-proof.pglite.test.ts',
  'packages/platform-auth/src/entra/config.ts',
  'packages/platform-auth/src/entra/session-policy.ts',
  'packages/platform-auth/src/entra/session-policy.test.ts',
  '.github/workflows/security-design-review.yml',
  'tooling/security/ue-staging-delegated-review.mjs',
  'tooling/security/ue-staging-delegated-review.test.mjs',
  'tooling/repo-inventory/output/inventory.json', 'tooling/repo-inventory/output/inventory.md',
  'tooling/repo-inventory/output/repo-inventory.json', 'tooling/repo-inventory/output/repo-inventory.md',
])
const fail = message => { throw new Error(message) }
function exactKeys(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail(`Invalid fields: ${name}`)
}
export function allowedPath(name) {
  return typeof name === 'string' && !name.includes('\\') && !name.split('/').some(part => ['.', '..', ''].includes(part)) && !/[\x00-\x1f]/.test(name) && (EXACT_PATHS.has(name) || name.startsWith('apps/union-eyes/'))
}

// Only PR986 may include these exact, signed dependency repairs.
const DEPENDENCY_PATHS = ['package.json', 'pnpm-lock.yaml']
const TOOL_DEPENDENCY_PATHS = ['.kilo/package.json', '.kilo/package-lock.json']
const OTEL_DEPENDENCY_PATH = 'packages/otel-core/package.json'
export function validateSanitizerPackageChange(baseBytes, sourceBytes) {
  const base = JSON.parse(baseBytes.toString('utf8'))
  const source = JSON.parse(sourceBytes.toString('utf8'))
  if (base.pnpm?.overrides?.dompurify !== '>=3.4.13' || source.pnpm?.overrides?.dompurify !== '>=3.4.17') fail('Unexpected sanitizer override repair')
  base.pnpm.overrides.dompurify = '>=3.4.17'
  if (Object.hasOwn(base.pnpm.overrides, '@sentry/nextjs') || source.pnpm.overrides['@sentry/nextjs'] !== '10.75.2') fail('Unexpected Sentry security repair')
  base.pnpm.overrides['@sentry/nextjs'] = '10.75.2'
  if (JSON.stringify(base) !== JSON.stringify(source)) fail('Unrelated root package change')
}

const stableJson = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))) : v)
export function validateOtelPackageChange(baseBytes, sourceBytes) {
  const base = JSON.parse(baseBytes.toString('utf8')), source = JSON.parse(sourceBytes.toString('utf8'))
  if (!base.optionalDependencies || Object.hasOwn(base.optionalDependencies, '@fastify/otel') || source.optionalDependencies?.['@fastify/otel'] !== '0.18.0') fail('Unexpected Fastify instrumentation dependency repair')
  base.optionalDependencies['@fastify/otel'] = '0.18.0'
  if (stableJson(base) !== stableJson(source)) fail('Unrelated OTel package change')
}
const TOOL_MANIFEST = {name:'nzila-kilo-local-tooling',private:true,dependencies:{'@kilocode/plugin':'7.2.52'},overrides:{toml:'5.0.1'},engines:{node:'>=20'}}
export function validateToolDependencyChange(name, baseBytes, sourceBytes) {
  const source = JSON.parse(sourceBytes.toString('utf8'))
  if (name === '.kilo/package.json') {
    if (baseBytes || stableJson(source) !== stableJson(TOOL_MANIFEST)) fail('Unexpected local tooling manifest')
    return
  }
  if (name !== '.kilo/package-lock.json' || !baseBytes) fail('Unexpected local tooling lock path')
  const base = JSON.parse(baseBytes.toString('utf8'))
  const old = base.packages?.['node_modules/toml'], patched = source.packages?.['node_modules/toml']
  if (base.lockfileVersion !== 3 || old?.version !== '4.2.0' || patched?.version !== '5.0.1' || patched.resolved !== 'https://registry.npmjs.org/toml/-/toml-5.0.1.tgz' || patched.integrity !== 'sha512-EqYNA/YvUNndrA2B3O2ojzLQoTQrBxeZ9UIjQwk8t10oe6n7dwclBwd9IdZQTOKwe6vWX+AXtl6IntXRbepdxQ==') fail('Unexpected TOML security repair')
  base.name = TOOL_MANIFEST.name
  base.packages[''] = {name:TOOL_MANIFEST.name,dependencies:TOOL_MANIFEST.dependencies,engines:TOOL_MANIFEST.engines}
  base.packages['node_modules/toml'] = {...old,version:patched.version,resolved:patched.resolved,integrity:patched.integrity}
  if (stableJson(base) !== stableJson(source)) fail('Unrelated local tooling lock change')
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
  const binding = Number.isInteger(m.pullRequest) && PR_BINDINGS[m.pullRequest]
  if (m.version !== 1 || m.purpose !== 'staging-security-review' || m.repository !== 'anungis437/nzila-os' || !binding || m.branch !== binding.branch || m.baseSha !== binding.base || !SHA.test(m.sourceSha) || !SHA.test(m.sourceTree)) fail('Source/repository/PR binding invalid')
  if (m.mission !== 'UE-STAGING-RECOVERY-TO-GO' || m.changeRecordId !== 'CHG-2026-0112' || m.environment !== 'STAGING' || m.owner !== 'anungis437' || m.operator !== 'Codex' || m.instructionSha256 !== '681844e4f18424c1e592dfd1db205afc66d5c7a3d647c91006dc8f5d2dcbb2e3') fail('Mission or attribution invalid')
  if (m.productionAuthorized !== false || m.runtimeProofRequired !== true || m.signedReleaseRequired !== true) fail('Production/proof boundary invalid')
  exactKeys(m.resources, Object.keys(RESOURCES), 'resources')
  if (!Object.entries(RESOURCES).every(([k,v]) => m.resources[k] === v)) fail('Resource scope invalid')
  const issued = Date.parse(m.issuedAt), expires = Date.parse(m.expiresAt)
  if (![issued,expires,now].every(Number.isFinite) || issued > now || now >= expires || expires > END || expires <= issued || now - issued > 72*60*60*1000) fail('Review validity window invalid')
  if (!Array.isArray(m.files) || !m.files.length || new Set(m.files.map(f=>f.path)).size !== m.files.length) fail('Missing or duplicate source coverage')
  for (const f of m.files) {
    exactKeys(f, ['path','status','previousPath','blobSha','sha256','baseBlobSha','baseSha256'], 'file')
    if (m.pullRequest === 990 && (!NATIVE_INTAKE_PATHS.has(f.path) ||
      (f.previousPath !== null && !NATIVE_INTAKE_PATHS.has(f.previousPath)))) fail('Native intake follow-up exceeds exact reviewed path scope')
    const dependencyRepair = m.pullRequest === 986 && [...DEPENDENCY_PATHS, OTEL_DEPENDENCY_PATH].includes(f.path) && f.status === 'modified' && f.previousPath === null
    const toolRepair = m.pullRequest === 986 && TOOL_DEPENDENCY_PATHS.includes(f.path) && f.status === (f.path === '.kilo/package.json' ? 'added' : 'modified') && f.previousPath === null
    if ((!allowedPath(f.path) && !dependencyRepair && !toolRepair) || (f.previousPath !== null && !allowedPath(f.previousPath)) || !['added','modified','removed','renamed'].includes(f.status)) fail('Unreviewable source path/status')
    if ((f.status === 'removed' ? f.blobSha !== null || f.sha256 !== null : !SHA.test(f.blobSha) || !HASH.test(f.sha256)) || (f.status === 'added' ? f.baseBlobSha !== null || f.baseSha256 !== null : !SHA.test(f.baseBlobSha) || !HASH.test(f.baseSha256)) || (f.status === 'renamed' ? !f.previousPath : f.previousPath !== null)) fail('File hash/status binding invalid')
  }
  if (m.files.some(f=>DEPENDENCY_PATHS.includes(f.path)) && !DEPENDENCY_PATHS.every(name=>m.files.some(f=>f.path===name && f.status==='modified'))) fail('Sanitizer repair requires package and lockfile coverage')
  if (m.files.some(f=>f.path===OTEL_DEPENDENCY_PATH) && !m.files.some(f=>f.path==='pnpm-lock.yaml' && f.status==='modified')) fail('OTel dependency declaration requires reviewed lock coverage')
  if (m.files.some(f=>TOOL_DEPENDENCY_PATHS.includes(f.path)) && !TOOL_DEPENDENCY_PATHS.every(name=>m.files.some(f=>f.path===name && f.status===(name === '.kilo/package.json' ? 'added' : 'modified')))) fail('Local tooling repair requires exact manifest and lockfile coverage')
  const requiredPaths = ['.github/workflows/security-design-review.yml','tooling/security/ue-staging-delegated-review.mjs']
  if (m.pullRequest === 984) requiredPaths.push(KEY_PATH)
  else if (m.files.some(f=>f.path===KEY_PATH || f.previousPath===KEY_PATH)) fail('Follow-up cannot change delegated trust key')
  for (const required of requiredPaths) if (!m.files.some(f=>f.path===required && f.status !== 'removed')) fail('Gate amendment itself missing from review')
  if (!Array.isArray(m.reviews) || !m.reviews.length || !Array.isArray(m.tests) || !m.tests.length || !Array.isArray(m.limitations)) fail('Review/test evidence missing')
  for (const review of m.reviews) {
    exactKeys(review,['kind','agentTask','reviewedAt','report','reportSha256','unresolvedP0','unresolvedP1'], 'review')
    const attribution = review.kind === 'separate-agent-review' && typeof review.agentTask === 'string' && /^\/root\/[a-z0-9_]+$/.test(review.agentTask)
      || [986, 990].includes(m.pullRequest) && review.kind === 'primary-agent-review' && review.agentTask === '/root'
    if (!attribution || !review.report || sha256(Buffer.from(review.report)) !== review.reportSha256 || !Number.isFinite(Date.parse(review.reviewedAt)) || Date.parse(review.reviewedAt)>issued || review.unresolvedP0 !== 0 || review.unresolvedP1 !== 0) fail('Agent review attribution/report/findings invalid')
  }
  if ([986, 990].includes(m.pullRequest) && !m.reviews.some(r=>r.kind==='primary-agent-review' && r.agentTask==='/root')) fail('Follow-up primary review with explicit attribution required')
  for (const test of m.tests) {
    exactKeys(test,['command','result','passed','logSha256'], 'test')
    if (typeof test.command !== 'string' || !test.command || test.result !== 'PASS' || !Number.isInteger(test.passed) || test.passed < 1 || !HASH.test(test.logSha256)) fail('Actual passing test evidence missing')
  }
  return m
}

/** API adapter is read-only; all failures throw, including incomplete pagination. */
export async function verifyPullRequest(m, api) {
  const binding = Number.isInteger(m.pullRequest) && PR_BINDINGS[m.pullRequest]
  if (!binding || m.baseSha !== binding.base || m.branch !== binding.branch) fail('Source/repository/PR binding invalid')
  const endpoint = `pulls/${m.pullRequest}`
  const pr = await api.get(endpoint)
  if (pr.number !== m.pullRequest || pr.state !== 'open' || pr.user?.login !== binding.author || pr.base?.ref !== 'main' || pr.base?.sha !== binding.base || pr.base?.repo?.full_name !== m.repository || pr.head?.repo?.full_name !== m.repository || pr.head?.ref !== m.branch || !SHA.test(pr.head.sha)) fail('Actual PR identity invalid')
  const evidence = await api.get(`git/commits/${pr.head.sha}`)
  if (evidence.parents?.length !== 1 || evidence.parents[0].sha !== m.sourceSha) fail('Evidence commit must be direct sole-parent child of reviewed source')
  const source = await api.get(`git/commits/${m.sourceSha}`)
  if (source.tree?.sha !== m.sourceTree) fail('Actual reviewed tree differs')
  const changes = await api.pages(`commits/${pr.head.sha}`, 'files')
  if (changes.length !== 2 || ![RECEIPT_PATH,SIGNATURE_PATH].every(name=>changes.some(f=>f.filename===name && ['added','modified'].includes(f.status)))) fail('Evidence commit contains unreviewed edits')
  const files = await api.pages(`${endpoint}/files`)
  if (files.length !== pr.changed_files || files.length > 3000) fail('Incomplete paginated PR coverage')
  const actual = files.filter(f=>![RECEIPT_PATH,SIGNATURE_PATH].includes(f.filename))
  if (actual.length !== m.files.length) fail('Source coverage differs from actual PR')
  const sourceTree = await api.get(`git/trees/${m.sourceTree}?recursive=1`)
  const baseCommit = await api.get(`git/commits/${binding.base}`)
  const baseTree = await api.get(`git/trees/${baseCommit.tree.sha}?recursive=1`)
  if (sourceTree.truncated || baseTree.truncated) fail('Truncated source tree')
  const blob = async (sha, expected) => { const b=await api.get(`git/blobs/${sha}`); const bytes=Buffer.from(b.content??'','base64'); if(b.encoding!=='base64' || b.sha!==sha || sha256(bytes)!==expected) fail('Git blob bytes differ from signed review');return bytes }
  if ([986, 990].includes(m.pullRequest)) {
    const key = sourceTree.tree.find(t=>t.path===KEY_PATH), baseKey = baseTree.tree.find(t=>t.path===KEY_PATH)
    if (key?.type!=='blob' || baseKey?.type!=='blob' || key.sha!==baseKey.sha) fail('Follow-up trust key must match immutable base')
    await blob(key.sha, TRUST_SHA256)
  }
  for (const f of m.files) {
    const a=actual.find(a=>a.filename===f.path)
    if (!a || a.status !== f.status || (a.previous_filename??null)!==f.previousPath) fail('Actual changed-file identity differs')
    const s=sourceTree.tree.find(t=>t.path===f.path)
    let sourceBytes,baseBytes
    if(f.status==='removed'){if(s)fail('Removed source still exists')}else{if(s?.type!=='blob'||s.sha!==f.blobSha||a.sha!==f.blobSha)fail('Source blob identity differs');sourceBytes=await blob(f.blobSha,f.sha256)}
    if(f.status!=='added'){const b=baseTree.tree.find(t=>t.path===(f.previousPath??f.path));if(b?.type!=='blob'||b.sha!==f.baseBlobSha)fail('Base blob identity differs');baseBytes=await blob(f.baseBlobSha,f.baseSha256)}
    if(f.path===KEY_PATH&&sha256(sourceBytes)!==TRUST_SHA256)fail('Reviewed key differs from owner trust')
    if(f.path==='package.json')validateSanitizerPackageChange(baseBytes,sourceBytes)
    if(f.path===OTEL_DEPENDENCY_PATH)validateOtelPackageChange(baseBytes,sourceBytes)
    if(TOOL_DEPENDENCY_PATHS.includes(f.path))validateToolDependencyChange(f.path,baseBytes,sourceBytes)
    if(f.path==='.gitattributes'&&(f.status!=='modified'||sourceBytes.toString('utf8').trimEnd()!==baseBytes.toString('utf8').trimEnd()+'\n'+KEY_PATH+' -text'))fail('Only exact public-key byte preservation attribute is permitted')
  }
  // Detect a head update during verification; no race-induced stale success.
  if ((await api.get(endpoint)).head.sha !== pr.head.sha) fail('PR head changed during verification')
  return { sourceSha:m.sourceSha,evidenceSha:pr.head.sha,files:m.files.length }
}

async function main() {
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'))
  const number=event.pull_request?.number
  if(process.env.GITHUB_REPOSITORY!=='anungis437/nzila-os'||!Number.isInteger(number)||!PR_BINDINGS[number])fail('Alternative only applies to explicitly bound mission PRs')
  const token=process.env.GITHUB_TOKEN
  const get=async endpoint=>{const response=await fetch(`https://api.github.com/repos/anungis437/nzila-os/${endpoint}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});if(!response.ok)fail(`GitHub read failed ${response.status}`);return response.json()}
  const pages=async(endpoint,field)=>{const all=[];for(let page=1;page<=31;page++){const result=await get(`${endpoint}${endpoint.includes('?')?'&':'?'}per_page=100&page=${page}`);const rows=field?result[field]:result;if(!Array.isArray(rows))fail('Invalid paginated response');all.push(...rows);if(rows.length<100)return all}fail('Pagination exceeds bound')}
  const endpoint=`pulls/${number}`,pr=await get(endpoint)
  const content=async name=>{const result=await get(`contents/${name}?ref=${pr.head.sha}`);if(result.encoding!=='base64'||result.type!=='file')fail('Evidence content unavailable');return Buffer.from(result.content,'base64')}
  const bytes=await content(RECEIPT_PATH), signature=await content(SIGNATURE_PATH)
  const pem=fs.readFileSync(new URL('../../'+KEY_PATH,import.meta.url))
  const manifest=verifyEnvelope(bytes,signature.toString('utf8'),pem)
  if(manifest.pullRequest!==number)fail('Receipt belongs to another PR')
  // Verify that fetched evidence belongs to the same observed head.
  const api={get:async requested=>{const r=await get(requested);if(requested===endpoint&&r.head.sha!==pr.head.sha)fail('Head changed while fetching evidence');return r},pages}
  console.log(JSON.stringify(await verifyPullRequest(manifest,api)))
  console.log('Delegated staging security review verified (explicit agent attribution, sole-owner authorization); production authorization unchanged')
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1})
