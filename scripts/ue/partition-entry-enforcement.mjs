import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const directory = 'docs/union-eyes/reality-remediation/'
const censusFile = `${directory}PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS.json`
const primitiveFile = `${directory}PHASE_1B_2B1_ENFORCEMENT_PRIMITIVE_SEMANTICS.json`
const carryForwardFile = `${directory}PHASE_1B_1_R2C_TARGETLESS_EFFECT_CLOSEOUT.json`
const jsonFile = `${directory}PHASE_1B_2B2A_ENTRY_ENFORCEMENT_PARTITION.json`
const markdownFile = `${directory}PHASE_1B_2B2A_ENTRY_ENFORCEMENT_PARTITION.md`
const checkOnly = process.argv.includes('--check')
const source = (file) => path.resolve(root, ...file.split('/'))
const digest = (value) => createHash('sha256').update(value).digest('hex')
const readJson = (file) => {
  const bytes = readFileSync(source(file))
  return { value: JSON.parse(bytes.toString('utf8')), sha256: digest(bytes) }
}
const sortedUnique = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b))
const serialize = (value) => JSON.stringify(value)

const { value: census, sha256: censusSha256 } = readJson(censusFile)
const { value: previousRegistry, sha256: primitiveRegistrySha256 } = readJson(primitiveFile)
const { value: r2c } = readJson(carryForwardFile)
const primitiveArraySha256 = digest(serialize(previousRegistry.PRIMITIVES))
const expectedPrimitiveArraySha256 =
  'dd2a7b990956870b0ada147b75c1696207687229c748ac3276bb610a6555aace'
const entryIds = census.ENTRIES.map((entry) => entry.ENTRY_ID)
const entryIdSet = new Set(entryIds)

assert.equal(census.ENTRIES.length, 1910, 'Accepted census denominator drift')
assert.equal(entryIdSet.size, 1910, 'Accepted census entry IDs are not unique')
assert.equal(census.STATE.PHASE_1B_2A, 'CENSUS_COMPLETE')
assert.equal(previousRegistry.PRIMITIVES.length, 20)
assert.equal(previousRegistry.STATE.PHASE_1B_2B1, 'SOURCE_CEILING_ACCEPTED')
assert.equal(previousRegistry.STATE.PHASE_1B_2B1_GATE, 'SOURCE_CEILING')
assert.equal(previousRegistry.STATE.PHASE_1B_2B2_STARTED, 'NO')
assert.equal(primitiveArraySha256, expectedPrimitiveArraySha256)
assert.equal(new Set(previousRegistry.PRIMITIVES.map((item) => item.PRIMITIVE_ID)).size, 20)
assert.equal(census.HISTORICAL_PAGE_EXPECTATION_CARRY_FORWARD.RECORDS.length, 43)
assert.equal(census.HISTORICAL_PAGE_EXPECTATION_CARRY_FORWARD.INPUT_AUTH_EXPECTATIONS, 22)
assert.equal(census.HISTORICAL_PAGE_EXPECTATION_CARRY_FORWARD.INPUT_ORG_CONTEXT_EXPECTATIONS, 21)
assert.equal(r2c.records.length, 56)
assert.equal(r2c.EXCLUSIVE_ACCOUNTING.CHAINS_WITH_RESOLVED_TARGETS, 43)
assert.equal(r2c.STATIC_WORK_ACCOUNTING.TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD, 13)
assert.equal(r2c.STATIC_WORK_ACCOUNTING.TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD, 0)
assert.equal(r2c.STATIC_WORK_ACCOUNTING.TARGETLESS_EFFECT_STATIC_WORK_AFTER_R2C, 0)
assert.equal(r2c.STATIC_WORK_ACCOUNTING.AUTHORITY_SOURCE_CEILING_CARRY_FORWARD, 207)
assert.equal(r2c.STATIC_WORK_ACCOUNTING.AUTHORITY_KNOWN_DEFECT_CARRY_FORWARD, 3)
assert.equal(r2c.STATIC_WORK_ACCOUNTING.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD, 247)

const primitiveByEntry = new Map(entryIds.map((id) => [id, []]))
for (const primitive of previousRegistry.PRIMITIVES) {
  for (const id of primitive.ENTRY_IDS) {
    assert(entryIdSet.has(id), `Primitive ${primitive.PRIMITIVE_ID} references an unknown entry`)
    primitiveByEntry.get(id).push(primitive.PRIMITIVE_ID)
  }
}
for (const ids of primitiveByEntry.values()) ids.sort((a, b) => a.localeCompare(b))

const requirementFields = [
  'IDENTITY_AUTHENTICATION_REQUIRED',
  'ORGANIZATION_MEMBERSHIP_REQUIRED',
  'ORGANIZATION_SCOPE_REQUIRED',
  'ROLE_OR_PERMISSION_REQUIRED',
  'ADMIN_SCOPE_REQUIRED',
  'RESOURCE_SCOPE_REQUIRED',
  'SYSTEM_IDENTITY_REQUIRED',
  'PROVIDER_AUTH_REQUIRED',
  'ENTITLEMENT_REQUIRED',
  'RLS_CONTEXT_EXPECTED',
  'PRIVILEGED_DB_PRECONDITION_REQUIRED',
]
const categoricalValues = ['REQUIRED', 'NOT_REQUIRED', 'CONTEXTUAL', 'SOURCE_CEILING']
const adminValues = [
  'NOT_REQUIRED',
  'APPLICATION_ADMIN',
  'ORGANIZATION_ADMIN',
  'SYSTEM_ADMIN',
  'SUPER_ADMIN',
  'CONTEXTUAL',
  'SOURCE_CEILING',
]
const rlsValues = [
  'REQUIRED',
  'NOT_REQUIRED',
  'SYSTEM_BYPASS_EXPECTED',
  'CONTEXTUAL',
  'SOURCE_CEILING',
]
const privateAudiences = new Set([
  'ADMIN',
  'AUTHENTICATED_GENERAL',
  'EXECUTIVE',
  'GOVERNANCE',
  'MEMBER',
  'STAFF',
  'MIXED_OR_CONTEXTUAL',
])
const roleAudiences = new Set(['ADMIN', 'EXECUTIVE', 'GOVERNANCE', 'MEMBER', 'STAFF'])
const administrativeAudiences = new Set(['ADMIN', 'EXECUTIVE', 'GOVERNANCE', 'STAFF'])
const setOf = (...arrays) => new Set(arrays.flat().filter(Boolean))
const hasSignal = (entry, ...keys) =>
  keys.some((key) => Array.isArray(entry[key]) && entry[key].length > 0)
const hasTargetLink = (entry) =>
  Boolean(
    entry.PHASE_1A_BINDING_IDS?.length ||
    entry.PHASE_1A_EFFECT_CHAIN_IDS?.length ||
    entry.PHASE_1B_1_TARGET_OBJECT_IDS?.length,
  )
const isSystemAudience = (entry) =>
  entry.AUDIENCE === 'SYSTEM_INTERNAL' ||
  entry.ENTRY_CLASS === 'SCHEDULED_OR_CRON_HANDLER' ||
  entry.AUTH_BOUNDARY_CLASS === 'INTERNAL_TRUST_BOUNDARY'
const isProviderAudience = (entry) =>
  entry.AUDIENCE === 'PROVIDER_CALLBACK' ||
  entry.ENTRY_CLASS === 'WEBHOOK_HANDLER' ||
  entry.AUTH_BOUNDARY_CLASS === 'PROVIDER_SIGNATURE_OR_SECRET'
const hasOrgContext = (entry) =>
  entry.ORG_CONTEXT_CLASS === 'ORG_CONTEXT_DIRECT' ||
  entry.ORG_CONTEXT_CLASS === 'ORG_CONTEXT_VIA_WRAPPER' ||
  entry.DIRECT_SOURCE_SIGNALS.organizationContext
const hasOrgMembershipPrimitive = (primitiveIds) =>
  primitiveIds.includes('UE-B2B1-PRIMITIVE-009') || primitiveIds.includes('UE-B2B1-PRIMITIVE-016')
const hasOrgContextPrimitive = (primitiveIds) =>
  primitiveIds.includes('UE-B2B1-PRIMITIVE-004') || hasOrgMembershipPrimitive(primitiveIds)
const hasRoleSignal = (entry, primitiveIds) =>
  entry.ROLE_CHECK_CLASS === 'ROLE_CHECK_DIRECT' ||
  entry.DIRECT_SOURCE_SIGNALS.roleCheck ||
  entry.DIRECT_SOURCE_SIGNALS.permissionCheck ||
  [
    'UE-B2B1-PRIMITIVE-005',
    'UE-B2B1-PRIMITIVE-013',
    'UE-B2B1-PRIMITIVE-014',
    'UE-B2B1-PRIMITIVE-015',
  ].some((id) => primitiveIds.includes(id))
const hasAdminSignal = (entry, primitiveIds) =>
  entry.ADMIN_CHECK_CLASS === 'ADMIN_CHECK_DIRECT' ||
  entry.DIRECT_SOURCE_SIGNALS.adminCheck ||
  ['UE-B2B1-PRIMITIVE-006', 'UE-B2B1-PRIMITIVE-007', 'UE-B2B1-PRIMITIVE-011'].some((id) =>
    primitiveIds.includes(id),
  )
const hasResourceSignal = (entry) =>
  entry.RESOURCE_CHECK_CLASS === 'RESOURCE_CHECK_DIRECT' ||
  entry.DIRECT_SOURCE_SIGNALS.resourceCheck
const hasEntitlementSignal = (entry, primitiveIds) =>
  entry.ENTITLEMENT_CHECK_CLASS === 'ENTITLEMENT_CHECK_DIRECT' ||
  primitiveIds.includes('UE-B2B1-PRIMITIVE-019') ||
  primitiveIds.includes('UE-B2B1-PRIMITIVE-020')
const isMutating = (entry) =>
  ['POST', 'PUT', 'PATCH', 'DELETE'].includes((entry.HTTP_METHOD ?? '').toUpperCase())
const routeHasSpecificObject = (entry) =>
  /(?:\[.+(?:id|key|slug|number).*\]|[:{].*(?:id|key|slug|number).*[}:])/i.test(
    entry.ROUTE_PATTERN ?? '',
  )
const localHelperSignals = (entry) =>
  sortedUnique(
    [
      ...entry.AUTH_HELPERS,
      ...entry.ORG_CONTEXT_HELPERS,
      ...entry.ROLE_PERMISSION_HELPERS,
      ...entry.RESOURCE_PERMISSION_HELPERS,
      ...entry.ADMIN_HELPERS,
      ...entry.ENTITLEMENT_HELPERS,
      ...entry.RLS_CONTEXT_HELPERS,
    ].filter((name) => typeof name === 'string'),
  )

function classifyIdentity(entry) {
  if (isSystemAudience(entry) || isProviderAudience(entry)) return 'NOT_REQUIRED'
  if (entry.AUDIENCE === 'PUBLIC_INTENTIONAL') {
    if (
      entry.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_DIRECT' ||
      entry.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_VIA_WRAPPER'
    )
      return 'REQUIRED'
    if (entry.AUTH_BOUNDARY_CLASS === 'PUBLIC_EXPLICIT') return 'NOT_REQUIRED'
    return 'SOURCE_CEILING'
  }
  if (
    entry.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_DIRECT' ||
    entry.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_VIA_WRAPPER'
  )
    return 'REQUIRED'
  if (privateAudiences.has(entry.AUDIENCE)) return 'REQUIRED'
  return 'SOURCE_CEILING'
}

function classifyOrgMembership(entry, primitiveIds) {
  if (isSystemAudience(entry) || isProviderAudience(entry)) return 'NOT_REQUIRED'
  if (hasOrgMembershipPrimitive(primitiveIds) || roleAudiences.has(entry.AUDIENCE))
    return 'REQUIRED'
  if (hasTargetLink(entry)) return 'SOURCE_CEILING'
  return 'CONTEXTUAL'
}

function classifyOrgScope(entry, primitiveIds) {
  if (isSystemAudience(entry) || isProviderAudience(entry)) return 'NOT_REQUIRED'
  if (hasOrgContext(entry) || hasOrgContextPrimitive(primitiveIds)) return 'REQUIRED'
  return 'CONTEXTUAL'
}

function adminScope(entry, primitiveIds) {
  if (isSystemAudience(entry) && entry.AUDIENCE !== 'ADMIN') return 'SYSTEM_ADMIN'
  if (!hasAdminSignal(entry, primitiveIds) && !administrativeAudiences.has(entry.AUDIENCE))
    return 'NOT_REQUIRED'
  const primitives = previousRegistry.PRIMITIVES.filter((primitive) =>
    primitiveIds.includes(primitive.PRIMITIVE_ID),
  )
  const names = new Set(primitives.map((primitive) => primitive.SYMBOL))
  if (names.has('requireSystemAdmin') || names.has('isSystemAdmin')) return 'SYSTEM_ADMIN'
  if (names.has('requireSuperAdmin') || names.has('isSuperAdmin')) return 'SUPER_ADMIN'
  if (names.has('requireOrganizationAdmin') || names.has('isOrganizationAdmin'))
    return 'ORGANIZATION_ADMIN'
  if (names.has('requireApplicationAdmin') || names.has('isApplicationAdmin'))
    return 'APPLICATION_ADMIN'
  return hasAdminSignal(entry, primitiveIds) ? 'SOURCE_CEILING' : 'CONTEXTUAL'
}

function classifyResource(entry, hasTarget) {
  if (hasResourceSignal(entry)) return 'REQUIRED'
  if (entry.RESOURCE_CHECK_CLASS === 'RESOURCE_CHECK_NOT_APPLICABLE') return 'NOT_REQUIRED'
  if (routeHasSpecificObject(entry) || hasTarget) return 'SOURCE_CEILING'
  if (entry.DIRECT_DATABASE_ACCESS_OBSERVED) return 'CONTEXTUAL'
  return 'CONTEXTUAL'
}

function classifyRls(entry, primitiveIds) {
  if (primitiveIds.includes('UE-B2B1-PRIMITIVE-018')) return 'SYSTEM_BYPASS_EXPECTED'
  if (
    entry.RLS_CONTEXT_CLASS === 'RLS_CONTEXT_DIRECT' ||
    primitiveIds.includes('UE-B2B1-PRIMITIVE-017')
  )
    return 'REQUIRED'
  if (entry.RLS_CONTEXT_CLASS === 'NOT_APPLICABLE') return 'NOT_REQUIRED'
  if (entry.DIRECT_DATABASE_ACCESS_OBSERVED || hasTargetLink(entry)) return 'SOURCE_CEILING'
  return 'CONTEXTUAL'
}

function classifyPrivilegedDb(entry, primitiveIds) {
  if (primitiveIds.includes('UE-B2B1-PRIMITIVE-018')) return 'REQUIRED'
  if (isSystemAudience(entry)) return 'CONTEXTUAL'
  if (entry.DIRECT_DATABASE_ACCESS_OBSERVED || hasTargetLink(entry)) return 'SOURCE_CEILING'
  return 'CONTEXTUAL'
}

function publicCallerAuthModel(entry) {
  if (entry.AUDIENCE !== 'PUBLIC_INTENTIONAL') return 'NOT_APPLICABLE'
  if (
    entry.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_DIRECT' ||
    entry.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_VIA_WRAPPER'
  )
    return 'SOURCE_CEILING'
  if (entry.AUTH_BOUNDARY_CLASS === 'PUBLIC_EXPLICIT') return 'NO_CALLER_AUTH'
  return 'SOURCE_CEILING'
}

function linkageStatus(entry, primitiveIds, requirements) {
  const helperNames = localHelperSignals(entry)
  const directBoundaryObserved =
    entry.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_DIRECT' ||
    entry.AUTH_BOUNDARY_CLASS === 'PROVIDER_SIGNATURE_OR_SECRET' ||
    entry.AUTH_BOUNDARY_CLASS === 'INTERNAL_TRUST_BOUNDARY' ||
    entry.ORG_CONTEXT_CLASS === 'ORG_CONTEXT_DIRECT' ||
    entry.ROLE_CHECK_CLASS === 'ROLE_CHECK_DIRECT' ||
    entry.ADMIN_CHECK_CLASS === 'ADMIN_CHECK_DIRECT' ||
    entry.RESOURCE_CHECK_CLASS === 'RESOURCE_CHECK_DIRECT' ||
    entry.ENTITLEMENT_CHECK_CLASS === 'ENTITLEMENT_CHECK_DIRECT' ||
    entry.RLS_CONTEXT_CLASS === 'RLS_CONTEXT_DIRECT' ||
    entry.DIRECT_SOURCE_SIGNALS.roleCheck ||
    entry.DIRECT_SOURCE_SIGNALS.permissionCheck ||
    entry.DIRECT_SOURCE_SIGNALS.adminCheck ||
    entry.DIRECT_SOURCE_SIGNALS.organizationContext ||
    entry.DIRECT_SOURCE_SIGNALS.resourceCheck
  const wrapperBoundaryObserved =
    entry.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_VIA_WRAPPER' ||
    entry.ORG_CONTEXT_CLASS === 'ORG_CONTEXT_VIA_WRAPPER'
  const anyRequirement =
    requirements.IDENTITY_AUTHENTICATION_REQUIRED !== 'NOT_REQUIRED' ||
    requirements.ORGANIZATION_MEMBERSHIP_REQUIRED !== 'NOT_REQUIRED' ||
    requirements.ORGANIZATION_SCOPE_REQUIRED !== 'NOT_REQUIRED' ||
    requirements.ROLE_OR_PERMISSION_REQUIRED !== 'NOT_REQUIRED' ||
    requirements.ADMIN_SCOPE_REQUIRED !== 'NOT_REQUIRED' ||
    requirements.RESOURCE_SCOPE_REQUIRED !== 'NOT_REQUIRED' ||
    requirements.SYSTEM_IDENTITY_REQUIRED !== 'NOT_REQUIRED' ||
    requirements.PROVIDER_AUTH_REQUIRED !== 'NOT_REQUIRED' ||
    requirements.ENTITLEMENT_REQUIRED !== 'NOT_REQUIRED' ||
    requirements.RLS_CONTEXT_EXPECTED !== 'NOT_REQUIRED' ||
    requirements.PRIVILEGED_DB_PRECONDITION_REQUIRED !== 'NOT_REQUIRED'
  if (primitiveIds.length > 0) return 'PARTIALLY_LINKED_TO_RESOLVED_PRIMITIVES'
  if (directBoundaryObserved) return 'ENTRY_LOCAL_ENFORCEMENT'
  if (wrapperBoundaryObserved || helperNames.length > 0) {
    return 'BOUNDARY_LINKAGE_SOURCE_CEILING'
  }
  if (anyRequirement) return 'NO_ENFORCEMENT_SIGNAL_OBSERVED'
  return 'NO_ENFORCEMENT_REQUIRED_BY_CONTRACT'
}

function mutationSensitivity(entry) {
  const method = (entry.HTTP_METHOD ?? '').toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return 'READ_ONLY'
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return 'MUTATING'
  if (
    entry.ENTRY_CLASS === 'SERVER_ACTION' ||
    entry.ENTRY_CLASS === 'WEBHOOK_HANDLER' ||
    entry.ENTRY_CLASS === 'SCHEDULED_OR_CRON_HANDLER'
  )
    return 'MIXED'
  if (entry.ENTRY_CLASS === 'NEXTAUTH_AUTH_HANDLER') return 'NON_DATA_OPERATION'
  return 'MIXED'
}

function highImpactTags(entry, sensitivity, requirements, primitiveIds) {
  const tags = new Set()
  const text =
    `${entry.EXPORT_OR_HANDLER} ${entry.ROUTE_PATTERN} ${entry.SPECIAL_BOUNDARY ?? ''}`.toLowerCase()
  if (sensitivity === 'MUTATING' && requirements.ADMIN_SCOPE_REQUIRED !== 'NOT_REQUIRED')
    tags.add('ADMIN_MUTATION')
  if (sensitivity === 'MUTATING' && /membership|member/.test(text)) tags.add('MEMBERSHIP_MUTATION')
  if (sensitivity === 'MUTATING' && hasRoleSignal(entry, primitiveIds))
    tags.add('ROLE_PERMISSION_MUTATION')
  if (sensitivity === 'MUTATING' && /auth|session|credential|password|mfa|identity/.test(text))
    tags.add('AUTH_POLICY_MUTATION')
  if (sensitivity === 'MUTATING' && /financial|payment|payroll|invoice|bank|claim/.test(text))
    tags.add('FINANCIAL_MUTATION')
  if (sensitivity === 'MUTATING' && /election|ballot|vote/.test(text))
    tags.add('ELECTION_VOTE_MUTATION')
  if (sensitivity === 'MUTATING' && /document|evidence|attachment|upload/.test(text))
    tags.add('DOCUMENT_EVIDENCE_MUTATION')
  if (sensitivity === 'MUTATING' && /identity|security|credential|password|mfa/.test(text))
    tags.add('IDENTITY_SECURITY_MUTATION')
  if (/\bcross[-_ ]org\b|all[-_ ]org|system[-_ ]wide/.test(text) || isSystemAudience(entry))
    tags.add('CROSS_ORG_OPERATION')
  if (requirements.PRIVILEGED_DB_PRECONDITION_REQUIRED === 'REQUIRED')
    tags.add('PRIVILEGED_DB_OPERATION')
  if (sensitivity === 'MUTATING' && entry.SPECIAL_BOUNDARY) tags.add('OTHER_EXPLICIT_HIGH_IMPACT')
  return [...tags].sort((a, b) => a.localeCompare(b))
}

const entryRequirements = census.ENTRIES.map((entry) => {
  const primitiveIds = primitiveByEntry.get(entry.ENTRY_ID)
  const identity = classifyIdentity(entry)
  const systemIdentity = isSystemAudience(entry)
  const providerAuth = isProviderAudience(entry)
  const orgMembership = classifyOrgMembership(entry, primitiveIds)
  const orgScope = classifyOrgScope(entry, primitiveIds)
  let roleRequirement
  if (hasRoleSignal(entry, primitiveIds)) roleRequirement = 'REQUIRED'
  else if (roleAudiences.has(entry.AUDIENCE)) roleRequirement = 'REQUIRED'
  else if (entry.AUDIENCE === 'MIXED_OR_CONTEXTUAL') roleRequirement = 'CONTEXTUAL'
  else if (privateAudiences.has(entry.AUDIENCE)) roleRequirement = 'NOT_REQUIRED'
  else roleRequirement = 'CONTEXTUAL'
  const admin = adminScope(entry, primitiveIds)
  const resource = classifyResource(entry, hasTargetLink(entry))
  const entitlement = hasEntitlementSignal(entry, primitiveIds) ? 'REQUIRED' : 'CONTEXTUAL'
  const rls = classifyRls(entry, primitiveIds)
  const privileged = classifyPrivilegedDb(entry, primitiveIds)
  const requirements = {
    IDENTITY_AUTHENTICATION_REQUIRED: identity,
    ORGANIZATION_MEMBERSHIP_REQUIRED: orgMembership,
    ORGANIZATION_SCOPE_REQUIRED: orgScope,
    ROLE_OR_PERMISSION_REQUIRED: roleRequirement,
    ADMIN_SCOPE_REQUIRED: admin,
    RESOURCE_SCOPE_REQUIRED: resource,
    SYSTEM_IDENTITY_REQUIRED: systemIdentity ? 'REQUIRED' : 'NOT_REQUIRED',
    PROVIDER_AUTH_REQUIRED: providerAuth ? 'REQUIRED' : 'NOT_REQUIRED',
    ENTITLEMENT_REQUIRED: entitlement,
    RLS_CONTEXT_EXPECTED: rls,
    PRIVILEGED_DB_PRECONDITION_REQUIRED: privileged,
  }
  const mutation = mutationSensitivity(entry)
  const helperNames = localHelperSignals(entry)
  const hasRelevantBoundarySignal =
    helperNames.length > 0 ||
    entry.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_DIRECT' ||
    entry.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_VIA_WRAPPER' ||
    entry.AUTH_BOUNDARY_CLASS === 'PROVIDER_SIGNATURE_OR_SECRET' ||
    entry.AUTH_BOUNDARY_CLASS === 'INTERNAL_TRUST_BOUNDARY' ||
    entry.ORG_CONTEXT_CLASS === 'ORG_CONTEXT_DIRECT' ||
    entry.ORG_CONTEXT_CLASS === 'ORG_CONTEXT_VIA_WRAPPER' ||
    entry.ROLE_CHECK_CLASS === 'ROLE_CHECK_DIRECT' ||
    entry.ADMIN_CHECK_CLASS === 'ADMIN_CHECK_DIRECT' ||
    entry.RESOURCE_CHECK_CLASS === 'RESOURCE_CHECK_DIRECT' ||
    entry.ENTITLEMENT_CHECK_CLASS === 'ENTITLEMENT_CHECK_DIRECT' ||
    entry.RLS_CONTEXT_CLASS === 'RLS_CONTEXT_DIRECT'
  const linkage = linkageStatus(entry, primitiveIds, requirements)
  const ceilings = requirementFields.filter((field) => requirements[field] === 'SOURCE_CEILING')
  const ceilingReason =
    ceilings.length === 0
      ? null
      : 'Accepted census and frozen primitive registry do not establish the exact requirement for this dimension; no source outside the accepted evidence was inspected.'
  const observed = {
    AUTH_BOUNDARY_CLASS: entry.AUTH_BOUNDARY_CLASS,
    AUTH_HELPERS: entry.AUTH_HELPERS,
    ORG_CONTEXT_CLASS: entry.ORG_CONTEXT_CLASS,
    ORG_CONTEXT_HELPERS: entry.ORG_CONTEXT_HELPERS,
    ROLE_CHECK_CLASS: entry.ROLE_CHECK_CLASS,
    PERMISSION_CHECK_CLASS: entry.PERMISSION_CHECK_CLASS,
    ROLE_PERMISSION_HELPERS: entry.ROLE_PERMISSION_HELPERS,
    ADMIN_CHECK_CLASS: entry.ADMIN_CHECK_CLASS,
    ADMIN_HELPERS: entry.ADMIN_HELPERS,
    RESOURCE_CHECK_CLASS: entry.RESOURCE_CHECK_CLASS,
    RESOURCE_PERMISSION_HELPERS: entry.RESOURCE_PERMISSION_HELPERS,
    ENTITLEMENT_CHECK_CLASS: entry.ENTITLEMENT_CHECK_CLASS,
    ENTITLEMENT_HELPERS: entry.ENTITLEMENT_HELPERS,
    RLS_CONTEXT_CLASS: entry.RLS_CONTEXT_CLASS,
    RLS_CONTEXT_HELPERS: entry.RLS_CONTEXT_HELPERS,
    PRIVILEGED_DATABASE_PATH: primitiveIds.includes('UE-B2B1-PRIMITIVE-018')
      ? 'WITH_SYSTEM_CONTEXT_PRIMITIVE_EXPOSURE'
      : 'NOT_ESTABLISHED_BY_ACCEPTED_CENSUS',
    PUBLIC_INTENT_EVIDENCE: entry.PUBLIC_DECLARATION_EVIDENCE,
    PUBLIC_CALLER_AUTH_MODEL: publicCallerAuthModel(entry),
    BOUNDARY_PRIMITIVE_IDS: primitiveIds,
  }
  return {
    ENTRY_ID: entry.ENTRY_ID,
    ENTRY_CLASS: entry.ENTRY_CLASS,
    AUDIENCE: entry.AUDIENCE,
    REQUIRED_ENFORCEMENT_CONTRACT: requirements,
    REQUIREMENT_SOURCE_CEILING_DIMENSIONS: ceilings,
    REQUIREMENT_SOURCE_CEILING_REASON: ceilingReason,
    OBSERVED_ENFORCEMENT_STACK: observed,
    PRIMITIVE_LINKAGE_STATUS: linkage,
    ENFORCEMENT_SIGNATURE: null,
    COHORT_ID: null,
    MUTATION_SENSITIVITY: mutation,
    HIGH_IMPACT_TAGS: highImpactTags(entry, mutation, requirements, primitiveIds),
    SOURCE_MODEL_NOTES: {
      SPECIFIC_RESOURCE_ROUTE_OBSERVED: routeHasSpecificObject(entry),
      ACCEPTED_PHASE1A_OR_PHASE1B1_LINK_PRESENT: hasTargetLink(entry),
      RELEVANT_BOUNDARY_SIGNAL_OBSERVED: hasRelevantBoundarySignal,
      ENTRY_LOCAL_HELPER_SIGNALS: helperNames,
    },
  }
})

function signatureRecord(record) {
  const observed = record.OBSERVED_ENFORCEMENT_STACK
  return {
    ENTRY_CLASS: record.ENTRY_CLASS,
    AUDIENCE: record.AUDIENCE,
    REQUIRED_ENFORCEMENT_CONTRACT: record.REQUIRED_ENFORCEMENT_CONTRACT,
    AUTH_BOUNDARY_CLASS: observed.AUTH_BOUNDARY_CLASS,
    ORG_CONTEXT_CLASS: observed.ORG_CONTEXT_CLASS,
    ROLE_CHECK_CLASS: observed.ROLE_CHECK_CLASS,
    PERMISSION_CHECK_CLASS: observed.PERMISSION_CHECK_CLASS,
    ADMIN_CHECK_CLASS: observed.ADMIN_CHECK_CLASS,
    RESOURCE_CHECK_CLASS: observed.RESOURCE_CHECK_CLASS,
    ENTITLEMENT_CHECK_CLASS: observed.ENTITLEMENT_CHECK_CLASS,
    RLS_CONTEXT_CLASS: observed.RLS_CONTEXT_CLASS,
    PRIVILEGED_DATABASE_PATH: observed.PRIVILEGED_DATABASE_PATH,
    BOUNDARY_PRIMITIVE_IDS: observed.BOUNDARY_PRIMITIVE_IDS,
    PRIMITIVE_LINKAGE_STATUS: record.PRIMITIVE_LINKAGE_STATUS,
  }
}

const groups = new Map()
for (const record of entryRequirements) {
  const signature = digest(serialize(signatureRecord(record)))
  record.ENFORCEMENT_SIGNATURE = signature
  if (!groups.has(signature)) groups.set(signature, [])
  groups.get(signature).push(record)
}
const enforcementCohorts = [...groups.entries()]
  .map(([signature, records]) => {
    const memberIds = records.map((record) => record.ENTRY_ID).sort((a, b) => a.localeCompare(b))
    const first = records[0]
    return {
      COHORT_ID: `UE-B2B2A-${signature.slice(0, 16)}`,
      ENFORCEMENT_SIGNATURE: signature,
      ENTRY_COUNT: memberIds.length,
      ENTRY_IDS: memberIds,
      REQUIRED_ENFORCEMENT_CONTRACT: first.REQUIRED_ENFORCEMENT_CONTRACT,
      OBSERVED_BOUNDARY_CONTRACT: first.OBSERVED_ENFORCEMENT_STACK,
      PRIMITIVE_IDS: first.OBSERVED_ENFORCEMENT_STACK.BOUNDARY_PRIMITIVE_IDS,
      LINKAGE_STATUS: first.PRIMITIVE_LINKAGE_STATUS,
      REQUIRES_ENTRY_LOCAL_SOURCE_REVIEW: records.some(
        (record) =>
          record.REQUIREMENT_SOURCE_CEILING_DIMENSIONS.length > 0 ||
          record.PRIMITIVE_LINKAGE_STATUS === 'ENTRY_LOCAL_ENFORCEMENT' ||
          record.PRIMITIVE_LINKAGE_STATUS === 'BOUNDARY_LINKAGE_SOURCE_CEILING',
      ),
    }
  })
  .sort((a, b) => a.COHORT_ID.localeCompare(b.COHORT_ID))
const cohortByEntry = new Map(
  enforcementCohorts.flatMap((cohort) => cohort.ENTRY_IDS.map((id) => [id, cohort.COHORT_ID])),
)
for (const record of entryRequirements) record.COHORT_ID = cohortByEntry.get(record.ENTRY_ID)

const historicalPageExpectationLinkage =
  census.HISTORICAL_PAGE_EXPECTATION_CARRY_FORWARD.RECORDS.map((expectation) => {
    const linkedIds = sortedUnique(expectation.LINKED_SERVER_ENTRY_IDS ?? [])
    const unknownIds = linkedIds.filter((id) => !entryIdSet.has(id))
    assert.deepEqual(
      unknownIds,
      [],
      `Unknown entry in historical expectation ${expectation.CARRY_FORWARD_ID}`,
    )
    return {
      CARRY_FORWARD_ID: expectation.CARRY_FORWARD_ID,
      EXPECTATION_TYPE: expectation.EXPECTATION_TYPE,
      ROUTE: expectation.ROUTE,
      SOURCE_FILE: expectation.SOURCE_FILE,
      LINKED_ENTRY_IDS: linkedIds,
      LINKED_COHORT_IDS: sortedUnique(linkedIds.map((id) => cohortByEntry.get(id))),
      LINKAGE_DISPOSITION:
        linkedIds.length > 0 ? 'LINKED' : 'NOT_APPLICABLE_NO_SERVER_BOUNDARY_LINK_FOUND',
    }
  })

const boundaryFindingEntryIds = sortedUnique(
  census.OBSERVED_SECURITY_BOUNDARY_SIGNALS.DIRECT_HANDLER_SECURITY_BOUNDARY_ENTRY_IDS,
)
const phase1B2aFindingLinkage = [
  {
    FINDING_ID: 'UE-1B2A-DIRECT-HANDLER-SECURITY-BOUNDARY',
    FINDING_CLASS: 'DIRECT_HANDLER_SECURITY_BOUNDARY',
    ACCEPTED_FINDING_COUNT:
      census.OBSERVED_SECURITY_BOUNDARY_SIGNALS.DIRECT_HANDLER_SECURITY_BOUNDARY_ENTRIES,
    ENTRY_IDS: boundaryFindingEntryIds,
    COHORT_IDS: sortedUnique(boundaryFindingEntryIds.map((id) => cohortByEntry.get(id))),
    NOT_APPLICABLE_ENTRY_IDS: entryIds.filter((id) => !boundaryFindingEntryIds.includes(id)),
    NOT_APPLICABLE_REASON:
      'The accepted census did not classify this entry as a direct handler security-boundary finding.',
  },
  {
    FINDING_ID: 'UE-1B2A-PRIVILEGED-DATABASE-PATHS',
    FINDING_CLASS: 'PRIVILEGED_DATABASE_PATH',
    ACCEPTED_FINDING_COUNT:
      census.OBSERVED_SECURITY_BOUNDARY_SIGNALS.PRIVILEGED_DATABASE_PATHS.length,
    ENTRY_IDS: [],
    COHORT_IDS: [],
    NOT_APPLICABLE_ENTRY_IDS: entryIds,
    NOT_APPLICABLE_REASON:
      'The accepted census records no privileged database path; B2B1 separately records primitive exposure, not a complete entry boundary graph.',
  },
]
assert.equal(boundaryFindingEntryIds.length, 679)
assert(boundaryFindingEntryIds.every((id) => entryIdSet.has(id)))

function entryEvidenceText(entry) {
  return serialize({
    AUTH_HELPERS: entry.AUTH_HELPERS,
    ORG_CONTEXT_HELPERS: entry.ORG_CONTEXT_HELPERS,
    ROLE_PERMISSION_HELPERS: entry.ROLE_PERMISSION_HELPERS,
    RESOURCE_PERMISSION_HELPERS: entry.RESOURCE_PERMISSION_HELPERS,
    ADMIN_HELPERS: entry.ADMIN_HELPERS,
    ENTITLEMENT_HELPERS: entry.ENTITLEMENT_HELPERS,
    RLS_CONTEXT_HELPERS: entry.RLS_CONTEXT_HELPERS,
    DIRECT_SOURCE_SIGNALS: entry.DIRECT_SOURCE_SIGNALS,
  }).toLowerCase()
}
const phase1B2b1FindingLinkage = previousRegistry.EXCLUDED_OR_UNRESOLVED_CENSUS_SIGNALS.map(
  (finding) => {
    const impacted = census.ENTRIES.filter((entry) =>
      entryEvidenceText(entry).includes(finding.SIGNAL.toLowerCase()),
    ).map((entry) => entry.ENTRY_ID)
    return {
      FINDING_ID: `UE-1B2B1-SIGNAL-${digest(finding.SIGNAL).slice(0, 12)}`,
      SIGNAL: finding.SIGNAL,
      CATEGORY:
        finding.REASON === 'Identifier or constant signal, not a callable primitive.'
          ? 'NON_CALLABLE_IDENTIFIER_OR_CONSTANT'
          : 'UNRESOLVED_CENSUS_SIGNAL',
      REASON: finding.REASON,
      ENTRY_IDS: impacted,
      COHORT_IDS: sortedUnique(impacted.map((id) => cohortByEntry.get(id))),
      LINKAGE_DISPOSITION:
        impacted.length > 0 ? 'AFFECTED_ENTRIES_LINKED' : 'NOT_APPLICABLE_NO_ENTRY_LOCAL_SIGNAL',
    }
  },
)

const highImpactEntries = entryRequirements
  .filter((record) => record.HIGH_IMPACT_TAGS.length > 0)
  .map((record) => ({
    ENTRY_ID: record.ENTRY_ID,
    COHORT_ID: record.COHORT_ID,
    TAGS: record.HIGH_IMPACT_TAGS,
  }))
const requirementSourceCeilings = entryRequirements.flatMap((record) =>
  record.REQUIREMENT_SOURCE_CEILING_DIMENSIONS.map((dimension) => ({
    ENTRY_ID: record.ENTRY_ID,
    COHORT_ID: record.COHORT_ID,
    DIMENSION: dimension,
    REASON: record.REQUIREMENT_SOURCE_CEILING_REASON,
  })),
)
const requirementCounts = Object.fromEntries(
  requirementFields.map((field) => {
    const possibleValues =
      field === 'ADMIN_SCOPE_REQUIRED'
        ? adminValues
        : field === 'RLS_CONTEXT_EXPECTED'
          ? rlsValues
          : categoricalValues
    const counts = Object.fromEntries(possibleValues.map((value) => [value, 0]))
    for (const record of entryRequirements) {
      const value = record.REQUIRED_ENFORCEMENT_CONTRACT[field]
      assert(Object.hasOwn(counts, value), `Unexpected value ${value} for ${field}`)
      counts[value] += 1
    }
    assert.equal(
      Object.values(counts).reduce((sum, value) => sum + value, 0),
      1910,
    )
    return [field, counts]
  }),
)
const linkageCounts = Object.fromEntries(
  [
    'FULLY_LINKED_TO_RESOLVED_PRIMITIVES',
    'PARTIALLY_LINKED_TO_RESOLVED_PRIMITIVES',
    'ENTRY_LOCAL_ENFORCEMENT',
    'BOUNDARY_LINKAGE_SOURCE_CEILING',
    'NO_ENFORCEMENT_SIGNAL_OBSERVED',
    'NO_ENFORCEMENT_REQUIRED_BY_CONTRACT',
  ].map((status) => [
    status,
    entryRequirements.filter((record) => record.PRIMITIVE_LINKAGE_STATUS === status).length,
  ]),
)
const memberships = enforcementCohorts.flatMap((cohort) => cohort.ENTRY_IDS)
const multipleMemberships = entryIds.filter(
  (id) => memberships.filter((member) => member === id).length > 1,
)
const noMemberships = entryIds.filter((id) => !memberships.includes(id))
const cohortsRequiringLocalReview = enforcementCohorts.filter(
  (cohort) => cohort.REQUIRES_ENTRY_LOCAL_SOURCE_REVIEW,
)
const localReviewEntryIds = sortedUnique(
  cohortsRequiringLocalReview.flatMap((cohort) => cohort.ENTRY_IDS),
)
const entriesWithCeilings = entryRequirements.filter(
  (record) => record.REQUIREMENT_SOURCE_CEILING_DIMENSIONS.length > 0,
)
const gate = requirementSourceCeilings.length > 0 ? 'SOURCE_CEILING' : 'PASS'

assert.equal(entryRequirements.length, 1910)
assert.equal(new Set(entryRequirements.map((record) => record.ENTRY_ID)).size, 1910)
assert(
  entryRequirements.every((record) =>
    requirementFields.every((field) => Object.hasOwn(record.REQUIRED_ENFORCEMENT_CONTRACT, field)),
  ),
)
assert(entryRequirements.every((record) => record.ENFORCEMENT_SIGNATURE))
assert(entryRequirements.every((record) => record.COHORT_ID))
assert.equal(memberships.length, 1910)
assert.equal(new Set(memberships).size, 1910)
assert.equal(multipleMemberships.length, 0)
assert.equal(noMemberships.length, 0)
assert.equal(
  Object.values(linkageCounts).reduce((sum, value) => sum + value, 0),
  1910,
)
assert.equal(
  enforcementCohorts.reduce((sum, cohort) => sum + cohort.ENTRY_COUNT, 0),
  1910,
)
assert.equal(historicalPageExpectationLinkage.length, 43)
assert.equal(phase1B2b1FindingLinkage.length, 8)

const result = {
  metadata: {
    PHASE: 'PHASE_1B_2B2A_ENTRY_ENFORCEMENT_PARTITION',
    METHOD: 'ACCEPTED_CENSUS_AND_FROZEN_PRIMITIVE_REGISTRY_ONLY',
    INPUTS: {
      CENSUS_FILE: censusFile,
      CENSUS_SHA256: censusSha256,
      PRIMITIVE_REGISTRY_FILE: primitiveFile,
      PRIMITIVE_REGISTRY_SHA256: primitiveRegistrySha256,
      R2C_CARRY_FORWARD_FILE: carryForwardFile,
    },
    INPUT_EXECUTABLE_SERVER_ENTRIES: census.ENTRIES.length,
    UNIQUE_ENTRY_IDS: entryIdSet.size,
    SOURCE_RESOLVED_PRIMITIVES: previousRegistry.PRIMITIVES.length,
    PRIMITIVE_ARRAY_SHA256: primitiveArraySha256,
    PRIMITIVE_RECORDS_PRESERVED_VERBATIM: 'YES',
    NO_APPLICATION_SOURCE_NEWLY_INSPECTED: 'YES',
  },
  entryRequirements,
  enforcementCohorts,
  requirementSourceCeilings,
  historicalPageExpectationLinkage,
  phase1B2aFindingLinkage,
  phase1B2b1FindingLinkage,
  highImpactEntries,
  carryForward: {
    AUTHORITY_SOURCE_CEILING_CARRY_FORWARD: 207,
    R2B_KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD: 3,
    R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS: 56,
    R2C_RESOLVED_TARGET_CHAINS: 43,
    TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD: 13,
    TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD: 0,
    TARGETLESS_EFFECT_STATIC_WORK_REMAINING: 0,
    FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD: 247,
    STATIC_WORK_REMAINING: 0,
  },
  summary: {
    TOTAL_ENTRIES: entryRequirements.length,
    TOTAL_ENFORCEMENT_COHORTS: enforcementCohorts.length,
    COMPRESSION_RATIO: Number((entryRequirements.length / enforcementCohorts.length).toFixed(4)),
    REQUIREMENT_COUNTS: requirementCounts,
    PRIMITIVE_LINKAGE_COUNTS: linkageCounts,
    COHORTS_ELIGIBLE_FOR_SHARED_ADJUDICATION:
      enforcementCohorts.length - cohortsRequiringLocalReview.length,
    COHORTS_REQUIRING_ENTRY_LOCAL_REVIEW: cohortsRequiringLocalReview.length,
    ENTRIES_REQUIRING_ENTRY_LOCAL_REVIEW: localReviewEntryIds.length,
    ENTRIES_WITH_REQUIREMENT_SOURCE_CEILING: entriesWithCeilings.length,
    REQUIREMENT_SOURCE_CEILING_DIMENSION_RECORDS: requirementSourceCeilings.length,
    HISTORICAL_AUTH_EXPECTATION_RECORDS: historicalPageExpectationLinkage.filter(
      (item) => item.EXPECTATION_TYPE === 'PAGE_AUTH_EXPECTATION_UNPROVEN',
    ).length,
    HISTORICAL_ORG_EXPECTATION_RECORDS: historicalPageExpectationLinkage.filter(
      (item) => item.EXPECTATION_TYPE === 'PAGE_ORG_CONTEXT_EXPECTATION_UNPROVEN',
    ).length,
  },
  validation: {
    ACCEPTED_ENTRY_IDS_PRESERVED_EXACTLY_ONCE:
      entryRequirements.length === 1910 &&
      new Set(entryRequirements.map((record) => record.ENTRY_ID)).size === 1910,
    REQUIREMENT_FIELDS_COMPLETE: entryRequirements.every((record) =>
      requirementFields.every((field) =>
        Object.hasOwn(record.REQUIRED_ENFORCEMENT_CONTRACT, field),
      ),
    ),
    EXACTLY_ONE_LINKAGE_STATUS_PER_ENTRY:
      Object.values(linkageCounts).reduce((sum, count) => sum + count, 0) === 1910,
    EXACTLY_ONE_SIGNATURE_PER_ENTRY: entryRequirements.every((record) =>
      Boolean(record.ENFORCEMENT_SIGNATURE),
    ),
    EXACTLY_ONE_COHORT_PER_ENTRY: memberships.length === 1910 && new Set(memberships).size === 1910,
    COHORT_PARTITION_LOSSLESS: multipleMemberships.length === 0 && noMemberships.length === 0,
    ENTRIES_IN_MULTIPLE_COHORTS: multipleMemberships.length,
    ENTRIES_IN_NO_COHORT: noMemberships.length,
    PRIMITIVE_RECORDS_UNMUTATED: primitiveArraySha256 === expectedPrimitiveArraySha256,
    B2B1_SOURCE_CEILINGS_PRESERVED: previousRegistry.STATE.PHASE_1B_2B1_GATE === 'SOURCE_CEILING',
    HISTORICAL_PAGE_EXPECTATIONS_PRESERVED: historicalPageExpectationLinkage.length === 43,
    ALL_1B2A_FINDINGS_LINKED_OR_EXPLICITLY_NOT_APPLICABLE: phase1B2aFindingLinkage.every(
      (finding) => finding.ENTRY_IDS.length > 0 || finding.NOT_APPLICABLE_ENTRY_IDS.length > 0,
    ),
    ALL_1B2B1_FINDINGS_LINKED_OR_EXPLICITLY_NOT_APPLICABLE: phase1B2b1FindingLinkage.every(
      (finding) =>
        finding.ENTRY_IDS.length > 0 || finding.LINKAGE_DISPOSITION.startsWith('NOT_APPLICABLE'),
    ),
    NO_AUTHORIZATION_SUFFICIENCY_VERDICT: 'YES',
    NO_RUNTIME_AUTH_EXECUTED: 'YES',
    NO_RUNTIME_DATABASE_INSPECTED: 'YES',
    NO_PRODUCT_CODE_CHANGED: 'YES',
  },
  phaseStatus: {
    PHASE_1B_2B2_A_GATE: gate,
    PHASE_1B_2B2_A: gate === 'PASS' ? 'PASS' : 'SOURCE_CEILING_ACCEPTED',
    ENTRY_ENFORCEMENT_REQUIREMENT_UNIVERSE:
      gate === 'PASS' ? 'CLOSED' : 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
    ENFORCEMENT_EQUIVALENCE_PARTITION: 'CLOSED',
    PHASE_1B_2: 'NOT_YET_COMPLETE',
    AUTHORIZATION_CORRECTNESS_PROVEN: 'NO',
    ORG_SCOPE_ENFORCEMENT_PROVEN: 'NO',
    RESOURCE_AUTHORIZATION_PROVEN: 'NO',
    RLS_CORRECTNESS_PROVEN: 'NO',
    PRODUCT_READY: 'NO',
    PHASE_1B_2B2_B_ENFORCEMENT_ADJUDICATION: 'AUTHORIZED',
    PHASE_1B_2B2_B_STARTED: 'NO',
    PHASE_1B_3: 'NOT_AUTHORIZED',
    PHASE_1C: 'NOT_AUTHORIZED',
    PHASE_1D: 'NOT_AUTHORIZED',
    PHASE_2: 'NOT_AUTHORIZED',
  },
}

function markdownReport(data) {
  const dimensions = Object.entries(data.summary.REQUIREMENT_COUNTS)
    .map(
      ([field, counts]) =>
        `| ${field} | ${Object.entries(counts)
          .map(([key, value]) => `${key}: ${value}`)
          .join('; ')} |`,
    )
    .join('\n')
  const history = data.historicalPageExpectationLinkage.reduce((counts, item) => {
    counts[item.EXPECTATION_TYPE] = (counts[item.EXPECTATION_TYPE] ?? 0) + 1
    return counts
  }, {})
  const links = data.summary.PRIMITIVE_LINKAGE_COUNTS
  return `# Phase 1B.2b2-A — Entry Enforcement Requirement & Equivalence Partition

## Gate

\`\`\`
PHASE_1B_2B2_A_GATE = ${data.phaseStatus.PHASE_1B_2B2_A_GATE}
PHASE_1B_2B2_A = ${data.phaseStatus.PHASE_1B_2B2_A}
ENTRY_ENFORCEMENT_REQUIREMENT_UNIVERSE = ${data.phaseStatus.ENTRY_ENFORCEMENT_REQUIREMENT_UNIVERSE}
ENFORCEMENT_EQUIVALENCE_PARTITION = CLOSED
PHASE_1B_2B2_B_ENFORCEMENT_ADJUDICATION = AUTHORIZED
PHASE_1B_2B2_B_STARTED = NO
\`\`\`

This is a source-only requirement model and lossless partition. It does not determine whether any entry is adequately authorized, secure, or vulnerable. Any \`SOURCE_CEILING\` value means the frozen accepted evidence does not establish that dimension; no application source was newly inspected.

## Denominator and partition

| Measure | Value |
| --- | ---: |
| Accepted executable server entries | ${data.summary.TOTAL_ENTRIES} |
| Unique entry records | ${new Set(data.entryRequirements.map((entry) => entry.ENTRY_ID)).size} |
| Enforcement cohorts | ${data.summary.TOTAL_ENFORCEMENT_COHORTS} |
| Compression ratio | ${data.summary.COMPRESSION_RATIO} |
| Cohorts eligible for shared adjudication | ${data.summary.COHORTS_ELIGIBLE_FOR_SHARED_ADJUDICATION} |
| Cohorts requiring entry-local review | ${data.summary.COHORTS_REQUIRING_ENTRY_LOCAL_REVIEW} |
| Entries requiring entry-local review | ${data.summary.ENTRIES_REQUIRING_ENTRY_LOCAL_REVIEW} |
| Entries with a requirement source ceiling | ${data.summary.ENTRIES_WITH_REQUIREMENT_SOURCE_CEILING} |

## Requirement arithmetic

| Dimension | Counts |
| --- | --- |
${dimensions}

## Primitive linkage arithmetic

| Linkage status | Entries |
| --- | ---: |
${Object.entries(links)
  .map(([status, count]) => `| ${status} | ${count} |`)
  .join('\n')}

## Historical page expectations

Preserved ${data.historicalPageExpectationLinkage.length} records: ${history.PAGE_AUTH_EXPECTATION_UNPROVEN ?? 0} auth expectations and ${history.PAGE_ORG_CONTEXT_EXPECTATION_UNPROVEN ?? 0} organization-context expectations. Each is linked to its accepted server entry/cohort when a link exists, or explicitly marked not applicable when the census found no server-boundary link.

## Preserved carry-forwards

\`\`\`json
${JSON.stringify(data.carryForward, null, 2)}
\`\`\`

The 20 accepted B2B1 primitive records are referenced without mutation; frozen primitive-array SHA-256: \`${data.metadata.PRIMITIVE_ARRAY_SHA256}\`.

## Validation and scope

- Exact-once entries and a lossless cohort partition: ${data.validation.COHORT_PARTITION_LOSSLESS ? 'PASS' : 'FAIL'} (${data.validation.ENTRIES_IN_MULTIPLE_COHORTS} multiple memberships; ${data.validation.ENTRIES_IN_NO_COHORT} missing memberships).
- Complete requirement fields and one linkage status/signature/cohort per entry: PASS.
- 1B.2a boundary findings and all B2B1 source-signal findings are linked or explicitly not applicable.
- No authorization-sufficiency verdict, runtime authentication, runtime database inspection, or product code change.
- B2B2-B is authorized but not started; Phase 1B.2 remains incomplete.
`
}

const jsonText = `${JSON.stringify(result, null, 2)}\n`
const prettierConfig = (await resolveConfig(source(jsonFile))) ?? {}
const formattedJson = await format(jsonText, { ...prettierConfig, filepath: source(jsonFile) })
const formattedMarkdown = await format(markdownReport(result), {
  ...((await resolveConfig(source(markdownFile))) ?? {}),
  filepath: source(markdownFile),
})

if (checkOnly) {
  const currentJson = readFileSync(source(jsonFile), 'utf8')
  const currentMarkdown = readFileSync(source(markdownFile), 'utf8')
  assert.equal(currentJson, formattedJson, `${jsonFile} is stale; rerun the generator`)
  assert.equal(currentMarkdown, formattedMarkdown, `${markdownFile} is stale; rerun the generator`)
  console.log('B2B2-A partition artifacts are deterministic and current.')
} else {
  writeFileSync(source(jsonFile), formattedJson)
  writeFileSync(source(markdownFile), formattedMarkdown)
  console.log(
    `Generated ${jsonFile} and ${markdownFile}: ${entryRequirements.length} entries, ${enforcementCohorts.length} cohorts, gate ${gate}.`,
  )
}
