import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  assembleAcrAttestation,
  assembleRoleCatalog,
  assertWorkflowMutationOrder,
  evaluateDeploymentSafety,
  inspectMigration0019,
  phaseAllowed,
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

function ready(overrides = {}) {
  const { approval, ...rest } = overrides
  const signed = Object.prototype.hasOwnProperty.call(overrides, 'approval')
    ? approval
    : signApproval(approvalBody(), privateKeyPem)
  return {
    phase: 'premigrate',
    now: NOW,
    manifest: { releaseSha: SHA, frontendDigest: FRONTEND, backendDigest: BACKEND },
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
})
