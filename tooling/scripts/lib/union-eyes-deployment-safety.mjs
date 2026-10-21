/**
 * Fail-closed Union Eyes release decisions.
 *
 * This module does not call Azure and does not change traffic. A caller may
 * deactivate only the revisions named in quiesceRevisions. Traffic promotion
 * is never allowed here; a human approval outside this module is required,
 * and a traffic change is not a recovery for a committed migration.
 */

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

function normalizeRevision(revision) {
  const props = revision.properties ?? {}
  const containers = props.template?.containers ?? []
  const imageFromTemplate = containers.map((container) => container.image).filter(Boolean).join(',')
  return {
    name: revision.name,
    active: Boolean(revision.active ?? props.active),
    replicas: Number(revision.replicas ?? props.replicas ?? 0),
    trafficWeight: Number(revision.trafficWeight ?? props.trafficWeight ?? 0),
    image: revision.image ?? imageFromTemplate,
    releaseSha: revision.releaseSha ?? props.labels?.['ue.release-sha'] ?? '',
  }
}

export function normalizeRevisionInventory(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('revision inventory is missing')
  }
  if (Array.isArray(raw)) {
    return { revisionMode: 'multiple', revisions: raw.map(normalizeRevision) }
  }
  if (Array.isArray(raw.value)) {
    return { revisionMode: raw.revisionMode ?? 'multiple', revisions: raw.value.map(normalizeRevision) }
  }
  if (!Array.isArray(raw.revisions)) {
    throw new Error('revision inventory is missing')
  }
  return {
    revisionMode: raw.revisionMode ?? 'multiple',
    revisions: raw.revisions.map(normalizeRevision),
  }
}

function imageDefects(releaseSha, images) {
  const defects = []
  for (const side of ['frontend', 'backend']) {
    const image = images?.[side] ?? {}
    const name = side.toUpperCase()
    if (!DIGEST_RE.test(image.digest ?? '')) defects.push(`WRONG_IMAGE_${name}_DIGEST`)
    if (image.tag !== releaseSha) defects.push(`WRONG_IMAGE_${name}_TAG`)
    if (image.label !== releaseSha) defects.push(`WRONG_IMAGE_${name}_LABEL`)
  }
  return defects
}

export function evaluateDeploymentSafety(input) {
  const defects = []
  const releaseSha = input.releaseSha ?? ''
  if (!SHA_RE.test(releaseSha)) defects.push('RELEASE_SHA_INVALID')
  defects.push(...imageDefects(releaseSha, input.images))

  let inventory = null
  try {
    inventory = normalizeRevisionInventory(input.inventory)
  } catch {
    defects.push('REVISION_INVENTORY_MISSING')
  }

  const active = inventory?.revisions.filter((revision) => revision.active) ?? []
  const serving = active.filter((revision) => revision.trafficWeight > 0)
  const zeroTraffic = active.filter((revision) => revision.trafficWeight === 0)
  const candidateRevision = input.candidateRevision || input.probe?.revisionName || ''
  const staleZero = zeroTraffic.filter((revision) => revision.name !== candidateRevision)
  if (inventory && serving.length !== 1) defects.push('SERVING_REVISION_AMBIGUOUS')
  if (inventory && inventory.revisionMode !== 'multiple') defects.push('REVISION_MODE_NOT_MULTIPLE')
  if (staleZero.length > 0) defects.push('ZERO_TRAFFIC_REVISIONS_ACTIVE')
  if (candidateRevision) {
    const candidate = inventory?.revisions.find((revision) => revision.name === candidateRevision)
    const releaseDigests = [input.images?.frontend?.digest, input.images?.backend?.digest].filter(Boolean)
    if (!candidate || candidate.trafficWeight !== 0 || !releaseDigests.some((digest) => String(candidate.image).includes(digest))) {
      defects.push('CANDIDATE_REVISION_NOT_ISOLATED')
    }
  }

  const role = String(input.databaseAuthority?.role ?? '').trim().toLowerCase()
  if (!role || FORBIDDEN_MIGRATION_ROLES.has(role) || input.databaseAuthority?.bypassrls === true || input.databaseAuthority?.superuser === true) {
    defects.push('INCORRECT_DATABASE_AUTHORITY')
  }
  if (input.schemaPreflight?.ok !== true) defects.push('SCHEMA_MIGRATION_PREFLIGHT_FAILED')
  if (input.djangoPreflight?.ok !== true) defects.push('DJANGO_MIGRATION_PREFLIGHT_FAILED')

  const rehearsal = input.rehearsal ?? {}
  if (rehearsal.restoredClone !== true) defects.push('RESTORED_CLONE_REHEARSAL_REQUIRED')
  if (!rehearsal.changeRecord) defects.push('CHANGE_RECORD_REQUIRED')
  if (!rehearsal.approver || /^(github-actions|dependabot\[bot\])$/i.test(rehearsal.approver)) {
    defects.push('HUMAN_APPROVAL_REQUIRED')
  }
  if (rehearsal.recoveryRecorded !== true) defects.push('RECOVERY_EVIDENCE_REQUIRED')
  if (rehearsal.recoveryMethod !== 'point-in-time-restore') defects.push('RECOVERY_METHOD_INVALID')
  if (rehearsal.releaseSha !== releaseSha) defects.push('REHEARSAL_SHA_MISMATCH')

  if (input.migrationCommitted === true && input.requestedRecovery === 'traffic-rollback') {
    defects.push('MIGRATION_RECOVERY_IS_NOT_TRAFFIC_ROLLBACK')
  }

  if (input.tenantIsolation && (input.tenantIsolation.ok !== true || input.tenantIsolation.principal !== 'union_eyes_runtime' || input.tenantIsolation.bypassrls === true)) {
    defects.push('TENANT_ISOLATION_CHECK_FAILED')
  }
  if (input.healthProbe && input.healthProbe.ok !== true) defects.push('HEALTH_PROBE_FAILED')

  if (input.phase === 'probe' || input.probe) {
    const probe = input.probe ?? {}
    if (probe.target !== 'candidate-revision' || !probe.revisionName || probe.revisionName === serving[0]?.name) {
      defects.push('CANDIDATE_PROBE_HIT_SERVING_REVISION')
    }
    if (probe.header !== 'x-ms-container-app-revision') defects.push('CANDIDATE_PROBE_HEADER_MISSING')
  }

  const uniqueDefects = [...new Set(defects)]
  const servingRevision = serving.length === 1 ? serving[0].name : null
  const quiesceRevisions = servingRevision ? staleZero.map((revision) => revision.name) : []
  const migrationBlockers = uniqueDefects.filter((defect) => defect !== 'TENANT_ISOLATION_CHECK_FAILED' && defect !== 'HEALTH_PROBE_FAILED' && defect !== 'CANDIDATE_PROBE_HIT_SERVING_REVISION' && defect !== 'CANDIDATE_PROBE_HEADER_MISSING' && defect !== 'MIGRATION_RECOVERY_IS_NOT_TRAFFIC_ROLLBACK')
  const allowMigration = migrationBlockers.length === 0
  const releaseStopped = uniqueDefects.some((defect) => [
    'TENANT_ISOLATION_CHECK_FAILED',
    'HEALTH_PROBE_FAILED',
    'CANDIDATE_PROBE_HIT_SERVING_REVISION',
    'CANDIDATE_PROBE_HEADER_MISSING',
    'MIGRATION_RECOVERY_IS_NOT_TRAFFIC_ROLLBACK',
    'SCHEMA_MIGRATION_PREFLIGHT_FAILED',
    'DJANGO_MIGRATION_PREFLIGHT_FAILED',
    'WRONG_IMAGE_FRONTEND_DIGEST',
    'WRONG_IMAGE_BACKEND_DIGEST',
    'WRONG_IMAGE_FRONTEND_TAG',
    'WRONG_IMAGE_BACKEND_TAG',
    'WRONG_IMAGE_FRONTEND_LABEL',
    'WRONG_IMAGE_BACKEND_LABEL',
    'INCORRECT_DATABASE_AUTHORITY',
    'ZERO_TRAFFIC_REVISIONS_ACTIVE',
  ].includes(defect))

  return {
    defects: uniqueDefects,
    servingRevision,
    quiesceRevisions,
    allowQuiesce: Boolean(servingRevision) && quiesceRevisions.length > 0,
    allowMigration,
    allowCandidateDeploy: allowMigration,
    allowTrafficPromotion: false,
    promotionRefusal: 'AUTOMATIC_TRAFFIC_PROMOTION_FORBIDDEN',
    releaseStopped,
    probeHeader: 'x-ms-container-app-revision',
  }
}

const QUIESCE_BLOCKERS = [
  'HUMAN_APPROVAL_REQUIRED',
  'CHANGE_RECORD_REQUIRED',
  'RESTORED_CLONE_REHEARSAL_REQUIRED',
  'RECOVERY_EVIDENCE_REQUIRED',
  'RECOVERY_METHOD_INVALID',
  'REHEARSAL_SHA_MISMATCH',
  'REVISION_INVENTORY_MISSING',
  'SERVING_REVISION_AMBIGUOUS',
  'REVISION_MODE_NOT_MULTIPLE',
  'RELEASE_SHA_INVALID',
  'WRONG_IMAGE_FRONTEND_DIGEST',
  'WRONG_IMAGE_BACKEND_DIGEST',
  'WRONG_IMAGE_FRONTEND_TAG',
  'WRONG_IMAGE_BACKEND_TAG',
  'WRONG_IMAGE_FRONTEND_LABEL',
  'WRONG_IMAGE_BACKEND_LABEL',
]

export function phaseAllowed(decision, phase) {
  if (phase === 'promote' || phase === 'traffic-rollback') return false
  if (phase === 'quiesce') {
    return !decision.defects.some((defect) => QUIESCE_BLOCKERS.includes(defect)) && (decision.allowQuiesce || decision.quiesceRevisions.length === 0)
  }
  if (phase === 'migrate' || phase === 'deploy') return decision.allowMigration
  if (phase === 'probe') {
    const probeDefects = ['CANDIDATE_PROBE_HIT_SERVING_REVISION', 'CANDIDATE_PROBE_HEADER_MISSING', 'CANDIDATE_REVISION_NOT_ISOLATED', 'HEALTH_PROBE_FAILED', 'TENANT_ISOLATION_CHECK_FAILED']
    return decision.allowMigration && !decision.defects.some((defect) => probeDefects.includes(defect))
  }
  return false
}
