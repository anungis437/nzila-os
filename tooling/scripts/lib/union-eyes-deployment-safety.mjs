/**
 * Fail-closed Union Eyes release decisions.
 *
 * This module does not call Azure and does not change traffic, labels, or
 * the database. Callers may mutate only after phaseAllowed returns true for
 * that exact phase, and only for the mutation named by an authenticated
 * approval. Traffic promotion and ingress weight rewrites are never allowed.
 */
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const MIGRATION_0019_TAG = '0019_deadline_reassignment_convergence'
export const MIGRATION_0019_RELATIVE_PATH = 'apps/union-eyes/db/migrations-cache/0019_deadline_reassignment_convergence.sql'
export const PREMUTATION_GATE_JOB = 'release-premutation-gate'
export const DATABASE_PREMUTATION_GATE_JOB = 'database-premutation-gate'
export const SCOPED_EXECUTOR = 'applyScopedMigrations'
export const TWO_SHA_PROCEDURE = 'two-sha-application-pin'
export const EXECUTOR_RELATIVE_PATH = 'tooling/scripts/apply-scoped-journal-tag.mjs'
export const JOURNAL_RELATIVE_PATH = 'apps/union-eyes/db/migrations-cache/meta/_journal.json'
export const APPROVAL_MAX_AGE_MS = 72 * 60 * 60 * 1000
export const RESTORED_CLONE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export const AUTHORITY_MUTATION_JOBS = [
  'apply-authority-schema-prerequisites',
  'apply-automation-rules-ownership-migration',
  'apply-rls-foundation-migration',
  'apply-authority-enforcement-migration',
  'apply-round58-grant-fix-migration',
  'apply-round59-geometry-gap-closure',
  'apply-round59-congress-memberships-grant-fix',
  'apply-congress-memberships-multi-party-rls-fix',
]

export const RELEASE_MUTATION_JOBS = [
  'apply-icra-capability-migration',
  'apply-scoped-0019',
  'apply-django-migrations',
]

export const DATABASE_MUTATION_JOBS = [...AUTHORITY_MUTATION_JOBS, ...RELEASE_MUTATION_JOBS]

const PHASE_MUTATIONS = {
  icra: 'scoped-0005',
  'scoped-0019': 'scoped-0019',
  migrate: 'django-migrate',
  label: 'candidate-label',
  deactivate: 'revision-deactivate',
}

const SHA_RE = /^[0-9a-f]{40}$/
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/
const FORBIDDEN_MIGRATION_ROLES = new Set([
  'nzilaadmin',
  'union_eyes_runtime',
  'union_eyes_system',
  'postgres',
  'public',
  'azure_superuser',
])
const WORKFLOW_IDENTITIES = /^(github-actions(\[bot\])?|dependabot\[bot\])$/i
const PROBE_PATHS = ['/api/health', '/api/ready', '/api/version', '/api/admin/database/health']

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export function signApproval(body, privateKeyPem) {
  const signature = crypto.sign(null, Buffer.from(canonicalJson(body)), privateKeyPem).toString('base64')
  return { ...body, signature: { algorithm: 'ed25519', keyId: 'ue-release-approver', value: signature } }
}

export function approvalSignatureValid(record, publicKeyPem) {
  if (!record?.signature || record.signature.algorithm !== 'ed25519' || !record.signature.value || !publicKeyPem) return false
  const { signature: _signature, ...body } = record
  try {
    return crypto.verify(null, Buffer.from(canonicalJson(body)), publicKeyPem, Buffer.from(record.signature.value, 'base64'))
  } catch {
    return false
  }
}

export function inspectMigration0019(sourceRoot) {
  const filePath = path.join(sourceRoot, MIGRATION_0019_RELATIVE_PATH)
  if (!fs.existsSync(filePath)) return { present: false, sha256: null, filePath }
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
  return { present: true, sha256, filePath }
}

function hashFile(root, relativePath) {
  const filePath = path.join(root, relativePath)
  if (!root || !fs.existsSync(filePath)) return null
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

export function readSourceIdentity(sourceRoot, workflowRoot = sourceRoot) {
  const git = spawnSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  return {
    migrationCheckoutSha: git.status === 0 ? git.stdout.trim() : null,
    applicationExecutorSha256: hashFile(sourceRoot, EXECUTOR_RELATIVE_PATH),
    workflowExecutorSha256: hashFile(workflowRoot, EXECUTOR_RELATIVE_PATH),
    journalSha256: hashFile(sourceRoot, JOURNAL_RELATIVE_PATH),
  }
}

export function assembleAcrAttestation(show, config) {
  const labels = config?.config?.Labels ?? config?.Labels ?? null
  return {
    source: 'acr',
    digest: typeof show?.digest === 'string' ? show.digest : null,
    tags: Array.isArray(show?.tags) ? show.tags : [],
    labels,
  }
}

export function assembleRoleCatalog(row) {
  return {
    source: 'pg_roles',
    query: 'SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = current_user',
    currentUser: row?.rolname ?? null,
    rows: row ? [row] : [],
  }
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key)
}

export function normalizeTrafficEntry(entry) {
  const weightPresent = hasOwn(entry, 'weight') && entry.weight !== null && entry.weight !== undefined
  const label = typeof entry?.label === 'string' && entry.label.length > 0 ? entry.label : null
  return {
    revisionName: entry?.revisionName ?? null,
    weight: weightPresent ? Number(entry.weight) : null,
    label,
  }
}

export function normalizeIngress(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'INGRESS_MISSING' }
  if (!raw.readId) return { error: 'INGRESS_READ_ID_MISSING' }
  const trafficRaw = Array.isArray(raw.traffic)
    ? raw.traffic
    : raw.properties?.configuration?.ingress?.traffic
  if (!Array.isArray(trafficRaw)) return { error: 'INGRESS_TRAFFIC_MISSING' }
  const mode = raw.activeRevisionsMode ?? raw.properties?.configuration?.activeRevisionsMode ?? ''
  return {
    readId: String(raw.readId),
    observedAt: raw.observedAt ?? raw.capturedAt ?? null,
    mode: String(mode).toLowerCase(),
    fqdn: raw.fqdn ?? raw.properties?.configuration?.ingress?.fqdn ?? '',
    traffic: trafficRaw.map(normalizeTrafficEntry),
  }
}

export function normalizeRevisionList(raw) {
  const rows = Array.isArray(raw) ? raw : raw?.value ?? raw?.revisions
  if (!Array.isArray(rows)) return { error: 'REVISION_INVENTORY_MISSING' }
  return {
    readId: raw?.readId ? String(raw.readId) : null,
    observedAt: raw?.observedAt ?? null,
    revisions: rows.map((row) => {
      const props = row.properties ?? {}
      const containers = (props.template?.containers ?? row.containers ?? []).map((container) => ({
        name: container.name ?? '',
        image: container.image ?? '',
      }))
      return {
        name: row.name,
        active: Boolean(row.active ?? props.active),
        replicas: Number(row.replicas ?? props.replicas ?? 0),
        containers,
      }
    }),
  }
}

function fingerprint(ingress, revisions) {
  return canonicalJson({
    mode: ingress.mode,
    fqdn: ingress.fqdn,
    traffic: ingress.traffic,
    revisions: revisions.revisions.map((revision) => ({
      name: revision.name,
      active: revision.active,
      replicas: revision.replicas,
      containers: revision.containers,
    })),
  })
}

function joinRevisions(ingress, revisionList) {
  const trafficByName = new Map(
    ingress.traffic.filter((entry) => entry.revisionName).map((entry) => [entry.revisionName, entry]),
  )
  const names = new Set(revisionList.revisions.map((revision) => revision.name))
  const joined = revisionList.revisions.map((revision) => {
    const traffic = trafficByName.get(revision.name)
    return {
      ...revision,
      weight: traffic ? traffic.weight : null,
      label: traffic?.label ?? null,
      listedInIngress: Boolean(traffic),
    }
  })
  for (const entry of ingress.traffic) {
    if (entry.revisionName && !names.has(entry.revisionName)) {
      joined.push({
        name: entry.revisionName,
        active: true,
        replicas: 0,
        containers: [],
        weight: entry.weight,
        label: entry.label,
        listedInIngress: true,
      })
    }
  }
  return joined
}

function imageDigest(image) {
  const match = String(image ?? '').match(/@(sha256:[0-9a-f]{64})$/)
  return match ? match[1] : null
}

export function servingDigests(ingressRaw, revisionsRaw) {
  const ingress = normalizeIngress(ingressRaw)
  const revisions = normalizeRevisionList(revisionsRaw)
  if (ingress.error || revisions.error) return null
  const serving = joinRevisions(ingress, revisions).filter((revision) => revision.weight !== null && revision.weight > 0)
  if (serving.length !== 1) return null
  const images = serving[0].containers ?? []
  const backend = images.find((container) => container.name === 'django-backend' || String(container.image).includes('union-eyes-backend'))
  const frontend = images.find((container) => container !== backend && (container.name === 'union-eyes' || String(container.image).includes('nzila-os-union-eyes')))
  const frontendDigest = imageDigest(frontend?.image)
  const backendDigest = imageDigest(backend?.image)
  if (!frontendDigest || !backendDigest) return null
  return { frontendDigest, backendDigest, revisionName: serving[0].name }
}

function servingImageDefects(manifest, serving) {
  if (serving.length !== 1) return ['SERVING_IMAGE_DIGEST_MISMATCH']
  const images = serving[0].containers ?? []
  const backend = images.find((container) => container.name === 'django-backend' || String(container.image).includes('union-eyes-backend'))
  const frontend = images.find((container) => container !== backend && (container.name === 'union-eyes' || String(container.image).includes('nzila-os-union-eyes')))
  if (imageDigest(frontend?.image) !== manifest?.frontendDigest || imageDigest(backend?.image) !== manifest?.backendDigest) {
    return ['SERVING_IMAGE_DIGEST_MISMATCH']
  }
  return []
}

function imageDefects(manifest, acr) {
  const defects = []
  if (!manifest || !SHA_RE.test(manifest.releaseSha ?? '') || !DIGEST_RE.test(manifest.frontendDigest ?? '') || !DIGEST_RE.test(manifest.backendDigest ?? '')) {
    defects.push('RELEASE_MANIFEST_INVALID')
  }
  for (const side of ['frontend', 'backend']) {
    const observed = acr?.[side]
    const name = side.toUpperCase()
    if (!observed || observed.source !== 'acr' || !observed.labels || typeof observed.labels !== 'object') {
      defects.push(`IMAGE_ATTESTATION_MISSING_${name}`)
      continue
    }
    if (observed.digest !== manifest?.[`${side}Digest`]) defects.push(`WRONG_IMAGE_${name}_DIGEST`)
    if (observed.labels['org.opencontainers.image.revision'] !== manifest?.releaseSha) defects.push(`WRONG_IMAGE_${name}_LABEL`)
    if (!Array.isArray(observed.tags) || !observed.tags.includes(manifest?.releaseSha)) defects.push(`WRONG_IMAGE_${name}_TAG`)
  }
  return defects
}

function roleDefects(catalog) {
  if (!catalog || catalog.source !== 'pg_roles' || !Array.isArray(catalog.rows)) return ['ROLE_EVIDENCE_MISSING']
  if (catalog.rows.length !== 1) return ['ROLE_EVIDENCE_MISSING']
  const row = catalog.rows[0]
  if (!hasOwn(row, 'rolsuper') || !hasOwn(row, 'rolbypassrls') || !row.rolname) return ['ROLE_EVIDENCE_INCOMPLETE']
  const role = String(row.rolname).trim().toLowerCase()
  if (FORBIDDEN_MIGRATION_ROLES.has(role) || row.rolsuper !== false || row.rolbypassrls !== false) return ['INCORRECT_DATABASE_AUTHORITY']
  if (catalog.currentUser && String(catalog.currentUser).toLowerCase() !== role) return ['INCORRECT_DATABASE_AUTHORITY']
  return []
}

function restoredCloneDefects(approval, manifest, nowMs) {
  const clone = approval?.restoredClone
  if (!clone || clone.target === 'staging') return ['RESTORED_CLONE_MISSING']
  const defects = []
  if (!clone.databaseBaseline || !clone.recoveryPoint || !clone.changeRecordId) defects.push('RESTORED_CLONE_MISSING')
  if (clone.sourceSha !== manifest?.releaseSha || clone.frontendDigest !== manifest?.frontendDigest || clone.backendDigest !== manifest?.backendDigest) {
    defects.push('RESTORED_CLONE_BINDING_MISMATCH')
  }
  if (clone.databaseBaseline !== approval?.databaseBaseline || clone.changeRecordId !== approval?.changeRecordId) {
    defects.push('RESTORED_CLONE_BINDING_MISMATCH')
  }
  const tests = Array.isArray(clone.tests) ? clone.tests : []
  if (tests.length === 0 || tests.some((test) => test.ok !== true)) defects.push('RESTORED_CLONE_TESTS_FAILED')
  const recoveryMs = Date.parse(clone.recoveryPoint ?? '')
  const issuedMs = Date.parse(approval?.issuedAt ?? '')
  if (!Number.isFinite(recoveryMs) || !Number.isFinite(issuedMs) || recoveryMs > issuedMs || issuedMs - recoveryMs > RESTORED_CLONE_MAX_AGE_MS || recoveryMs > nowMs) {
    defects.push('RESTORED_CLONE_STALE')
  }
  const apply = clone.schemaApply ?? {}
  if (/showmigrations/i.test(String(apply.command ?? '')) || apply.inspectionOnly === true) defects.push('SHOWMIGRATIONS_PLAN_IS_NOT_APPLY_PROOF')
  if (apply.provesApply !== true || apply.exitCode !== 0 || apply.target !== 'restored-clone' || !apply.command) {
    defects.push('SCHEMA_APPLY_PROOF_MISSING')
  }
  return defects
}

function approvalDefects(approval, publicKeyPem, manifest, nowMs) {
  if (!approval || typeof approval !== 'object') return ['APPROVAL_MISSING']
  const defects = []
  if (!approvalSignatureValid(approval, publicKeyPem)) defects.push('APPROVAL_UNSIGNED')
  if (approval.approvalStatus !== 'APPROVED' || !Array.isArray(approval.approvedBy) || approval.approvedBy.length === 0) {
    defects.push('APPROVAL_NOT_APPROVED')
  } else if (approval.approvedBy.some((name) => WORKFLOW_IDENTITIES.test(String(name)))) {
    defects.push('APPROVAL_NOT_APPROVED')
  } else if (!Array.isArray(approval.approversRequired) || approval.approversRequired.some((name) => !approval.approvedBy.includes(name))) {
    defects.push('APPROVAL_NOT_APPROVED')
  }
  const issuedMs = Date.parse(approval.issuedAt ?? '')
  const expiresMs = Date.parse(approval.expiresAt ?? '')
  if (!Number.isFinite(issuedMs) || !Number.isFinite(expiresMs) || !Number.isFinite(nowMs) || expiresMs <= nowMs || nowMs - issuedMs > APPROVAL_MAX_AGE_MS || issuedMs > nowMs + 5 * 60 * 1000) {
    defects.push('APPROVAL_STALE')
  }
  if (approval.releaseSha !== manifest?.releaseSha || approval.frontendDigest !== manifest?.frontendDigest || approval.backendDigest !== manifest?.backendDigest || !approval.changeRecordId || approval.recoveryMethod !== 'point-in-time-restore') {
    defects.push('APPROVAL_BINDING_MISMATCH')
  }
  if (typeof approval.approver === 'string' && approval.approvalStatus !== 'APPROVED') defects.push('APPROVAL_NOT_APPROVED')
  defects.push(...restoredCloneDefects(approval, manifest, nowMs))
  return defects
}

function sourceParityDefects(identity, manifest, approval, migration0019) {
  if (!identity) return ['SOURCE_IDENTITY_MISSING']
  const workflowSha = identity.workflowSha
  const applicationSourceSha = identity.applicationSourceSha
  if (!SHA_RE.test(workflowSha ?? '') || !SHA_RE.test(applicationSourceSha ?? '') || !SHA_RE.test(identity.migrationCheckoutSha ?? '')) {
    return ['SOURCE_IDENTITY_MISSING']
  }
  if (!identity.workflowExecutorSha256 || !identity.applicationExecutorSha256 || !identity.journalSha256) {
    return ['SOURCE_IDENTITY_MISSING']
  }
  const defects = []
  if (identity.migrationCheckoutSha !== applicationSourceSha || manifest?.releaseSha !== applicationSourceSha) {
    defects.push('TWO_SHA_SOURCE_MISMATCH')
  }
  if (workflowSha === applicationSourceSha) {
    if (identity.workflowExecutorSha256 !== identity.applicationExecutorSha256 || approval?.twoSha) defects.push('TWO_SHA_SOURCE_MISMATCH')
    return defects
  }
  const two = approval?.twoSha
  if (!two || two.procedure !== TWO_SHA_PROCEDURE || two.authorized !== true) {
    defects.push('TWO_SHA_UNAUTHORIZED')
    return defects
  }
  if (two.workflowSha !== workflowSha || two.applicationSourceSha !== applicationSourceSha) defects.push('TWO_SHA_SOURCE_MISMATCH')
  if (two.workflowExecutorSha256 !== identity.workflowExecutorSha256 || two.applicationExecutorSha256 !== identity.applicationExecutorSha256) {
    defects.push('TWO_SHA_SOURCE_MISMATCH')
  }
  if (two.journalSha256 !== identity.journalSha256) defects.push('TWO_SHA_SOURCE_MISMATCH')
  if (migration0019?.present && two.migrationSha256 !== migration0019.sha256) defects.push('TWO_SHA_SOURCE_MISMATCH')
  return defects
}

function firewallAuthorizationDefects(approval, request) {
  if (!request) return []
  const actions = Array.isArray(approval?.infrastructureActions) ? approval.infrastructureActions : []
  const match = actions.find((item) => item.action === 'postgres-firewall-rule' && item.serverName === request.serverName && item.resourceGroup === request.resourceGroup)
  if (!request.serverName || !request.resourceGroup || !match) return ['FIREWALL_MUTATION_UNAUTHORIZED']
  return []
}

function stagingRlsDefects(input, manifest, migration0019) {
  const environment = input.environment ?? manifest?.environment
  if (environment !== 'staging') return []
  const proof = input.stagingRls
  if (!proof || typeof proof !== 'object') return ['STAGING_RLS_PROOF_MISSING']
  const defects = []
  const foundation = proof.foundation
  if (!foundation || foundation.source !== 'github-environment-variable' || foundation.name !== 'UE_RLS_FOUNDATION_ENFORCED_STAGING') {
    defects.push('STAGING_RLS_FOUNDATION_UNVERIFIED')
  } else if (foundation.value !== true) {
    defects.push('STAGING_RLS_FOUNDATION_DISABLED')
  }
  const ledger = proof.ledger
  if (!ledger || ledger.source !== 'drizzle.__drizzle_migrations' || !Array.isArray(ledger.rows) || ledger.rows.length === 0 || ledger.rows.some((row) => !/^[0-9a-f]{64}$/.test(String(row.hash ?? '')))) {
    defects.push('STAGING_RLS_LEDGER_MISSING')
  }
  if (migration0019?.present && !migration0019.recorded) defects.push('MIGRATION_0019_LEDGER_HASH_MISSING')
  const roles = proof.runtimeRoles
  if (!roles || roles.source === 'application' || roles.source === 'manifest' || roles.source === 'http') defects.push('STAGING_RLS_APP_RESPONSE_IS_NOT_PROOF')
  else if (roles.source !== 'pg_roles' || !Array.isArray(roles.rows)) defects.push('STAGING_RLS_ROLE_UNVERIFIED')
  else {
    for (const name of ['union_eyes_runtime', 'union_eyes_system']) {
      const row = roles.rows.find((item) => item.rolname === name)
      if (!row || !hasOwn(row, 'rolsuper') || !hasOwn(row, 'rolbypassrls') || row.rolsuper !== false || row.rolbypassrls !== false) {
        defects.push('STAGING_RLS_ROLE_UNVERIFIED')
      }
    }
  }
  const denial = proof.tenantDenial
  const denialCommand = String(denial?.command ?? '')
  if (!denial || denial.source !== 'deployed-database' || denial.transport !== 'postgres' || !denialCommand.includes('set_config') || /^https?:/i.test(denialCommand)) {
    defects.push('STAGING_RLS_APP_RESPONSE_IS_NOT_PROOF')
  } else if (denial.candidateRevision !== input.candidateRevision || denial.releaseSha !== manifest?.releaseSha || denial.servingRevisionReached === true) {
    defects.push('STAGING_RLS_CANDIDATE_EVIDENCE_MISSING')
  } else if (denial.exitCode !== 0 || denial.leakedRows !== 0) {
    defects.push('STAGING_RLS_TENANT_DENIAL_FAILED')
  }
  return defects
}

function migration0019State(input, approval) {
  const inspected = input.migration0019 ?? { present: false, sha256: null }
  const ledger = input.ledger
  const ledgerTrusted = ledger?.source === 'drizzle.__drizzle_migrations' && Array.isArray(ledger.rows)
  const recorded = Boolean(inspected.present && inspected.sha256 && ledgerTrusted && ledger.rows.some((row) => row.hash === inspected.sha256))
  const scheduledRecord = approval?.scheduledMigrations?.find((item) => item.tag === MIGRATION_0019_TAG) ?? null
  const scheduled = Boolean(
    inspected.present
    && scheduledRecord
    && scheduledRecord.sha256 === inspected.sha256
    && scheduledRecord.executor === SCOPED_EXECUTOR
    && scheduledRecord.beforeRlsPreflight === true
    && Array.isArray(approval?.authorizedMutations)
    && approval.authorizedMutations.includes('scoped-0019'),
  )
  return { ...inspected, recorded, scheduled, ledgerTrusted }
}

function addMigration0019Defects(defects, state, rlsPreflight) {
  if (!state.present) defects.push('MIGRATION_0019_ABSENT_FROM_CANDIDATE')
  if (!state.ledgerTrusted) defects.push('MIGRATION_0019_LEDGER_HASH_MISSING')
  else if (!state.recorded && !state.scheduled) defects.push('MIGRATION_0019_LEDGER_HASH_MISSING')
  if (rlsPreflight && (rlsPreflight.ok === true || rlsPreflight.exitCode === 0) && !hasOwn(rlsPreflight, 'exitCode')) {
    defects.push('RLS_PREFLIGHT_FAILED')
  } else if (rlsPreflight && rlsPreflight.exitCode !== 0 && rlsPreflight.exitCode !== undefined) {
    defects.push('RLS_PREFLIGHT_FAILED')
  } else if (rlsPreflight && rlsPreflight.exitCode === 0 && !state.recorded) {
    defects.push('RLS_PREFLIGHT_BEFORE_0019')
  }
}

function deploymentImagesMatch(deployment, manifest) {
  const images = (deployment?.containers ?? deployment?.properties?.template?.containers ?? []).map((container) => container.image ?? '')
  const frontend = images.some((image) => image.endsWith(`@${manifest.frontendDigest}`))
  const backend = images.some((image) => image.endsWith(`@${manifest.backendDigest}`))
  return frontend && backend
}

function probeDefects(probe, manifest, servingNames, candidate) {
  const defects = []
  if (!probe) return ['CANDIDATE_PROBE_MISSING']
  if (probe.header === 'x-ms-container-app-revision' || (probe.stableHost && probe.host === probe.stableHost)) {
    defects.push('CANDIDATE_PROBE_HIT_SERVING_REVISION')
  }
  if (!probe.label || !probe.host || !probe.host.startsWith(`${probe.label}.`)) defects.push('CANDIDATE_REVISION_FQDN_REQUIRED')
  const revisionName = probe.deploymentRevision ?? probe.revisionName ?? ''
  if (!revisionName || servingNames.includes(revisionName)) defects.push('CANDIDATE_PROBE_HIT_SERVING_REVISION')
  if (!probe.deployment || !probe.deployment.latestRevisionName) defects.push('CANDIDATE_REVISION_UNIDENTIFIED')
  else if (probe.deployment.latestRevisionName !== revisionName || !deploymentImagesMatch(probe.deployment, manifest)) {
    defects.push('CANDIDATE_IMAGE_DIGEST_MISMATCH')
  }
  if (candidate && candidate.weight !== 0 && candidate.weight !== null) defects.push('CANDIDATE_TRAFFIC_NOT_ZERO')
  if (candidate && candidate.label !== probe.label) defects.push('CANDIDATE_REVISION_FQDN_REQUIRED')
  for (const requiredPath of PROBE_PATHS) {
    const response = (probe.responses ?? []).find((item) => item.path === requiredPath)
    if (!response || response.status < 200 || response.status >= 300) defects.push(`CANDIDATE_PROBE_PATH_FAILED:${requiredPath}`)
  }
  const version = (probe.responses ?? []).find((item) => item.path === '/api/version')?.body ?? {}
  if (version.gitSha !== manifest?.releaseSha) defects.push('CANDIDATE_RELEASE_SHA_MISMATCH')
  if (version.frontendImageDigest !== manifest?.frontendDigest || version.backendImageDigest !== manifest?.backendDigest) {
    defects.push('CANDIDATE_IMAGE_DIGEST_MISMATCH')
  }
  const admin = (probe.responses ?? []).find((item) => item.path === '/api/admin/database/health')?.body ?? {}
  const tenant = admin.tenantPrincipal ?? {}
  const system = admin.systemPrincipal ?? {}
  if (tenant.currentUser !== 'union_eyes_runtime' || tenant.rolsuper !== false || tenant.rolbypassrls !== false || system.currentUser !== 'union_eyes_system') {
    defects.push('AUTHENTICATED_ACCEPTANCE_FAILED')
  }
  return defects
}

function weightsPreserved(before, after) {
  const beforeWeights = new Map(before.traffic.map((entry) => [entry.revisionName, entry.weight]))
  for (const entry of after.traffic) {
    if (!beforeWeights.has(entry.revisionName)) {
      if (entry.weight !== null && entry.weight !== 0) return false
      continue
    }
    if (beforeWeights.get(entry.revisionName) !== entry.weight) return false
  }
  for (const [name, weight] of beforeWeights) {
    const afterEntry = after.traffic.find((entry) => entry.revisionName === name)
    if (!afterEntry || afterEntry.weight !== weight) return false
  }
  return true
}

export function evaluateDeploymentSafety(input) {
  const defects = []
  const manifest = input.manifest ?? null
  const nowMs = Date.parse(input.now ?? '')
  const skipAcr = input.phase === 'authority' || (input.phase === 'approval' && !input.acr)
  if (!skipAcr) defects.push(...imageDefects(manifest, input.acr))
  if (input.phase !== 'approval') defects.push(...roleDefects(input.roleCatalog))

  const ingress = normalizeIngress(input.ingress)
  const revisions = normalizeRevisionList(input.revisions)
  if (ingress.error) defects.push(ingress.error)
  if (revisions.error) defects.push(revisions.error)
  if (!ingress.error && ingress.mode !== 'multiple') defects.push('REVISION_MODE_NOT_MULTIPLE')

  const joined = ingress.error || revisions.error ? [] : joinRevisions(ingress, revisions)
  const candidateName = input.probe?.deployment?.latestRevisionName ?? input.probe?.revisionName ?? input.candidateRevision ?? ''
  const serving = joined.filter((revision) => revision.weight !== null && revision.weight > 0)
  const labelReachable = joined.filter((revision) => revision.label && !(revision.weight !== null && revision.weight > 0))
  const unspecified = joined.filter((revision) => revision.active && revision.weight === null && !revision.label && revision.name !== candidateName)
  const unaccounted = joined.filter((revision) => revision.active && revision.weight === 0 && !revision.label && revision.replicas > 0)
  const candidateLabelAllowed = input.phase === 'probe' || input.phase === 'label-confirm'
  const unexpectedLabels = labelReachable.filter((revision) => !(candidateLabelAllowed && revision.name === candidateName))
  if (!ingress.error && !revisions.error && serving.length !== 1) defects.push('SERVING_REVISION_AMBIGUOUS')
  if (serving.length > 1) defects.push('MIXED_TRAFFIC_ALLOCATION')
  if (unspecified.length > 0) defects.push('UNSPECIFIED_TRAFFIC_WEIGHT')
  if (unexpectedLabels.length > 0) defects.push('LABEL_REACHABLE_REVISION')
  if (unaccounted.length > 0) defects.push('UNACCOUNTED_ACTIVE_REVISION')

  const approval = input.approval ?? null
  defects.push(...approvalDefects(approval, input.approvalTrustPem, manifest, nowMs))
  const migration0019 = migration0019State(input, approval)
  addMigration0019Defects(defects, migration0019, input.rlsPreflight)
  if (input.requireLedgerRecord === true && !migration0019.recorded) defects.push('MIGRATION_0019_LEDGER_HASH_MISSING')
  defects.push(...sourceParityDefects(input.sourceIdentity, manifest, approval, migration0019))
  defects.push(...firewallAuthorizationDefects(approval, input.firewallRequest))
  defects.push(...stagingRlsDefects(input, manifest, migration0019))
  if (input.phase === 'authority') defects.push(...servingImageDefects(manifest, serving))

  if (input.djangoPlan && (/showmigrations/i.test(String(input.djangoPlan.command ?? '')) || input.djangoPlan.inspectionOnly === true)) {
    if (input.djangoPlan.treatedAsApplyProof === true) defects.push('SHOWMIGRATIONS_PLAN_IS_NOT_APPLY_PROOF')
  }

  const mutationPhases = new Set(['icra', 'scoped-0019', 'migrate', 'candidate', 'label', 'label-confirm', 'probe', 'deactivate'])
  if (mutationPhases.has(input.phase)) {
    const freshIngress = input.freshIngress ? normalizeIngress(input.freshIngress) : { error: 'STALE_INVENTORY' }
    const freshRevisions = input.freshRevisions ? normalizeRevisionList(input.freshRevisions) : { error: 'STALE_INVENTORY' }
    if (freshIngress.error || freshRevisions.error || ingress.error || revisions.error) defects.push('STALE_INVENTORY')
    else if (freshIngress.readId === ingress.readId || freshRevisions.readId === revisions.readId) defects.push('STALE_INVENTORY')
    else if (fingerprint(ingress, revisions) !== fingerprint(freshIngress, freshRevisions)) defects.push('STALE_INVENTORY')
  }

  if (input.weightBaseline) {
    const baseline = normalizeIngress(input.weightBaseline)
    if (baseline.error || ingress.error || !weightsPreserved(baseline, ingress)) defects.push('INGRESS_WEIGHT_REWRITE_FORBIDDEN')
  }
  if (input.phase === 'label-confirm' && !input.proposedIngress) defects.push('INGRESS_WEIGHT_REWRITE_FORBIDDEN')
  if (input.proposedIngress) {
    const proposed = normalizeIngress(input.proposedIngress)
    if (proposed.error || ingress.error || !weightsPreserved(ingress, proposed)) defects.push('INGRESS_WEIGHT_REWRITE_FORBIDDEN')
  }
  if (input.migrationCommitted === true && input.requestedRecovery === 'traffic-rollback') {
    defects.push('MIGRATION_RECOVERY_IS_NOT_TRAFFIC_ROLLBACK')
  }

  const candidate = joined.find((revision) => revision.name === candidateName) ?? null
  if (input.phase === 'probe' || input.probe) {
    defects.push(...probeDefects(input.probe, manifest ?? {}, serving.map((revision) => revision.name), candidate))
  }

  const uniqueDefects = [...new Set(defects)]
  const blocking = (ignored) => uniqueDefects.filter((defect) => !ignored.has(defect))
  const premigrateClear = blocking(new Set([
    'CANDIDATE_PROBE_MISSING',
    'CANDIDATE_PROBE_HIT_SERVING_REVISION',
    'CANDIDATE_REVISION_FQDN_REQUIRED',
    'CANDIDATE_REVISION_UNIDENTIFIED',
    'CANDIDATE_IMAGE_DIGEST_MISMATCH',
    'CANDIDATE_RELEASE_SHA_MISMATCH',
    'CANDIDATE_TRAFFIC_NOT_ZERO',
    'AUTHENTICATED_ACCEPTANCE_FAILED',
    'MIGRATION_RECOVERY_IS_NOT_TRAFFIC_ROLLBACK',
  ])).length === 0
  const mutationClear = premigrateClear && !uniqueDefects.includes('STALE_INVENTORY') && !uniqueDefects.includes('INGRESS_WEIGHT_REWRITE_FORBIDDEN')
  const authorized = (mutation) => Array.isArray(approval?.authorizedMutations) && approval.authorizedMutations.includes(mutation)
  const accountingOk = unaccounted.every((revision) => {
    const account = input.consumerAccounting?.[revision.name]
    return account?.workersStopped === true && Array.isArray(account.consumers) && account.consumers.length > 0
  })
  const deactivateTargetsAreUnlabeled = unaccounted.length > 0 && labelReachable.length === 0

  const authorizations = {
    premigrate: premigrateClear,
    icra: mutationClear && authorized('scoped-0005'),
    'scoped-0019': mutationClear && authorized('scoped-0019') && migration0019.present && (migration0019.recorded || migration0019.scheduled),
    migrate: mutationClear && authorized('django-migrate'),
    candidate: mutationClear && authorized('candidate-revision'),
    label: mutationClear && authorized('candidate-label') && !uniqueDefects.includes('INGRESS_WEIGHT_REWRITE_FORBIDDEN'),
    'label-confirm': mutationClear && authorized('candidate-label') && !uniqueDefects.includes('INGRESS_WEIGHT_REWRITE_FORBIDDEN'),
    probe: mutationClear && !uniqueDefects.some((defect) => defect.startsWith('CANDIDATE_') || defect === 'AUTHENTICATED_ACCEPTANCE_FAILED' || defect === 'LABEL_REACHABLE_REVISION'),
    approval: !uniqueDefects.some((defect) => /^(APPROVAL_|RESTORED_CLONE_|FIREWALL_|TWO_SHA_|SOURCE_)/.test(defect)),
    authority: blocking(new Set([
      'RELEASE_MANIFEST_INVALID',
      'IMAGE_ATTESTATION_MISSING_FRONTEND',
      'IMAGE_ATTESTATION_MISSING_BACKEND',
      'WRONG_IMAGE_FRONTEND_DIGEST',
      'WRONG_IMAGE_BACKEND_DIGEST',
      'WRONG_IMAGE_FRONTEND_LABEL',
      'WRONG_IMAGE_BACKEND_LABEL',
      'WRONG_IMAGE_FRONTEND_TAG',
      'WRONG_IMAGE_BACKEND_TAG',
      'CANDIDATE_PROBE_MISSING',
      'CANDIDATE_PROBE_HIT_SERVING_REVISION',
      'CANDIDATE_REVISION_FQDN_REQUIRED',
      'CANDIDATE_REVISION_UNIDENTIFIED',
      'CANDIDATE_IMAGE_DIGEST_MISMATCH',
      'CANDIDATE_RELEASE_SHA_MISMATCH',
      'CANDIDATE_TRAFFIC_NOT_ZERO',
      'AUTHENTICATED_ACCEPTANCE_FAILED',
      'MIGRATION_RECOVERY_IS_NOT_TRAFFIC_ROLLBACK',
    ])).length === 0,
    'rls-preflight': !uniqueDefects.some((defect) => /^(MIGRATION_0019_|RLS_PREFLIGHT_|APPROVAL_|RESTORED_CLONE_|STAGING_RLS_|TWO_SHA_|SOURCE_|FIREWALL_)/.test(defect)),
    deactivate: mutationClear && authorized('revision-deactivate') && deactivateTargetsAreUnlabeled && accountingOk && !uniqueDefects.includes('LABEL_REACHABLE_REVISION'),
    promote: false,
    'traffic-rollback': false,
  }

  return {
    defects: uniqueDefects,
    servingRevision: serving.length === 1 ? serving[0].name : null,
    servingRevisions: serving.map((revision) => revision.name),
    labelReachableRevisions: labelReachable.map((revision) => revision.name),
    unaccountedRevisions: unaccounted.map((revision) => revision.name),
    unspecifiedWeightRevisions: unspecified.map((revision) => revision.name),
    allowTrafficPromotion: false,
    allowIngressWeightRewrite: false,
    allowRevisionDeactivate: authorizations.deactivate,
    promotionRefusal: 'AUTOMATIC_TRAFFIC_PROMOTION_FORBIDDEN',
    migration0019,
    authorizations,
  }
}

export function phaseAllowed(decision, phase) {
  return decision.authorizations?.[phase] === true
}

export function parseWorkflowJobs(workflowText) {
  const jobsAt = workflowText.indexOf('\njobs:\n')
  const jobsText = jobsAt >= 0 ? workflowText.slice(jobsAt) : workflowText
  const headers = [...jobsText.matchAll(/^  ([a-z0-9-]+):\s*$/gm)]
  return headers.map((header, index) => {
    const start = header.index
    const end = index + 1 < headers.length ? headers[index + 1].index : jobsText.length
    const body = jobsText.slice(start, end)
    const inline = body.match(/\n    needs:\s*(\[[^\]]+\]|[a-z0-9-]+)\s*(?:\n|$)/)
    const folded = body.match(/\n    needs:\s*\n\s+(\[[^\]]+\])/)
    const listed = body.match(/\n    needs:\s*\n((?:\s+-\s+[a-z0-9-]+\s*\n)+)/)
    let needs = []
    if (inline) needs = inline[1].replace(/[\[\]]/g, '').split(',').map((item) => item.trim()).filter(Boolean)
    else if (folded) needs = folded[1].replace(/[\[\]]/g, '').split(',').map((item) => item.trim()).filter(Boolean)
    else if (listed) needs = [...listed[1].matchAll(/-\s+([a-z0-9-]+)/g)].map((match) => match[1])
    return { name: header[1], needs, body }
  })
}

function jobIsDisabled(job) {
  return /if:\s*\$\{\{\s*false\s*\}\}/.test(job?.body ?? '')
}

export function assertWorkflowMutationOrder(workflowText) {
  const jobs = parseWorkflowJobs(workflowText)
  const byName = new Map(jobs.map((job) => [job.name, job]))
  const defects = []
  const gate = byName.get(PREMUTATION_GATE_JOB)
  const authorityGate = byName.get(DATABASE_PREMUTATION_GATE_JOB)
  if (!gate) defects.push('PREMUTATION_GATE_MISSING')
  else {
    const gateNeeds = new Set(gate.needs)
    if (![...gateNeeds].every((need) => need === 'plan' || need === 'build-push') || !gateNeeds.has('plan') || !gateNeeds.has('build-push')) {
      defects.push('PREMUTATION_GATE_DEPENDENCY_INVALID')
    }
    for (const forbidden of ['icra:capability-rollout:apply', 'manage.py migrate', 'containerapp revision deactivate', 'ingress traffic set']) {
      if (gate.body.includes(forbidden)) defects.push('PREMUTATION_GATE_MUTATES')
    }
  }
  if (!authorityGate) defects.push('DATABASE_PREMUTATION_GATE_MISSING')
  else if (authorityGate.needs.length !== 1 || authorityGate.needs[0] !== 'plan' || authorityGate.needs.includes('build-push') || authorityGate.needs.includes(PREMUTATION_GATE_JOB)) {
    defects.push('AUTHORITY_GATE_DEPENDS_ON_IMAGE_BUILD')
  } else {
    for (const forbidden of ['icra:capability-rollout:apply', 'manage.py migrate', 'containerapp revision deactivate', 'ingress traffic set', 'build-push']) {
      if (authorityGate.body.includes(forbidden)) defects.push('AUTHORITY_GATE_DEPENDS_ON_IMAGE_BUILD')
    }
  }
  for (const name of AUTHORITY_MUTATION_JOBS) {
    const job = byName.get(name)
    if (!job) defects.push(`MUTATION_JOB_MISSING:${name}`)
    else {
      if (!job.needs.includes(DATABASE_PREMUTATION_GATE_JOB)) defects.push(`MUTATION_BEFORE_PREMUTATION_GATE:${name}`)
      if (job.needs.includes(PREMUTATION_GATE_JOB) || job.needs.includes('build-push') || job.needs.includes('deploy') || job.needs.includes('apply-django-migrations')) {
        defects.push(`AUTHORITY_JOB_DEPENDS_ON_IMAGE_BUILD:${name}`)
      }
      if (!jobIsDisabled(job) && !job.body.includes('database-premutation-gate.outputs.application_source_sha')) {
        defects.push(`AUTHORITY_JOB_SOURCE_UNPINNED:${name}`)
      }
    }
  }
  for (const name of RELEASE_MUTATION_JOBS) {
    const job = byName.get(name)
    if (!job) defects.push(`MUTATION_JOB_MISSING:${name}`)
    else if (!job.needs.includes(PREMUTATION_GATE_JOB)) defects.push(`MUTATION_BEFORE_PREMUTATION_GATE:${name}`)
  }
  const icra = byName.get('apply-icra-capability-migration')
  if (icra && icra.needs.length === 1 && icra.needs[0] === 'plan') defects.push('ICRA_BEFORE_PREMUTATION_GATE')
  if (icra && !icra.needs.includes(PREMUTATION_GATE_JOB)) defects.push('ICRA_BEFORE_PREMUTATION_GATE')
  const scoped = byName.get('apply-scoped-0019')
  if (scoped && !scoped.needs.includes('apply-icra-capability-migration')) defects.push('SCOPED_0019_BEFORE_ICRA')
  const django = byName.get('apply-django-migrations')
  if (django && (!django.needs.includes('apply-icra-capability-migration') || !django.needs.includes('apply-scoped-0019'))) {
    defects.push('DJANGO_MIGRATION_OUT_OF_ORDER')
  }
  const deploy = byName.get('deploy')
  if (deploy && !['release-premutation-gate', 'apply-icra-capability-migration', 'apply-scoped-0019', 'apply-django-migrations'].every((need) => deploy.needs.includes(need))) {
    defects.push('DEPLOY_BEFORE_MIGRATIONS')
  }
  for (const job of jobs) {
    const createCandidates = [job.body.indexOf('firewall-rule create'), job.body.indexOf('union-eyes-postgres-firewall.sh open')].filter((index) => index >= 0)
    if (createCandidates.length === 0) continue
    const createAt = Math.min(...createCandidates)
    const approvalAt = job.body.indexOf('--phase approval')
    if (approvalAt < 0 || approvalAt > createAt) defects.push(`FIREWALL_BEFORE_APPROVAL:${job.name}`)
    if (/firewall-rule delete[\s\S]{0,400}\|\| true/.test(job.body)) defects.push(`FIREWALL_CLEANUP_SWALLOWED:${job.name}`)
  }
  if (!workflowText.includes("needs.plan.outputs.environment == 'staging' || needs.plan.outputs.rls_foundation_enforced == 'true'")) {
    defects.push('STAGING_RLS_SKIPPABLE')
  }
  if (!workflowText.includes('UE_APPLICATION_SOURCE_SHA')) defects.push('TWO_SHA_ARGUMENTS_MISSING')
  if (!workflowText.includes('--require-0019-recorded')) defects.push('REQUIRE_0019_RECORDED_MISSING')
  if (/az containerapp ingress traffic set/.test(workflowText) || /--revision-weight[^\n]*=100/.test(workflowText)) {
    defects.push('INGRESS_WEIGHT_REWRITE')
  }
  if (workflowText.includes('x-ms-container-app-revision')) defects.push('CANDIDATE_HEADER_PROBE')
  if (workflowText.includes('--frontend-label') || workflowText.includes('--schema-preflight') || workflowText.includes('--bypassrls')) {
    defects.push('ASSERTED_GATE')
  }
  if (workflowText.includes('containerapp revision deactivate')) defects.push('UNACCOUNTED_DEACTIVATE')
  return { ok: defects.length === 0, defects, jobs: jobs.map((job) => ({ name: job.name, needs: job.needs })) }
}
