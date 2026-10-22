import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { databaseProofId, sha256 } from './union-eyes-staging-proof.mjs'
import {
  assembleAcrAttestation,
  assembleRoleCatalog,
  assertWorkflowMutationOrder,
  evaluateDeploymentSafety,
  inspectMigration0019,
  phaseAllowed,
  readSourceIdentity,
  signApproval,
} from './union-eyes-deployment-safety.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../..')
const SHA = 'a'.repeat(40)
const OTHER_SHA = 'e'.repeat(40)
const FRONTEND = `sha256:${'b'.repeat(64)}`
const BACKEND = `sha256:${'c'.repeat(64)}`
const HASH_0019 = 'd'.repeat(64)
const NOW = '2026-10-21T22:00:00.000Z'
const FIXTURE = {
  fixtureId: 'synthetic-acceptance-v1', environment: 'staging', synthetic: true,
  allowRolledBackWriteProbe: true, databaseName: 'ue_acceptance',
  databaseBaseline: 'pitr-2026-10-21T12:00:00Z',
  tenantA: { organizationId: '11111111-1111-4111-8111-111111111111', userId: '22222222-2222-4222-8222-222222222222', recordId: '33333333-3333-4333-8333-333333333333' },
  tenantB: { organizationId: '44444444-4444-4444-8444-444444444444', userId: '55555555-5555-4555-8555-555555555555', recordId: '66666666-6666-4666-8666-666666666666' },
}
const keys = crypto.generateKeyPairSync('ed25519')
const privateKeyPem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' })
const publicKeyPem = keys.publicKey.export({ type: 'spki', format: 'pem' })

function acr(digest) {
  return assembleAcrAttestation(
    { digest, tags: [SHA, 'latest'] },
    { config: { Labels: { 'org.opencontainers.image.revision': SHA } } },
  )
}

function ingress(readId, traffic, extra = {}) {
  return {
    readId,
    observedAt: extra.observedAt ?? '2026-10-21T21:50:00.000Z',
    activeRevisionsMode: 'multiple',
    fqdn: 'union-eyes.example.com',
    traffic,
  }
}

function revisions(readId, rows) {
  return { readId, observedAt: '2026-10-21T21:50:00.000Z', revisions: rows }
}

function revision(name, extra = {}) {
  return {
    name,
    active: true,
    replicas: extra.replicas ?? 1,
    containers: extra.containers ?? [{ name: 'app', image: 'app@sha256:old' }],
  }
}

function approvalBody(overrides = {}) {
  return {
    changeRecordId: 'CHG-TEST-0019',
    approvalStatus: 'APPROVED',
    approvedBy: ['release-owner', 'security-reviewer'],
    approversRequired: ['release-owner', 'security-reviewer'],
    issuedAt: '2026-10-21T18:00:00.000Z',
    expiresAt: '2026-10-22T18:00:00.000Z',
    releaseSha: SHA,
    frontendDigest: FRONTEND,
    backendDigest: BACKEND,
    databaseBaseline: 'pitr-2026-10-21T12:00:00Z',
    acceptanceFixture: FIXTURE,
    recoveryMethod: 'point-in-time-restore',
    authorizedMutations: ['scoped-0005', 'scoped-0019', 'django-migrate', 'candidate-revision', 'candidate-label'],
    scheduledMigrations: [{
      tag: '0019_deadline_reassignment_convergence',
      sha256: HASH_0019,
      executor: 'applyScopedMigrations',
      beforeRlsPreflight: true,
    }],
    restoredClone: {
      sourceSha: SHA,
      frontendDigest: FRONTEND,
      backendDigest: BACKEND,
      databaseBaseline: 'pitr-2026-10-21T12:00:00Z',
      recoveryPoint: '2026-10-21T12:00:00.000Z',
      changeRecordId: 'CHG-TEST-0019',
      tests: [{ name: 'tenant-isolation', ok: true }],
      schemaApply: {
        command: 'python manage.py migrate --noinput',
        exitCode: 0,
        target: 'restored-clone',
        provesApply: true,
      },
    },
    ...overrides,
  }
}

function sourceIdentity(overrides = {}) {
  return {
    workflowSha: SHA,
    applicationSourceSha: SHA,
    migrationCheckoutSha: SHA,
    workflowExecutorSha256: 'f'.repeat(64),
    applicationExecutorSha256: 'f'.repeat(64),
    journalSha256: '1'.repeat(64),
    ...overrides,
  }
}

function ready(overrides = {}) {
  const { approval, ...rest } = overrides
  const signed = Object.prototype.hasOwnProperty.call(overrides, 'approval')
    ? approval
    : signApproval(approvalBody(), privateKeyPem)
  return {
    phase: 'premigrate',
    now: NOW,
    manifest: { releaseSha: SHA, frontendDigest: FRONTEND, backendDigest: BACKEND },
    sourceIdentity: sourceIdentity(),
    acr: { frontend: acr(FRONTEND), backend: acr(BACKEND) },
    ingress: ingress('read-a', [{ revisionName: 'app--serving', weight: 100 }]),
    revisions: revisions('rev-a', [revision('app--serving', { replicas: 2 })]),
    roleCatalog: assembleRoleCatalog({ rolname: 'ue_migration_admin', rolsuper: false, rolbypassrls: false, rolcanlogin: true }),
    approval: signed,
    approvalTrustPem: publicKeyPem,
    ledger: { source: 'drizzle.__drizzle_migrations', rows: [{ hash: HASH_0019 }] },
    migration0019: { present: true, sha256: HASH_0019 },
    djangoPlan: { command: 'python manage.py showmigrations --plan', exitCode: 0, inspectionOnly: true },
    ...rest,
  }
}

function withFresh(input, mutate) {
  const freshIngress = structuredClone(input.ingress)
  const freshRevisions = structuredClone(input.revisions)
  freshIngress.readId = 'read-b'
  freshIngress.observedAt = '2026-10-21T21:59:00.000Z'
  freshRevisions.readId = 'rev-b'
  freshRevisions.observedAt = '2026-10-21T21:59:00.000Z'
  if (mutate) mutate(freshIngress, freshRevisions)
  return { ...input, freshIngress, freshRevisions }
}

test('ICRA cannot migrate before revision isolation and the premutation gate', () => {
  const isolated = evaluateDeploymentSafety(withFresh(ready({ phase: 'icra' })))
  assert.equal(phaseAllowed(isolated, 'icra'), true)
  assert.equal(isolated.allowTrafficPromotion, false)

  const beforeQuiescence = evaluateDeploymentSafety(withFresh(ready({
    phase: 'icra',
    revisions: revisions('rev-a', [
      revision('app--serving', { replicas: 2 }),
      revision('app--stale', { replicas: 1 }),
    ]),
    ingress: ingress('read-a', [
      { revisionName: 'app--serving', weight: 100 },
      { revisionName: 'app--stale', weight: 0 },
    ]),
  })))
  assert.ok(beforeQuiescence.defects.includes('UNACCOUNTED_ACTIVE_REVISION'))
  assert.equal(phaseAllowed(beforeQuiescence, 'icra'), false)
  assert.equal(beforeQuiescence.allowRevisionDeactivate, false)
})

test('a missing, unsigned, stale, or falsified approval is not a change authorization', () => {
  const missing = evaluateDeploymentSafety(ready({ approval: null }))
  assert.ok(missing.defects.includes('APPROVAL_MISSING'))
  assert.equal(phaseAllowed(missing, 'premigrate'), false)

  const nameOnly = { approver: 'release-owner', changeRecord: 'CHG-2026-0112', approvalStatus: 'APPROVED' }
  const unsigned = evaluateDeploymentSafety(ready({ approval: nameOnly }))
  assert.ok(unsigned.defects.includes('APPROVAL_UNSIGNED'))
  assert.equal(phaseAllowed(unsigned, 'premigrate'), false)

  const changeRecord = JSON.parse(fs.readFileSync(path.join(REPO, 'ops/change-records/CHG-2026-0112.json'), 'utf8'))
  const proposed = evaluateDeploymentSafety(ready({ approval: changeRecord }))
  assert.ok(proposed.defects.includes('APPROVAL_UNSIGNED'))
  assert.ok(proposed.defects.includes('APPROVAL_NOT_APPROVED'))

  const pending = signApproval(approvalBody({ approvalStatus: 'PENDING', approvedBy: [] }), privateKeyPem)
  const notApproved = evaluateDeploymentSafety(ready({ approval: pending }))
  assert.ok(notApproved.defects.includes('APPROVAL_NOT_APPROVED'))

  const stale = signApproval(approvalBody({
    issuedAt: '2026-10-01T18:00:00.000Z',
    expiresAt: '2026-10-02T18:00:00.000Z',
  }), privateKeyPem)
  const expired = evaluateDeploymentSafety(ready({ approval: stale }))
  assert.ok(expired.defects.includes('APPROVAL_STALE'))

  const tampered = signApproval(approvalBody(), privateKeyPem)
  tampered.releaseSha = OTHER_SHA
  const falsified = evaluateDeploymentSafety(ready({ approval: tampered }))
  assert.ok(falsified.defects.includes('APPROVAL_UNSIGNED'))
  assert.equal(phaseAllowed(falsified, 'migrate'), false)
})

test('a restored-clone receipt must be bound, current, and tested', () => {
  const missing = signApproval(approvalBody({ restoredClone: undefined }), privateKeyPem)
  const missingDecision = evaluateDeploymentSafety(ready({ approval: missing }))
  assert.ok(missingDecision.defects.includes('RESTORED_CLONE_MISSING'))

  const staleClone = signApproval(approvalBody({
    restoredClone: {
      ...approvalBody().restoredClone,
      recoveryPoint: '2026-09-01T12:00:00.000Z',
    },
  }), privateKeyPem)
  const stale = evaluateDeploymentSafety(ready({ approval: staleClone }))
  assert.ok(stale.defects.includes('RESTORED_CLONE_STALE'))

  const wrongSha = signApproval(approvalBody({
    restoredClone: { ...approvalBody().restoredClone, sourceSha: OTHER_SHA },
  }), privateKeyPem)
  const mismatched = evaluateDeploymentSafety(ready({ approval: wrongSha }))
  assert.ok(mismatched.defects.includes('RESTORED_CLONE_BINDING_MISMATCH'))
})

test('ACR evidence is read from image metadata and an expected SHA is not observed metadata', () => {
  const showOnly = assembleAcrAttestation({ digest: FRONTEND, tags: [SHA] }, {})
  assert.equal(showOnly.labels, null)
  const missingLabels = evaluateDeploymentSafety(ready({
    acr: { frontend: showOnly, backend: acr(BACKEND) },
  }))
  assert.ok(missingLabels.defects.includes('IMAGE_ATTESTATION_MISSING_FRONTEND'))

  const wrong = evaluateDeploymentSafety(ready({
    acr: {
      frontend: assembleAcrAttestation(
        { digest: `sha256:${'f'.repeat(64)}`, tags: [SHA] },
        { config: { Labels: { 'org.opencontainers.image.revision': OTHER_SHA } } },
      ),
      backend: acr(BACKEND),
    },
  }))
  assert.ok(wrong.defects.includes('WRONG_IMAGE_FRONTEND_DIGEST'))
  assert.ok(wrong.defects.includes('WRONG_IMAGE_FRONTEND_LABEL'))
  assert.equal(phaseAllowed(wrong, 'premigrate'), false)
})

test('migration role attributes come from pg_roles and missing flags are not false', () => {
  const omitted = evaluateDeploymentSafety(ready({
    roleCatalog: assembleRoleCatalog({ rolname: 'ue_migration_admin', rolcanlogin: true }),
  }))
  assert.ok(omitted.defects.includes('ROLE_EVIDENCE_INCOMPLETE'))

  const bypass = evaluateDeploymentSafety(ready({
    roleCatalog: assembleRoleCatalog({ rolname: 'ue_migration_admin', rolsuper: true, rolbypassrls: true, rolcanlogin: true }),
  }))
  assert.ok(bypass.defects.includes('INCORRECT_DATABASE_AUTHORITY'))

  const runtime = evaluateDeploymentSafety(ready({
    roleCatalog: assembleRoleCatalog({ rolname: 'union_eyes_runtime', rolsuper: false, rolbypassrls: false, rolcanlogin: true }),
  }))
  assert.ok(runtime.defects.includes('INCORRECT_DATABASE_AUTHORITY'))
  assert.equal(phaseAllowed(runtime, 'migrate'), false)
})

test('showmigrations --plan does not prove that migrate will succeed', () => {
  const planOnly = signApproval(approvalBody({
    restoredClone: {
      ...approvalBody().restoredClone,
      schemaApply: {
        command: 'python manage.py showmigrations --plan',
        exitCode: 0,
        target: 'restored-clone',
        provesApply: true,
        inspectionOnly: true,
      },
    },
  }), privateKeyPem)
  const decision = evaluateDeploymentSafety(ready({
    approval: planOnly,
    djangoPlan: { command: 'python manage.py showmigrations --plan', exitCode: 0, inspectionOnly: true, treatedAsApplyProof: true },
  }))
  assert.ok(decision.defects.includes('SHOWMIGRATIONS_PLAN_IS_NOT_APPLY_PROOF'))
  assert.equal(phaseAllowed(decision, 'migrate'), false)
})

test('a revision header on the serving hostname is not candidate verification', () => {
  const servingProbe = {
    host: 'union-eyes.example.com',
    stableHost: 'union-eyes.example.com',
    header: 'x-ms-container-app-revision',
    label: '',
    revisionName: 'app--serving',
    responses: [
      { path: '/api/health', status: 200, body: { ok: true } },
      { path: '/api/ready', status: 200, body: { ok: true } },
      { path: '/api/version', status: 200, body: { gitSha: SHA, frontendImageDigest: FRONTEND, backendImageDigest: BACKEND } },
      { path: '/api/admin/database/health', status: 200, body: { tenantPrincipal: { currentUser: 'union_eyes_runtime', rolsuper: false, rolbypassrls: false }, systemPrincipal: { currentUser: 'union_eyes_system' } } },
    ],
  }
  const hit = evaluateDeploymentSafety(withFresh(ready({ phase: 'probe', probe: servingProbe })))
  assert.ok(hit.defects.includes('CANDIDATE_PROBE_HIT_SERVING_REVISION'))
  assert.equal(phaseAllowed(hit, 'probe'), false)
})

test('a labeled zero-weight revision stays reachable and is not rewritten to zero', () => {
  const decision = evaluateDeploymentSafety(ready({
    ingress: ingress('read-a', [
      { revisionName: 'app--serving', weight: 100 },
      { revisionName: 'app--labeled', label: 'previous' },
    ]),
    revisions: revisions('rev-a', [
      revision('app--serving', { replicas: 2, containers: [{ name: 'app', image: 'app@sha256:old' }] }),
      {
        name: 'app--labeled',
        active: true,
        replicas: 1,
        trafficWeight: 0,
        containers: [{ name: 'app', image: 'app@sha256:old' }],
      },
    ]),
  }))
  assert.equal(decision.unspecifiedWeightRevisions.includes('app--labeled'), false)
  assert.ok(decision.labelReachableRevisions.includes('app--labeled'))
  assert.ok(decision.defects.includes('LABEL_REACHABLE_REVISION'))
  assert.equal(decision.allowRevisionDeactivate, false)
  assert.equal(decision.allowIngressWeightRewrite, false)
})

test('multiple serving revisions and mixed weights stop the release', () => {
  const decision = evaluateDeploymentSafety(ready({
    ingress: ingress('read-a', [
      { revisionName: 'app--a', weight: 80 },
      { revisionName: 'app--b', weight: 20 },
    ]),
    revisions: revisions('rev-a', [revision('app--a'), revision('app--b')]),
  }))
  assert.ok(decision.defects.includes('SERVING_REVISION_AMBIGUOUS'))
  assert.ok(decision.defects.includes('MIXED_TRAFFIC_ALLOCATION'))
  assert.equal(phaseAllowed(decision, 'premigrate'), false)
})

test('a reused or changed inventory cannot authorize a mutation', () => {
  const reused = evaluateDeploymentSafety(ready({
    phase: 'migrate',
    freshIngress: ready().ingress,
    freshRevisions: ready().revisions,
  }))
  assert.ok(reused.defects.includes('STALE_INVENTORY'))
  assert.equal(phaseAllowed(reused, 'migrate'), false)

  const changed = evaluateDeploymentSafety(withFresh(ready({ phase: 'migrate' }), (freshIngress) => {
    freshIngress.traffic = [{ revisionName: 'app--serving', weight: 100 }, { revisionName: 'app--other', weight: 0 }]
  }))
  assert.ok(changed.defects.includes('STALE_INVENTORY'))
  assert.equal(phaseAllowed(changed, 'migrate'), false)
})

test('committed DDL cannot be recovered by a traffic-only rollback', () => {
  const decision = evaluateDeploymentSafety(withFresh(ready({
    phase: 'migrate',
    migrationCommitted: true,
    requestedRecovery: 'traffic-rollback',
  })))
  assert.ok(decision.defects.includes('MIGRATION_RECOVERY_IS_NOT_TRAFFIC_ROLLBACK'))
  assert.equal(phaseAllowed(decision, 'traffic-rollback'), false)
  assert.equal(decision.allowTrafficPromotion, false)
  assert.equal(decision.promotionRefusal, 'AUTOMATIC_TRAFFIC_PROMOTION_FORBIDDEN')
})

test('migration 0019 must be in the candidate and in the ledger before RLS preflight', () => {
  const absent = evaluateDeploymentSafety(ready({
    migration0019: inspectMigration0019(REPO),
    ledger: { source: 'drizzle.__drizzle_migrations', rows: [] },
    approval: signApproval(approvalBody({ scheduledMigrations: [] }), privateKeyPem),
  }))
  assert.equal(absent.migration0019.present, false)
  assert.ok(absent.defects.includes('MIGRATION_0019_ABSENT_FROM_CANDIDATE'))
  assert.ok(absent.defects.includes('MIGRATION_0019_LEDGER_HASH_MISSING'))

  const scheduled = evaluateDeploymentSafety(ready({
    ledger: { source: 'drizzle.__drizzle_migrations', rows: [] },
  }))
  assert.equal(scheduled.migration0019.scheduled, true)
  assert.equal(scheduled.defects.includes('MIGRATION_0019_LEDGER_HASH_MISSING'), false)

  const preflightTooSoon = evaluateDeploymentSafety(ready({
    ledger: { source: 'drizzle.__drizzle_migrations', rows: [] },
    rlsPreflight: { command: 'tsx scripts/rls-verify.ts --mode=preflight --require-deadline-engine-tables', exitCode: 0 },
  }))
  assert.ok(preflightTooSoon.defects.includes('RLS_PREFLIGHT_BEFORE_0019'))

  const failed = evaluateDeploymentSafety(ready({
    rlsPreflight: { command: 'tsx scripts/rls-verify.ts --mode=preflight --require-deadline-engine-tables', exitCode: 1 },
  }))
  assert.ok(failed.defects.includes('RLS_PREFLIGHT_FAILED'))
  assert.equal(phaseAllowed(failed, 'probe'), false)
})

test('the candidate is accepted only on its revision-label FQDN at zero traffic', () => {
  const candidateIngress = ingress('read-a', [
    { revisionName: 'app--serving', weight: 100 },
    { revisionName: 'app--candidate', weight: 0, label: 'ue-candidate' },
  ])
  const candidateRevisions = revisions('rev-a', [
    revision('app--serving', { replicas: 2 }),
    revision('app--candidate', {
      replicas: 1,
      containers: [
        { name: 'union-eyes', image: `registry.azurecr.io/nzila-os-union-eyes@${FRONTEND}` },
        { name: 'django-backend', image: `registry.azurecr.io/nzila-os-union-eyes-backend@${BACKEND}` },
      ],
    }),
  ])
  const probe = {
    label: 'ue-candidate',
    host: 'ue-candidate.union-eyes.example.com',
    stableHost: 'union-eyes.example.com',
    revisionName: 'app--candidate',
    deploymentRevision: 'app--candidate',
    deployment: {
      latestRevisionName: 'app--candidate',
      containers: [
        { name: 'union-eyes', image: `registry.azurecr.io/nzila-os-union-eyes@${FRONTEND}` },
        { name: 'django-backend', image: `registry.azurecr.io/nzila-os-union-eyes-backend@${BACKEND}` },
      ],
    },
    responses: [
      { path: '/api/health', status: 200, body: { ok: true } },
      { path: '/api/ready', status: 200, body: { ok: true } },
      { path: '/api/version', status: 200, body: { gitSha: SHA, frontendImageDigest: FRONTEND, backendImageDigest: BACKEND } },
      {
        path: '/api/admin/database/health',
        status: 200,
        body: {
          tenantPrincipal: { currentUser: 'union_eyes_runtime', rolsuper: false, rolbypassrls: false },
          systemPrincipal: { currentUser: 'union_eyes_system' },
        },
      },
    ],
  }
  const accepted = evaluateDeploymentSafety(withFresh(ready({
    phase: 'probe',
    probe,
    ingress: candidateIngress,
    revisions: candidateRevisions,
  })))
  assert.equal(phaseAllowed(accepted, 'probe'), true)
  assert.equal(accepted.allowTrafficPromotion, false)

  const wrongDigest = structuredClone(probe)
  wrongDigest.responses.find((item) => item.path === '/api/version').body.frontendImageDigest = `sha256:${'9'.repeat(64)}`
  const rejected = evaluateDeploymentSafety(withFresh(ready({
    phase: 'probe',
    probe: wrongDigest,
    ingress: candidateIngress,
    revisions: candidateRevisions,
  })))
  assert.ok(rejected.defects.includes('CANDIDATE_IMAGE_DIGEST_MISMATCH'))
  assert.equal(phaseAllowed(rejected, 'probe'), false)
})

test('an ingress weight rewrite is refused, including a post-change confirmation that lacks a read', () => {
  const proposed = ingress('read-c', [{ revisionName: 'app--serving', weight: 100 }])
  const rewritten = evaluateDeploymentSafety(withFresh(ready({ phase: 'label', proposedIngress: proposed })))
  assert.equal(rewritten.defects.includes('INGRESS_WEIGHT_REWRITE_FORBIDDEN'), false)
  assert.equal(phaseAllowed(rewritten, 'label'), true)

  const shifted = ingress('read-c', [{ revisionName: 'app--serving', weight: 100 }, { revisionName: 'app--candidate', weight: 100, label: 'ue-candidate' }])
  const forbidden = evaluateDeploymentSafety(withFresh(ready({ phase: 'label-confirm', proposedIngress: shifted })))
  assert.ok(forbidden.defects.includes('INGRESS_WEIGHT_REWRITE_FORBIDDEN'))
  assert.equal(forbidden.allowIngressWeightRewrite, false)

  const missingPostImage = evaluateDeploymentSafety(withFresh(ready({ phase: 'label-confirm' })))
  assert.ok(missingPostImage.defects.includes('INGRESS_WEIGHT_REWRITE_FORBIDDEN'))
  assert.equal(phaseAllowed(missingPostImage, 'label-confirm'), false)
})

test('the scoped 0019 executor refuses to run without an allowed decision or the candidate file', () => {
  const script = path.join(REPO, 'tooling/scripts/apply-scoped-journal-tag.mjs')
  const missingDecision = spawnSync(process.execPath, [script, '--tag', '0019_deadline_reassignment_convergence'], { encoding: 'utf8' })
  assert.notEqual(missingDecision.status, 0)

  const decisionFile = path.join(os.tmpdir(), `ue-0019-decision-${process.pid}.json`)
  fs.writeFileSync(decisionFile, JSON.stringify({ phase: 'scoped-0019', allowed: false }))
  const refused = spawnSync(process.execPath, [script, '--tag', '0019_deadline_reassignment_convergence', '--decision', decisionFile], { encoding: 'utf8' })
  assert.notEqual(refused.status, 0)
  assert.match(`${refused.stderr}`, /MIGRATION_0019_ABSENT_FROM_CANDIDATE|SCOPED_0019_DECISION_REFUSED/)
  fs.unlinkSync(decisionFile)
})

test('asserted CLI flags are rejected and the workflow keeps mutations behind the gate', () => {
  const cli = path.join(REPO, 'tooling/scripts/union-eyes-deployment-safety-cli.mjs')
  const asserted = spawnSync(process.execPath, [cli, '--phase', 'migrate', '--frontend-label', SHA, '--schema-preflight', 'pass', '--bypassrls', 'false'], { encoding: 'utf8' })
  assert.equal(asserted.status, 2)
  assert.match(asserted.stderr, /ASSERTED_GATE_REJECTED/)

  const workflow = fs.readFileSync(path.join(REPO, '.github/workflows/deploy-union-eyes.yml'), 'utf8')
  const order = assertWorkflowMutationOrder(workflow)
  assert.deepEqual(order.defects, [])
  const icra = order.jobs.find((job) => job.name === 'apply-icra-capability-migration')
  assert.ok(icra.needs.includes('release-premutation-gate'))
  assert.equal(icra.needs.includes('plan') && icra.needs.length === 1, false)

  const regressed = workflow.replace(
    'apply-icra-capability-migration:\n    runs-on: ubuntu-latest\n    needs: [plan, release-premutation-gate]',
    'apply-icra-capability-migration:\n    runs-on: ubuntu-latest\n    needs: plan',
  )
  const broken = assertWorkflowMutationOrder(regressed)
  assert.ok(broken.defects.includes('ICRA_BEFORE_PREMUTATION_GATE'))
  assert.match(workflow, /revision label add/)
  assert.match(workflow, /\/api\/version/)
  assert.doesNotMatch(workflow, /x-ms-container-app-revision/)
  assert.doesNotMatch(workflow, /ingress traffic set/)

  const authorityOnBuild = workflow.replace(
    '  database-premutation-gate:\n    runs-on: ubuntu-latest\n    needs: [plan]\n',
    '  database-premutation-gate:\n    runs-on: ubuntu-latest\n    needs: [plan, build-push]\n',
  )
  const coupled = assertWorkflowMutationOrder(authorityOnBuild)
  assert.ok(coupled.defects.includes('AUTHORITY_GATE_DEPENDS_ON_IMAGE_BUILD'))
})

test('the workflow CLI requires 0019 to be recorded when the bare flag precedes --now', () => {
  const cli = path.join(REPO, 'tooling/scripts/union-eyes-deployment-safety-cli.mjs')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-0019-cli-'))
  fs.mkdirSync(path.join(root, 'apps/union-eyes/db/migrations-cache/meta'), { recursive: true })
  fs.mkdirSync(path.join(root, 'tooling/scripts'), { recursive: true })
  const sql = 'select 1;\n'
  fs.writeFileSync(path.join(root, 'apps/union-eyes/db/migrations-cache/0019_deadline_reassignment_convergence.sql'), sql)
  fs.copyFileSync(path.join(REPO, 'tooling/scripts/apply-scoped-journal-tag.mjs'), path.join(root, 'tooling/scripts/apply-scoped-journal-tag.mjs'))
  fs.copyFileSync(path.join(REPO, 'apps/union-eyes/db/migrations-cache/meta/_journal.json'), path.join(root, 'apps/union-eyes/db/migrations-cache/meta/_journal.json'))
  const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 'ue-test', GIT_AUTHOR_EMAIL: 'ue-test@example.com', GIT_COMMITTER_NAME: 'ue-test', GIT_COMMITTER_EMAIL: 'ue-test@example.com' }
  for (const args of [['init'], ['add', '.'], ['commit', '-m', 'candidate']]) {
    const result = spawnSync('git', args, { cwd: root, env: gitEnv, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim()
  const migrationSha = crypto.createHash('sha256').update(sql).digest('hex')
  const observed = readSourceIdentity(root, REPO)
  const approval = signApproval(approvalBody({
    releaseSha: commit,
    restoredClone: { ...approvalBody().restoredClone, sourceSha: commit },
    scheduledMigrations: [{
      tag: '0019_deadline_reassignment_convergence',
      sha256: migrationSha,
      executor: 'applyScopedMigrations',
      beforeRlsPreflight: true,
    }],
  }), privateKeyPem)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-0019-evidence-'))
  const manifestPath = path.join(dir, 'manifest.json')
  const approvalPath = path.join(dir, 'approval.json')
  const trustPath = path.join(dir, 'trust.pem')
  const ledgerPath = path.join(dir, 'ledger.json')
  fs.writeFileSync(manifestPath, JSON.stringify({ releaseSha: commit, frontendDigest: FRONTEND, backendDigest: BACKEND }))
  fs.writeFileSync(approvalPath, JSON.stringify(approval))
  fs.writeFileSync(trustPath, publicKeyPem)
  fs.writeFileSync(ledgerPath, JSON.stringify({ source: 'drizzle.__drizzle_migrations', rows: [] }))
  const common = [
    cli,
    '--phase', 'rls-preflight',
    '--now', NOW,
    '--source-root', root,
    '--workflow-sha', commit,
    '--application-source-sha', commit,
    '--manifest', manifestPath,
    '--approval', approvalPath,
    '--approval-trust', trustPath,
    '--ledger', ledgerPath,
  ]
  const scheduledOnly = spawnSync(process.execPath, common, { encoding: 'utf8' })
  const scheduledDecision = JSON.parse(scheduledOnly.stdout)
  assert.equal(scheduledDecision.migration0019.scheduled, true)
  assert.equal(scheduledDecision.migration0019.recorded, false)
  assert.equal(scheduledDecision.defects.includes('MIGRATION_0019_LEDGER_HASH_MISSING'), false)
  assert.equal(scheduledDecision.allowed, true)

  const recordedFlag = spawnSync(process.execPath, [
    cli,
    '--phase', 'rls-preflight',
    '--require-0019-recorded',
    '--now', NOW,
    '--source-root', root,
    '--workflow-sha', commit,
    '--application-source-sha', commit,
    '--manifest', manifestPath,
    '--approval', approvalPath,
    '--approval-trust', trustPath,
    '--ledger', ledgerPath,
  ], { encoding: 'utf8' })
  assert.notEqual(recordedFlag.status, 0)
  const recordedDecision = JSON.parse(recordedFlag.stdout)
  assert.equal(recordedDecision.migration0019.scheduled, true)
  assert.equal(recordedDecision.migration0019.recorded, false)
  assert.ok(recordedDecision.defects.includes('MIGRATION_0019_LEDGER_HASH_MISSING'))
  assert.equal(recordedDecision.allowed, false)
  assert.equal(observed.applicationExecutorSha256, observed.workflowExecutorSha256)
})

test('a two-SHA pin is refused unless the signed approval binds both commits', () => {
  const pinned = sourceIdentity({
    workflowSha: SHA,
    applicationSourceSha: OTHER_SHA,
    migrationCheckoutSha: OTHER_SHA,
    applicationExecutorSha256: '9'.repeat(64),
  })
  const manifest = { releaseSha: OTHER_SHA, frontendDigest: FRONTEND, backendDigest: BACKEND }
  const acrFor = (revision) => ({
    frontend: assembleAcrAttestation({ digest: FRONTEND, tags: [revision, 'latest'] }, { config: { Labels: { 'org.opencontainers.image.revision': revision } } }),
    backend: assembleAcrAttestation({ digest: BACKEND, tags: [revision, 'latest'] }, { config: { Labels: { 'org.opencontainers.image.revision': revision } } }),
  })
  const unbound = signApproval(approvalBody({
    releaseSha: OTHER_SHA,
    restoredClone: { ...approvalBody().restoredClone, sourceSha: OTHER_SHA },
  }), privateKeyPem)
  const refused = evaluateDeploymentSafety(ready({ approval: unbound, manifest, acr: acrFor(OTHER_SHA), sourceIdentity: pinned }))
  assert.ok(refused.defects.includes('TWO_SHA_UNAUTHORIZED'))
  assert.equal(phaseAllowed(refused, 'premigrate'), false)

  const bound = signApproval(approvalBody({
    releaseSha: OTHER_SHA,
    restoredClone: { ...approvalBody().restoredClone, sourceSha: OTHER_SHA },
    twoSha: {
      procedure: 'two-sha-application-pin',
      authorized: true,
      workflowSha: SHA,
      applicationSourceSha: OTHER_SHA,
      workflowExecutorSha256: 'f'.repeat(64),
      applicationExecutorSha256: '9'.repeat(64),
      journalSha256: '1'.repeat(64),
      migrationSha256: HASH_0019,
    },
  }), privateKeyPem)
  const accepted = evaluateDeploymentSafety(ready({ approval: bound, manifest, acr: acrFor(OTHER_SHA), sourceIdentity: pinned }))
  assert.equal(accepted.defects.includes('TWO_SHA_UNAUTHORIZED'), false)
  assert.equal(accepted.defects.includes('TWO_SHA_SOURCE_MISMATCH'), false)
  assert.equal(phaseAllowed(accepted, 'premigrate'), true)
})

test('firewall creation requires the signed approval before the Azure change', () => {
  const request = { serverName: 'nzila-staging-db', resourceGroup: 'nzila-staging-rg' }
  const missing = evaluateDeploymentSafety(ready({ phase: 'approval', firewallRequest: request }))
  assert.ok(missing.defects.includes('FIREWALL_MUTATION_UNAUTHORIZED'))
  assert.equal(phaseAllowed(missing, 'approval'), false)

  const authorized = signApproval(approvalBody({
    infrastructureActions: [{ action: 'postgres-firewall-rule', serverName: request.serverName, resourceGroup: request.resourceGroup }],
  }), privateKeyPem)
  const allowed = evaluateDeploymentSafety(ready({ phase: 'approval', approval: authorized, firewallRequest: request }))
  assert.equal(allowed.defects.includes('FIREWALL_MUTATION_UNAUTHORIZED'), false)
  assert.equal(phaseAllowed(allowed, 'approval'), true)
})

test('staging RLS proof is mandatory and an application response is not that proof', () => {
  const stagingManifest = { releaseSha: SHA, frontendDigest: FRONTEND, backendDigest: BACKEND, environment: 'staging' }
  const absent = evaluateDeploymentSafety(ready({ phase: 'rls-preflight', environment: 'staging', manifest: stagingManifest, candidateRevision: 'app--candidate' }))
  assert.ok(absent.defects.includes('STAGING_RLS_PROOF_MISSING'))
  assert.equal(phaseAllowed(absent, 'rls-preflight'), false)

  const httpOnly = {
    foundation: { source: 'application', name: 'UE_RLS_FOUNDATION_ENFORCED_STAGING', value: true },
    runtimeRoles: { source: 'http', rows: [] },
    ledger: { source: 'manifest', rows: [] },
    tenantDenial: { source: 'application', transport: 'https', command: 'https://union-eyes.example.com/api/health', exitCode: 0, leakedRows: 0 },
  }
  const substituted = evaluateDeploymentSafety(ready({
    phase: 'rls-preflight',
    environment: 'staging',
    manifest: stagingManifest,
    candidateRevision: 'app--candidate',
    stagingRls: httpOnly,
  }))
  assert.ok(substituted.defects.includes('STAGING_RLS_APP_RESPONSE_IS_NOT_PROOF'))
  assert.equal(phaseAllowed(substituted, 'rls-preflight'), false)

  const disabled = {
    foundation: { source: 'github-environment-variable', name: 'UE_RLS_FOUNDATION_ENFORCED_STAGING', value: false },
    runtimeRoles: {
      source: 'pg_roles',
      rows: [
        { rolname: 'union_eyes_runtime', rolsuper: false, rolbypassrls: false },
        { rolname: 'union_eyes_system', rolsuper: false, rolbypassrls: false },
      ],
    },
    ledger: { source: 'drizzle.__drizzle_migrations', rows: [{ hash: HASH_0019 }] },
    databaseIsolation: databaseProof(),
  }
  const foundationOff = evaluateDeploymentSafety(ready({
    phase: 'rls-preflight',
    environment: 'staging',
    manifest: stagingManifest,
    candidateRevision: 'app--candidate',
    stagingRls: disabled,
  }))
  assert.ok(foundationOff.defects.includes('STAGING_RLS_FOUNDATION_DISABLED'))
  assert.equal(phaseAllowed(foundationOff, 'rls-preflight'), false)

  const leaked = structuredClone(disabled)
  leaked.foundation.value = true
  leaked.databaseIsolation.counts.emptyContext = 2
  const denialFailed = evaluateDeploymentSafety(ready({
    phase: 'rls-preflight',
    environment: 'staging',
    manifest: stagingManifest,
    candidateRevision: 'app--candidate',
    stagingRls: leaked,
  }))
  assert.ok(denialFailed.defects.includes('STAGING_RLS_TENANT_DENIAL_FAILED'))
  assert.equal(phaseAllowed(denialFailed, 'rls-preflight'), false)
})

function databaseProof() {
  const proof = {
    kind: 'database-isolation', source: 'deployed-database', transport: 'postgres',
    releaseSha: SHA, databaseBaseline: FIXTURE.databaseBaseline, fixture: structuredClone(FIXTURE),
    observedAt: NOW, test: 'grievances-two-tenant-v1', executedSql: 'synthetic-test-query',
    executedSqlSha256: sha256('synthetic-test-query'),
    ledgerSha256: sha256(JSON.stringify([{ hash: HASH_0019 }])),
    identity: { currentUser: 'union_eyes_runtime', sessionUser: 'union_eyes_runtime', databaseName: FIXTURE.databaseName, rolsuper: false, rolbypassrls: false },
    counts: { fixtureA: 1, fixtureB: 1, ownA: 1, ownB: 1, aReadsB: 0, bReadsA: 0, emptyContext: 0 },
    forgedWrites: { aToB: '42501', bToA: '42501' },
  }
  proof.evidenceId = databaseProofId(proof)
  return proof
}

function stagingInput(phase = 'rls-preflight') {
  const input = ready({ phase, environment: 'staging' })
  input.manifest.environment = 'staging'
  input.stagingRls = {
    foundation: { source: 'github-environment-variable', name: 'UE_RLS_FOUNDATION_ENFORCED_STAGING', value: true },
    runtimeRoles: { source: 'pg_roles', rows: ['union_eyes_runtime', 'union_eyes_system'].map((rolname) => ({ rolname, rolsuper: false, rolbypassrls: false })) },
    ledger: input.ledger,
    databaseIsolation: databaseProof(),
  }
  return input
}

test('database isolation requires nonempty signed fixtures, actual identity and both denial directions', () => {
  assert.equal(phaseAllowed(evaluateDeploymentSafety(stagingInput()), 'rls-preflight'), true)
  const mutations = [
    (p) => { p.counts.fixtureA = 0 }, (p) => { p.counts.fixtureB = 0 },
    (p) => { p.counts.ownA = 0 }, (p) => { p.counts.ownB = 0 },
    (p) => { p.counts.aReadsB = 1 }, (p) => { p.counts.bReadsA = 1 },
    (p) => { p.counts.emptyContext = 1 }, (p) => { p.counts.emptyContext = '0' },
    (p) => { delete p.counts.emptyContext }, (p) => { p.forgedWrites.aToB = 'success' },
    (p) => { delete p.forgedWrites.bToA }, (p) => { p.identity.currentUser = 'postgres' },
    (p) => { p.identity.sessionUser = 'postgres' }, (p) => { p.identity.rolsuper = true },
    (p) => { p.identity.rolbypassrls = true }, (p) => { delete p.identity.rolsuper },
    (p) => { p.identity.databaseName = 'different' }, (p) => { p.releaseSha = OTHER_SHA },
    (p) => { p.databaseBaseline = 'different' }, (p) => { p.fixture.tenantB.organizationId = p.fixture.tenantA.organizationId },
    (p) => { p.fixture.synthetic = false }, (p) => { p.fixture.allowRolledBackWriteProbe = false },
    (p) => { p.candidateRevision = 'claimed-candidate' }, (p) => { p.executedSql = 'changed' },
    (p) => { p.observedAt = '2026-10-20T22:00:00.000Z' },
    (p) => { p.ledgerSha256 = '0'.repeat(64) },
  ]
  for (const mutate of mutations) {
    const input = stagingInput()
    mutate(input.stagingRls.databaseIsolation)
    input.stagingRls.databaseIsolation.evidenceId = databaseProofId(input.stagingRls.databaseIsolation)
    assert.equal(phaseAllowed(evaluateDeploymentSafety(input), 'rls-preflight'), false)
  }
  const unsigned = stagingInput()
  unsigned.approval.acceptanceFixture.fixtureId = 'unsigned-change'
  assert.equal(phaseAllowed(evaluateDeploymentSafety(unsigned), 'rls-preflight'), false)
})

test('candidate endpoint proof is separate and correlated to the database evidence', () => {
  const input = stagingInput('probe')
  input.candidateRevision = 'app--candidate'
  input.ingress.traffic.push({ revisionName: 'app--candidate', weight: 0, label: 'ue-candidate' })
  const containers = [
    { name: 'union-eyes', image: `registry.azurecr.io/app@${FRONTEND}` },
    { name: 'django-backend', image: `registry.azurecr.io/backend@${BACKEND}` },
  ]
  input.revisions.revisions.push(revision('app--candidate', { containers }))
  const proof = input.stagingRls.databaseIsolation
  input.probe = {
    label: 'ue-candidate', host: 'ue-candidate.union-eyes.example.com', stableHost: 'union-eyes.example.com',
    revisionName: 'app--candidate', deploymentRevision: 'app--candidate',
    deployment: { latestRevisionName: 'app--candidate', containers },
    databaseProof: { evidenceId: proof.evidenceId, databaseBaseline: proof.databaseBaseline, releaseSha: SHA, runtimePrincipal: 'union_eyes_runtime' },
    responses: [
      { path: '/api/health', status: 200, body: { ok: true } },
      { path: '/api/ready', status: 200, body: { ok: true } },
      { path: '/api/version', status: 200, body: { gitSha: SHA, frontendImageDigest: FRONTEND, backendImageDigest: BACKEND } },
      { path: '/api/admin/database/health', status: 200, body: {
        tenantPrincipal: { ...proof.identity },
        systemPrincipal: { currentUser: 'union_eyes_system', databaseName: FIXTURE.databaseName, rolsuper: false, rolbypassrls: false },
      } },
    ],
  }
  const checked = withFresh(input)
  assert.equal(phaseAllowed(evaluateDeploymentSafety(checked), 'probe'), true)
  const envelope = structuredClone(checked)
  const admin = envelope.probe.responses[3]
  admin.body = { success: true, data: admin.body, timestamp: NOW }
  assert.equal(phaseAllowed(evaluateDeploymentSafety(envelope), 'probe'), true)
  for (const mutate of [
    (i) => { delete i.probe },
    (i) => { delete i.probe.databaseProof },
    (i) => { i.probe.databaseProof.evidenceId = 'different' },
    (i) => { i.probe.databaseProof.databaseBaseline = 'different' },
    (i) => { i.probe.responses[2].body.frontendImageDigest = BACKEND },
    (i) => { i.probe.responses[3].body.tenantPrincipal.currentUser = 'postgres' },
    (i) => { i.probe.responses[3].body.systemPrincipal.rolbypassrls = true },
    (i) => { i.probe.responses[3].body.tenantPrincipal.databaseName = 'different' },
    (i) => { i.probe.host = i.probe.stableHost },
    (i) => { i.probe.host = 'ue-candidate.unrelated.example.com' },
    (i) => { i.revisions.revisions.pop() },
    (i) => { delete i.stagingRls },
  ]) {
    const changed = structuredClone(checked)
    mutate(changed)
    assert.equal(phaseAllowed(evaluateDeploymentSafety(changed), 'probe'), false)
  }
})

test('psql count parsing survives command tags and refuses malformed shell output', () => {
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'
  const result = spawnSync(bash, ['tooling/scripts/test-union-eyes-psql-parser.sh'], { cwd: REPO, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
})
