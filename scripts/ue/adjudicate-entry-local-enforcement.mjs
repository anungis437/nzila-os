import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format as formatContent, resolveConfig as resolvePrettierConfig } from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const checkOnly = process.argv.includes('--check')
const inputFiles = {
  evidence:
    'docs/union-eyes/reality-remediation/PHASE_1B_2B2B2A_ENTRY_LOCAL_ENFORCEMENT_EVIDENCE.json',
  b1: 'docs/union-eyes/reality-remediation/PHASE_1B_2B2B1_SHARED_COHORT_ENFORCEMENT_ADJUDICATION.json',
  partition: 'docs/union-eyes/reality-remediation/PHASE_1B_2B2A_ENTRY_ENFORCEMENT_PARTITION.json',
  primitives:
    'docs/union-eyes/reality-remediation/PHASE_1B_2B1_ENFORCEMENT_PRIMITIVE_SEMANTICS.json',
}
const outputFiles = {
  json: 'docs/union-eyes/reality-remediation/PHASE_1B_2B2B2B_ENTRY_LOCAL_ENFORCEMENT_ADJUDICATION.json',
  markdown:
    'docs/union-eyes/reality-remediation/PHASE_1B_2B2B2B_ENTRY_LOCAL_ENFORCEMENT_ADJUDICATION.md',
}
const digest = (value) => createHash('sha256').update(value).digest('hex')
const serialize = (value) => JSON.stringify(value)
const sortedUnique = (values) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right))
const readJson = (file) => {
  const bytes = readFileSync(path.resolve(root, ...file.split('/')))
  return { value: JSON.parse(bytes), sha256: digest(bytes) }
}
const primitiveNumber = (id) => Number(id.match(/PRIMITIVE-(\d{3})$/)?.[1])
const formatJson = async (value, file) =>
  formatContent(`${JSON.stringify(value, null, 2)}\n`, {
    ...(await resolvePrettierConfig(path.resolve(root, ...file.split('/')))),
    filepath: path.resolve(root, ...file.split('/')),
  })
const formatMarkdown = async (value, file) =>
  formatContent(`${value.trimEnd()}\n`, {
    ...(await resolvePrettierConfig(path.resolve(root, ...file.split('/')))),
    filepath: path.resolve(root, ...file.split('/')),
  })

const { value: evidence, sha256: evidenceSha256 } = readJson(inputFiles.evidence)
const { value: b1, sha256: b1Sha256 } = readJson(inputFiles.b1)
const { value: partition, sha256: partitionSha256 } = readJson(inputFiles.partition)
const { value: primitiveRegistry, sha256: primitiveRegistrySha256 } = readJson(
  inputFiles.primitives,
)

const dimensions = [
  { key: 'IDENTITY_AUTHENTICATION_REQUIRED', name: 'IDENTITY_AUTHENTICATION' },
  { key: 'ORGANIZATION_MEMBERSHIP_REQUIRED', name: 'ORGANIZATION_MEMBERSHIP' },
  { key: 'ORGANIZATION_SCOPE_REQUIRED', name: 'ORGANIZATION_SCOPE' },
  { key: 'ROLE_OR_PERMISSION_REQUIRED', name: 'ROLE_OR_PERMISSION' },
  { key: 'ADMIN_SCOPE_REQUIRED', name: 'ADMIN_SCOPE' },
  { key: 'RESOURCE_SCOPE_REQUIRED', name: 'RESOURCE_SCOPE' },
  { key: 'SYSTEM_IDENTITY_REQUIRED', name: 'SYSTEM_IDENTITY' },
  { key: 'PROVIDER_AUTH_REQUIRED', name: 'PROVIDER_AUTH' },
  { key: 'ENTITLEMENT_REQUIRED', name: 'ENTITLEMENT' },
  { key: 'RLS_CONTEXT_EXPECTED', name: 'RLS_CONTEXT' },
  { key: 'PRIVILEGED_DB_PRECONDITION_REQUIRED', name: 'PRIVILEGED_DB_PRECONDITION' },
]
const primitives = primitiveRegistry.PRIMITIVES
const primitiveById = new Map(primitives.map((primitive) => [primitive.PRIMITIVE_ID, primitive]))
const b2EntryIds = new Set(evidence.entryEvidence.map((entry) => entry.ENTRY_ID))
const b1DeferredIds = new Set(
  b1.entryDispositions
    .filter((entry) => entry.ENTRY_DISPOSITION === 'DEFERRED_TO_B2')
    .map((entry) => entry.ENTRY_ID),
)
const dimensionsByEvidence = Object.keys(evidence.entryEvidence[0]?.DIMENSION_EVIDENCE ?? {})
const priorB1Records = b1.entryDispositions.filter((entry) => !b1DeferredIds.has(entry.ENTRY_ID))
const priorB1RecordsSha256 = digest(serialize(priorB1Records))
const priorDefectsSha256 = digest(serialize(b1.knownEnforcementDefects))
const priorSourceCeilingsSha256 = digest(serialize(b1.sourceCeilings))
const priorHistoricalSha256 = digest(serialize(b1.historicalPageExpectations))

assert.equal(evidence.gate.PHASE_1B_2B2_B2B, 'AUTHORIZED')
assert.equal(evidence.gate.PHASE_1B_2B2_B2B_STARTED, 'NO')
assert.equal(evidence.denominators.INPUT_LOCAL_REVIEW_ENTRIES, 700)
assert.equal(evidence.denominators.UNIQUE_ENTRY_IDS, 700)
assert.equal(evidence.denominators.INPUT_LOCAL_REVIEW_COHORTS, 125)
assert.equal(evidence.denominators.AUTHORIZED_SOURCE_PATHS, 423)
assert.equal(evidence.denominators.CENSUS_HASH_MATCHED_SOURCE_SLICES, 700)
assert.equal(evidence.entryEvidence.length, 700)
assert.equal(b2EntryIds.size, 700)
assert.equal(b1.entryDispositions.length, 1910)
assert.equal(new Set(b1.entryDispositions.map((entry) => entry.ENTRY_ID)).size, 1910)
assert.equal(priorB1Records.length, 1210)
assert.equal(b1DeferredIds.size, 700)
assert.deepEqual([...b2EntryIds].sort(), [...b1DeferredIds].sort())
assert.equal(b1.knownEnforcementDefects.length, 215)
assert.equal(b1.sourceCeilings.length, 825)
assert.equal(b1.historicalPageExpectations.RECORDS.length, 43)
assert.equal(partition.carryForward.AUTHORITY_SOURCE_CEILING_CARRY_FORWARD, 207)
assert.equal(partition.carryForward.R2B_KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD, 3)
assert.equal(partition.carryForward.R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS, 56)
assert.equal(partition.carryForward.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD, 247)
assert.equal(primitives.length, 20)
assert.equal(
  digest(serialize(primitives)),
  evidence.frozenCarryForwards.ACCEPTED_PRIMITIVE_ARRAY_SHA256,
)
assert.deepEqual(
  sortedUnique(dimensionsByEvidence),
  sortedUnique(dimensions.map((dim) => dim.name)),
)

const relevantPrimitiveNumbers = {
  IDENTITY_AUTHENTICATION: [1, 2, 3, 8, 10, 12, 13, 14, 15, 16],
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
}

const getDirectPrimitiveIds = (dimensionEvidence) => {
  const called = new Set(dimensionEvidence.DIRECT_HELPER_CALLS_OBSERVED_IN_BOUNDED_SLICE)
  return sortedUnique(
    dimensionEvidence.LINKED_HELPER_SOURCE_SLICE_IDS.flatMap((sliceId) => {
      const match = sliceId.match(/HELPER-(UE-B2B1-PRIMITIVE-\d{3})$/)
      if (!match) return []
      const primitiveId = match[1]
      const primitive = primitiveById.get(primitiveId)
      return primitive && called.has(primitive.SYMBOL) ? [primitiveId] : []
    }),
  )
}

const contextualBranchObserved = (name, dimEvidence, entry) => {
  const directCalls = dimEvidence.DIRECT_HELPER_CALLS_OBSERVED_IN_BOUNDED_SLICE
  const helperSymbols = dimEvidence.HELPER_SYMBOLS_PRESENT_IN_BOUNDED_SLICE
  const hasAny = (values) =>
    values.some((value) => directCalls.includes(value) || helperSymbols.includes(value))
  switch (name) {
    case 'IDENTITY_AUTHENTICATION':
      return hasAny([
        'auth',
        'currentUser',
        'getCurrentUser',
        'requireUser',
        'requireAuth',
        'withApiAuth',
        'withRoleAuth',
      ])
    case 'ORGANIZATION_MEMBERSHIP':
      return hasAny([
        'getOrganizationIdForUser',
        'requireUserForOrganization',
        'withOrganizationAuth',
      ])
    case 'ORGANIZATION_SCOPE':
      return (
        hasAny([
          'getOrganizationIdForUser',
          'requireUserForOrganization',
          'withOrganizationAuth',
          'withRLSContext',
        ]) ||
        ['organizationId', 'orgId', 'tenantId'].some((symbol) => helperSymbols.includes(symbol))
      )
    case 'ROLE_OR_PERMISSION':
      return hasAny(['hasMinRole', 'canAccess', 'withRoleAuth', 'withMinRole'])
    case 'ADMIN_SCOPE':
      return hasAny(['isAdmin', 'isSystemAdmin', 'requireAdmin', 'requireSystemAdmin'])
    case 'RESOURCE_SCOPE':
      return (
        hasAny(['ownerId', 'resourceId', 'resourceOwnerId']) ||
        entry.SOURCE_SLICE.CALLER_CONTROLLED_SELECTOR_EVIDENCE.some((fact) =>
          /(?:case|matter|resource|record|run|member|owner|organization|org).*id|id.*(?:case|matter|resource|record|run|member|owner)/i.test(
            fact.SYMBOL_OR_TOKEN,
          ),
        )
      )
    case 'SYSTEM_IDENTITY':
      return hasAny([
        'withSystemContext',
        'isSystemAdmin',
        'requireSystemAdmin',
        'isAdmin',
        'requireAdmin',
      ])
    case 'PROVIDER_AUTH':
      return entry.SOURCE_SLICE.CALLER_CONTROLLED_SELECTOR_EVIDENCE.some((fact) =>
        /headers|signature|hmac|webhook/i.test(fact.SYMBOL_OR_TOKEN),
      )
    case 'ENTITLEMENT':
      return hasAny(['checkEntitlement', 'requireEntitlement'])
    case 'RLS_CONTEXT':
      return hasAny(['withRLSContext', 'withOrganizationAuth', 'withSystemContext'])
    case 'PRIVILEGED_DB_PRECONDITION':
      return hasAny(['withSystemContext'])
    default:
      assert.fail(`Unhandled contextual dimension ${name}`)
  }
}

const assess = (name, contract, dimEvidence, entry) => {
  const directCalls = dimEvidence.DIRECT_HELPER_CALLS_OBSERVED_IN_BOUNDED_SLICE
  const helperSymbols = dimEvidence.HELPER_SYMBOLS_PRESENT_IN_BOUNDED_SLICE
  const directIds = getDirectPrimitiveIds(dimEvidence)
  const directNumbers = new Set(directIds.map(primitiveNumber))
  const relevantNumbers = new Set(relevantPrimitiveNumbers[name])
  const resolvedPrimitiveIds = sortedUnique(
    directIds.filter((id) => relevantNumbers.has(primitiveNumber(id))),
  )
  const directSignals = []
  const limits = []
  let result = null
  let rationale = null
  const hasDirect = (...numbers) => numbers.some((number) => directNumbers.has(number))
  const hasSignal = (...symbols) =>
    symbols.some((symbol) => directCalls.includes(symbol) || helperSymbols.includes(symbol))
  const hasRelevantSignal =
    directCalls.length > 0 ||
    (name === 'ORGANIZATION_SCOPE' &&
      ['organizationId', 'orgId', 'tenantId'].some((symbol) => helperSymbols.includes(symbol))) ||
    (name === 'RESOURCE_SCOPE' &&
      (helperSymbols.includes('ownerId') ||
        entry.SOURCE_SLICE.CALLER_CONTROLLED_SELECTOR_EVIDENCE.length > 0)) ||
    (name === 'PROVIDER_AUTH' &&
      entry.SOURCE_SLICE.CALLER_CONTROLLED_SELECTOR_EVIDENCE.some((fact) =>
        /headers|signature|hmac|webhook/i.test(fact.SYMBOL_OR_TOKEN),
      )) ||
    helperSymbols.some((symbol) =>
      [
        'auth',
        'currentUser',
        'getCurrentUser',
        'requireUser',
        'requireAuth',
        'withApiAuth',
        'withRoleAuth',
        'getOrganizationIdForUser',
        'requireUserForOrganization',
        'hasMinRole',
        'canAccess',
        'isAdmin',
        'isSystemAdmin',
        'requireAdmin',
        'requireSystemAdmin',
        'checkEntitlement',
        'requireEntitlement',
        'withRLSContext',
        'withOrganizationAuth',
        'withSystemContext',
      ].includes(symbol),
    )

  switch (name) {
    case 'IDENTITY_AUTHENTICATION':
      if (hasDirect(8, 10, 13, 14, 15, 16)) {
        result = 'RESOLVED_PRIMITIVE_SEMANTICS'
        rationale = 'A directly invoked accepted primitive requires an authenticated user context.'
      } else if (
        hasSignal('auth', 'currentUser', 'getCurrentUser', 'withApiAuth', 'authenticate')
      ) {
        result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
        rationale =
          'Identity resolution or an optional authentication wrapper does not establish a required rejecting boundary.'
        limits.push(
          'The observed identity helper may resolve a user without requiring authentication.',
        )
      }
      break
    case 'ORGANIZATION_MEMBERSHIP':
      if (hasDirect(9, 14, 16)) {
        result = 'RESOLVED_PRIMITIVE_SEMANTICS'
        rationale =
          'A directly invoked accepted primitive establishes organization-specific membership before its protected handler.'
      } else if (
        hasSignal('getOrganizationIdForUser', 'withRoleAuth', 'withMinRole', 'withRLSContext')
      ) {
        result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
        rationale =
          'Organization context or role/RLS setup is observed, but membership itself is not established.'
        limits.push(
          'Organization context, role checks, and RLS setup do not by themselves prove membership.',
        )
      }
      break
    case 'ORGANIZATION_SCOPE':
      if (hasRelevantSignal) {
        result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
        rationale =
          'Organization context or an RLS helper is observed, but resource query and mutation predicates are not established by the frozen evidence.'
        limits.push(
          'Organization context/RLS setup does not establish that each resource query or mutation is constrained to that organization.',
        )
      }
      break
    case 'ROLE_OR_PERMISSION':
      if (hasDirect(5, 13, 14, 15)) {
        result = 'RESOLVED_PRIMITIVE_SEMANTICS'
        rationale =
          'A directly invoked accepted role or permission primitive establishes the required check semantics.'
      } else if (hasSignal('hasMinRole', 'canAccess', 'ROLE_HIERARCHY', 'requireAdmin')) {
        result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
        rationale =
          'A role-like or administrative signal is observed, but it does not establish the exact required role/permission contract.'
        limits.push(
          'An administrative check or role-related symbol alone does not establish the required role/permission contract.',
        )
      }
      break
    case 'ADMIN_SCOPE':
      if (['SYSTEM_ADMIN', 'SYSTEM_ADMIN_REQUIRED'].includes(contract) && hasDirect(6, 7)) {
        result = 'RESOLVED_PRIMITIVE_SEMANTICS'
        rationale =
          'A directly invoked system-administrator primitive matches the exact required scope.'
      } else if (hasSignal('isAdmin', 'isSystemAdmin', 'requireAdmin', 'requireSystemAdmin')) {
        result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
        rationale =
          'An administrative check is observed, but its exact scope does not match or is not proven by the contract.'
        limits.push(
          `The observed administrative check does not establish the exact ${contract} scope.`,
        )
      }
      break
    case 'RESOURCE_SCOPE':
      if (hasRelevantSignal) {
        result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
        rationale =
          'A resource selector or ownership-related signal is observed, but no frozen evidence establishes an effective ownership, organization, assignment, participation, or member-identity predicate.'
        limits.push(
          'Caller-controlled identifiers and ownership-related symbols do not prove a resource authorization predicate.',
        )
      }
      break
    case 'SYSTEM_IDENTITY':
      if (
        hasSignal(
          'withSystemContext',
          'isAdmin',
          'isSystemAdmin',
          'requireAdmin',
          'requireSystemAdmin',
        )
      ) {
        result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
        rationale =
          'Administrative or privileged database context is observed, but caller system identity or trusted internal-job authorization is not established.'
        limits.push(
          'A privileged database context or administrator role is not evidence of trusted system identity.',
        )
      }
      break
    case 'PROVIDER_AUTH':
      if (hasRelevantSignal) {
        result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
        rationale =
          'Provider request headers or webhook input are observed, but signature/secret validation is not established.'
        limits.push(
          'Header and request-body access alone does not prove provider signature or secret validation.',
        )
      }
      break
    case 'ENTITLEMENT':
      if (hasDirect(19, 20)) {
        result = 'RESOLVED_PRIMITIVE_SEMANTICS'
        rationale =
          'A directly invoked accepted entitlement primitive establishes the required entitlement semantics.'
      } else if (hasSignal('checkEntitlement', 'requireEntitlement')) {
        result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
        rationale =
          'An entitlement helper symbol is present, but a direct invocation in the bounded entry slice is not established.'
        limits.push(
          'A helper symbol without a direct invocation does not establish that entitlement is checked on this entry.',
        )
      }
      break
    case 'RLS_CONTEXT':
      if (hasDirect(16, 17)) {
        result = 'RESOLVED_PRIMITIVE_SEMANTICS'
        rationale =
          'A directly invoked accepted organization/RLS context primitive establishes context setup semantics.'
      } else if (hasSignal('withRLSContext', 'withOrganizationAuth', 'withSystemContext')) {
        result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
        rationale =
          'An RLS or privileged-context helper symbol is present, but direct context application is not established.'
        limits.push(
          'RLS context setup does not establish policy correctness or that every data operation uses the context.',
        )
      }
      break
    case 'PRIVILEGED_DB_PRECONDITION':
      if (hasDirect(18) || hasDirect(8, 9, 10, 11, 13, 14, 15, 16)) {
        result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
        rationale =
          'A privileged context or a caller gate is observed, but the required caller precondition and ordering before privileged access are not proven.'
        limits.push(
          'The accepted evidence does not establish that an independent caller authority gate runs before privileged database access.',
        )
      } else if (hasSignal('withSystemContext', 'requireUser', 'requireAuth', 'requireAdmin')) {
        result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
        rationale =
          'A caller gate or privileged-context helper symbol is present, but invocation and ordering are not established.'
        limits.push(
          'Helper-symbol presence does not establish invocation order before privileged access.',
        )
      }
      break
    default:
      assert.fail(`Unhandled enforcement dimension ${name}`)
  }

  if (!result && name === 'IDENTITY_AUTHENTICATION' && hasSignal('requireUser', 'requireAuth')) {
    result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
    rationale =
      'An authentication primitive symbol is present, but a direct call is not established.'
  }
  if (!result) {
    result = 'NO_OBSERVED_ENFORCEMENT_MISSING'
    rationale =
      'No accepted direct boundary or relevant helper semantics establish this required enforcement dimension.'
  }
  const signalHelpers = sortedUnique([
    ...directCalls,
    ...helperSymbols.filter(
      (symbol) =>
        relevantNumbers.size === 0 ||
        [...relevantNumbers].some(
          (number) =>
            primitiveById.get(`UE-B2B1-PRIMITIVE-${String(number).padStart(3, '0')}`)?.SYMBOL ===
            symbol,
        ),
    ),
  ])
  for (const symbol of signalHelpers) {
    if (directCalls.includes(symbol)) directSignals.push(`DIRECT_HELPER_CALL=${symbol}`)
    else directSignals.push(`HELPER_SYMBOL=${symbol}`)
  }
  return {
    result,
    rationale,
    limitation: sortedUnique(limits),
    primitiveIds: resolvedPrimitiveIds,
    directSignals: sortedUnique(directSignals),
    hasRelevantSignal,
    directCalls,
    helperSymbols,
  }
}

const sourceCeilingResult = (name, contract, entry, reason) => ({
  DIMENSION: name,
  REQUIRED_CONTRACT: contract,
  RESULT: 'REQUIREMENT_SOURCE_CEILING',
  EVIDENCE_CLASS: 'SOURCE_CEILING',
  RESOLVED_PRIMITIVE_IDS: [],
  ACCEPTED_DIRECT_BOUNDARY_SIGNALS: [],
  RATIONALE:
    reason ??
    'The frozen requirement is contextual, but the authorized artifacts do not establish whether its conditional branch applies to this entry.',
  SOURCE_LIMITATION:
    'This bounded static source ceiling does not imply that the entry is invalid, absent, unused, runtime-broken, or exploitable.',
  SOURCE_SLICE_ID: entry.SOURCE_SLICE.SOURCE_SLICE_ID,
})

const classifyDimension = (dimension, entry) => {
  const dimEvidence = entry.DIMENSION_EVIDENCE[dimension.name]
  const contract = dimEvidence.REQUIRED_CONTRACT
  assert.equal(
    contract,
    entry.REQUIRED_ENFORCEMENT_CONTRACT[dimension.key],
    `${entry.ENTRY_ID} has inconsistent contract for ${dimension.name}.`,
  )
  if (
    entry.REQUIREMENT_SOURCE_CEILING_DIMENSIONS.includes(dimension.key) ||
    contract === 'SOURCE_CEILING'
  ) {
    return sourceCeilingResult(
      dimension.name,
      contract,
      entry,
      entry.REQUIREMENT_SOURCE_CEILING_REASON,
    )
  }
  if (['NOT_REQUIRED', 'NOT_APPLICABLE'].includes(contract)) {
    return {
      DIMENSION: dimension.name,
      REQUIRED_CONTRACT: contract,
      RESULT: 'NOT_REQUIRED_BY_CONTRACT',
      EVIDENCE_CLASS: 'CONTRACT',
      RESOLVED_PRIMITIVE_IDS: [],
      ACCEPTED_DIRECT_BOUNDARY_SIGNALS: [],
      RATIONALE: 'The frozen requirement contract does not require this enforcement dimension.',
      SOURCE_LIMITATION: null,
      SOURCE_SLICE_ID: entry.SOURCE_SLICE.SOURCE_SLICE_ID,
    }
  }
  const assessment = assess(dimension.name, contract, dimEvidence, entry)
  if (contract === 'CONTEXTUAL') {
    if (!contextualBranchObserved(dimension.name, dimEvidence, entry)) {
      return sourceCeilingResult(dimension.name, contract, entry)
    }
    if (assessment.result === 'NO_OBSERVED_ENFORCEMENT_MISSING') {
      assessment.result = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
      assessment.rationale =
        'Frozen entry-local evidence establishes the contextual branch, but not the required enforcement semantics.'
      assessment.limitation.push(
        'The applicable contextual branch is established; enforcement remains unproven.',
      )
    }
  }
  return {
    DIMENSION: dimension.name,
    REQUIRED_CONTRACT: contract,
    RESULT: assessment.result,
    EVIDENCE_CLASS: assessment.result,
    RESOLVED_PRIMITIVE_IDS: assessment.primitiveIds,
    ACCEPTED_DIRECT_BOUNDARY_SIGNALS: assessment.directSignals,
    RATIONALE: assessment.rationale,
    SOURCE_LIMITATION:
      assessment.limitation.length > 0
        ? sortedUnique(assessment.limitation).join(' ')
        : 'This result is bounded static evidence only and does not prove runtime reachability or authorization correctness.',
    SOURCE_SLICE_ID: entry.SOURCE_SLICE.SOURCE_SLICE_ID,
  }
}

const classifyEntry = (entry) => {
  const dimensionResults = dimensions.map((dimension) => classifyDimension(dimension, entry))
  const results = new Set(dimensionResults.map((result) => result.RESULT))
  const hasCeiling = [...results].includes('REQUIREMENT_SOURCE_CEILING')
  const hasMissing = results.has('NO_OBSERVED_ENFORCEMENT_MISSING')
  const hasPartial = results.has('OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL')
  let disposition = 'SOURCE_ENFORCEMENT_MATCH'
  if (hasCeiling && (hasMissing || hasPartial)) disposition = 'MIXED_SOURCE_ENFORCEMENT_RESULT'
  else if (hasMissing) disposition = 'NO_OBSERVED_ENFORCEMENT_MISSING'
  else if (hasPartial) disposition = 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL'
  else if (hasCeiling) disposition = 'SOURCE_REQUIREMENT_CEILING'
  return {
    ENTRY_ID: entry.ENTRY_ID,
    COHORT_ID: entry.COHORT_ID,
    ENTRY_CLASS: entry.ENTRY_CLASS,
    EXPORT_OR_HANDLER: entry.EXPORT_OR_HANDLER,
    HTTP_METHOD: entry.HTTP_METHOD,
    ROUTE_PATTERN: entry.ROUTE_PATTERN,
    REQUIRED_SOURCE_PATH: entry.REQUIRED_SOURCE_PATH,
    SOURCE_SLICE: {
      SOURCE_SLICE_ID: entry.SOURCE_SLICE.SOURCE_SLICE_ID,
      LINE_START: entry.SOURCE_SLICE.LINE_START,
      LINE_END: entry.SOURCE_SLICE.LINE_END,
      SHA256: entry.SOURCE_SLICE.SHA256,
    },
    REQUIRED_ENFORCEMENT_CONTRACT: entry.REQUIRED_ENFORCEMENT_CONTRACT,
    PRIMITIVE_LINKAGE_STATUS: entry.PRIMITIVE_LINKAGE_STATUS,
    HIGH_IMPACT_TAGS: entry.HIGH_IMPACT_TAGS,
    ENTRY_DISPOSITION: disposition,
    DIMENSION_RESULTS: dimensionResults,
  }
}

const localAdjudications = evidence.entryEvidence.map(classifyEntry)
const localById = new Map(localAdjudications.map((record) => [record.ENTRY_ID, record]))
const missingResults = []
const partialResults = []
const ceilingResults = []
const dimensionAccounting = Object.fromEntries(
  dimensions.map((dimension) => [
    dimension.name,
    {
      CONTRACTS: {},
      RESULTS: {},
    },
  ]),
)

for (const entry of localAdjudications) {
  for (const dimensionResult of entry.DIMENSION_RESULTS) {
    const counts = dimensionAccounting[dimensionResult.DIMENSION]
    counts.CONTRACTS[dimensionResult.REQUIRED_CONTRACT] =
      (counts.CONTRACTS[dimensionResult.REQUIRED_CONTRACT] ?? 0) + 1
    counts.RESULTS[dimensionResult.RESULT] = (counts.RESULTS[dimensionResult.RESULT] ?? 0) + 1
    const finding = {
      DEFECT_ID: `UE-B2B2B2B-FINDING-${digest(`${entry.ENTRY_ID}|${dimensionResult.DIMENSION}`).slice(0, 16)}`,
      OBJECT_ID: entry.ENTRY_ID,
      ENTRY_ID: entry.ENTRY_ID,
      COHORT_ID: entry.COHORT_ID,
      DIMENSION: dimensionResult.DIMENSION,
      DEFECT_CLASS:
        dimensionResult.RESULT === 'NO_OBSERVED_ENFORCEMENT_MISSING'
          ? 'MISSING_ENFORCEMENT'
          : 'PARTIAL_ENFORCEMENT_SEMANTICS',
      REQUIRED_CONTRACT: dimensionResult.REQUIRED_CONTRACT,
      RESULT: dimensionResult.RESULT,
      ACTIVE_USAGE_EVIDENCE: {
        ENTRY_CLASS: entry.ENTRY_CLASS,
        EXPORT_OR_HANDLER: entry.EXPORT_OR_HANDLER,
        ROUTE_PATTERN: entry.ROUTE_PATTERN,
        SOURCE_PATH: entry.REQUIRED_SOURCE_PATH,
        SOURCE_SLICE_ID: entry.SOURCE_SLICE.SOURCE_SLICE_ID,
        SOURCE_LINES: [entry.SOURCE_SLICE.LINE_START, entry.SOURCE_SLICE.LINE_END],
      },
      CONFIGURATION_EVIDENCE: {
        ACCEPTED_DIRECT_BOUNDARY_SIGNALS: dimensionResult.ACCEPTED_DIRECT_BOUNDARY_SIGNALS,
        RESOLVED_PRIMITIVE_IDS: dimensionResult.RESOLVED_PRIMITIVE_IDS,
        PRIMITIVE_LINKAGE_STATUS: entry.PRIMITIVE_LINKAGE_STATUS,
      },
      MIGRATION_EVIDENCE_STATUS:
        'NOT_EVALUATED_BY_B2B; no migration conclusion is made from this adjudication.',
      HIGH_IMPACT_TAGS: entry.HIGH_IMPACT_TAGS,
      EVIDENCE_LIMITATION: dimensionResult.SOURCE_LIMITATION,
    }
    if (dimensionResult.RESULT === 'NO_OBSERVED_ENFORCEMENT_MISSING') {
      missingResults.push(finding)
    } else if (dimensionResult.RESULT === 'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL') {
      partialResults.push(finding)
    } else if (dimensionResult.RESULT === 'REQUIREMENT_SOURCE_CEILING') {
      ceilingResults.push({
        SOURCE_CEILING_ID: finding.DEFECT_ID.replace('FINDING', 'CEILING'),
        OBJECT_ID: entry.ENTRY_ID,
        ENTRY_ID: entry.ENTRY_ID,
        COHORT_ID: entry.COHORT_ID,
        DIMENSION: dimensionResult.DIMENSION,
        REQUIRED_CONTRACT: dimensionResult.REQUIRED_CONTRACT,
        REASON: dimensionResult.RATIONALE,
        SOURCE_PATH: entry.REQUIRED_SOURCE_PATH,
        SOURCE_SLICE_ID: entry.SOURCE_SLICE.SOURCE_SLICE_ID,
        SOURCE_LIMITATION: dimensionResult.SOURCE_LIMITATION,
      })
    }
  }
}

const knownEnforcementDefects = [...missingResults, ...partialResults]
const combinedKnownEnforcementDefects = [...b1.knownEnforcementDefects, ...knownEnforcementDefects]
const combinedSourceCeilings = [...b1.sourceCeilings, ...ceilingResults]
const finalEntryDispositions = b1.entryDispositions.map((record) => {
  if (!b1DeferredIds.has(record.ENTRY_ID)) return record
  const adjudication = localById.get(record.ENTRY_ID)
  assert.ok(adjudication, `Missing B2 adjudication for ${record.ENTRY_ID}`)
  return {
    ENTRY_ID: record.ENTRY_ID,
    COHORT_ID: record.COHORT_ID,
    ENTRY_DISPOSITION: adjudication.ENTRY_DISPOSITION,
    DIMENSION_RESULTS: adjudication.DIMENSION_RESULTS,
    HIGH_IMPACT_TAGS: record.HIGH_IMPACT_TAGS,
  }
})
const dispositionCounts = Object.fromEntries(
  [...new Set(finalEntryDispositions.map((record) => record.ENTRY_DISPOSITION))]
    .sort()
    .map((disposition) => [
      disposition,
      finalEntryDispositions.filter((record) => record.ENTRY_DISPOSITION === disposition).length,
    ]),
)
const entryDispositionCounts = Object.fromEntries(
  [...new Set(localAdjudications.map((record) => record.ENTRY_DISPOSITION))]
    .sort()
    .map((disposition) => [
      disposition,
      localAdjudications.filter((record) => record.ENTRY_DISPOSITION === disposition).length,
    ]),
)
const dimensionFindings = dimensions.map((dimension) => {
  const records = localAdjudications.flatMap((entry) =>
    entry.DIMENSION_RESULTS.filter((result) => result.DIMENSION === dimension.name),
  )
  const counts = dimensionAccounting[dimension.name]
  return {
    DIMENSION: dimension.name,
    INPUT_ENTRIES: records.length,
    CONTRACT_COUNTS: counts.CONTRACTS,
    RESULT_COUNTS: counts.RESULTS,
  }
})

assert.equal(localAdjudications.length, 700)
assert.equal(new Set(localAdjudications.map((record) => record.ENTRY_ID)).size, 700)
assert.equal(
  localAdjudications.reduce((total, entry) => total + entry.DIMENSION_RESULTS.length, 0),
  7700,
)
assert.equal(finalEntryDispositions.length, 1910)
assert.equal(new Set(finalEntryDispositions.map((record) => record.ENTRY_ID)).size, 1910)
assert.equal(
  finalEntryDispositions.filter((record) => b1DeferredIds.has(record.ENTRY_ID)).length,
  700,
)
assert.equal(
  finalEntryDispositions.filter((record) => !b1DeferredIds.has(record.ENTRY_ID)).length,
  1210,
)
for (const record of priorB1Records) {
  assert.equal(
    serialize(finalEntryDispositions.find((entry) => entry.ENTRY_ID === record.ENTRY_ID)),
    serialize(record),
    `Prior B1 adjudication changed for ${record.ENTRY_ID}.`,
  )
}
for (const counts of Object.values(dimensionAccounting)) {
  assert.equal(
    Object.values(counts.CONTRACTS).reduce((sum, count) => sum + count, 0),
    700,
    'Every dimension contract must account for all 700 entries.',
  )
  assert.equal(
    Object.values(counts.RESULTS).reduce((sum, count) => sum + count, 0),
    700,
    'Every dimension contract/result classification must account for all 700 entries.',
  )
}
assert.equal(digest(serialize(b1.knownEnforcementDefects)), priorDefectsSha256)
assert.equal(digest(serialize(b1.sourceCeilings)), priorSourceCeilingsSha256)
assert.equal(digest(serialize(b1.historicalPageExpectations)), priorHistoricalSha256)
assert.equal(digest(serialize(priorB1Records)), priorB1RecordsSha256)
assert.equal(
  new Set(combinedKnownEnforcementDefects.map((record) => record.DEFECT_ID)).size,
  combinedKnownEnforcementDefects.length,
)
assert.equal(
  new Set(combinedSourceCeilings.map((record) => record.SOURCE_CEILING_ID)).size,
  combinedSourceCeilings.length,
)
assert.deepEqual(
  combinedKnownEnforcementDefects.slice(0, b1.knownEnforcementDefects.length),
  b1.knownEnforcementDefects,
)
assert.deepEqual(combinedSourceCeilings.slice(0, b1.sourceCeilings.length), b1.sourceCeilings)
assert.equal(
  b1.knownEnforcementDefects.length,
  evidence.frozenCarryForwards.B1_KNOWN_ENFORCEMENT_DEFECTS,
)
assert.equal(b1.sourceCeilings.length, evidence.frozenCarryForwards.B1_SOURCE_CEILING_RECORDS)
assert.equal(
  b1.historicalPageExpectations.RECORDS.filter(
    (record) => record.ORIGINAL_EXPECTATION_CLOSED === 'NO',
  ).length,
  43,
)
assert.deepEqual(entryDispositionCounts, {
  MIXED_SOURCE_ENFORCEMENT_RESULT: 676,
  SOURCE_REQUIREMENT_CEILING: 24,
})
assert.equal(knownEnforcementDefects.length, 1495)
assert.equal(ceilingResults.length, 2847)
assert.equal(combinedKnownEnforcementDefects.length, 1710)
assert.equal(combinedSourceCeilings.length, 3672)
assert.ok(
  b1.historicalPageExpectations.RECORDS.every(
    (record) => record.LINKED_ENTRY_IDS.length === 0 && record.LINKED_COHORT_IDS.length === 0,
  ),
)

const report = {
  metadata: {
    PHASE: 'PHASE_1B_2B2_B2B_ENTRY_LOCAL_ENFORCEMENT_ADJUDICATION',
    METHOD: 'FOUR_AUTHORIZED_FROZEN_ARTIFACTS_ONLY',
    INPUTS: {
      B2A_EVIDENCE_FILE: inputFiles.evidence,
      B2A_EVIDENCE_SHA256: evidenceSha256,
      B1_ADJUDICATION_FILE: inputFiles.b1,
      B1_ADJUDICATION_SHA256: b1Sha256,
      B2A_PARTITION_FILE: inputFiles.partition,
      B2A_PARTITION_SHA256: partitionSha256,
      PRIMITIVE_REGISTRY_FILE: inputFiles.primitives,
      PRIMITIVE_REGISTRY_SHA256: primitiveRegistrySha256,
      PRIMITIVE_ARRAY_SHA256: digest(serialize(primitives)),
      PRIOR_B1_ADJUDICATED_ENTRIES_SHA256: priorB1RecordsSha256,
      PRIOR_B1_DEFECT_REGISTER_SHA256: priorDefectsSha256,
      PRIOR_B1_SOURCE_CEILING_REGISTER_SHA256: priorSourceCeilingsSha256,
      PRIOR_B1_HISTORICAL_EXPECTATIONS_SHA256: priorHistoricalSha256,
    },
    NO_APPLICATION_SOURCE_NEWLY_INSPECTED: 'YES',
    NO_RUNTIME_DATABASE_INSPECTED: 'YES',
    NO_MIGRATION_EXECUTED: 'YES',
    NO_DATABASE_WRITE_EXECUTED: 'YES',
    NO_RUNTIME_AUTH_EXECUTED: 'YES',
    NO_PRODUCT_CODE_CHANGED: 'YES',
    PHASE_1B_3_STARTED: 'NO',
  },
  gate: {
    PHASE_1B_2B2_B2BN_GATE: 'PASS',
    PHASE_1B_2B2_B2B_GATE: 'PASS',
    PHASE_1B_2B2_B2B: 'PASS',
    PHASE_1B_2B2_B2B_EVIDENCE_WORK: 'ACCEPTED',
    SOURCE_ENFORCEMENT_CEILINGS_PRESENT: 'YES',
    SOURCE_ENFORCEMENT_DEFECTS_PRESENT: 'YES',
    AUTHORIZATION_SOURCE_MODEL_CLOSED: 'YES',
    AUTHORIZATION_RUNTIME_PROVEN: 'NO',
    ORG_SCOPE_RUNTIME_PROVEN: 'NO',
    RESOURCE_AUTHORIZATION_RUNTIME_PROVEN: 'NO',
    TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
    AUDIT_PERSISTENCE_RUNTIME_PROVEN: 'NO',
    AUTHORIZATION_CORRECTNESS_PROVEN: 'NO',
    ORGANIZATION_SCOPE_ENFORCEMENT_PROVEN: 'NO',
    RESOURCE_AUTHORIZATION_PROVEN: 'NO',
    RLS_CORRECTNESS_PROVEN: 'NO',
    ADEQUACY_VERDICT_ISSUED: 'NO',
    PRODUCT_READY: 'NO',
  },
  denominators: {
    INPUT_B2A_ENTRY_EVIDENCE: evidence.entryEvidence.length,
    UNIQUE_B2A_ENTRY_IDS: b2EntryIds.size,
    INPUT_B2A_COHORTS: evidence.denominators.INPUT_LOCAL_REVIEW_COHORTS,
    INPUT_B1_ENTRY_DISPOSITIONS: b1.entryDispositions.length,
    UNIQUE_B1_ENTRY_IDS: new Set(b1.entryDispositions.map((record) => record.ENTRY_ID)).size,
    FROZEN_B1_ADJUDICATED_ENTRIES: priorB1Records.length,
    B2_ENTRY_LOCAL_ADJUDICATIONS: localAdjudications.length,
    UNIQUE_B2_ENTRY_LOCAL_ADJUDICATIONS: new Set(
      localAdjudications.map((record) => record.ENTRY_ID),
    ).size,
    B2_DIMENSION_RESULTS: localAdjudications.reduce(
      (total, entry) => total + entry.DIMENSION_RESULTS.length,
      0,
    ),
    FINAL_RECONCILED_ENTRY_DISPOSITIONS: finalEntryDispositions.length,
    UNIQUE_FINAL_RECONCILED_ENTRY_IDS: new Set(
      finalEntryDispositions.map((record) => record.ENTRY_ID),
    ).size,
    B1_KNOWN_ENFORCEMENT_DEFECTS_PRESERVED: b1.knownEnforcementDefects.length,
    B1_SOURCE_CEILING_RECORDS_PRESERVED: b1.sourceCeilings.length,
    COMBINED_KNOWN_ENFORCEMENT_DEFECTS: combinedKnownEnforcementDefects.length,
    COMBINED_SOURCE_CEILING_REGISTER_RECORDS: combinedSourceCeilings.length,
    B2_ENTRY_LOCAL_FINDINGS: knownEnforcementDefects.length,
    B2_SOURCE_CEILING_RECORDS: ceilingResults.length,
    ENTRIES_MISSING_FINAL_DISPOSITION: [
      ...b2EntryIds,
      ...priorB1Records.map((entry) => entry.ENTRY_ID),
    ].filter((id) => !finalEntryDispositions.some((entry) => entry.ENTRY_ID === id)).length,
    ENTRIES_WITH_MULTIPLE_FINAL_DISPOSITIONS:
      finalEntryDispositions.length -
      new Set(finalEntryDispositions.map((entry) => entry.ENTRY_ID)).size,
    HISTORICAL_EXPECTATIONS_RETAINED_OPEN: b1.historicalPageExpectations.RECORDS.filter(
      (record) => record.ORIGINAL_EXPECTATION_CLOSED === 'NO',
    ).length,
    AUTHORITY_SOURCE_CEILING_CARRY_FORWARD:
      evidence.frozenCarryForwards.R2B_SOURCE_CEILING_UNKNOWN_AUTHORITY,
    KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD:
      evidence.frozenCarryForwards.R2B_KNOWN_CONFIGURED_SCHEMA_MISMATCH_OBJECTS,
    TARGETLESS_DATABASE_EFFECTS_CARRY_FORWARD:
      evidence.frozenCarryForwards.R2C_TARGETLESS_DATABASE_EFFECTS,
    FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD:
      evidence.frozenCarryForwards.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD,
  },
  adjudicationConvention: {
    CONTEXTUAL_CONTRACT:
      'REQUIREMENT_SOURCE_CEILING unless frozen entry-local evidence establishes the applicable branch.',
    EMPTY_LOCAL_SIGNAL: 'NO_OBSERVED_ENFORCEMENT_MISSING for a required contract.',
    HELPER_SYMBOL_WITHOUT_DIRECT_CALL:
      'OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL unless a directly invoked accepted primitive independently establishes the dimension.',
    DIRECT_CALL:
      'A directly observed call is credited only for the explicit semantics of its linked frozen primitive; invocation does not establish behavior outside those semantics.',
    ASSURANCE_LIMITATION:
      'Static source adjudication does not prove runtime reachability, authorization correctness, organization/resource isolation, RLS policy correctness, exploitability, or product readiness.',
  },
  entryDispositionCounts,
  allEntryDispositionCounts: dispositionCounts,
  dimensionFindings,
  entryLocalAdjudications: localAdjudications,
  knownEnforcementDefects: combinedKnownEnforcementDefects,
  b2EntryLocalFindings: knownEnforcementDefects,
  missingEnforcementDefects: missingResults,
  partialSemanticsRegister: partialResults,
  sourceCeilings: combinedSourceCeilings,
  b2SourceCeilings: ceilingResults,
  frozenB1Registers: {
    knownEnforcementDefects: b1.knownEnforcementDefects,
    sourceCeilings: b1.sourceCeilings,
    historicalPageExpectations: b1.historicalPageExpectations,
  },
  reconciledEntryDispositions: finalEntryDispositions,
  priorPhasePreservation: {
    R2B_INPUT_AUTHORITY_OBJECTS: evidence.frozenCarryForwards.R2B_INPUT_AUTHORITY_OBJECTS,
    R2B_SOURCE_CEILING_UNKNOWN_AUTHORITY:
      evidence.frozenCarryForwards.R2B_SOURCE_CEILING_UNKNOWN_AUTHORITY,
    R2B_KNOWN_CONFIGURED_SCHEMA_MISMATCH_OBJECTS:
      evidence.frozenCarryForwards.R2B_KNOWN_CONFIGURED_SCHEMA_MISMATCH_OBJECTS,
    R2C_TARGETLESS_DATABASE_EFFECTS: evidence.frozenCarryForwards.R2C_TARGETLESS_DATABASE_EFFECTS,
    R2C_RESOLVED_TARGET_CHAINS: evidence.frozenCarryForwards.R2C_RESOLVED_TARGET_CHAINS,
    R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD:
      evidence.frozenCarryForwards.R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD,
    FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD:
      evidence.frozenCarryForwards.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD,
    HISTORICAL_AUTH_EXPECTATIONS: evidence.frozenCarryForwards.HISTORICAL_AUTH_EXPECTATIONS,
    HISTORICAL_ORG_EXPECTATIONS: evidence.frozenCarryForwards.HISTORICAL_ORG_EXPECTATIONS,
    ACCEPTED_PRIMITIVE_SEMANTICS: primitives.length,
    ACCEPTED_PRIMITIVE_ARRAY_SHA256: digest(serialize(primitives)),
    FROZEN_B1_ADJUDICATED_ENTRIES: priorB1Records.length,
    FROZEN_B1_ADJUDICATED_ENTRIES_UNCHANGED: 'YES',
    FROZEN_B1_KNOWN_ENFORCEMENT_DEFECTS: b1.knownEnforcementDefects.length,
    FROZEN_B1_KNOWN_ENFORCEMENT_DEFECTS_UNCHANGED: 'YES',
    FROZEN_B1_SOURCE_CEILING_RECORDS: b1.sourceCeilings.length,
    FROZEN_B1_SOURCE_CEILING_RECORDS_UNCHANGED: 'YES',
    HISTORICAL_PAGE_EXPECTATIONS_RETAINED_OPEN: b1.historicalPageExpectations.RECORDS.length,
    HISTORICAL_PAGE_EXPECTATIONS_UNCHANGED: 'YES',
    HISTORICAL_PAGE_EXPECTATIONS_CLOSED: 'NO',
  },
  phaseState: {
    PHASE_1B_2B2_B2B: 'PASS',
    ENTRY_LOCAL_ENFORCEMENT_UNIVERSE: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
    ENTRY_LOCAL_ENFORCEMENT_ADJUDICATION_REMAINING: 0,
    PHASE_1B_2: 'SOURCE_CEILING_ACCEPTED',
    SERVER_AUTHORIZATION_SOURCE_MODEL: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
    EXECUTABLE_SERVER_ENTRY_UNIVERSE: 'CLOSED',
    ENFORCEMENT_REQUIREMENT_UNIVERSE: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
    ENFORCEMENT_PRIMITIVE_SOURCE_MODEL: 'CLOSED_WITH_EXPLICIT_LINKAGE_CEILINGS',
    SOURCE_ENFORCEMENT_ADJUDICATION_UNIVERSE: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
    NO_FURTHER_PHASE_1B_2_GENERAL_STATIC_PASS: 'YES',
    PHASE_1B_2_STATIC_WORK_REMAINING: 0,
    PHASE_1B_3: 'AUTHORIZED_NOT_STARTED',
    PHASE_1B_3_SCOPE: 'RLS_POLICY_AND_TENANT_ISOLATION_ASSURANCE',
    PHASE_1B_3_FUTURE_CONCERNS: [
      'RLS policy correctness',
      'privileged/system DB bypass semantics',
      'tenant isolation',
      'database mutation boundary enforcement',
      'provenance/audit persistence',
      'integration/provider trust boundaries',
    ],
    PHASE_1C: 'NOT_AUTHORIZED',
    PHASE_1D: 'NOT_AUTHORIZED',
    PHASE_2: 'NOT_AUTHORIZED',
    HISTORICAL_PAGE_EXPECTATIONS_REMAIN_OPEN: 43,
    PHASE_1B_3_STARTED: 'NO',
  },
  validation: {
    '700 B2A evidence records preserved exactly once': 'PASS',
    '700 B2 entry-local adjudications emitted exactly once': 'PASS',
    '11 enforcement dimensions accounted for each B2 entry': 'PASS',
    '1,210 frozen B1 entry adjudications preserved exactly': 'PASS',
    'All 1,910 server entries reconciled exactly once': 'PASS',
    '215 frozen B1 defects preserved unchanged in combined register': 'PASS',
    '825 frozen B1 source-ceiling records preserved unchanged in combined register': 'PASS',
    '43 historical page expectations retained open and unchanged': 'PASS',
    '207 R2B authority source ceilings preserved': 'PASS',
    '3 R2B known authority defects preserved': 'PASS',
    '56 R2C targetless database effects preserved as carry-forward': 'PASS',
    '247 Phase 1A unknown-effect chains preserved as carry-forward': 'PASS',
    'Accepted 20-primitive registry preserved by array digest': 'PASS',
    'No application source newly inspected': 'YES',
    'No runtime database inspected': 'YES',
    'No migration executed': 'YES',
    'No database write executed': 'YES',
    'Phase 1B.3 not started': 'YES',
    'Phase 1B.3 authorized only; not started': 'PASS',
    'No runtime auth executed': 'YES',
    'No product code changed': 'YES',
  },
}

const expectedPayloadDigests = {
  B2_ENTRY_ADJUDICATIONS: 'ed9bdc1067e218afacfa2d6486e63a496309ea77e1bfe344b2930fa60a75cc63',
  B2_DIMENSION_RESULTS: '4942b0e904adfd7948acd4930a46efd470efbd7b087489a0528fdc542f60b2ec',
  B1_ENTRY_DISPOSITIONS: '191c04949acbb32036a9279163421119e2944e918f2f561a6542f5f0e72a3c3a',
  FINAL_ENTRY_DISPOSITIONS: '100609784fc1cc410bd9ebc401e44120053661c6d4def790569c4c10a9aa052a',
  B2_FINDINGS: 'c137b10eadb771145badfc3b961fa21a0f7aaf17ffbd59b1d0e072f6319cc62c',
  B2_MISSING_FINDINGS: '999c5623b0e4fd665d51a186216aa01fc791953645c1ba120601d58cce48cc4c',
  B2_PARTIAL_RESULTS: 'cb58dba2cd17051ccbb31032f01f3234c6ec9bfc0480c1d58cbe611543b1c87f',
  B2_SOURCE_CEILINGS: '6d5cf94398fc1ca1e682d1ec3aac2eef3907166777b946ad1a645300cb077982',
  B1_DEFECTS: '6a6594f4c0757fe4eaed85bfe72f2db74fcc2d0ce7af956be16f8aeb28eb5a18',
  B1_SOURCE_CEILINGS: '8977c09a93fcb04ec1c23a7d7e42e3212311ef2be7b2409f7666146e7d7927a0',
  COMBINED_DEFECT_REGISTER: '454d2e840c17c5932119d1978c0f903da1f6d0f6b398d57aa6e44cd10e3d55f6',
  COMBINED_SOURCE_CEILING_REGISTER:
    '1d1c4eae1c59711d371e7b5dde330b6bb2e01f76679e79b5762d25ed1cfd9a83',
  DIMENSION_ACCOUNTING: 'bd0a1a9460ce89b1529e64bf69338d2f78a5e642a5d27d8c7e92fe40bd5ae829',
  B2_DISPOSITION_ACCOUNTING: 'd7c01dcfa2d848a13dc1b897058bd0f8760b1fc1acc09665e5157ce263a69e4b',
  FINAL_DISPOSITION_ACCOUNTING: '37774c2bd5ea60cb589d97de3b5b3847f85445ee832348fb9a68bed7efe6b7bb',
  HISTORICAL_PAGE_EXPECTATIONS: 'e7c25f35202201f3b929d06b4843b5f54dd9ba63591823b435aaffcce34d4827',
  PRIOR_PHASE_PRESERVATION: '71e76a618f63034dc80f40d8b4ef4ed7df747eb27c75a7ca9cc954b1a5431c07',
}
const preservedPayloads = {
  B2_ENTRY_ADJUDICATIONS: report.entryLocalAdjudications,
  B2_DIMENSION_RESULTS: report.entryLocalAdjudications.flatMap((entry) => entry.DIMENSION_RESULTS),
  B1_ENTRY_DISPOSITIONS: report.reconciledEntryDispositions.filter(
    (entry) => !b1DeferredIds.has(entry.ENTRY_ID),
  ),
  FINAL_ENTRY_DISPOSITIONS: report.reconciledEntryDispositions,
  B2_FINDINGS: report.b2EntryLocalFindings,
  B2_MISSING_FINDINGS: report.missingEnforcementDefects,
  B2_PARTIAL_RESULTS: report.partialSemanticsRegister,
  B2_SOURCE_CEILINGS: report.b2SourceCeilings,
  B1_DEFECTS: report.frozenB1Registers.knownEnforcementDefects,
  B1_SOURCE_CEILINGS: report.frozenB1Registers.sourceCeilings,
  COMBINED_DEFECT_REGISTER: report.knownEnforcementDefects,
  COMBINED_SOURCE_CEILING_REGISTER: report.sourceCeilings,
  DIMENSION_ACCOUNTING: report.dimensionFindings,
  B2_DISPOSITION_ACCOUNTING: report.entryDispositionCounts,
  FINAL_DISPOSITION_ACCOUNTING: report.allEntryDispositionCounts,
  HISTORICAL_PAGE_EXPECTATIONS: report.frozenB1Registers.historicalPageExpectations,
  PRIOR_PHASE_PRESERVATION: report.priorPhasePreservation,
}
const normalizationPreservation = Object.fromEntries(
  Object.entries(preservedPayloads).map(([name, payload]) => {
    const afterSha256 = digest(serialize(payload))
    assert.equal(
      afterSha256,
      expectedPayloadDigests[name],
      `${name} changed during B2BN normalization.`,
    )
    return [
      name,
      { BEFORE_SHA256: expectedPayloadDigests[name], AFTER_SHA256: afterSha256, CHANGED: 'NO' },
    ]
  }),
)
const closeoutCarryForward = {
  KNOWN_SOURCE_ENFORCEMENT_FINDINGS_CARRY_FORWARD: 1710,
  SOURCE_ENFORCEMENT_CEILING_RECORDS_CARRY_FORWARD: 3672,
  SOURCE_CEILING_RECORD_COUNT_IS_NOT_UNIQUE_ENTRY_COUNT: 'YES',
  HISTORICAL_PAGE_EXPECTATION_SOURCE_CEILING_CARRY_FORWARD: 43,
  HISTORICAL_PAGE_EXPECTATIONS_OPEN: 43,
  LINKED_SERVER_ENTRIES: 0,
  LINKED_COHORTS: 0,
  AUTHORITY_SOURCE_CEILING_CARRY_FORWARD: 207,
  R2B_KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD: 3,
  R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS: 56,
  R2C_RESOLVED_TARGET_CHAINS: 43,
  TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD: 13,
  TARGETLESS_EFFECT_STATIC_WORK_REMAINING: 0,
  FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD: 247,
}
assert.equal(report.denominators.ENTRIES_MISSING_FINAL_DISPOSITION, 0)
assert.equal(report.denominators.ENTRIES_WITH_MULTIPLE_FINAL_DISPOSITIONS, 0)
assert.equal(report.priorPhasePreservation.R2B_SOURCE_CEILING_UNKNOWN_AUTHORITY, 207)
assert.equal(report.priorPhasePreservation.R2B_KNOWN_CONFIGURED_SCHEMA_MISMATCH_OBJECTS, 3)
assert.equal(report.priorPhasePreservation.R2C_TARGETLESS_DATABASE_EFFECTS, 56)
assert.equal(report.priorPhasePreservation.R2C_RESOLVED_TARGET_CHAINS, 43)
assert.equal(report.priorPhasePreservation.R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD, 13)
assert.equal(report.priorPhasePreservation.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD, 247)
assert.equal(report.gate.PHASE_1B_2B2_B2B_GATE, 'PASS')
assert.equal(report.gate.PHASE_1B_2B2_B2B, 'PASS')
assert.equal(report.phaseState.PHASE_1B_2, 'SOURCE_CEILING_ACCEPTED')
assert.equal(report.phaseState.PHASE_1B_3, 'AUTHORIZED_NOT_STARTED')
assert.equal(report.phaseState.PHASE_1B_3_STARTED, 'NO')
assert.equal(report.phaseState.PHASE_1B_2_STATIC_WORK_REMAINING, 0)
const normalizedReport = { ...report, normalizationPreservation, closeoutCarryForward }

const summaryTable = (rows, columns) => {
  const widths = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => String(row[column] ?? '').length)),
  )
  const line = (row) =>
    `| ${columns.map((column, index) => String(row[column] ?? '').padEnd(widths[index])).join(' | ')} |`
  const separator = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`
  return [
    line(Object.fromEntries(columns.map((column) => [column, column]))),
    separator,
    ...rows.map(line),
  ].join('\n')
}

const markdown = `# Phase 1B.2b2-B2B — Entry-Local Enforcement Adjudication

## Gate and state

- Gate: \`${report.gate.PHASE_1B_2B2_B2B_GATE}\`
- B2BN normalization gate: \`${report.gate.PHASE_1B_2B2_B2BN_GATE}\`
- Entry-local adjudication: \`${report.gate.PHASE_1B_2B2_B2B}\`
- Entry-local evidence universe: \`${report.phaseState.ENTRY_LOCAL_ENFORCEMENT_UNIVERSE}\`
- Phase 1B.2: \`${report.phaseState.PHASE_1B_2}\`
- Phase 1B.3: \`${report.phaseState.PHASE_1B_3}\`; started: \`${report.phaseState.PHASE_1B_3_STARTED}\`
- Authorization correctness, organization/resource isolation, RLS correctness, and product readiness proven: \`NO\`

The B2B \`PASS\` gate measures completed adjudication, not absence of findings or ceilings. Source enforcement ceilings and defects remain present. A ceiling means a question remains beyond the authorized static evidence boundary; it does not imply that an entry is absent, unused, invalid, runtime-broken, or exploitable.

## Phase 1B.2 source-model closure and proof boundaries

- Server authorization source model: \`CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS\`.
- Executable server entry universe: \`CLOSED\`.
- Enforcement requirement universe: \`CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS\`.
- Enforcement primitive source model: \`CLOSED_WITH_EXPLICIT_LINKAGE_CEILINGS\`.
- Source enforcement adjudication universe: \`CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS\`.
- Phase 1B.2 static work remaining: \`0\`; no further general static pass: \`YES\`.
- Authorization source model closed: \`YES\`.
- Authorization, organization scope, resource authorization, tenant isolation, audit persistence runtime proof, and RLS correctness: \`NO\`; product ready: \`NO\`.
- Phase 1B.3 scope: \`RLS_POLICY_AND_TENANT_ISOLATION_ASSURANCE\`; authorization only, not started.

Future Phase 1B.3 concerns are RLS policy correctness, privileged/system DB bypass semantics, tenant isolation, database mutation boundary enforcement, provenance/audit persistence, and integration/provider trust boundaries. None were inspected here.

## Reconciled entry accounting

${summaryTable(
  [
    { Measure: 'Frozen B1 adjudications preserved unchanged', Count: 1210 },
    { Measure: 'B2 entry-local adjudications', Count: 700 },
    { Measure: 'All reconciled server entries', Count: 1910 },
    { Measure: 'Unique reconciled entry IDs', Count: 1910 },
    { Measure: 'B2 evidence cohorts', Count: 125 },
    { Measure: 'B2 dimension results', Count: 7700 },
  ],
  ['Measure', 'Count'],
)}

### B2 entry dispositions

${summaryTable(
  Object.entries(entryDispositionCounts).map(([Disposition, Count]) => ({ Disposition, Count })),
  ['Disposition', 'Count'],
)}

## Dimension accounting

${summaryTable(
  dimensionFindings.map((record) => ({
    Dimension: record.DIMENSION,
    Required: record.CONTRACT_COUNTS.REQUIRED ?? 0,
    Contextual: record.CONTRACT_COUNTS.CONTEXTUAL ?? 0,
    'Not required':
      (record.CONTRACT_COUNTS.NOT_REQUIRED ?? 0) + (record.CONTRACT_COUNTS.NOT_APPLICABLE ?? 0),
    'Source-ceiling contract': record.CONTRACT_COUNTS.SOURCE_CEILING ?? 0,
    'System-admin contract': record.CONTRACT_COUNTS.SYSTEM_ADMIN ?? 0,
    'Direct boundary': record.RESULT_COUNTS.ACCEPTED_DIRECT_BOUNDARY ?? 0,
    'Resolved primitive': record.RESULT_COUNTS.RESOLVED_PRIMITIVE_SEMANTICS ?? 0,
    Partial: record.RESULT_COUNTS.OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL ?? 0,
    Missing: record.RESULT_COUNTS.NO_OBSERVED_ENFORCEMENT_MISSING ?? 0,
    'Source ceiling': record.RESULT_COUNTS.REQUIREMENT_SOURCE_CEILING ?? 0,
    Total: record.INPUT_ENTRIES,
  })),
  [
    'Dimension',
    'Required',
    'Contextual',
    'Not required',
    'Source-ceiling contract',
    'System-admin contract',
    'Direct boundary',
    'Resolved primitive',
    'Partial',
    'Missing',
    'Source ceiling',
    'Total',
  ],
)}

## Preserved registers and carry-forwards

- Frozen B1 records: 1,210 adjudications preserved verbatim; 215 known enforcement defects and 825 source-ceiling records preserved unchanged.
- B2 finding records: 1,495; combined enforcement finding carry-forward: 1,710. These are finding records, not 1,710 unique affected entries.
- B2 ceiling records: 2,847; combined ceiling record carry-forward: 3,672. \`SOURCE_CEILING_RECORD_COUNT != UNIQUE_SOURCE_CEILING_ENTRY_COUNT\`.
- Historical page expectations: 43 remain open and unchanged as source-ceiling carry-forward; linked server entries: 0; linked cohorts: 0. They do not keep the server source census open.
- R2B authority source ceilings: 207; known authority/configuration defects: 3.
- R2C input targetless database-effect chains: 56; resolved target chains: 43; source-ceiling carry-forward: 13; targetless effect static work remaining: 0.
- Frozen Phase 1A unknown-effect carry-forward: 247.
- Accepted primitive semantics: 20; array digest: \`${report.priorPhasePreservation.ACCEPTED_PRIMITIVE_ARRAY_SHA256}\`.
- Static review remaining in the B2 entry-local universe: 0. The results remain source-level findings and ceilings, not runtime proof.

## Validation and scope

All 17 accepted payload/accounting objects have equal pre-normalization and post-normalization SHA-256 digests. All adjudications, 7,700 dimension results, final dispositions, missing/partial/ceiling registers, historical expectations, and prior-phase preservation objects are unchanged. The JSON report retains each digest pair and \`CHANGED = NO\`.

${Object.entries(report.validation)
  .map(([assertion, result]) => `- ${assertion}: **${result}**`)
  .join('\n')}

No product repair or application-source inspection was performed. No runtime database was inspected, no migration was executed, and no database write was made. Phase 1B.3, Phase 1C, Phase 1D, and Phase 2 were not started.

Machine-readable entry and dimension results, defect/partial/ceiling registers, preservation hashes, phase state, and validation assertions are in [the JSON report](./PHASE_1B_2B2B2B_ENTRY_LOCAL_ENFORCEMENT_ADJUDICATION.json).
`

const outputs = [
  [outputFiles.json, await formatJson(normalizedReport, outputFiles.json)],
  [outputFiles.markdown, await formatMarkdown(markdown, outputFiles.markdown)],
]
for (const [file, content] of outputs) {
  const absolutePath = path.resolve(root, ...file.split('/'))
  if (checkOnly) {
    assert.equal(readFileSync(absolutePath, 'utf8'), content, `${file} is not up to date.`)
  } else {
    writeFileSync(absolutePath, content)
  }
}

console.log(
  `${checkOnly ? 'Verified' : 'Generated'} ${localAdjudications.length} B2 entry adjudications, ` +
    `${knownEnforcementDefects.length} defect/partial findings, ${ceilingResults.length} source ceilings, ` +
    `and ${finalEntryDispositions.length} reconciled entry dispositions.`,
)
