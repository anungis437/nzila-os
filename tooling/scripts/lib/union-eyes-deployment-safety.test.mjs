import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { evaluateDeploymentSafety, phaseAllowed } from './union-eyes-deployment-safety.mjs'

const SHA = 'a'.repeat(40)
const FRONTEND = `sha256:${'b'.repeat(64)}`
const BACKEND = `sha256:${'c'.repeat(64)}`

function ready(overrides = {}) {
  return {
    releaseSha: SHA,
    images: {
      frontend: { digest: FRONTEND, tag: SHA, label: SHA },
      backend: { digest: BACKEND, tag: SHA, label: SHA },
    },
    inventory: {
      revisionMode: 'multiple',
      revisions: [
        { name: 'app--serving', active: true, replicas: 2, trafficWeight: 100, image: 'app@sha256:old', releaseSha: 'd'.repeat(40) },
      ],
    },
    databaseAuthority: { role: 'ue_migration_admin', bypassrls: false, superuser: false },
    schemaPreflight: { ok: true },
    djangoPreflight: { ok: true },
    rehearsal: {
      restoredClone: true,
      changeRecord: 'CHG-2026-0112',
      approver: 'release-owner',
      recoveryRecorded: true,
      recoveryMethod: 'point-in-time-restore',
      releaseSha: SHA,
    },
    ...overrides,
  }
}

test('an active zero-traffic revision blocks migration until it is quiesced', () => {
  const stale = evaluateDeploymentSafety(ready({
    inventory: {
      revisionMode: 'multiple',
      revisions: [
        { name: 'app--serving', active: true, replicas: 2, trafficWeight: 100, image: 'app@sha256:old' },
        { name: 'app--stale', active: true, replicas: 1, trafficWeight: 0, image: 'app@sha256:stale' },
        { name: 'app--already-stopped', active: false, replicas: 0, trafficWeight: 0, image: 'app@sha256:stopped' },
      ],
    },
  }))
  assert.equal(stale.allowMigration, false)
  assert.deepEqual(stale.quiesceRevisions, ['app--stale'])
  assert.equal(stale.allowQuiesce, true)
  assert.equal(stale.allowTrafficPromotion, false)
  assert.equal(phaseAllowed(stale, 'quiesce'), true)
  assert.equal(phaseAllowed(stale, 'migrate'), false)

  const cleared = evaluateDeploymentSafety(ready())
  assert.equal(cleared.allowMigration, true)
  assert.equal(cleared.allowTrafficPromotion, false)
  assert.equal(phaseAllowed(cleared, 'promote'), false)
})

test('a wrong image tag or digest blocks the release', () => {
  const wrongTag = evaluateDeploymentSafety(ready({
    images: {
      frontend: { digest: FRONTEND, tag: 'latest', label: SHA },
      backend: { digest: BACKEND, tag: SHA, label: SHA },
    },
  }))
  assert.ok(wrongTag.defects.includes('WRONG_IMAGE_FRONTEND_TAG'))
  assert.equal(wrongTag.allowMigration, false)

  const wrongDigest = evaluateDeploymentSafety(ready({
    images: {
      frontend: { digest: 'frontend:staging', tag: SHA, label: SHA },
      backend: { digest: BACKEND, tag: SHA, label: SHA },
    },
  }))
  assert.ok(wrongDigest.defects.includes('WRONG_IMAGE_FRONTEND_DIGEST'))
})

test('a failed schema preflight blocks migration before any later phase', () => {
  const decision = evaluateDeploymentSafety(ready({ schemaPreflight: { ok: false } }))
  assert.ok(decision.defects.includes('SCHEMA_MIGRATION_PREFLIGHT_FAILED'))
  assert.equal(decision.allowMigration, false)
  assert.equal(decision.allowCandidateDeploy, false)
  assert.equal(phaseAllowed(decision, 'promote'), false)
})

test('nzilaadmin and a bypassrls role are refused as migration authority', () => {
  const admin = evaluateDeploymentSafety(ready({ databaseAuthority: { role: 'nzilaadmin', bypassrls: true, superuser: true } }))
  assert.ok(admin.defects.includes('INCORRECT_DATABASE_AUTHORITY'))
  const runtime = evaluateDeploymentSafety(ready({ databaseAuthority: { role: 'union_eyes_runtime', bypassrls: false, superuser: false } }))
  assert.ok(runtime.defects.includes('INCORRECT_DATABASE_AUTHORITY'))
})

test('traffic rollback is refused after a committed migration', () => {
  const decision = evaluateDeploymentSafety(ready({ migrationCommitted: true, requestedRecovery: 'traffic-rollback' }))
  assert.ok(decision.defects.includes('MIGRATION_RECOVERY_IS_NOT_TRAFFIC_ROLLBACK'))
  assert.equal(decision.allowTrafficPromotion, false)
  assert.equal(phaseAllowed(decision, 'traffic-rollback'), false)
  assert.equal(decision.promotionRefusal, 'AUTOMATIC_TRAFFIC_PROMOTION_FORBIDDEN')
})

test('a probe of the serving ingress is not acceptance of the candidate', () => {
  const decision = evaluateDeploymentSafety(ready({
    phase: 'probe',
    probe: { target: 'serving-ingress', header: '', revisionName: 'app--serving' },
    healthProbe: { ok: true },
    tenantIsolation: { ok: true, principal: 'union_eyes_runtime', bypassrls: false },
  }))
  assert.ok(decision.defects.includes('CANDIDATE_PROBE_HIT_SERVING_REVISION'))
  assert.equal(phaseAllowed(decision, 'probe'), false)

  const candidate = evaluateDeploymentSafety(ready({
    phase: 'probe',
    candidateRevision: 'app--candidate',
    inventory: {
      revisionMode: 'multiple',
      revisions: [
        { name: 'app--serving', active: true, replicas: 2, trafficWeight: 100, image: 'app@sha256:old' },
        { name: 'app--candidate', active: true, replicas: 1, trafficWeight: 0, image: `app@${FRONTEND}` },
      ],
    },
    probe: { target: 'candidate-revision', header: 'x-ms-container-app-revision', revisionName: 'app--candidate' },
    healthProbe: { ok: true },
    tenantIsolation: { ok: true, principal: 'union_eyes_runtime', bypassrls: false },
  }))
  assert.equal(phaseAllowed(candidate, 'probe'), true)
  assert.equal(candidate.allowTrafficPromotion, false)
})

test('missing rehearsal evidence and a workflow identity cannot authorize migration', () => {
  const missing = evaluateDeploymentSafety(ready({ rehearsal: {} }))
  assert.ok(missing.defects.includes('RESTORED_CLONE_REHEARSAL_REQUIRED'))
  assert.ok(missing.defects.includes('CHANGE_RECORD_REQUIRED'))
  assert.ok(missing.defects.includes('HUMAN_APPROVAL_REQUIRED'))
  assert.ok(missing.defects.includes('RECOVERY_EVIDENCE_REQUIRED'))
  const bot = evaluateDeploymentSafety(ready({
    rehearsal: { ...ready().rehearsal, approver: 'github-actions' },
  }))
  assert.ok(bot.defects.includes('HUMAN_APPROVAL_REQUIRED'))
  const unauthorizedQuiesce = evaluateDeploymentSafety(ready({
    rehearsal: {},
    inventory: {
      revisionMode: 'multiple',
      revisions: [
        { name: 'app--serving', active: true, replicas: 1, trafficWeight: 100, image: 'app@sha256:old' },
        { name: 'app--stale', active: true, replicas: 1, trafficWeight: 0, image: 'app@sha256:stale' },
      ],
    },
  }))
  assert.equal(phaseAllowed(unauthorizedQuiesce, 'quiesce'), false)
})

test('the workflow pins the candidate to the release SHA and does not promote traffic', () => {
  const workflow = fs.readFileSync(new URL('../../../.github/workflows/deploy-union-eyes.yml', import.meta.url), 'utf8')
  assert.match(workflow, /org\.opencontainers\.image\.revision=\$\{\{ steps\.source\.outputs\.sha \}\}/)
  assert.match(workflow, /source_sha: \$\{\{ steps\.source\.outputs\.sha \}\}/)
  assert.match(workflow, /union-eyes-deployment-safety-cli\.mjs/)
  assert.match(workflow, /x-ms-container-app-revision/)
  assert.match(workflow, /Pin ingress to the serving revision/)
  assert.match(workflow, /Probe the candidate revision/)
  assert.doesNotMatch(workflow, /Promote traffic/)
  assert.match(workflow, /python manage\.py showmigrations --plan/)
})
