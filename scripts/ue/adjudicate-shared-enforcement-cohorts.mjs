import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format as formatContent, resolveConfig as resolvePrettierConfig } from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const checkOnly = process.argv.includes('--check')
const inputFiles = {
  partition: 'docs/union-eyes/reality-remediation/PHASE_1B_2B2A_ENTRY_ENFORCEMENT_PARTITION.json',
  census: 'docs/union-eyes/reality-remediation/PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS.json',
  primitives:
    'docs/union-eyes/reality-remediation/PHASE_1B_2B1_ENFORCEMENT_PRIMITIVE_SEMANTICS.json',
}
const outputFiles = {
  json: 'docs/union-eyes/reality-remediation/PHASE_1B_2B2B1_SHARED_COHORT_ENFORCEMENT_ADJUDICATION.json',
  markdown:
    'docs/union-eyes/reality-remediation/PHASE_1B_2B2B1_SHARED_COHORT_ENFORCEMENT_ADJUDICATION.md',
}
const digest = (value) => createHash('sha256').update(value).digest('hex')
const serialize = (value) => JSON.stringify(value)
const sortedUnique = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b))
const readJson = (file) => {
  const bytes = readFileSync(path.resolve(root, ...file.split('/')))
  return { value: JSON.parse(bytes), sha256: digest(bytes) }
}
const same = (left, right) => serialize(left) === serialize(right)
const primitiveNumber = (id) => Number(id.slice('UE-B2B1-PRIMITIVE-'.length))

const { value: partition, sha256: partitionSha256 } = readJson(inputFiles.partition)
const { value: census, sha256: censusSha256 } = readJson(inputFiles.census)
const { value: primitiveRegistry, sha256: primitiveRegistrySha256 } = readJson(
  inputFiles.primitives,
)
const entries = census.ENTRIES
const requirements = partition.entryRequirements
const cohorts = partition.enforcementCohorts
const primitives = primitiveRegistry.PRIMITIVES
const censusById = new Map(entries.map((entry) => [entry.ENTRY_ID, entry]))
const requirementById = new Map(requirements.map((entry) => [entry.ENTRY_ID, entry]))
const primitiveById = new Map(primitives.map((primitive) => [primitive.PRIMITIVE_ID, primitive]))
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
const dimensions = [
  { key: requirementFields[0], name: 'IDENTITY_AUTHENTICATION' },
  { key: requirementFields[1], name: 'ORGANIZATION_MEMBERSHIP' },
  { key: requirementFields[2], name: 'ORGANIZATION_SCOPE' },
  { key: requirementFields[3], name: 'ROLE_OR_PERMISSION' },
  { key: requirementFields[4], name: 'ADMIN_SCOPE' },
  { key: requirementFields[5], name: 'RESOURCE_SCOPE' },
  { key: requirementFields[6], name: 'SYSTEM_IDENTITY' },
  { key: requirementFields[7], name: 'PROVIDER_AUTH' },
  { key: requirementFields[8], name: 'ENTITLEMENT' },
  { key: requirementFields[9], name: 'RLS_CONTEXT' },
  { key: requirementFields[10], name: 'PRIVILEGED_DB_PRECONDITION' },
]
const primitiveSymbols = new Map(
  primitives.map((primitive) => [primitiveNumber(primitive.PRIMITIVE_ID), primitive.SYMBOL]),
)
const expectedPrimitiveSymbols = new Map([
  [5, 'hasMinRole'],
  [6, 'isSystemAdmin'],
  [7, 'requireSystemAdmin'],
  [8, 'requireUser'],
  [9, 'requireUserForOrganization'],
  [10, 'requireAuth'],
  [11, 'requireAdmin'],
  [12, 'withApiAuth'],
  [13, 'withRoleAuth'],
  [14, 'withRoleAuth'],
  [15, 'withMinRole'],
  [16, 'withOrganizationAuth'],
  [17, 'withRLSContext'],
  [18, 'withSystemContext'],
  [19, 'checkEntitlement'],
  [20, 'requireEntitlement'],
])
const recordsByCohort = new Map()
for (const record of requirements) {
  if (!recordsByCohort.has(record.COHORT_ID)) recordsByCohort.set(record.COHORT_ID, [])
  recordsByCohort.get(record.COHORT_ID).push(record)
}
const sourcePathsFor = (entryIds) =>
  sortedUnique(
    entryIds
      .map((id) => censusById.get(id)?.SOURCE_FILE)
      .filter((file) => typeof file === 'string'),
  )
const compactSignatureRecord = (record) => {
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
const cohortSignatureRecord = (record, cohort) =>
  compactSignatureRecord({
    ENTRY_CLASS: record.ENTRY_CLASS,
    AUDIENCE: record.AUDIENCE,
    REQUIRED_ENFORCEMENT_CONTRACT: cohort.REQUIRED_ENFORCEMENT_CONTRACT,
    OBSERVED_ENFORCEMENT_STACK: cohort.OBSERVED_BOUNDARY_CONTRACT,
    PRIMITIVE_LINKAGE_STATUS: cohort.LINKAGE_STATUS,
  })
const cohortIntegrity = (cohort) => {
  const members = recordsByCohort.get(cohort.COHORT_ID) ?? []
  const reasons = []
  if (members.length !== cohort.ENTRY_COUNT) reasons.push('ENTRY_COUNT_MISMATCH')
  if (!same(sortedUnique(members.map((record) => record.ENTRY_ID)), cohort.ENTRY_IDS)) {
    reasons.push('MEMBER_ID_MISMATCH')
  }
  const signatures = sortedUnique(
    members.map((record) => digest(serialize(compactSignatureRecord(record)))),
  )
  const declaredSignatures = sortedUnique(members.map((record) => record.ENFORCEMENT_SIGNATURE))
  if (signatures.length !== 1 || signatures[0] !== cohort.ENFORCEMENT_SIGNATURE) {
    reasons.push('MEMBER_SIGNATURE_MISMATCH')
  }
  if (declaredSignatures.length !== 1 || declaredSignatures[0] !== cohort.ENFORCEMENT_SIGNATURE) {
    reasons.push('DECLARED_SIGNATURE_MISMATCH')
  }
  if (
    members.some(
      (record) =>
        !same(record.REQUIRED_ENFORCEMENT_CONTRACT, cohort.REQUIRED_ENFORCEMENT_CONTRACT) ||
        !same(compactSignatureRecord(record), cohortSignatureRecord(record, cohort)) ||
        record.PRIMITIVE_LINKAGE_STATUS !== cohort.LINKAGE_STATUS,
    )
  ) {
    reasons.push('CONTRACT_OR_LINKAGE_MISMATCH')
  }
  return { members, reasons: sortedUnique(reasons) }
}

assert.equal(censusSha256, partition.metadata.INPUTS.CENSUS_SHA256)
assert.equal(primitiveRegistrySha256, partition.metadata.INPUTS.PRIMITIVE_REGISTRY_SHA256)
assert.equal(primitiveRegistry.ACCEPTED_INPUT_SHA256[inputFiles.census], censusSha256)
assert.ok(
  Object.hasOwn(
    primitiveRegistry.ACCEPTED_INPUT_SHA256,
    partition.metadata.INPUTS.R2C_CARRY_FORWARD_FILE,
  ),
  'The primitive registry must retain its accepted R2C carry-forward input reference.',
)
assert.equal(primitives.length, 20)
assert.equal(
  digest(serialize(primitives)),
  partition.metadata.PRIMITIVE_ARRAY_SHA256,
  'The accepted 20-record primitive array must remain unchanged.',
)
for (const [number, symbol] of expectedPrimitiveSymbols) {
  assert.equal(primitiveSymbols.get(number), symbol, `Primitive ${number} semantics changed.`)
}
assert.equal(entries.length, 1910)
assert.equal(requirements.length, 1910)
assert.equal(new Set(entries.map((entry) => entry.ENTRY_ID)).size, 1910)
assert.equal(new Set(requirements.map((entry) => entry.ENTRY_ID)).size, 1910)
assert.equal(cohorts.length, 249)
assert.equal(partition.summary.TOTAL_ENTRIES, 1910)
assert.equal(partition.summary.TOTAL_ENFORCEMENT_COHORTS, 249)
assert.equal(partition.summary.COHORTS_ELIGIBLE_FOR_SHARED_ADJUDICATION, 124)
assert.equal(partition.summary.ENTRIES_REQUIRING_ENTRY_LOCAL_REVIEW, 700)
assert.equal(partition.summary.HISTORICAL_AUTH_EXPECTATION_RECORDS, 22)
assert.equal(partition.summary.HISTORICAL_ORG_EXPECTATION_RECORDS, 21)
assert.equal(partition.historicalPageExpectationLinkage.length, 43)
assert.equal(partition.carryForward.AUTHORITY_SOURCE_CEILING_CARRY_FORWARD, 207)
assert.equal(partition.carryForward.R2B_KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD, 3)
assert.equal(partition.carryForward.R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS, 56)
assert.equal(partition.carryForward.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD, 247)

for (const record of requirements) {
  assert.ok(censusById.has(record.ENTRY_ID), `Missing census entry ${record.ENTRY_ID}`)
  assert.ok(record.REQUIRED_ENFORCEMENT_CONTRACT)
  assert.ok(record.OBSERVED_ENFORCEMENT_STACK)
  assert.ok(record.ENFORCEMENT_SIGNATURE)
  assert.ok(record.COHORT_ID)
  assert.ok(record.REQUIRED_ENFORCEMENT_CONTRACT)
  for (const field of requirementFields) {
    assert.ok(
      Object.hasOwn(record.REQUIRED_ENFORCEMENT_CONTRACT, field),
      `${record.ENTRY_ID} is missing ${field}.`,
    )
  }
}

const directResult = (dimension, requirement, record, ids, partialIds, limitations = []) => {
  const observed = record.OBSERVED_ENFORCEMENT_STACK
  const directSignals = []
  const hasPrimitive = (...numbers) => numbers.some((number) => ids.includes(number))
  const hasPartialPrimitive = (...numbers) => numbers.some((number) => partialIds.includes(number))
  let satisfiedBy = null
  let partial = false
  let limitation = [...limitations]

  switch (dimension.name) {
    case 'IDENTITY_AUTHENTICATION':
      if (observed.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_DIRECT') {
        satisfiedBy = 'ACCEPTED_DIRECT_BOUNDARY'
        directSignals.push('AUTH_BOUNDARY_CLASS=AUTH_REQUIRED_DIRECT')
      } else if (hasPrimitive(8, 10, 13, 14, 15, 16)) {
        satisfiedBy = 'RESOLVED_PRIMITIVE_SEMANTICS'
      } else if (
        observed.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_VIA_WRAPPER' ||
        hasPrimitive(12) ||
        hasPartialPrimitive(1, 3)
      ) {
        partial = true
        limitation.push(
          'Identity resolution or optional wrapper exposure does not prove required authentication.',
        )
      }
      break
    case 'ORGANIZATION_MEMBERSHIP':
      if (hasPrimitive(9, 14, 16)) {
        satisfiedBy = 'RESOLVED_PRIMITIVE_SEMANTICS'
      } else if (
        observed.ORG_CONTEXT_CLASS === 'ORG_CONTEXT_DIRECT' ||
        hasPrimitive(4, 13, 15, 17) ||
        hasPartialPrimitive(4, 13, 15, 17)
      ) {
        partial = true
        directSignals.push(
          ...(observed.ORG_CONTEXT_CLASS === 'ORG_CONTEXT_DIRECT'
            ? ['ORG_CONTEXT_CLASS=ORG_CONTEXT_DIRECT']
            : []),
        )
        limitation.push(
          'Organization context or role checks do not by themselves establish membership.',
        )
      }
      break
    case 'ORGANIZATION_SCOPE':
      if (
        observed.ORG_CONTEXT_CLASS === 'ORG_CONTEXT_DIRECT' ||
        hasPrimitive(16, 17) ||
        hasPartialPrimitive(4, 13, 14, 15)
      ) {
        partial = true
        directSignals.push(
          ...(observed.ORG_CONTEXT_CLASS === 'ORG_CONTEXT_DIRECT'
            ? ['ORG_CONTEXT_CLASS=ORG_CONTEXT_DIRECT']
            : []),
        )
        limitation.push(
          'Organization context/RLS setup does not establish that each resource query or mutation is constrained to that organization.',
        )
      }
      break
    case 'ROLE_OR_PERMISSION':
      if (
        observed.ROLE_CHECK_CLASS === 'ROLE_CHECK_DIRECT' ||
        observed.PERMISSION_CHECK_CLASS === 'PERMISSION_CHECK_DIRECT'
      ) {
        satisfiedBy = 'ACCEPTED_DIRECT_BOUNDARY'
        if (observed.ROLE_CHECK_CLASS === 'ROLE_CHECK_DIRECT') {
          directSignals.push('ROLE_CHECK_CLASS=ROLE_CHECK_DIRECT')
        }
        if (observed.PERMISSION_CHECK_CLASS === 'PERMISSION_CHECK_DIRECT') {
          directSignals.push('PERMISSION_CHECK_CLASS=PERMISSION_CHECK_DIRECT')
        }
      } else if (hasPrimitive(5, 13, 14, 15)) {
        satisfiedBy = 'RESOLVED_PRIMITIVE_SEMANTICS'
      } else if (hasPartialPrimitive(6, 7, 11)) {
        partial = true
        limitation.push(
          'An administrative check does not establish the required role/permission contract.',
        )
      }
      break
    case 'ADMIN_SCOPE': {
      const requiredScope = requirement
      const exactSystemAdmin = requiredScope === 'SYSTEM_ADMIN' && hasPrimitive(6, 7)
      if (exactSystemAdmin) {
        satisfiedBy = 'RESOLVED_PRIMITIVE_SEMANTICS'
      } else if (
        observed.ADMIN_CHECK_CLASS === 'ADMIN_CHECK_DIRECT' ||
        hasPrimitive(6, 7, 11) ||
        hasPartialPrimitive(6, 7, 11)
      ) {
        partial = true
        if (observed.ADMIN_CHECK_CLASS === 'ADMIN_CHECK_DIRECT') {
          directSignals.push('ADMIN_CHECK_CLASS=ADMIN_CHECK_DIRECT')
        }
        limitation.push(
          `The observed administrative check does not establish the exact ${requiredScope} scope.`,
        )
      }
      break
    }
    case 'RESOURCE_SCOPE':
      if (observed.RESOURCE_CHECK_CLASS === 'RESOURCE_CHECK_DIRECT') {
        satisfiedBy = 'ACCEPTED_DIRECT_BOUNDARY'
        directSignals.push('RESOURCE_CHECK_CLASS=RESOURCE_CHECK_DIRECT')
      }
      break
    case 'SYSTEM_IDENTITY':
      if (observed.AUTH_BOUNDARY_CLASS === 'INTERNAL_TRUST_BOUNDARY') {
        satisfiedBy = 'ACCEPTED_DIRECT_BOUNDARY'
        directSignals.push('AUTH_BOUNDARY_CLASS=INTERNAL_TRUST_BOUNDARY')
      } else if (hasPrimitive(18) || hasPartialPrimitive(18)) {
        partial = true
        limitation.push(
          'A privileged database context is not evidence of the caller system identity or internal-job trust.',
        )
      }
      break
    case 'PROVIDER_AUTH':
      if (observed.AUTH_BOUNDARY_CLASS === 'PROVIDER_SIGNATURE_OR_SECRET') {
        satisfiedBy = 'ACCEPTED_DIRECT_BOUNDARY'
        directSignals.push('AUTH_BOUNDARY_CLASS=PROVIDER_SIGNATURE_OR_SECRET')
      }
      break
    case 'ENTITLEMENT':
      if (observed.ENTITLEMENT_CHECK_CLASS === 'ENTITLEMENT_CHECK_DIRECT') {
        satisfiedBy = 'ACCEPTED_DIRECT_BOUNDARY'
        directSignals.push('ENTITLEMENT_CHECK_CLASS=ENTITLEMENT_CHECK_DIRECT')
      } else if (hasPrimitive(19, 20)) {
        satisfiedBy = 'RESOLVED_PRIMITIVE_SEMANTICS'
      }
      break
    case 'RLS_CONTEXT':
      if (requirement === 'SYSTEM_BYPASS_EXPECTED') {
        if (hasPrimitive(18)) satisfiedBy = 'RESOLVED_PRIMITIVE_SEMANTICS'
        else if (observed.PRIVILEGED_DATABASE_PATH === 'WITH_SYSTEM_CONTEXT_PRIMITIVE_EXPOSURE') {
          partial = true
          limitation.push(
            'The privileged path signal does not prove a resolved system-context primitive.',
          )
        }
      } else if (observed.RLS_CONTEXT_CLASS === 'RLS_CONTEXT_DIRECT' || hasPrimitive(16, 17)) {
        satisfiedBy =
          observed.RLS_CONTEXT_CLASS === 'RLS_CONTEXT_DIRECT'
            ? 'ACCEPTED_DIRECT_BOUNDARY'
            : 'RESOLVED_PRIMITIVE_SEMANTICS'
        if (observed.RLS_CONTEXT_CLASS === 'RLS_CONTEXT_DIRECT') {
          directSignals.push('RLS_CONTEXT_CLASS=RLS_CONTEXT_DIRECT')
        }
      }
      break
    case 'PRIVILEGED_DB_PRECONDITION': {
      const hasPrivilegedContext = hasPrimitive(18)
      const hasIndependentCallerGate =
        observed.AUTH_BOUNDARY_CLASS === 'AUTH_REQUIRED_DIRECT' ||
        observed.AUTH_BOUNDARY_CLASS === 'INTERNAL_TRUST_BOUNDARY' ||
        observed.AUTH_BOUNDARY_CLASS === 'PROVIDER_SIGNATURE_OR_SECRET' ||
        observed.ADMIN_CHECK_CLASS === 'ADMIN_CHECK_DIRECT' ||
        hasPrimitive(8, 9, 10, 11, 13, 14, 15, 16)
      if (hasPrivilegedContext && hasIndependentCallerGate) {
        partial = true
        limitation.push(
          'The accepted evidence records privileged context and a separate caller gate but does not establish their invocation order before privileged access.',
        )
      } else if (
        hasPrivilegedContext ||
        observed.PRIVILEGED_DATABASE_PATH !== 'NOT_ESTABLISHED_BY_ACCEPTED_CENSUS'
      ) {
        partial = true
        limitation.push(
          'withSystemContext establishes a privileged database context, not the expected caller identity/authority precondition before entering it.',
        )
      }
      break
    }
    default:
      assert.fail(`Unhandled enforcement dimension ${dimension.name}`)
  }

  const relevantPrimitiveNumbers = {
    IDENTITY_AUTHENTICATION: [1, 3, 8, 10, 12, 13, 14, 15, 16],
    ORGANIZATION_MEMBERSHIP: [4, 9, 13, 14, 15, 16, 17],
    ORGANIZATION_SCOPE: [4, 13, 14, 15, 16, 17],
    ROLE_OR_PERMISSION: [5, 6, 7, 11, 13, 14, 15],
    ADMIN_SCOPE: [6, 7, 11],
    RESOURCE_SCOPE: [],
    SYSTEM_IDENTITY: [18],
    PROVIDER_AUTH: [],
    ENTITLEMENT: [19, 20],
    RLS_CONTEXT: [16, 17, 18],
    PRIVILEGED_DB_PRECONDITION: [8, 9, 10, 11, 13, 14, 15, 16, 18],
  }[dimension.name]
  const resolvedIds = ids
    .filter((number) => relevantPrimitiveNumbers.includes(number))
    .filter((number) => {
      const symbol = primitiveSymbols.get(number)
      return Boolean(symbol)
    })
    .map((number) => `UE-B2B1-PRIMITIVE-${String(number).padStart(3, '0')}`)
  if (satisfiedBy) {
    return {
      result: satisfiedBy,
      directSignals: sortedUnique(directSignals),
      primitiveIds: resolvedIds,
      rationale:
        satisfiedBy === 'ACCEPTED_DIRECT_BOUNDARY'
          ? 'The accepted census classifies a direct boundary for this enforcement dimension.'
          : 'An accepted primitive has explicit semantics for this enforcement dimension.',
      limitation: sortedUnique(limitation),
    }
  }
  if (partial) {
    return {
      result: 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL',
      directSignals: sortedUnique(directSignals),
      primitiveIds: resolvedIds,
      rationale:
        'Some relevant context or control semantics are observed, but the required enforcement meaning is not established.',
      limitation: sortedUnique(limitation),
    }
  }
  return {
    result: 'NO_OBSERVED_ENFORCEMENT_MISSING',
    directSignals: sortedUnique(directSignals),
    primitiveIds: resolvedIds,
    rationale:
      'No accepted direct boundary or resolved primitive establishes this required enforcement dimension.',
    limitation: [
      'This is a bounded static-source finding; it is not a runtime exploitability or product-behavior conclusion.',
    ],
  }
}

const classifyDimension = (dimension, record, ids) => {
  const requirement = record.REQUIRED_ENFORCEMENT_CONTRACT[dimension.key]
  const sourceCeilingDimensions = record.REQUIREMENT_SOURCE_CEILING_DIMENSIONS
  if (sourceCeilingDimensions.includes(dimension.key) || requirement === 'SOURCE_CEILING') {
    return {
      DIMENSION: dimension.name,
      REQUIRED_CONTRACT: requirement,
      RESULT: 'REQUIREMENT_SOURCE_CEILING',
      EVIDENCE_CLASS: 'SOURCE_CEILING',
      RESOLVED_PRIMITIVE_IDS: [],
      ACCEPTED_DIRECT_BOUNDARY_SIGNALS: [],
      OBSERVED_CONTRACT: record.OBSERVED_ENFORCEMENT_STACK,
      RATIONALE: record.REQUIREMENT_SOURCE_CEILING_REASON,
      SOURCE_LIMITATION:
        'The accepted requirement source does not establish whether this enforcement applies.',
    }
  }
  if (['NOT_REQUIRED', 'NOT_APPLICABLE'].includes(requirement)) {
    return {
      DIMENSION: dimension.name,
      REQUIRED_CONTRACT: requirement,
      RESULT: 'NOT_REQUIRED_BY_CONTRACT',
      EVIDENCE_CLASS: 'CONTRACT',
      RESOLVED_PRIMITIVE_IDS: [],
      ACCEPTED_DIRECT_BOUNDARY_SIGNALS: [],
      OBSERVED_CONTRACT: record.OBSERVED_ENFORCEMENT_STACK,
      RATIONALE: 'The accepted requirement contract does not require this enforcement dimension.',
      SOURCE_LIMITATION: null,
    }
  }
  if (requirement === 'CONTEXTUAL') {
    return {
      DIMENSION: dimension.name,
      REQUIRED_CONTRACT: requirement,
      RESULT: 'CONTEXTUAL_REQUIREMENT',
      EVIDENCE_CLASS: 'CONTRACT',
      RESOLVED_PRIMITIVE_IDS: [],
      ACCEPTED_DIRECT_BOUNDARY_SIGNALS: [],
      OBSERVED_CONTRACT: record.OBSERVED_ENFORCEMENT_STACK,
      RATIONALE:
        'The accepted requirement contract marks this dimension contextual rather than required.',
      SOURCE_LIMITATION:
        'No claim is made that the contextual dimension is enforced or unenforced.',
    }
  }
  if (record.PRIMITIVE_LINKAGE_STATUS === 'BOUNDARY_LINKAGE_SOURCE_CEILING') {
    return {
      DIMENSION: dimension.name,
      REQUIRED_CONTRACT: requirement,
      RESULT: 'BOUNDARY_LINKAGE_SOURCE_CEILING',
      EVIDENCE_CLASS: 'SOURCE_CEILING',
      RESOLVED_PRIMITIVE_IDS: [],
      ACCEPTED_DIRECT_BOUNDARY_SIGNALS: [],
      OBSERVED_CONTRACT: record.OBSERVED_ENFORCEMENT_STACK,
      RATIONALE:
        'Accepted census-to-primitive linkage is explicitly at a source ceiling for this entry.',
      SOURCE_LIMITATION:
        'No enforcement absence or runtime behavior is inferred from incomplete boundary linkage.',
    }
  }
  const assessment = directResult(dimension, requirement, record, ids, ids)
  return {
    DIMENSION: dimension.name,
    REQUIRED_CONTRACT: requirement,
    RESULT: assessment.result,
    EVIDENCE_CLASS: assessment.result,
    RESOLVED_PRIMITIVE_IDS: assessment.primitiveIds,
    ACCEPTED_DIRECT_BOUNDARY_SIGNALS: assessment.directSignals,
    OBSERVED_CONTRACT: record.OBSERVED_ENFORCEMENT_STACK,
    RATIONALE: assessment.rationale,
    SOURCE_LIMITATION: assessment.limitation.length ? assessment.limitation.join(' ') : null,
  }
}

const classifyCohort = (results) => {
  const resultSet = new Set(results.map((result) => result.RESULT))
  const hasCeiling = [...resultSet].some((result) =>
    ['REQUIREMENT_SOURCE_CEILING', 'BOUNDARY_LINKAGE_SOURCE_CEILING'].includes(result),
  )
  const hasDefect = [...resultSet].some((result) =>
    ['NO_OBSERVED_ENFORCEMENT_MISSING', 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'].includes(result),
  )
  if (hasCeiling && hasDefect) return 'MIXED_SOURCE_ENFORCEMENT_RESULT'
  if (resultSet.has('NO_OBSERVED_ENFORCEMENT_MISSING')) return 'NO_OBSERVED_ENFORCEMENT_MISSING'
  if (resultSet.has('OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL')) {
    return 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
  }
  if (resultSet.has('REQUIREMENT_SOURCE_CEILING')) return 'SOURCE_REQUIREMENT_CEILING'
  if (resultSet.has('BOUNDARY_LINKAGE_SOURCE_CEILING')) return 'SOURCE_BOUNDARY_LINKAGE_CEILING'
  return 'SOURCE_ENFORCEMENT_MATCH'
}

const dispositions = []
const deferredCohorts = []
const cohortIntegrityRecords = []
for (const cohort of cohorts) {
  const { members, reasons } = cohortIntegrity(cohort)
  const invalid = reasons.length > 0
  const sharedEligible = !cohort.REQUIRES_ENTRY_LOCAL_SOURCE_REVIEW && !invalid
  cohortIntegrityRecords.push({
    COHORT_ID: cohort.COHORT_ID,
    ENTRY_IDS: cohort.ENTRY_IDS,
    EQUIVALENCE_VALID: !invalid,
    INVALID_REASONS: reasons,
  })
  if (!sharedEligible) {
    deferredCohorts.push({
      COHORT_ID: cohort.COHORT_ID,
      ENTRY_IDS: cohort.ENTRY_IDS,
      ENTRY_COUNT: cohort.ENTRY_COUNT,
      DEFER_REASON: invalid
        ? 'INVALID_EQUIVALENCE_COHORT'
        : cohort.LINKAGE_STATUS === 'ENTRY_LOCAL_ENFORCEMENT'
          ? 'ENTRY_LOCAL_ENFORCEMENT'
          : cohort.LINKAGE_STATUS === 'BOUNDARY_LINKAGE_SOURCE_CEILING'
            ? 'BOUNDARY_LINKAGE_SOURCE_CEILING'
            : 'OTHER_EXPLICIT',
      INVALID_REASONS: reasons,
      LINKAGE_STATUS: cohort.LINKAGE_STATUS,
      REQUIREMENT_SOURCE_CEILING_DIMENSIONS: sortedUnique(
        members.flatMap((member) => member.REQUIREMENT_SOURCE_CEILING_DIMENSIONS),
      ),
      REQUIRED_SOURCE_PATHS: sourcePathsFor(cohort.ENTRY_IDS),
      REQUIRED_SOURCE_PATHS_BY_ENTRY: cohort.ENTRY_IDS.map((entryId) => ({
        ENTRY_ID: entryId,
        REQUIRED_SOURCE_PATH: censusById.get(entryId)?.SOURCE_FILE ?? null,
      })),
      REVIEW_SCOPE:
        'Review the exact entry-local source boundary and its accepted requirement/source ceilings; do not infer runtime behavior.',
    })
    continue
  }

  const record = members[0]
  const primitiveIds = cohort.PRIMITIVE_IDS.map(primitiveNumber)
  const dimensionResults = dimensions.map((dimension) =>
    classifyDimension(dimension, record, primitiveIds),
  )
  const disposition = classifyCohort(dimensionResults)
  const defectDimensions = dimensionResults.filter((result) =>
    ['NO_OBSERVED_ENFORCEMENT_MISSING', 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'].includes(
      result.RESULT,
    ),
  )
  const sourceCeilingDimensions = dimensionResults.filter((result) =>
    ['REQUIREMENT_SOURCE_CEILING', 'BOUNDARY_LINKAGE_SOURCE_CEILING'].includes(result.RESULT),
  )
  const highImpactTags = sortedUnique(members.flatMap((member) => member.HIGH_IMPACT_TAGS))
  dispositions.push({
    COHORT_ID: cohort.COHORT_ID,
    ENFORCEMENT_SIGNATURE: cohort.ENFORCEMENT_SIGNATURE,
    ENTRY_IDS: cohort.ENTRY_IDS,
    ENTRY_COUNT: cohort.ENTRY_COUNT,
    COHORT_DISPOSITION: disposition,
    REQUIRED_ENFORCEMENT_CONTRACT: cohort.REQUIRED_ENFORCEMENT_CONTRACT,
    OBSERVED_BOUNDARY_CONTRACT: cohort.OBSERVED_BOUNDARY_CONTRACT,
    RESOLVED_PRIMITIVE_IDS: cohort.PRIMITIVE_IDS,
    PRIMITIVE_LINKAGE_STATUS: cohort.LINKAGE_STATUS,
    DIMENSION_RESULTS: dimensionResults,
    KNOWN_GAP_DIMENSIONS: defectDimensions.map((result) => result.DIMENSION),
    SOURCE_CEILING_DIMENSIONS: sourceCeilingDimensions.map((result) => result.DIMENSION),
    HIGH_IMPACT_TAGS: highImpactTags,
    ACCEPTED_SOURCE_PATHS: sourcePathsFor(cohort.ENTRY_IDS),
    ASSURANCE_LIMITATION:
      'Source-level adjudication only. It does not prove runtime reachability, authorization sufficiency, RLS policy correctness, or product readiness.',
  })
}

const dispositionByCohort = new Map(dispositions.map((cohort) => [cohort.COHORT_ID, cohort]))
const deferredByCohort = new Map(deferredCohorts.map((cohort) => [cohort.COHORT_ID, cohort]))
const entryDispositions = []
const b2LocalReviewRegister = []
const sourceCeilingRegister = []
const defectRecords = []
const defectKeySet = new Set()
const sourceCeilingKeySet = new Set()

for (const record of requirements) {
  const sourceEntry = censusById.get(record.ENTRY_ID)
  const cohort = dispositionByCohort.get(record.COHORT_ID)
  if (cohort) {
    entryDispositions.push({
      ENTRY_ID: record.ENTRY_ID,
      COHORT_ID: record.COHORT_ID,
      ENTRY_DISPOSITION: cohort.COHORT_DISPOSITION,
      DIMENSION_RESULTS: cohort.DIMENSION_RESULTS,
      HIGH_IMPACT_TAGS: record.HIGH_IMPACT_TAGS,
    })
    for (const dimensionResult of cohort.DIMENSION_RESULTS) {
      if (
        ['NO_OBSERVED_ENFORCEMENT_MISSING', 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'].includes(
          dimensionResult.RESULT,
        )
      ) {
        const defectClass =
          dimensionResult.RESULT === 'NO_OBSERVED_ENFORCEMENT_MISSING'
            ? 'MISSING_ENFORCEMENT'
            : 'PARTIAL_ENFORCEMENT_SEMANTICS'
        const key = `${record.COHORT_ID}|${dimensionResult.DIMENSION}`
        if (!defectKeySet.has(key)) {
          defectKeySet.add(key)
          defectRecords.push({
            DEFECT_ID: `UE-B2B2B1-DEFECT-${digest(key).slice(0, 16)}`,
            OBJECT_ID: record.COHORT_ID,
            COHORT_ID: record.COHORT_ID,
            ENTRY_IDS: cohort.ENTRY_IDS,
            DIMENSION: dimensionResult.DIMENSION,
            DEFECT_CLASS: defectClass,
            REQUIRED_CONTRACT: dimensionResult.REQUIRED_CONTRACT,
            OBSERVED_CONTRACT: dimensionResult.OBSERVED_CONTRACT,
            ACTIVE_USAGE_EVIDENCE: {
              ENTRY_IDS: cohort.ENTRY_IDS,
              SOURCE_FILES: cohort.ACCEPTED_SOURCE_PATHS,
              ENTRY_CLASSES: sortedUnique(
                cohort.ENTRY_IDS.map((id) => requirementById.get(id).ENTRY_CLASS),
              ),
            },
            CONFIGURATION_EVIDENCE: {
              ACCEPTED_BOUNDARY_SIGNALS: dimensionResult.ACCEPTED_DIRECT_BOUNDARY_SIGNALS,
              RESOLVED_PRIMITIVE_IDS: dimensionResult.RESOLVED_PRIMITIVE_IDS,
              LINKAGE_STATUS: record.PRIMITIVE_LINKAGE_STATUS,
            },
            MIGRATION_EVIDENCE_STATUS:
              'NOT_EVALUATED_BY_B1; no migration conclusion is made from this adjudication.',
            HIGH_IMPACT_TAGS: cohort.HIGH_IMPACT_TAGS,
            EVIDENCE_LIMITATION: dimensionResult.SOURCE_LIMITATION,
          })
        }
      }
    }
    continue
  }

  const deferred = deferredByCohort.get(record.COHORT_ID)
  assert.ok(deferred, `Entry ${record.ENTRY_ID} has no shared disposition or B2 deferral.`)
  const requirementsForEntry = dimensions.map((dimension) => {
    const requirement = record.REQUIRED_ENFORCEMENT_CONTRACT[dimension.key]
    return {
      DIMENSION: dimension.name,
      REQUIRED_CONTRACT: requirement,
      RESULT:
        requirement === 'NOT_REQUIRED' || requirement === 'NOT_APPLICABLE'
          ? 'NOT_REQUIRED_BY_CONTRACT'
          : requirement === 'CONTEXTUAL'
            ? 'CONTEXTUAL_REQUIREMENT'
            : record.REQUIREMENT_SOURCE_CEILING_DIMENSIONS.includes(dimension.key) ||
                requirement === 'SOURCE_CEILING'
              ? 'REQUIREMENT_SOURCE_CEILING'
              : 'ENTRY_LOCAL_REVIEW_REQUIRED',
    }
  })
  const entrySourcePath = sourceEntry.SOURCE_FILE
  assert.equal(
    typeof entrySourcePath,
    'string',
    `Missing accepted SOURCE_FILE for ${record.ENTRY_ID}`,
  )
  const additionalReasons = []
  if (record.REQUIREMENT_SOURCE_CEILING_DIMENSIONS.length > 0) {
    additionalReasons.push('REQUIREMENT_SOURCE_CEILING')
  }
  if (record.PRIMITIVE_LINKAGE_STATUS === 'ENTRY_LOCAL_ENFORCEMENT') {
    additionalReasons.push('ENTRY_LOCAL_ENFORCEMENT')
  }
  if (record.PRIMITIVE_LINKAGE_STATUS === 'BOUNDARY_LINKAGE_SOURCE_CEILING') {
    additionalReasons.push('BOUNDARY_LINKAGE_SOURCE_CEILING')
  }
  if (deferred.INVALID_REASONS.length > 0) additionalReasons.push('INVALID_EQUIVALENCE_COHORT')
  b2LocalReviewRegister.push({
    COHORT_ID: record.COHORT_ID,
    ENTRY_ID: record.ENTRY_ID,
    ENTRY_IDS: deferred.ENTRY_IDS,
    DEFER_REASON: deferred.DEFER_REASON,
    ADDITIONAL_DEFER_REASONS: sortedUnique(
      additionalReasons.filter((reason) => reason !== deferred.DEFER_REASON),
    ),
    REQUIRED_SOURCE_PATH: entrySourcePath,
    ENTRY_CLASS: record.ENTRY_CLASS,
    AUDIENCE: record.AUDIENCE,
    ROUTE_PATTERN: sourceEntry.ROUTE_PATTERN,
    REQUIREMENT_SOURCE_CEILING_DIMENSIONS: record.REQUIREMENT_SOURCE_CEILING_DIMENSIONS,
    REQUIREMENT_SOURCE_CEILING_REASON: record.REQUIREMENT_SOURCE_CEILING_REASON,
    PRIMITIVE_LINKAGE_STATUS: record.PRIMITIVE_LINKAGE_STATUS,
    REQUIRED_ENFORCEMENT_CONTRACT: record.REQUIRED_ENFORCEMENT_CONTRACT,
    OBSERVED_BOUNDARY_CONTRACT: record.OBSERVED_ENFORCEMENT_STACK,
    DIMENSION_RESULTS: requirementsForEntry,
    HIGH_IMPACT_TAGS: record.HIGH_IMPACT_TAGS,
    REVIEW_SCOPE:
      'Entry-local source review only; no runtime authentication, database, migration, or product changes.',
  })
  entryDispositions.push({
    ENTRY_ID: record.ENTRY_ID,
    COHORT_ID: record.COHORT_ID,
    ENTRY_DISPOSITION: 'DEFERRED_TO_B2',
    DIMENSION_RESULTS: requirementsForEntry,
    HIGH_IMPACT_TAGS: record.HIGH_IMPACT_TAGS,
  })
}

for (const record of requirements) {
  for (const dimensionKey of record.REQUIREMENT_SOURCE_CEILING_DIMENSIONS) {
    const dimension = dimensions.find((item) => item.key === dimensionKey)
    assert.ok(dimension, `Unknown requirement source-ceiling dimension ${dimensionKey}`)
    const key = `${record.ENTRY_ID}|${dimension.name}|REQUIREMENT_SOURCE_CEILING`
    if (!sourceCeilingKeySet.has(key)) {
      sourceCeilingKeySet.add(key)
      sourceCeilingRegister.push({
        SOURCE_CEILING_ID: `UE-B2B2B1-CEILING-${digest(key).slice(0, 16)}`,
        OBJECT_ID: record.ENTRY_ID,
        ENTRY_ID: record.ENTRY_ID,
        COHORT_ID: record.COHORT_ID,
        DIMENSION: dimension.name,
        CEILING_CLASS: 'REQUIREMENT_SOURCE_CEILING',
        REASON: record.REQUIREMENT_SOURCE_CEILING_REASON,
        REQUIRED_SOURCE_PATH: censusById.get(record.ENTRY_ID).SOURCE_FILE,
      })
    }
  }
  if (record.PRIMITIVE_LINKAGE_STATUS === 'BOUNDARY_LINKAGE_SOURCE_CEILING') {
    const key = `${record.ENTRY_ID}|BOUNDARY_LINKAGE|BOUNDARY_LINKAGE_SOURCE_CEILING`
    if (!sourceCeilingKeySet.has(key)) {
      sourceCeilingKeySet.add(key)
      sourceCeilingRegister.push({
        SOURCE_CEILING_ID: `UE-B2B2B1-CEILING-${digest(key).slice(0, 16)}`,
        OBJECT_ID: record.ENTRY_ID,
        ENTRY_ID: record.ENTRY_ID,
        COHORT_ID: record.COHORT_ID,
        DIMENSION: 'BOUNDARY_LINKAGE',
        CEILING_CLASS: 'BOUNDARY_LINKAGE_SOURCE_CEILING',
        REASON: 'The accepted census-to-primitive linkage remains at its explicit source ceiling.',
        REQUIRED_SOURCE_PATH: censusById.get(record.ENTRY_ID).SOURCE_FILE,
      })
    }
  }
}

entryDispositions.sort((a, b) => a.ENTRY_ID.localeCompare(b.ENTRY_ID))
b2LocalReviewRegister.sort(
  (a, b) => a.COHORT_ID.localeCompare(b.COHORT_ID) || a.ENTRY_ID.localeCompare(b.ENTRY_ID),
)
sourceCeilingRegister.sort(
  (a, b) =>
    a.ENTRY_ID.localeCompare(b.ENTRY_ID) ||
    a.DIMENSION.localeCompare(b.DIMENSION) ||
    a.CEILING_CLASS.localeCompare(b.CEILING_CLASS),
)
defectRecords.sort(
  (a, b) => a.COHORT_ID.localeCompare(b.COHORT_ID) || a.DIMENSION.localeCompare(b.DIMENSION),
)
dispositions.sort((a, b) => a.COHORT_ID.localeCompare(b.COHORT_ID))
deferredCohorts.sort((a, b) => a.COHORT_ID.localeCompare(b.COHORT_ID))

const dimensionDefectSummary = dimensions.map((dimension) => {
  const records = dispositions.flatMap((cohort) =>
    cohort.DIMENSION_RESULTS.filter(
      (result) =>
        result.DIMENSION === dimension.name &&
        ['NO_OBSERVED_ENFORCEMENT_MISSING', 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'].includes(
          result.RESULT,
        ),
    ).map((result) => ({ cohort, result })),
  )
  return {
    DIMENSION: dimension.name,
    COHORTS_WITH_KNOWN_GAP: records.length,
    AFFECTED_ENTRIES: records.reduce((sum, item) => sum + item.cohort.ENTRY_COUNT, 0),
    MISSING_ENFORCEMENT_COHORTS: records.filter(
      (item) => item.result.RESULT === 'NO_OBSERVED_ENFORCEMENT_MISSING',
    ).length,
    PARTIAL_SEMANTICS_COHORTS: records.filter(
      (item) => item.result.RESULT === 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL',
    ).length,
  }
})

const dispositionCounts = Object.fromEntries(
  [
    'SOURCE_ENFORCEMENT_MATCH',
    'NO_OBSERVED_ENFORCEMENT_MISSING',
    'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL',
    'SOURCE_REQUIREMENT_CEILING',
    'SOURCE_BOUNDARY_LINKAGE_CEILING',
    'MIXED_SOURCE_ENFORCEMENT_RESULT',
  ].map((value) => [
    value,
    dispositions.filter((cohort) => cohort.COHORT_DISPOSITION === value).length,
  ]),
)
const entryStatusCounts = {
  B1_ADJUDICATED_ENTRIES: entryDispositions.filter(
    (entry) => entry.ENTRY_DISPOSITION !== 'DEFERRED_TO_B2',
  ).length,
  DEFERRED_TO_B2_ENTRIES: b2LocalReviewRegister.length,
}
const historicalExpectations = partition.historicalPageExpectationLinkage.map((expectation) => {
  const entryResults = expectation.LINKED_ENTRY_IDS.map((entryId) => {
    const entry = entryDispositions.find((item) => item.ENTRY_ID === entryId)
    return {
      ENTRY_ID: entryId,
      COHORT_ID: entry?.COHORT_ID ?? null,
      ENTRY_DISPOSITION: entry?.ENTRY_DISPOSITION ?? 'NO_B1_ENTRY_DISPOSITION',
    }
  })
  const linkedCohorts = sortedUnique(
    [...expectation.LINKED_COHORT_IDS, ...entryResults.map((item) => item.COHORT_ID)].filter(
      Boolean,
    ),
  )
  const linkedDispositions = entryResults.map((item) => item.ENTRY_DISPOSITION)
  const hasDeferred = linkedDispositions.includes('DEFERRED_TO_B2')
  const hasCeiling = linkedCohorts.some((cohortId) => {
    const cohort = dispositionByCohort.get(cohortId)
    return (
      cohort &&
      [
        'SOURCE_REQUIREMENT_CEILING',
        'SOURCE_BOUNDARY_LINKAGE_CEILING',
        'MIXED_SOURCE_ENFORCEMENT_RESULT',
      ].includes(cohort.COHORT_DISPOSITION)
    )
  })
  const hasGap = linkedCohorts.some((cohortId) => {
    const cohort = dispositionByCohort.get(cohortId)
    return (
      cohort &&
      ['NO_OBSERVED_ENFORCEMENT_MISSING', 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'].includes(
        cohort.COHORT_DISPOSITION,
      )
    )
  })
  const status =
    hasDeferred || linkedDispositions.includes('NO_B1_ENTRY_DISPOSITION')
      ? 'B2_LOCAL_REVIEW_REQUIRED'
      : hasCeiling || entryResults.length === 0
        ? 'SOURCE_CEILING'
        : hasGap
          ? 'KNOWN_ENFORCEMENT_GAP'
          : 'ALL_LINKED_ENTRIES_MATCH'
  return {
    ...expectation,
    B1_STATUS: status,
    ORIGINAL_EXPECTATION_CLOSED: 'NO',
    B1_LINKED_ENTRY_DISPOSITIONS: entryResults,
    B1_LINKED_COHORT_DISPOSITIONS: linkedCohorts.map((cohortId) => ({
      COHORT_ID: cohortId,
      COHORT_DISPOSITION: dispositionByCohort.get(cohortId)?.COHORT_DISPOSITION ?? 'DEFERRED_TO_B2',
    })),
    STATUS_LIMITATION:
      entryResults.length === 0
        ? 'No B1-linked server entry was present in the accepted linkage; this historical expectation remains open and is retained at source ceiling.'
        : 'B1 dispositions annotate linked entries/cohorts only and do not close the historical expectation.',
  }
})
const historicalStatusCounts = Object.fromEntries(
  [
    'ALL_LINKED_ENTRIES_MATCH',
    'KNOWN_ENFORCEMENT_GAP',
    'SOURCE_CEILING',
    'B2_LOCAL_REVIEW_REQUIRED',
  ].map((status) => [
    status,
    historicalExpectations.filter((expectation) => expectation.B1_STATUS === status).length,
  ]),
)

const b2ReasonsByCohort = new Map()
for (const entry of b2LocalReviewRegister) {
  if (!b2ReasonsByCohort.has(entry.COHORT_ID))
    b2ReasonsByCohort.set(entry.COHORT_ID, entry.DEFER_REASON)
}
const cohortDispositionRegister = cohorts.map((cohort) => {
  const adjudication = dispositionByCohort.get(cohort.COHORT_ID)
  const deferred = deferredByCohort.get(cohort.COHORT_ID)
  return adjudication
    ? {
        COHORT_ID: cohort.COHORT_ID,
        ENTRY_IDS: cohort.ENTRY_IDS,
        COHORT_ADJUDICATION_STATUS: 'SHARED_ADJUDICATED',
        COHORT_DISPOSITION: adjudication.COHORT_DISPOSITION,
      }
    : {
        COHORT_ID: cohort.COHORT_ID,
        ENTRY_IDS: cohort.ENTRY_IDS,
        COHORT_ADJUDICATION_STATUS: 'DEFERRED_TO_B2',
        DEFER_REASON: b2ReasonsByCohort.get(cohort.COHORT_ID) ?? deferred?.DEFER_REASON,
        INVALID_REASONS: deferred?.INVALID_REASONS ?? [],
      }
})
const sourceCeilingEntryCount = sortedUnique(
  sourceCeilingRegister.map((item) => item.ENTRY_ID),
).length
const gate =
  b2LocalReviewRegister.length > 0 || sourceCeilingRegister.length > 0
    ? 'SOURCE_CEILING'
    : defectRecords.length > 0
      ? 'KNOWN_ENFORCEMENT_GAPS'
      : 'PASS'
const report = {
  metadata: {
    PHASE: 'PHASE_1B_2B2_B1_SHARED_COHORT_SOURCE_ENFORCEMENT_ADJUDICATION',
    METHOD: 'ACCEPTED_PARTITION_CENSUS_AND_FROZEN_PRIMITIVE_REGISTRY_ONLY',
    INPUTS: {
      B2B2A_PARTITION_FILE: inputFiles.partition,
      B2B2A_PARTITION_SHA256: partitionSha256,
      CENSUS_FILE: inputFiles.census,
      CENSUS_SHA256: censusSha256,
      PRIMITIVE_REGISTRY_FILE: inputFiles.primitives,
      PRIMITIVE_REGISTRY_SHA256: primitiveRegistrySha256,
      PRIMITIVE_ARRAY_SHA256: digest(serialize(primitives)),
    },
    NO_APPLICATION_SOURCE_NEWLY_INSPECTED: 'YES',
    NO_RUNTIME_DATABASE_INSPECTED: 'YES',
    NO_MIGRATION_EXECUTED: 'YES',
    NO_DATABASE_WRITE_EXECUTED: 'YES',
    B2_STARTED: 'NO',
  },
  gate: {
    PHASE_1B_2B2_B1_GATE: gate,
    PHASE_1B_2B2_B1: 'SOURCE_CEILING_ACCEPTED',
    AUTHORIZATION_CORRECTNESS_PROVEN: 'NO',
    ORGANIZATION_SCOPE_ENFORCEMENT_PROVEN: 'NO',
    RESOURCE_AUTHORIZATION_PROVEN: 'NO',
    RLS_CORRECTNESS_PROVEN: 'NO',
    PRODUCT_READY: 'NO',
  },
  denominators: {
    INPUT_ENTRY_REQUIREMENTS: requirements.length,
    UNIQUE_INPUT_ENTRY_IDS: new Set(requirements.map((record) => record.ENTRY_ID)).size,
    INPUT_COHORTS: cohorts.length,
    SHARED_ADJUDICATION_COHORTS_IN_ACCEPTED_PARTITION: cohorts.filter(
      (cohort) => !cohort.REQUIRES_ENTRY_LOCAL_SOURCE_REVIEW,
    ).length,
    SHARED_ADJUDICATION_ENTRIES_IN_ACCEPTED_PARTITION: cohorts
      .filter((cohort) => !cohort.REQUIRES_ENTRY_LOCAL_SOURCE_REVIEW)
      .reduce((sum, cohort) => sum + cohort.ENTRY_COUNT, 0),
    ENTRY_LOCAL_REVIEW_COHORTS_IN_ACCEPTED_PARTITION: cohorts.filter(
      (cohort) => cohort.REQUIRES_ENTRY_LOCAL_SOURCE_REVIEW,
    ).length,
    ENTRY_LOCAL_REVIEW_ENTRIES_IN_ACCEPTED_PARTITION: cohorts
      .filter((cohort) => cohort.REQUIRES_ENTRY_LOCAL_SOURCE_REVIEW)
      .reduce((sum, cohort) => sum + cohort.ENTRY_COUNT, 0),
    ACTUALLY_SHARED_ADJUDICATED_COHORTS: dispositions.length,
    ACTUALLY_SHARED_ADJUDICATED_ENTRIES: entryStatusCounts.B1_ADJUDICATED_ENTRIES,
    B2_LOCAL_REVIEW_COHORTS: deferredCohorts.length,
    B2_LOCAL_REVIEW_ENTRIES: b2LocalReviewRegister.length,
    HISTORICAL_PAGE_EXPECTATIONS: historicalExpectations.length,
    REQUIREMENT_SOURCE_CEILING_ENTRIES: partition.summary.ENTRIES_WITH_REQUIREMENT_SOURCE_CEILING,
    REQUIREMENT_SOURCE_CEILING_DIMENSION_RECORDS:
      partition.summary.REQUIREMENT_SOURCE_CEILING_DIMENSION_RECORDS,
    BOUNDARY_LINKAGE_SOURCE_CEILING_ENTRIES:
      partition.summary.PRIMITIVE_LINKAGE_COUNTS.BOUNDARY_LINKAGE_SOURCE_CEILING,
    SOURCE_CEILING_REGISTER_ENTRIES: sourceCeilingEntryCount,
    SOURCE_CEILING_REGISTER_RECORDS: sourceCeilingRegister.length,
  },
  adjudicationConvention: {
    DIMENSIONS: dimensions.map((dimension) => dimension.name),
    COHORT_DISPOSITIONS: [
      'SOURCE_ENFORCEMENT_MATCH',
      'NO_OBSERVED_ENFORCEMENT_MISSING',
      'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL',
      'SOURCE_REQUIREMENT_CEILING',
      'SOURCE_BOUNDARY_LINKAGE_CEILING',
      'MIXED_SOURCE_ENFORCEMENT_RESULT',
    ],
    DIMENSION_RESULTS: [
      'RESOLVED_PRIMITIVE_SEMANTICS',
      'ACCEPTED_DIRECT_BOUNDARY',
      'NOT_REQUIRED_BY_CONTRACT',
      'CONTEXTUAL_REQUIREMENT',
      'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL',
      'NO_OBSERVED_ENFORCEMENT_MISSING',
      'REQUIREMENT_SOURCE_CEILING',
      'BOUNDARY_LINKAGE_SOURCE_CEILING',
      'ENTRY_LOCAL_REVIEW_REQUIRED',
    ],
    INTERPRETATION:
      'Primitive exposure alone does not prove complete wrapper composition or runtime reachability. Organization context is not membership or resource scope. Entitlement is not authorization. RLS context setup is not RLS policy correctness. Privileged DB context is not proof of a caller precondition or its invocation order.',
  },
  cohortIntegrity: {
    CHECKED_COHORTS: cohortIntegrityRecords.length,
    VALID_COHORTS: cohortIntegrityRecords.filter((record) => record.EQUIVALENCE_VALID).length,
    INVALID_COHORTS: cohortIntegrityRecords.filter((record) => !record.EQUIVALENCE_VALID).length,
    RECORDS: cohortIntegrityRecords,
  },
  cohortDispositionRegister,
  sharedCohortAdjudications: dispositions,
  entryDispositions,
  dimensionLevelDefectSummary: dimensionDefectSummary,
  knownEnforcementDefects: defectRecords,
  sourceCeilings: sourceCeilingRegister,
  b2LocalReviewRegister,
  historicalPageExpectations: {
    EXPECTATIONS_REMAIN_OPEN: 'YES',
    STATUS_COUNTS: historicalStatusCounts,
    RECORDS: historicalExpectations,
  },
  priorPhasePreservation: {
    R2B_INPUT_AUTHORITY_OBJECTS: partition.carryForward.AUTHORITY_SOURCE_CEILING_CARRY_FORWARD,
    R2B_SOURCE_CEILING_UNKNOWN_AUTHORITY:
      partition.carryForward.AUTHORITY_SOURCE_CEILING_CARRY_FORWARD,
    R2B_KNOWN_CONFIGURED_SCHEMA_MISMATCH_OBJECTS:
      partition.carryForward.R2B_KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD,
    R2C_TARGETLESS_DATABASE_EFFECTS:
      partition.carryForward.R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS,
    R2C_RESOLVED_TARGET_CHAINS: partition.carryForward.R2C_RESOLVED_TARGET_CHAINS,
    R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD:
      partition.carryForward.TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD,
    FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD:
      partition.carryForward.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD,
    HISTORICAL_AUTH_EXPECTATIONS: partition.summary.HISTORICAL_AUTH_EXPECTATION_RECORDS,
    HISTORICAL_ORG_EXPECTATIONS: partition.summary.HISTORICAL_ORG_EXPECTATION_RECORDS,
    ACCEPTED_PRIMITIVE_SEMANTICS: primitives.length,
    ACCEPTED_PRIMITIVE_ARRAY_SHA256: digest(serialize(primitives)),
  },
  phaseState: {
    PHASE_1B_2B2_B1: 'SOURCE_CEILING_ACCEPTED',
    SHARED_COHORT_UNIVERSE: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
    SHARED_COHORTS_REQUIRING_ADJUDICATION_REMAINING: 0,
    B2_ENTRY_LOCAL_REVIEW: 'AUTHORIZED_NOT_STARTED',
    B2_LOCAL_REVIEW_ENTRIES_REMAINING: b2LocalReviewRegister.length,
    PHASE_1B_2: 'NOT_YET_COMPLETE',
    PHASE_1B_3: 'NOT_AUTHORIZED',
    PHASE_1C: 'NOT_AUTHORIZED',
    PHASE_1D: 'NOT_AUTHORIZED',
    PHASE_2: 'NOT_AUTHORIZED',
  },
  validation: {
    ALL_1910_INPUT_ENTRIES_ACCOUNTED_FOR_EXACTLY_ONCE:
      entryDispositions.length === 1910 &&
      new Set(entryDispositions.map((record) => record.ENTRY_ID)).size === 1910,
    ALL_249_COHORTS_ACCOUNTED_FOR_EXACTLY_ONCE:
      cohortDispositionRegister.length === 249 &&
      new Set(cohortDispositionRegister.map((record) => record.COHORT_ID)).size === 249,
    ALL_SHARED_ADJUDICATED_ENTRIES_PROPAGATE_COHORT_RESULTS: entryDispositions
      .filter((record) => record.ENTRY_DISPOSITION !== 'DEFERRED_TO_B2')
      .every((entry) =>
        same(entry.DIMENSION_RESULTS, dispositionByCohort.get(entry.COHORT_ID).DIMENSION_RESULTS),
      ),
    B2_REGISTER_HAS_ONE_FINITE_ACCEPTED_SOURCE_PATH_PER_ENTRY:
      b2LocalReviewRegister.length ===
        b2LocalReviewRegister.filter(
          (entry) =>
            typeof entry.REQUIRED_SOURCE_PATH === 'string' && entry.REQUIRED_SOURCE_PATH.length > 0,
        ).length &&
      new Set(b2LocalReviewRegister.map((entry) => entry.ENTRY_ID)).size ===
        b2LocalReviewRegister.length,
    HISTORICAL_EXPECTATION_COUNTS_SUM_TO_43:
      Object.values(historicalStatusCounts).reduce((sum, count) => sum + count, 0) === 43,
    ALL_HISTORICAL_EXPECTATIONS_REMAIN_OPEN: historicalExpectations.every(
      (expectation) => expectation.ORIGINAL_EXPECTATION_CLOSED === 'NO',
    ),
    ALL_20_ACCEPTED_PRIMITIVE_RECORDS_PRESERVED:
      primitives.length === 20 &&
      digest(serialize(primitives)) === partition.metadata.PRIMITIVE_ARRAY_SHA256,
    FROZEN_B2B2A_INPUTS_READ_ONLY: 'YES',
    NO_APPLICATION_SOURCE_NEWLY_INSPECTED: 'YES',
    NO_RUNTIME_DATABASE_INSPECTED: 'YES',
    NO_MIGRATION_EXECUTED: 'YES',
    NO_DATABASE_WRITE_EXECUTED: 'YES',
    B2_NOT_STARTED: 'YES',
  },
}

assert.equal(report.validation.ALL_1910_INPUT_ENTRIES_ACCOUNTED_FOR_EXACTLY_ONCE, true)
assert.equal(report.validation.ALL_249_COHORTS_ACCOUNTED_FOR_EXACTLY_ONCE, true)
assert.equal(report.validation.ALL_SHARED_ADJUDICATED_ENTRIES_PROPAGATE_COHORT_RESULTS, true)
assert.equal(report.validation.B2_REGISTER_HAS_ONE_FINITE_ACCEPTED_SOURCE_PATH_PER_ENTRY, true)
assert.equal(report.validation.HISTORICAL_EXPECTATION_COUNTS_SUM_TO_43, true)
assert.equal(report.validation.ALL_HISTORICAL_EXPECTATIONS_REMAIN_OPEN, true)
assert.equal(report.validation.ALL_20_ACCEPTED_PRIMITIVE_RECORDS_PRESERVED, true)
assert.equal(entryStatusCounts.B1_ADJUDICATED_ENTRIES + b2LocalReviewRegister.length, 1910)

const markdown = `# Phase 1B.2b2-B1 — Shared-Cohort Source-Enforcement Adjudication

## Gate and state

- **PHASE_1B_2B2_B1_GATE:** \`${gate}\`
- **PHASE_1B_2B2_B1:** \`SOURCE_CEILING_ACCEPTED\`
- **Phase 1B.2:** \`NOT_YET_COMPLETE\`
- **B2 entry-local review:** \`AUTHORIZED_NOT_STARTED\`
- **B2 started:** \`NO\`
- **Runtime authorization, organization/resource scope, RLS correctness, and product readiness proven:** \`NO\`

The source ceiling means this report adjudicates only the shared cohorts supported by the accepted static evidence. It does not imply an entry is absent, unused, runtime-broken, or exploitable.

## Frozen denominators

| Measure | Count |
|---|---:|
| Accepted entries | ${requirements.length} |
| Accepted cohorts | ${cohorts.length} |
| Shared-adjudication cohorts in the frozen partition | ${report.denominators.SHARED_ADJUDICATION_COHORTS_IN_ACCEPTED_PARTITION} |
| Shared-adjudication entries in the frozen partition | ${report.denominators.SHARED_ADJUDICATION_ENTRIES_IN_ACCEPTED_PARTITION} |
| Entry-local cohorts in the frozen partition | ${report.denominators.ENTRY_LOCAL_REVIEW_COHORTS_IN_ACCEPTED_PARTITION} |
| Entry-local entries in the frozen partition | ${report.denominators.ENTRY_LOCAL_REVIEW_ENTRIES_IN_ACCEPTED_PARTITION} |
| Cohorts actually adjudicated after equivalence validation | ${dispositions.length} |
| Entries deferred to B2 | ${b2LocalReviewRegister.length} |
| Historical page expectations retained open | ${historicalExpectations.length} |

## Shared cohort dispositions

| Disposition | Cohorts |
|---|---:|
${Object.entries(dispositionCounts)
  .map(([name, count]) => `| \`${name}\` | ${count} |`)
  .join('\n')}

## Dimension-level known gaps

| Dimension | Cohorts with gap | Affected entries | Missing | Partial |
|---|---:|---:|---:|---:|
${dimensionDefectSummary
  .map(
    (item) =>
      `| ${item.DIMENSION} | ${item.COHORTS_WITH_KNOWN_GAP} | ${item.AFFECTED_ENTRIES} | ${item.MISSING_ENFORCEMENT_COHORTS} | ${item.PARTIAL_SEMANTICS_COHORTS} |`,
  )
  .join('\n')}

Known gaps are bounded findings about the accepted source contracts. A partial semantic signal is not reported as complete enforcement. A direct organization-context signal is not treated as organization membership or as a resource/query predicate. Entitlement checks are not treated as authorization. RLS context setup does not establish RLS policy correctness. Privileged DB context does not establish the expected caller precondition or its order.

## Source ceilings and B2 review

- Requirement source-ceiling entries: ${report.denominators.REQUIREMENT_SOURCE_CEILING_ENTRIES} (${report.denominators.REQUIREMENT_SOURCE_CEILING_DIMENSION_RECORDS} dimension records).
- Boundary-linkage source-ceiling entries: ${report.denominators.BOUNDARY_LINKAGE_SOURCE_CEILING_ENTRIES}.
- Source-ceiling register records: ${sourceCeilingRegister.length}.
- B2 local-review register: ${b2LocalReviewRegister.length} exact entries across ${deferredCohorts.length} cohorts.
- Each B2 register entry names the \`SOURCE_FILE\` already present in the accepted census as \`REQUIRED_SOURCE_PATH\`.
- No B2 review was started.

## Historical page expectations (not closed)

| B1 annotation | Expectations |
|---|---:|
${Object.entries(historicalStatusCounts)
  .map(([name, count]) => `| \`${name}\` | ${count} |`)
  .join('\n')}

No historical expectation has a linked B1 entry or cohort in the accepted partition; each is therefore annotated at source ceiling. These annotations leave all 43 expectations open and do not close them.

## Preserved phase carry-forwards

- R2B authority source ceilings: ${report.priorPhasePreservation.R2B_SOURCE_CEILING_UNKNOWN_AUTHORITY}.
- R2B known authority/configuration defects: ${report.priorPhasePreservation.R2B_KNOWN_CONFIGURED_SCHEMA_MISMATCH_OBJECTS}.
- R2C targetless database effects: ${report.priorPhasePreservation.R2C_TARGETLESS_DATABASE_EFFECTS}; resolved target chains: ${report.priorPhasePreservation.R2C_RESOLVED_TARGET_CHAINS}; target-resolution source-ceiling carry-forward: ${report.priorPhasePreservation.R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD}.
- Frozen Phase 1A unknown-effect carry-forward: ${report.priorPhasePreservation.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD}.
- Accepted primitive semantics: ${report.priorPhasePreservation.ACCEPTED_PRIMITIVE_SEMANTICS}; array SHA-256: \`${report.priorPhasePreservation.ACCEPTED_PRIMITIVE_ARRAY_SHA256}\`.

## Validation and scope

- Exact-once entry accounting across B1 adjudications and B2 deferrals: **${report.validation.ALL_1910_INPUT_ENTRIES_ACCOUNTED_FOR_EXACTLY_ONCE ? 'PASS' : 'FAIL'}**.
- Exact-once cohort accounting: **${report.validation.ALL_249_COHORTS_ACCOUNTED_FOR_EXACTLY_ONCE ? 'PASS' : 'FAIL'}**.
- Cohort results propagated to every adjudicated member: **${report.validation.ALL_SHARED_ADJUDICATED_ENTRIES_PROPAGATE_COHORT_RESULTS ? 'PASS' : 'FAIL'}**.
- Finite census source path recorded for every B2 entry: **${report.validation.B2_REGISTER_HAS_ONE_FINITE_ACCEPTED_SOURCE_PATH_PER_ENTRY ? 'PASS' : 'FAIL'}**.
- Historical expectation status counts sum to 43 and all remain open: **${report.validation.HISTORICAL_EXPECTATION_COUNTS_SUM_TO_43 && report.validation.ALL_HISTORICAL_EXPECTATIONS_REMAIN_OPEN ? 'PASS' : 'FAIL'}**.
- Frozen 20-primitive array preserved: **${report.validation.ALL_20_ACCEPTED_PRIMITIVE_RECORDS_PRESERVED ? 'PASS' : 'FAIL'}**.
- No new application source or runtime database inspection, migration, or database write: **YES**.
- B2 started: **NO**.

Machine-readable cohort results, entry dispositions, defect/ceiling registers, historical linkage, and validation assertions are in [the JSON report](./PHASE_1B_2B2B1_SHARED_COHORT_ENFORCEMENT_ADJUDICATION.json).
`

for (const [format, file] of Object.entries(outputFiles)) {
  const absolutePath = path.resolve(root, ...file.split('/'))
  const rawContent = format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : markdown
  const prettierConfig = (await resolvePrettierConfig(absolutePath)) ?? {}
  const content = await formatContent(rawContent, {
    ...prettierConfig,
    filepath: absolutePath,
  })
  if (checkOnly) {
    assert.equal(readFileSync(absolutePath, 'utf8'), content, `${file} is stale; regenerate it.`)
  } else {
    writeFileSync(absolutePath, content)
  }
}

console.log(
  `${checkOnly ? 'Checked' : 'Generated'} B1 adjudication: ${dispositions.length} shared cohorts, ${entryStatusCounts.B1_ADJUDICATED_ENTRIES} adjudicated entries, ${b2LocalReviewRegister.length} B2 entries, gate ${gate}.`,
)
