import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  NEW_SUBSCRIPTION_ID,
  NEW_TENANT_ID,
  LEGACY_SUBSCRIPTION_ID,
  buildReleaseManifest,
  infrastructureProvenance,
  changeRecordDefects,
  deploymentParameterDefects,
  digestDefects,
  registryAttestationDefects,
  releaseManifestDefects,
  subscriptionDefects,
  whatIfDefects,
  whatIfFingerprint,
} from './union-eyes-v2-staging-release.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const SHA = 'a'.repeat(40)
const D = (c) => `sha256:${c.repeat(64)}`
const STAGING = `/subscriptions/${NEW_SUBSCRIPTION_ID}/resourceGroups/nzila-canada-staging-rg`
const REGISTRY = `/subscriptions/${NEW_SUBSCRIPTION_ID}/resourceGroups/nzila-canada-prod-rg/providers/Microsoft.ContainerRegistry/registries/nzilaventuresacr`

test('deployment provenance separately binds immutable image source and every admitted infrastructure module', () => {
  const input = { applicationSourceSha: SHA, workflowSha: 'b'.repeat(40), infrastructureTreeSha: 'c'.repeat(40), templateSha256: 'd'.repeat(64) }
  const result = infrastructureProvenance(input)
  assert.equal(result.applicationSourceSha, SHA)
  assert.equal(result.infrastructureSha, input.workflowSha)
  assert.equal(result.parametersSourceSha, input.workflowSha)
  assert.equal(result.infrastructureTreeSha, input.infrastructureTreeSha)
  for (const field of Object.keys(input)) assert.throws(() => infrastructureProvenance({ ...input, [field]: 'main' }))
  const workflow = fs.readFileSync(path.join(REPO, '.github/workflows/ue-v2-staging-deploy.yml'), 'utf8')
  assert.match(workflow, /git worktree add --detach "\$SRC" "\$GITHUB_SHA"/)
  assert.equal((workflow.match(/verify-ue-v2-staging-infrastructure.mjs --verify/g) ?? []).length, 2)
  assert(!workflow.includes('source/$TEMPLATE'))
})

test('real Git provenance admits a separate infrastructure commit and refuses a changed module even when main template is unchanged', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-infrastructure-provenance-'))
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    git('init', '-q'); git('config', 'user.name', 'Synthetic provenance fixture'); git('config', 'user.email', 'synthetic@example.invalid')
    fs.writeFileSync(path.join(directory, 'application.txt'), 'qualified immutable application')
    git('add', '.'); git('commit', '-qm', 'application source')
    const source = git('rev-parse', 'HEAD')
    const infra = path.join(directory, 'infrastructure/bicep/ue-v2')
    fs.mkdirSync(path.join(infra, 'modules'), { recursive: true })
    fs.writeFileSync(path.join(infra, 'main.bicep'), '// immutable main template')
    const module = path.join(infra, 'modules/alerts.bicep'); fs.writeFileSync(module, '// admitted alert correction')
    git('add', '.'); git('commit', '-qm', 'separate infrastructure correction')
    const workflow = git('rev-parse', 'HEAD'), receipt = path.join(directory, 'provenance.json')
    const run = (operation, changes = {}) => spawnSync(process.execPath, [path.join(REPO, 'tooling/scripts/verify-ue-v2-staging-infrastructure.mjs'), operation, receipt], { cwd: directory, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', SOURCE_SHA: source, GITHUB_SHA: workflow, TEMPLATE: 'infrastructure/bicep/ue-v2/main.bicep', ...changes } })
    assert.equal(run('--record').status, 0); assert.equal(run('--verify').status, 0)
    assert.notEqual(run('--verify', { GITHUB_SHA: source }).status, 0)
    fs.writeFileSync(module, '// unreviewed module mutation; unchanged main template')
    assert.notEqual(run('--verify').status, 0)
    const actual = JSON.parse(fs.readFileSync(receipt, 'utf8'))
    assert.equal(actual.applicationSourceSha, source); assert.equal(actual.infrastructureSha, workflow)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

function manifest() {
  return buildReleaseManifest({ sourceSha: SHA, images: { app: { digest: D('1') }, clamav: { digest: D('2') }, cron: { digest: D('3') } } })
}

function parameters(overrides = {}) {
  return {
    parameters: {
      env: { value: 'staging' },
      acrName: { value: 'nzilaventuresacr' },
      appImageDigest: { value: D('1') },
      clamavImageDigest: { value: D('2') },
      cronImageDigest: { value: D('3') },
      publicHostName: { value: 'staging-app.unioneyes.app' },
      ...overrides,
    },
  }
}

function record(overrides = {}) {
  return {
    change_id: 'CHG-2026-0200',
    service: 'union-eyes',
    environment: 'STAGING',
    approval_status: 'APPROVED',
    status: 'APPROVED',
    approvers_required: ['service_owner'],
    approved_by: ['service_owner'],
    implementation_window_start: '2026-11-01T00:00:00Z',
    implementation_window_end: '2026-11-30T00:00:00Z',
    linked_commits: [SHA],
    ...overrides,
  }
}

test('digests are the only accepted image references', () => {
  assert.deepEqual(digestDefects('app', D('f')), [])
  assert.deepEqual(digestDefects('app', 'latest'), ['DIGEST_INVALID:app'])
  assert.deepEqual(digestDefects('app', 'nzila-os-union-eyes-v2:staging'), ['TAG_REFERENCE_REJECTED:app'])
  assert.deepEqual(digestDefects('app', `repo@${D('f')}`), ['TAG_REFERENCE_REJECTED:app'])
  assert.deepEqual(digestDefects('app', 'f'.repeat(64)), ['DIGEST_PREFIX_MISSING:app'])
  assert.deepEqual(digestDefects('app', ''), ['DIGEST_MISSING:app'])
})

test('a complete digest manifest passes; a tag anywhere fails', () => {
  assert.deepEqual(releaseManifestDefects(manifest()), [])
  const tagged = buildReleaseManifest({ sourceSha: SHA, images: { app: { digest: 'v2-staging' }, clamav: { digest: D('2') }, cron: { digest: D('3') } } })
  assert.ok(releaseManifestDefects(tagged).includes('DIGEST_INVALID:app'))
  const wrongEnv = { ...manifest(), environment: 'prod' }
  assert.ok(releaseManifestDefects(wrongEnv).includes('RELEASE_MANIFEST_NOT_STAGING'))
  const legacy = { ...manifest(), subscriptionId: LEGACY_SUBSCRIPTION_ID }
  assert.ok(releaseManifestDefects(legacy).includes('RELEASE_MANIFEST_WRONG_SUBSCRIPTION'))
  assert.ok(releaseManifestDefects({ ...manifest(), registry: 'nzilacanadaacr' }).includes('RELEASE_MANIFEST_WRONG_REGISTRY'))
})

test('registry attestation must match digest and the app revision label', () => {
  const m = manifest()
  const att = (digest, revision) => ({ source: 'acr', digest, tags: [], labels: revision ? { 'org.opencontainers.image.revision': revision } : {} })
  assert.deepEqual(registryAttestationDefects(m, { app: att(D('1'), SHA), clamav: att(D('2')), cron: att(D('3')) }), [])
  assert.deepEqual(registryAttestationDefects(m, { app: att(D('9'), SHA), clamav: att(D('2')), cron: att(D('3')) }), ['WRONG_IMAGE_APP_DIGEST'])
  assert.deepEqual(registryAttestationDefects(m, { app: att(D('1'), 'b'.repeat(40)), clamav: att(D('2')), cron: att(D('3')) }), ['WRONG_IMAGE_APP_LABEL'])
  assert.deepEqual(registryAttestationDefects(m, { app: att(D('1'), SHA), clamav: att(D('2')) }), ['IMAGE_ATTESTATION_MISSING_CRON'])
})

test('deployment parameters must be staging, digest-bound and free of test bypasses', () => {
  const m = manifest()
  assert.deepEqual(deploymentParameterDefects(parameters(), m), [])
  assert.ok(deploymentParameterDefects(parameters({ env: { value: 'prod' } }), m).includes('PARAMETERS_ENV_NOT_STAGING'))
  assert.ok(deploymentParameterDefects(parameters({ appImageDigest: { value: D('9') } }), m).includes('PARAMETERS_DIGEST_MISMATCH:app'))
  assert.ok(deploymentParameterDefects(parameters({ dbAdminPassword: { value: 'x' } }), m).includes('PARAMETERS_FILE_CARRIES_SECRET'))
  assert.ok(deploymentParameterDefects(parameters({ publicHostName: { value: 'prod.unioneyes.app' } }), m).includes('PARAMETERS_PRODUCTION_VALUE:publicHostName'))
  for (const flag of ['PLAYWRIGHT_TEST_AUTH', 'UE_E2E_RISK_BYPASS', 'UNION_EYES_ACCEPTANCE_AUTH_ENABLED']) {
    const p = parameters({ extraEnv: { value: [{ name: flag, value: 'true' }] } })
    assert.ok(deploymentParameterDefects(p, m).includes(`FORBIDDEN_RUNTIME_FLAG:${flag}`), flag)
  }
})

test('Entra identifiers must be a complete pair and credentials stay out of parameters', () => {
  const m = manifest()
  const client = { value: 'c0a29862-9432-4b54-bb25-796ff987091f' }
  const tenant = { value: '5082b8be-b04d-4a13-b61c-b6397670177b' }
  assert.deepEqual(
    deploymentParameterDefects(parameters({ entraClientId: client, entraTenantId: tenant }), m),
    [],
  )
  for (const invalid of [
    { entraClientId: client },
    { entraTenantId: tenant },
    { entraClientId: client, entraTenantId: { value: 'common' } },
  ]) {
    assert.ok(
      deploymentParameterDefects(parameters(invalid), m).includes(
        'PARAMETERS_ENTRA_IDENTIFIERS_INVALID',
      ),
    )
  }
  assert.ok(
    deploymentParameterDefects(
      parameters({
        entraClientId: client,
        entraTenantId: tenant,
        entraClientSecret: { value: 'must-not-be-in-source' },
      }),
      m,
    ).includes('PARAMETERS_FILE_CARRIES_SECRET'),
  )
})

test('infrastructure bootstrap requires an explicit boolean and retains staging and digest gates', () => {
  const m = manifest()
  for (const value of [true, false]) {
    assert.deepEqual(deploymentParameterDefects(parameters({ bootstrapInfrastructureOnly: { value } }), m), [])
  }
  for (const value of ['false', 'true', 0, null]) {
    assert.ok(deploymentParameterDefects(parameters({ bootstrapInfrastructureOnly: { value } }), m).includes('PARAMETERS_BOOTSTRAP_MODE_NOT_BOOLEAN'))
  }
  assert.ok(deploymentParameterDefects(parameters({ bootstrapInfrastructureOnly: { value: true }, env: { value: 'prod' } }), m).includes('PARAMETERS_ENV_NOT_STAGING'))
  assert.ok(deploymentParameterDefects(parameters({ bootstrapInfrastructureOnly: { value: true }, appImageDigest: { value: D('9') } }), m).includes('PARAMETERS_DIGEST_MISMATCH:app'))
})

test('change record must be a named, approved, in-window UE staging record linking the SHA', () => {
  const now = Date.parse('2026-11-04T12:00:00Z')
  assert.deepEqual(changeRecordDefects(record(), { changeId: 'CHG-2026-0200', sourceSha: SHA, nowMs: now }), [])
  assert.deepEqual(changeRecordDefects(record(), { changeId: '', sourceSha: SHA, nowMs: now }), ['CHANGE_RECORD_ID_INVALID'])
  assert.deepEqual(changeRecordDefects(null, { changeId: 'CHG-2026-0200', sourceSha: SHA, nowMs: now }), ['CHANGE_RECORD_MISSING'])
  assert.ok(changeRecordDefects(record({ environment: 'PROD' }), { changeId: 'CHG-2026-0200', sourceSha: SHA, nowMs: now }).includes('CHANGE_RECORD_WRONG_ENVIRONMENT'))
  assert.ok(changeRecordDefects(record({ service: 'web' }), { changeId: 'CHG-2026-0200', sourceSha: SHA, nowMs: now }).includes('CHANGE_RECORD_WRONG_SERVICE'))
  assert.ok(changeRecordDefects(record({ approval_status: 'PENDING' }), { changeId: 'CHG-2026-0200', sourceSha: SHA, nowMs: now }).includes('CHANGE_RECORD_NOT_APPROVED'))
  assert.ok(changeRecordDefects(record({ approved_by: [] }), { changeId: 'CHG-2026-0200', sourceSha: SHA, nowMs: now }).includes('CHANGE_RECORD_APPROVALS_MISSING'))
  assert.ok(changeRecordDefects(record(), { changeId: 'CHG-2026-0200', sourceSha: SHA, nowMs: Date.parse('2026-12-04T00:00:00Z') }).includes('CHANGE_RECORD_OUTSIDE_WINDOW'))
  assert.ok(changeRecordDefects(record({ linked_commits: [] }), { changeId: 'CHG-2026-0200', sourceSha: SHA, nowMs: now }).includes('CHANGE_RECORD_SOURCE_SHA_NOT_LINKED'))
})

test('what-if stays in the staging group; only the registry AcrPull assignment may cross groups', () => {
  const ok = {
    status: 'Succeeded',
    changes: [
      { resourceId: `${STAGING}/providers/Microsoft.App/containerApps/nzila-ue-v2-staging-app`, changeType: 'Create' },
      { resourceId: `${REGISTRY}/providers/Microsoft.Authorization/roleAssignments/abc`, changeType: 'Create' },
      { resourceId: `/subscriptions/${NEW_SUBSCRIPTION_ID}/resourceGroups/nzila-canada-prod-rg/providers/Microsoft.OperationalInsights/workspaces/nzila-canada-prod-law`, changeType: 'NoChange' },
    ],
  }
  assert.deepEqual(whatIfDefects(ok, { registryResourceGroup: 'nzila-canada-prod-rg' }), [])
  const deletes = { changes: [{ resourceId: `${STAGING}/providers/Microsoft.KeyVault/vaults/kv`, changeType: 'Delete' }] }
  assert.equal(whatIfDefects(deletes, {})[0].startsWith('WHAT_IF_CHANGE_TYPE_REFUSED:Delete'), true)
  const prodWrite = { changes: [{ resourceId: `/subscriptions/${NEW_SUBSCRIPTION_ID}/resourceGroups/nzila-canada-prod-rg/providers/Microsoft.App/containerApps/nzila-os-web-prod`, changeType: 'Modify' }] }
  assert.equal(whatIfDefects(prodWrite, { registryResourceGroup: 'nzila-canada-prod-rg' })[0].startsWith('WHAT_IF_OUTSIDE_STAGING_RESOURCE_GROUP'), true)
  const legacy = { changes: [{ resourceId: `/subscriptions/${LEGACY_SUBSCRIPTION_ID}/resourceGroups/nzila-canada-staging-rg/x`, changeType: 'Create' }] }
  assert.equal(whatIfDefects(legacy, {})[0].startsWith('WHAT_IF_OUTSIDE_SUBSCRIPTION'), true)
  assert.deepEqual(whatIfDefects({}, {}), ['WHAT_IF_OUTPUT_INVALID'])
  assert.deepEqual(whatIfDefects({ status: 'Failed', changes: [] }, {}), ['WHAT_IF_NOT_SUCCEEDED'])
})

test('what-if accepts only the exact symbolic AcrPull assignment Azure emits for a new identity', () => {
  const registryId = `/subscriptions/${NEW_SUBSCRIPTION_ID}/resourceGroups/nzila-canada-prod-rg/providers/Microsoft.ContainerRegistry/registries/nzilaventuresacr`
  const identityId = `/subscriptions/${NEW_SUBSCRIPTION_ID}/resourceGroups/nzila-canada-staging-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/nzila-ue-v2-staging-id`
  const principalReference = `reference('${identityId}', '2023-01-31').principalId`
  const roleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
  const resourceId = `[extensionResourceId('${registryId}', 'Microsoft.Authorization/roleAssignments', guid('${registryId}', ${principalReference}, '${roleId}'))]`
  const symbolic = {
    status: 'Succeeded',
    changes: [{
      resourceId,
      changeType: 'Unsupported',
      after: {
        apiVersion: '2022-04-01',
        id: resourceId,
        resourceGroup: 'nzila-canada-prod-rg',
        type: 'Microsoft.Authorization/roleAssignments',
        properties: {
          principalId: `[${principalReference}]`,
          principalType: 'ServicePrincipal',
          roleDefinitionId: `/subscriptions/${NEW_SUBSCRIPTION_ID}/providers/Microsoft.Authorization/roleDefinitions/${roleId}`,
        },
      },
    }],
  }
  assert.deepEqual(whatIfDefects(symbolic, { registryResourceGroup: 'nzila-canada-prod-rg' }), [])

  const wrongRole = structuredClone(symbolic)
  wrongRole.changes[0].after.properties.roleDefinitionId = `/subscriptions/${NEW_SUBSCRIPTION_ID}/providers/Microsoft.Authorization/roleDefinitions/owner`
  assert.ok(whatIfDefects(wrongRole, { registryResourceGroup: 'nzila-canada-prod-rg' }).some(defect => defect.startsWith('WHAT_IF_OUTSIDE_SUBSCRIPTION')))

  const wrongIdentity = structuredClone(symbolic)
  wrongIdentity.changes[0].after.properties.principalId = "[reference('/subscriptions/other/resourceGroups/other/providers/Microsoft.ManagedIdentity/userAssignedIdentities/other', '2023-01-31').principalId]"
  assert.ok(whatIfDefects(wrongIdentity, { registryResourceGroup: 'nzila-canada-prod-rg' }).some(defect => defect.startsWith('WHAT_IF_OUTSIDE_SUBSCRIPTION')))
})

test('what-if fingerprint ignores order and case but not change type', () => {
  const a = { changes: [{ resourceId: `${STAGING}/A`, changeType: 'Create' }, { resourceId: `${STAGING}/B`, changeType: 'NoChange' }] }
  const b = { changes: [{ resourceId: `${STAGING}/b`, changeType: 'NoChange' }, { resourceId: `${STAGING}/a`, changeType: 'Create' }] }
  const c = { changes: [{ resourceId: `${STAGING}/A`, changeType: 'Modify' }, { resourceId: `${STAGING}/B`, changeType: 'NoChange' }] }
  assert.equal(whatIfFingerprint(a), whatIfFingerprint(b))
  assert.notEqual(whatIfFingerprint(a), whatIfFingerprint(c))
})

test('Azure provider contracts use the live AcrPull role and PostgreSQL SKU names', () => {
  const acrModule = fs.readFileSync(path.join(REPO, 'infrastructure/bicep/ue-v2/modules/acr-pull.bicep'), 'utf8')
  const postgresModule = fs.readFileSync(path.join(REPO, 'infrastructure/bicep/modules/postgres.bicep'), 'utf8')
  const stagingParameters = JSON.parse(fs.readFileSync(path.join(REPO, 'infrastructure/bicep/ue-v2/main.staging.parameters.json'), 'utf8'))
  assert.match(acrModule, /7f951dda-4ed3-4680-a7ca-43fe172d538d/)
  assert.doesNotMatch(acrModule, /7f951dda-4ed3-4680-a7ca-43fe172d0f3b/)
  assert.equal(stagingParameters.parameters.dbSku.value, 'Standard_B1ms')
  assert.match(postgresModule, /startsWith\(sku, 'Standard_B'\)/)
})

test('only the new subscription and tenant are accepted', () => {
  assert.deepEqual(subscriptionDefects({ id: NEW_SUBSCRIPTION_ID, tenantId: NEW_TENANT_ID }), [])
  assert.deepEqual(subscriptionDefects({ id: LEGACY_SUBSCRIPTION_ID, tenantId: NEW_TENANT_ID }), ['WRONG_SUBSCRIPTION'])
})

test('CLI fails closed on a missing change record and a tag manifest', () => {
  const cli = path.join(REPO, 'tooling/scripts/union-eyes-v2-staging-gate-cli.mjs')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-v2-gate-'))
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })

  const missing = run('--gate', 'change-record', '--change-id', 'CHG-2099-9999', '--source-sha', SHA, '--change-dir', dir)
  assert.equal(missing.status, 1)
  assert.deepEqual(JSON.parse(missing.stdout).defects, ['CHANGE_RECORD_MISSING'])

  const empty = run('--gate', 'change-record', '--change-id', '', '--source-sha', SHA, '--change-dir', dir)
  assert.equal(empty.status, 1)

  fs.writeFileSync(path.join(dir, 'CHG-2026-0200.json'), JSON.stringify(record()))
  const present = run('--gate', 'change-record', '--change-id', 'CHG-2026-0200', '--source-sha', SHA, '--change-dir', dir, '--now', '2026-11-04T12:00:00Z')
  assert.equal(present.status, 0, present.stdout)

  const tagged = { ...manifest(), images: { ...manifest().images, app: { repository: 'nzila-os-union-eyes-v2', digest: 'staging', reference: 'nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2:staging' } } }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(tagged))
  const result = run('--gate', 'manifest', '--manifest', path.join(dir, 'manifest.json'))
  assert.equal(result.status, 1)
  assert.ok(JSON.parse(result.stdout).defects.includes('DIGEST_INVALID:app'))
})

test('CHG-2026-0114 founder direction accepts only the exact candidate and preserves staging boundaries', () => {
  const approved = JSON.parse(fs.readFileSync(path.join(REPO, 'ops/change-records/CHG-2026-0114.json'), 'utf8'))
  const sha = 'a844237335542bcac0f4690f1f17832b68371a84'
  const opts = { changeId: 'CHG-2026-0114', sourceSha: sha, nowMs: Date.parse('2026-11-10T12:00:00Z') }
  assert.deepEqual(changeRecordDefects(approved, opts), [])
  assert.ok(changeRecordDefects({ ...approved, founder_staging_authorization: { ...approved.founder_staging_authorization, candidate_sha: '8a0faf64cc67a8bfaef35e39f5acdda8a9ef4896' } }, opts).includes('FOUNDER_STAGING_AUTHORIZATION_INVALID'))
  assert.ok(changeRecordDefects({ ...approved, environment: 'PROD' }, opts).includes('CHANGE_RECORD_WRONG_ENVIRONMENT'))
  assert.ok(changeRecordDefects({ ...approved, environment: 'PROD' }, opts).includes('FOUNDER_STAGING_AUTHORIZATION_INVALID'))
  assert.ok(changeRecordDefects({ ...approved, approved_by: [] }, opts).includes('CHANGE_RECORD_APPROVALS_MISSING'))
  assert.ok(changeRecordDefects({ ...approved, approved_by: [] }, opts).includes('FOUNDER_STAGING_AUTHORIZATION_INVALID'))
  assert.ok(changeRecordDefects(approved, { ...opts, sourceSha: 'f'.repeat(40) }).includes('FOUNDER_STAGING_CANDIDATE_MISMATCH'))
  assert.ok(changeRecordDefects({ ...approved, founder_staging_authorization: { ...approved.founder_staging_authorization, technical_gates_required: false } }, opts).includes('FOUNDER_STAGING_AUTHORIZATION_INVALID'))
  assert.ok(changeRecordDefects(approved, { ...opts, nowMs: Date.parse('2028-01-01T00:00:00Z') }).includes('CHANGE_RECORD_OUTSIDE_WINDOW'))
})
