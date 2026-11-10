/**
 * Fail-closed release gates for the Union Eyes V2 staging stack in the new
 * Azure subscription (infrastructure/bicep/ue-v2, env=staging).
 *
 * Pure functions only: nothing here calls Azure, reads secrets or mutates a
 * resource. The workflow .github/workflows/ue-v2-staging-deploy.yml feeds it
 * evidence files and may apply only when the matching gate returns no defects.
 *
 * It reuses the primitives of the legacy release gate
 * (./union-eyes-deployment-safety.mjs): the ACR attestation shape and
 * canonical JSON. The legacy approval/restored-clone gate does not apply to a
 * fresh synthetic-data staging database and is not invoked here.
 */
import crypto from 'node:crypto'
import { assembleAcrAttestation, canonicalJson } from './union-eyes-deployment-safety.mjs'

export { assembleAcrAttestation }

export const NEW_SUBSCRIPTION_ID = 'd562ba7f-d891-4504-a489-10917c0ebaaf'
export const NEW_TENANT_ID = 'cc15259a-d2bf-421f-8e44-dccf8dc6232a'
export const LEGACY_SUBSCRIPTION_ID = '5d819f33-d16f-429c-a3c0-5b0e94740ba3'
export const STAGING_RESOURCE_GROUP = 'nzila-canada-staging-rg'
export const REGISTRY_NAME = 'nzilaventuresacr'
export const MANIFEST_SCHEMA = 'ue-v2-staging-release-manifest/v1'

const STAGING_APP_IDENTITY_NAME = 'nzila-ue-v2-staging-id'
const ACR_PULL_ROLE_ID = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

/** Images the V2 template consumes; `revisionLabel` marks images built from this repository. */
export const V2_IMAGES = Object.freeze([
  { key: 'app', parameter: 'appImageDigest', repositoryParameter: 'appImageRepository', defaultRepository: 'nzila-os-union-eyes-v2', revisionLabel: true },
  { key: 'clamav', parameter: 'clamavImageDigest', repositoryParameter: 'clamavImageRepository', defaultRepository: 'ue-clamav-http-adapter', revisionLabel: false },
  { key: 'cron', parameter: 'cronImageDigest', repositoryParameter: 'cronImageRepository', defaultRepository: 'ue-cron-curl', revisionLabel: false },
])

/** Test-only bypasses that must never reach a deployed environment. */
export const FORBIDDEN_RUNTIME_FLAGS = Object.freeze([
  'PLAYWRIGHT_TEST_AUTH',
  'UE_E2E_RISK_BYPASS',
  'UNION_EYES_ACCEPTANCE_AUTH_ENABLED',
])

/** what-if change types an apply may carry. Deletes are never applied by this pipeline. */
const ALLOWED_CHANGE_TYPES = new Set(['Create', 'Modify', 'NoChange', 'Ignore', 'Deploy', 'Unsupported'])

const SHA_RE = /^[0-9a-f]{40}$/
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/
const CHANGE_ID_RE = /^CHG-\d{4}-\d{4}$/

function isExactSymbolicRegistryPull(change, registryResourceGroup) {
  if (!registryResourceGroup || change?.changeType !== 'Unsupported') return false
  const registryId = `/subscriptions/${NEW_SUBSCRIPTION_ID}/resourceGroups/${registryResourceGroup}/providers/Microsoft.ContainerRegistry/registries/${REGISTRY_NAME}`
  const identityId = `/subscriptions/${NEW_SUBSCRIPTION_ID}/resourceGroups/${STAGING_RESOURCE_GROUP}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/${STAGING_APP_IDENTITY_NAME}`
  const principalReference = `reference('${identityId}', '2023-01-31').principalId`
  const expectedResourceId = `[extensionResourceId('${registryId}', 'Microsoft.Authorization/roleAssignments', guid('${registryId}', ${principalReference}, '${ACR_PULL_ROLE_ID}'))]`
  const after = change?.after
  const properties = after?.properties
  return (
    String(change?.resourceId ?? '').toLowerCase() === expectedResourceId.toLowerCase()
    && String(after?.id ?? '').toLowerCase() === expectedResourceId.toLowerCase()
    && String(after?.apiVersion ?? '').toLowerCase() === '2022-04-01'
    && String(after?.resourceGroup ?? '').toLowerCase() === registryResourceGroup.toLowerCase()
    && String(after?.type ?? '').toLowerCase() === 'microsoft.authorization/roleassignments'
    && String(properties?.principalId ?? '').toLowerCase() === `[${principalReference}]`.toLowerCase()
    && properties?.principalType === 'ServicePrincipal'
    && String(properties?.roleDefinitionId ?? '').toLowerCase() === `/subscriptions/${NEW_SUBSCRIPTION_ID}/providers/Microsoft.Authorization/roleDefinitions/${ACR_PULL_ROLE_ID}`.toLowerCase()
  )
}

export function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

/**
 * Accepts only a bare `sha256:<64 hex>` digest. Anything that looks like a tag
 * (`:latest`, `repo:tag`, `repo@sha256:...:tag`) is rejected by name so the
 * workflow log says why.
 */
export function digestDefects(name, value) {
  const raw = String(value ?? '').trim()
  if (!raw) return [`DIGEST_MISSING:${name}`]
  if (DIGEST_RE.test(raw)) return []
  if (/^[0-9a-f]{64}$/.test(raw)) return [`DIGEST_PREFIX_MISSING:${name}`]
  if (raw.includes(':') && !raw.startsWith('sha256:')) return [`TAG_REFERENCE_REJECTED:${name}`]
  if (raw.includes('@') || raw.includes('/')) return [`IMAGE_REFERENCE_NOT_DIGEST:${name}`]
  return [`DIGEST_INVALID:${name}`]
}

export function buildReleaseManifest({ sourceSha, registry = REGISTRY_NAME, images, workflowRunId, workflowSha, createdAt }) {
  const manifest = {
    schema: MANIFEST_SCHEMA,
    environment: 'staging',
    subscriptionId: NEW_SUBSCRIPTION_ID,
    resourceGroup: STAGING_RESOURCE_GROUP,
    registry,
    sourceSha,
    workflowSha: workflowSha ?? null,
    workflowRunId: workflowRunId ?? null,
    createdAt: createdAt ?? null,
    images: {},
  }
  for (const image of V2_IMAGES) {
    const entry = images?.[image.key] ?? {}
    manifest.images[image.key] = {
      repository: entry.repository ?? image.defaultRepository,
      digest: entry.digest ?? null,
      reference: `${registry}.azurecr.io/${entry.repository ?? image.defaultRepository}@${entry.digest ?? ''}`,
    }
  }
  return manifest
}

export function manifestFingerprint(manifest) {
  return sha256Hex(canonicalJson(manifest))
}

export function releaseManifestDefects(manifest) {
  if (!manifest || typeof manifest !== 'object') return ['RELEASE_MANIFEST_MISSING']
  const defects = []
  if (manifest.schema !== MANIFEST_SCHEMA) defects.push('RELEASE_MANIFEST_SCHEMA')
  if (manifest.environment !== 'staging') defects.push('RELEASE_MANIFEST_NOT_STAGING')
  if (manifest.subscriptionId !== NEW_SUBSCRIPTION_ID) defects.push('RELEASE_MANIFEST_WRONG_SUBSCRIPTION')
  if (manifest.resourceGroup !== STAGING_RESOURCE_GROUP) defects.push('RELEASE_MANIFEST_WRONG_RESOURCE_GROUP')
  if (manifest.registry !== REGISTRY_NAME) defects.push('RELEASE_MANIFEST_WRONG_REGISTRY')
  if (!SHA_RE.test(manifest.sourceSha ?? '')) defects.push('RELEASE_MANIFEST_SOURCE_SHA_INVALID')
  for (const image of V2_IMAGES) {
    const entry = manifest.images?.[image.key]
    if (!entry) {
      defects.push(`RELEASE_MANIFEST_IMAGE_MISSING:${image.key}`)
      continue
    }
    defects.push(...digestDefects(image.key, entry.digest))
    if (!/^[a-z0-9]+(?:[._/-][a-z0-9]+)*$/.test(entry.repository ?? '')) defects.push(`RELEASE_MANIFEST_REPOSITORY_INVALID:${image.key}`)
    if (entry.reference !== `${manifest.registry}.azurecr.io/${entry.repository}@${entry.digest}`) {
      defects.push(`RELEASE_MANIFEST_REFERENCE_NOT_DIGEST_PINNED:${image.key}`)
    }
  }
  return defects
}

/**
 * Each image must exist in the registry under exactly the manifest digest.
 * Images built from this repository must also carry the source SHA as their
 * OCI revision label (the same rule the legacy gate applies).
 */
export function registryAttestationDefects(manifest, attestations) {
  const defects = []
  for (const image of V2_IMAGES) {
    const observed = attestations?.[image.key]
    const name = image.key.toUpperCase()
    if (!observed || observed.source !== 'acr') {
      defects.push(`IMAGE_ATTESTATION_MISSING_${name}`)
      continue
    }
    if (observed.digest !== manifest?.images?.[image.key]?.digest) defects.push(`WRONG_IMAGE_${name}_DIGEST`)
    if (image.revisionLabel) {
      const label = observed.labels?.['org.opencontainers.image.revision']
      if (label !== manifest?.sourceSha) defects.push(`WRONG_IMAGE_${name}_LABEL`)
    }
  }
  return defects
}

/** The deployment parameters handed to `az deployment group what-if|create`. */
export function deploymentParameterDefects(parameters, manifest) {
  const values = parameters?.parameters ?? parameters ?? {}
  const value = (name) => values?.[name]?.value
  const defects = []
  if (value('env') !== 'staging') defects.push('PARAMETERS_ENV_NOT_STAGING')
  if (value('acrName') !== REGISTRY_NAME) defects.push('PARAMETERS_WRONG_REGISTRY')
  if (Object.prototype.hasOwnProperty.call(values, 'dbAdminPassword')) defects.push('PARAMETERS_FILE_CARRIES_SECRET')
  for (const image of V2_IMAGES) {
    const expected = manifest?.images?.[image.key]
    if (value(image.parameter) !== expected?.digest) defects.push(`PARAMETERS_DIGEST_MISMATCH:${image.key}`)
    const repository = value(image.repositoryParameter) ?? image.defaultRepository
    if (repository !== expected?.repository) defects.push(`PARAMETERS_REPOSITORY_MISMATCH:${image.key}`)
  }
  const text = JSON.stringify(values)
  for (const flag of FORBIDDEN_RUNTIME_FLAGS) {
    if (text.includes(flag)) defects.push(`FORBIDDEN_RUNTIME_FLAG:${flag}`)
  }
  for (const [name, entry] of Object.entries(values)) {
    if (typeof entry?.value === 'string' && /prod/i.test(entry.value) && /(publicHostName|siteUrl|appDatabaseName|prefix)/.test(name)) {
      defects.push(`PARAMETERS_PRODUCTION_VALUE:${name}`)
    }
  }
  return defects
}

/**
 * Change record gate for an apply. Stricter than validate-change-window.ts:
 * the record is named by the operator, must be a Union Eyes STAGING record,
 * approved, inside its window, and must link the exact source SHA.
 */
export function changeRecordDefects(record, { changeId, sourceSha, nowMs }) {
  if (!CHANGE_ID_RE.test(String(changeId ?? ''))) return ['CHANGE_RECORD_ID_INVALID']
  if (!record || typeof record !== 'object') return ['CHANGE_RECORD_MISSING']
  const defects = []
  if (record.change_id !== changeId) defects.push('CHANGE_RECORD_ID_MISMATCH')
  if (record.service !== 'union-eyes') defects.push('CHANGE_RECORD_WRONG_SERVICE')
  if (record.environment !== 'STAGING') defects.push('CHANGE_RECORD_WRONG_ENVIRONMENT')
  if (record.approval_status !== 'APPROVED' || record.status !== 'APPROVED') defects.push('CHANGE_RECORD_NOT_APPROVED')
  const required = Array.isArray(record.approvers_required) ? record.approvers_required : []
  const approved = Array.isArray(record.approved_by) ? record.approved_by : []
  if (required.length === 0 || required.some((role) => !approved.includes(role))) defects.push('CHANGE_RECORD_APPROVALS_MISSING')
  const start = Date.parse(record.implementation_window_start ?? '')
  const end = Date.parse(record.implementation_window_end ?? '')
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(nowMs) || nowMs < start || nowMs > end) {
    defects.push('CHANGE_RECORD_OUTSIDE_WINDOW')
  }
  // Founder authorization is operationally sufficient for this narrowly scoped
  // staging change, not independent human review or technical release proof.
  const founder = record.founder_staging_authorization
  if (founder) {
    const valid =
      record.change_id === 'CHG-2026-0114' &&
      record.service === 'union-eyes' &&
      record.environment === 'STAGING' &&
      record.change_type === 'NORMAL' &&
      record.risk_level === 'HIGH' &&
      record.requested_by === 'anungis437' &&
      founder.mission === 'UE_V2_ISOLATED_STAGING_QUALIFICATION' &&
      founder.operating_mode === 'SOLO_FOUNDER' &&
      founder.owner_github_login === 'anungis437' &&
      founder.alternate_github_login === 'anungis' &&
      founder.owner_authorization_ref === 'ops/change-records/CHG-2026-0114.founder-authorization.md' &&
      founder.authority_origin === 'OWNER_DIRECTIVE_IN_CONVERSATION' &&
      founder.subscription_id === NEW_SUBSCRIPTION_ID &&
      founder.candidate_sha === '2eb48a0e8bb41be5dca3cb08c57c294f0327d8f9' &&
      founder.staging_only === true &&
      founder.production_authorized === false &&
      founder.technical_gates_required === true &&
      required.length === 1 && required[0] === 'anungis437' &&
      approved.length === 1 && approved[0] === 'anungis437' &&
      Array.isArray(record.test_evidence_refs) &&
      record.test_evidence_refs.includes(founder.owner_authorization_ref) &&
      record.approval_status === 'APPROVED' &&
      record.status === 'APPROVED'
    if (!valid) defects.push('FOUNDER_STAGING_AUTHORIZATION_INVALID')
  }
  const commits = Array.isArray(record.linked_commits) ? record.linked_commits : []
  if (!SHA_RE.test(String(sourceSha ?? '')) || !commits.includes(sourceSha)) defects.push('CHANGE_RECORD_SOURCE_SHA_NOT_LINKED')
  if (founder && founder.candidate_sha !== sourceSha) defects.push('FOUNDER_STAGING_CANDIDATE_MISMATCH')
  return defects
}

function changeList(whatIf) {
  if (Array.isArray(whatIf?.changes)) return whatIf.changes
  if (Array.isArray(whatIf?.properties?.changes)) return whatIf.properties.changes
  return null
}

/**
 * Scope rules for the `az deployment group what-if --result-format FullResourcePayloads -o json`
 * output. Changes must stay in the staging resource group of the new
 * subscription; the only cross-group change allowed is the AcrPull role
 * assignment the template places on the shared registry. Deletes are refused.
 */
export function whatIfDefects(whatIf, { registryResourceGroup } = {}) {
  const changes = changeList(whatIf)
  if (!changes) return ['WHAT_IF_OUTPUT_INVALID']
  if (whatIf?.status && whatIf.status !== 'Succeeded') return ['WHAT_IF_NOT_SUCCEEDED']
  const defects = []
  const subPrefix = `/subscriptions/${NEW_SUBSCRIPTION_ID}/`.toLowerCase()
  const stagingPrefix = `${subPrefix}resourcegroups/${STAGING_RESOURCE_GROUP}/`.toLowerCase()
  const registryId = registryResourceGroup
    ? `${subPrefix}resourcegroups/${registryResourceGroup}/providers/microsoft.containerregistry/registries/${REGISTRY_NAME}/`.toLowerCase()
    : null
  for (const change of changes) {
    const id = String(change?.resourceId ?? '').toLowerCase()
    const type = change?.changeType
    if (!ALLOWED_CHANGE_TYPES.has(type)) defects.push(`WHAT_IF_CHANGE_TYPE_REFUSED:${type}:${change?.resourceId}`)
    if (isExactSymbolicRegistryPull(change, registryResourceGroup)) continue
    if (!id.startsWith(subPrefix)) {
      defects.push(`WHAT_IF_OUTSIDE_SUBSCRIPTION:${change?.resourceId}`)
      continue
    }
    if (id.startsWith(stagingPrefix)) continue
    if (type === 'NoChange' || type === 'Ignore') continue
    const isRegistryPull = registryId && id.startsWith(registryId) && id.includes('/providers/microsoft.authorization/roleassignments/')
    if (!isRegistryPull) defects.push(`WHAT_IF_OUTSIDE_STAGING_RESOURCE_GROUP:${change?.resourceId}`)
  }
  return defects
}

/**
 * The reviewed what-if and the fresh what-if taken by the apply job must
 * describe the same change set; otherwise the environment drifted after
 * review and the apply refuses.
 */
export function whatIfFingerprint(whatIf) {
  const changes = changeList(whatIf) ?? []
  const summary = changes
    .map((change) => `${String(change?.resourceId ?? '').toLowerCase()}|${change?.changeType}`)
    .sort()
  return sha256Hex(summary.join('\n'))
}

export function subscriptionDefects(account) {
  const defects = []
  if (account?.id !== NEW_SUBSCRIPTION_ID) defects.push('WRONG_SUBSCRIPTION')
  if (account?.tenantId !== NEW_TENANT_ID) defects.push('WRONG_TENANT')
  return defects
}
