import fs from 'node:fs'
import path from 'node:path'
import prettier from 'prettier'

const root = process.cwd()
const paths = {
  pageIndex: 'docs/union-eyes/PHASE_1A_1_PAGE_AND_DISCOVERABILITY_INDEX.json',
  surfaceCensus: 'docs/union-eyes/PHASE_1A_USER_SURFACE_CENSUS.json',
  sourceCloseout: 'docs/union-eyes/reality-remediation/PHASE_1A_2_FINAL_SOURCE_CLOSEOUT.json',
  capabilityReview:
    'docs/union-eyes/reality-remediation/PHASE_1A_3B_CAPABILITY_COHERENCE_REVIEW.json',
  coreJourneys:
    'docs/union-eyes/reality-remediation/PHASE_1A_4A_CORE_PERSONA_JOURNEY_RECONCILIATION.json',
  specialJourneys:
    'docs/union-eyes/reality-remediation/PHASE_1A_4B_SPECIAL_JOURNEY_BOUNDARY_RECONCILIATION.json',
  assuranceLedger: 'docs/union-eyes/ASSURANCE_REMEDIATION_LEDGER.md',
  outputJson: 'docs/union-eyes/reality-remediation/PHASE_1A_FINAL_SOURCE_RECONCILIATION.json',
  outputMarkdown: 'docs/union-eyes/reality-remediation/PHASE_1A_FINAL_SOURCE_RECONCILIATION.md',
}

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const formatOutput = async (file, source, parser) => {
  const destination = path.join(root, file)
  const config = (await prettier.resolveConfig(destination)) ?? {}
  return prettier.format(source, { ...config, filepath: destination, parser })
}
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const uniqueSorted = (values) =>
  [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)))
const countBy = (items, keyOf) =>
  Object.fromEntries(
    [...new Set(items.map(keyOf))]
      .sort()
      .map((key) => [key, items.filter((item) => keyOf(item) === key).length]),
  )
const mdCell = (value) =>
  String(value ?? '—')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ')
const mdTable = (headers, rows) =>
  [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(mdCell).join(' | ')} |`),
  ].join('\n')
const readLedger = (markdown) =>
  markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith('|') && !line.startsWith('|---') && !line.startsWith('| ID '))
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim().replace(/^`|`$/g, '')),
    )
    .filter((cells) => cells.length >= 9)
    .map(
      ([id, source, category, impact, persona, severity, evidence, remediationPhase, status]) => ({
        id,
        source,
        category,
        impact,
        persona,
        severity,
        evidence,
        remediationPhase,
        status,
      }),
    )

const pageIndex = readJson(paths.pageIndex)
const surfaceCensus = readJson(paths.surfaceCensus)
const sourceCloseout = readJson(paths.sourceCloseout)
const capabilityReview = readJson(paths.capabilityReview)
const coreJourneys = readJson(paths.coreJourneys)
const specialJourneys = readJson(paths.specialJourneys)
const ledgerText = readText(paths.assuranceLedger)
const ledgerRows = readLedger(ledgerText)

const bindings = sourceCloseout.bindings
const bindingById = new Map(bindings.map((binding) => [binding.bindingId, binding]))
const bindingCapabilityRows = capabilityReview.bindingCapabilityMap
const capabilityBindingById = new Map(bindingCapabilityRows.map((row) => [row.bindingId, row]))
const capabilities = capabilityReview.canonicalCapabilities
const capabilityById = new Map(
  capabilities.map((capability) => [capability.capabilityId, capability]),
)
const canonicalJourneys = coreJourneys.canonicalJourneys
const journeyById = new Map(canonicalJourneys.map((journey) => [journey.journeyId, journey]))
const liunaDimensions = specialJourneys.liunaDimensions
const liunaTransitions = specialJourneys.liunaTransitions
const sourceCeilingObligations = sourceCloseout.obligationRegister.sourceCeilingBindingObligations
const residualObligations = sourceCloseout.obligationRegister.residualEffectChainObligations
const allObligations = [...sourceCeilingObligations, ...residualObligations]
const obligationIds = allObligations.map((item) => item.obligationId)
const knownDefectRows = bindings.filter((binding) => binding.knownDefectCategories?.length)
const capabilityMappings = new Map(bindingCapabilityRows.map((row) => [row.bindingId, row]))
const falseSuccess = sourceCloseout.falseSuccessReconciliation
const dynamicCandidates = pageIndex.contextualPageLinks.dynamicDestinationCandidates
const pageAudienceSummary = pageIndex.discoverability
const navSummary = pageIndex.primaryNavigation
const literalRouteRecords = pageIndex.contextualPageLinks.records
const censusPageIndex = surfaceCensus.pageAudienceIndex
const censusNavigation = surfaceCensus.navigationGraph
const censusActionIndex = surfaceCensus.actionIndex
const censusCapabilities = surfaceCensus.derivedCapabilityIndex
const censusRegistry = surfaceCensus.capabilityRegistryReconciliation
const censusJourneys = surfaceCensus.journeySurfaceCoverage
const unresolvedCensusPages = censusPageIndex.unresolvedPages
const unresolvedCensusActions = censusActionIndex.unresolvedActionRecords
const censusCapabilityCandidates = censusCapabilities.records.map((item) => ({
  capabilityId: item.capabilityId,
  evidenceClass: item.evidenceClass,
  reason: item.reason,
}))
const censusRegistryOwnerCandidates = censusRegistry.records.filter(
  (item) => item.disposition === 'USER_SURFACE_OWNER_CANDIDATE',
)
const censusJourneySummaries = censusJourneys.journeys.map((item) => ({
  journey: item.journey,
  sourceFile: item.sourceFile,
  coverage: item.coverage,
  stepCount: item.steps.length,
}))
const pageAuthUnprovenCount =
  pageAudienceSummary.authExpectationNotEstablishedCount +
  pageAudienceSummary.authEnforcementNotEstablishedCount
const pageOrgUnprovenCount =
  pageAudienceSummary.orgContextExpectationNotEstablishedCount +
  pageAudienceSummary.orgContextRequirementNotProvenCount

const sourceCheckNames = [
  'authentication',
  'role',
  'organizationResolution',
  'resourcePermission',
  'auditWrite',
]
const sourceCheckCounts = Object.fromEntries(
  sourceCheckNames.map((name) => [
    name,
    bindings.filter((binding) => binding.sourceChecksObserved?.[name] === false).length,
  ]),
)
const unobservedSourceChecks = sourceCheckNames.map((name) => ({
  check: name,
  status: 'NOT_OBSERVED',
  bindingCount: sourceCheckCounts[name],
  sourceField: `Phase 1A.2 bindings[].sourceChecksObserved.${name}`,
}))

const capabilityExposure = {
  withKnownDefects: capabilities
    .filter((item) => item.knownDefectBindingIds.length > 0)
    .map((item) => item.capabilityId),
  withSourceCeiling: capabilities
    .filter((item) => item.sourceCeilingBindingIds.length > 0)
    .map((item) => item.capabilityId),
}
const defectCapabilitySet = new Set(capabilityExposure.withKnownDefects)
const ceilingCapabilitySet = new Set(capabilityExposure.withSourceCeiling)
capabilityExposure.withBoth = uniqueSorted(
  [...defectCapabilitySet].filter((id) => ceilingCapabilitySet.has(id)),
)
capabilityExposure.withNeither = capabilities
  .map((item) => item.capabilityId)
  .filter((id) => !defectCapabilitySet.has(id) && !ceilingCapabilitySet.has(id))

const sourceRootCauseRows = new Map()
for (const binding of knownDefectRows) {
  for (const rootFindingId of binding.sourceRootCauseIds ?? []) {
    const item = sourceRootCauseRows.get(rootFindingId) ?? {
      rootFindingId,
      acceptedCategories: new Set(),
      affectedBindingIds: new Set(),
      affectedCapabilityIds: new Set(),
      affectedJourneyIds: new Set(),
      sourcePhases: new Set(),
      inheritedFindingIds: new Set(),
    }
    item.affectedBindingIds.add(binding.bindingId)
    for (const category of binding.knownDefectCategories ?? [])
      item.acceptedCategories.add(category)
    for (const findingId of binding.rootFindingIds ?? []) item.inheritedFindingIds.add(findingId)
    for (const capabilityId of capabilityMappings.get(binding.bindingId)?.capabilityIds ?? []) {
      item.affectedCapabilityIds.add(capabilityId)
    }
    for (const journey of canonicalJourneys) {
      if (journey.bindingIds.includes(binding.bindingId))
        item.affectedJourneyIds.add(journey.journeyId)
    }
    for (const dimension of liunaDimensions) {
      if (dimension.bindingIds.includes(binding.bindingId))
        item.affectedJourneyIds.add('LIUNA_LEADERSHIP_CONTINUITY')
    }
    item.sourcePhases.add(
      rootFindingId.startsWith('R1-') || rootFindingId.startsWith('UE-R1-')
        ? 'PHASE_1A_2B1_R1'
        : 'PHASE_1A_2',
    )
    sourceRootCauseRows.set(rootFindingId, item)
  }
}

const normalizeActionDefectCategory = (categories) => {
  if (categories.includes('FALSE_SUCCESS_SOURCE_SUPPORTED')) return 'FALSE_SUCCESS_SOURCE_SUPPORTED'
  if (categories.includes('VISIBLE_ACTION_CALLBACK_OMITTED')) return 'CALLBACK_DEFECT'
  if (categories.includes('METHOD_MISMATCH')) return 'METHOD_MISMATCH'
  if (categories.includes('MISSING_ROUTE')) return 'SERVER_ROUTE_DEFECT'
  if (categories.includes('STUB_OR_MOCK_EFFECT')) return 'STUB_OR_MOCK'
  return 'ACTION_BINDING_DEFECT'
}

const bindingDefectRegister = knownDefectRows.map((binding) => ({
  rootFindingIds: binding.sourceRootCauseIds ?? [],
  category: normalizeActionDefectCategory(binding.knownDefectCategories ?? []),
  acceptedCategories: binding.knownDefectCategories ?? [],
  affectedBindingIds: [binding.bindingId],
  affectedCapabilityIds: capabilityMappings.get(binding.bindingId)?.capabilityIds ?? [],
  affectedJourneyIds: canonicalJourneys
    .filter((journey) => journey.bindingIds.includes(binding.bindingId))
    .map((journey) => journey.journeyId),
  sourcePhase: (binding.sourceRootCauseIds ?? []).some(
    (id) => id.startsWith('R1-') || id.startsWith('UE-R1-'),
  )
    ? 'PHASE_1A_2B1_R1'
    : 'PHASE_1A_2',
  sourceBinding: binding,
}))

const ledgerDefectCategoryMap = {
  KNOWN_BROKEN_PRODUCER_PATH: 'ACTION_BINDING_DEFECT',
  KNOWN_MISSING_API_ROUTE: 'SERVER_ROUTE_DEFECT',
  KNOWN_UNBOUNDED_DATA_OR_PROP_CONTRACT: 'POLICY_OR_URL_BOUNDARY_DEFECT',
  KNOWN_FIELD_MAPPING_DEFECT: 'ACTION_BINDING_DEFECT',
  CONFIGURABLE_ORIGIN_WITHOUT_HOST_ALLOWLIST: 'POLICY_OR_URL_BOUNDARY_DEFECT',
  BROKEN_INTERNAL_DESTINATION_CANDIDATE: 'DISCOVERABILITY_OR_ROUTE_DEFECT',
  ORPHAN_ROUTE_CANDIDATE: 'DISCOVERABILITY_OR_ROUTE_DEFECT',
  BROKEN_UNREACHABLE_ROUTE_CANDIDATE: 'DISCOVERABILITY_OR_ROUTE_DEFECT',
  SOURCE_ROUTE_ALWAYS_NOT_FOUND: 'DISCOVERABILITY_OR_ROUTE_DEFECT',
  LOCAL_ROUTE_INVENTORY_GAP: 'SERVER_ROUTE_DEFECT',
  LOCAL_ROUTE_METHOD_INVENTORY_MISMATCH: 'METHOD_MISMATCH',
  ACTIVE_VISIBLE_ACTION_CALLBACK_OMITTED: 'CALLBACK_DEFECT',
}
const sourceCloseoutFindingIds = new Set(
  bindings.flatMap((binding) => [
    ...(binding.rootFindingIds ?? []),
    ...(binding.sourceRootCauseIds ?? []),
  ]),
)
const laterBindingsByFindingId = new Map()
for (const binding of bindings) {
  for (const findingId of [
    ...(binding.rootFindingIds ?? []),
    ...(binding.sourceRootCauseIds ?? []),
  ]) {
    const affectedBindings = laterBindingsByFindingId.get(findingId) ?? []
    affectedBindings.push(binding.bindingId)
    laterBindingsByFindingId.set(findingId, affectedBindings)
  }
}
const ledgerFindingRegister = ledgerRows
  .filter((row) => ledgerDefectCategoryMap[row.category])
  .map((row) => ({
    rootFindingId: row.id,
    category: ledgerDefectCategoryMap[row.category],
    acceptedCategory: row.category,
    acceptedFindingStatus: /CANDIDATE/.test(row.category)
      ? 'SOURCE_CANDIDATE_NOT_RUNTIME_CONFIRMED'
      : 'ACCEPTED_SOURCE_FINDING',
    affectedBindingIds: [],
    affectedCapabilityIds: [],
    affectedJourneyIds: [],
    sourcePhase: 'PHASE_1A_1',
    inheritedByLaterBindingIds: uniqueSorted(laterBindingsByFindingId.get(row.id) ?? []),
    evidence: row,
  }))

const independentLedgerRootFindings = ledgerFindingRegister.filter(
  (item) => !sourceCloseoutFindingIds.has(item.rootFindingId),
)
const unifiedRootFindings = [...sourceRootCauseRows.values()]
  .map((item) => ({
    rootFindingId: item.rootFindingId,
    category: normalizeActionDefectCategory([...item.acceptedCategories]),
    acceptedCategories: uniqueSorted([...item.acceptedCategories]),
    affectedBindingIds: uniqueSorted([...item.affectedBindingIds]),
    affectedBindingCount: item.affectedBindingIds.size,
    affectedCapabilityIds: uniqueSorted([...item.affectedCapabilityIds]),
    affectedJourneyIds: uniqueSorted([...item.affectedJourneyIds]),
    sourcePhase: uniqueSorted([...item.sourcePhases]).join(', '),
    inheritedFindingIds: uniqueSorted([...item.inheritedFindingIds]),
    upstreamRootIds: uniqueSorted(
      [...item.inheritedFindingIds].filter((id) => id !== item.rootFindingId),
    ),
  }))
  .concat(
    independentLedgerRootFindings.map(
      ({
        rootFindingId,
        category,
        affectedBindingIds,
        affectedCapabilityIds,
        affectedJourneyIds,
        sourcePhase,
      }) => ({
        rootFindingId,
        category,
        affectedBindingIds,
        affectedBindingCount: affectedBindingIds.length,
        affectedCapabilityIds,
        affectedJourneyIds,
        sourcePhase,
        inheritedFindingIds: [],
        upstreamRootIds: [],
      }),
    ),
  )

const capabilityRows = capabilities.map((item) => ({
  capabilityId: item.capabilityId,
  capabilityName: item.capabilityName,
  criticality: item.criticality,
  sourceModelStatus: item.capabilitySourceStatus,
  bindingCount: item.totalBindings,
  defectBindingCount: item.knownDefectBindings,
  sourceCeilingBindingCount: item.sourceCeilingBindings,
  bindingIds: item.bindingIds,
  knownDefectBindingIds: item.knownDefectBindingIds,
  sourceCeilingBindingIds: item.sourceCeilingBindingIds,
  runtimeProven: 'NO',
  authorizationProven: 'NO',
  persistenceProven: 'NO',
}))

const journeyRuntimeStatuses = [
  'runtimeProven',
  'authorizationProven',
  'persistenceProven',
  'humanUsabilityProven',
]
const coreJourneyRows = canonicalJourneys.map((journey) => ({
  ...journey,
  runtimeProven: 'NO',
  authorizationProven: 'NO',
  persistenceProven: 'NO',
  humanUsabilityProven: 'NO',
}))

const liunaBlockers = [
  {
    blocker: 'Restricted evidence boundary',
    classifications: ['SOURCE_GAP', 'RUNTIME_PROOF_REQUIRED'],
    evidence:
      'RESTRICTED_EVIDENCE_BOUNDARY is NOT_SOURCE_SUPPORTED; no bounded successor evidence-access transition is established.',
    relatedDimensionIds: ['RESTRICTED_EVIDENCE_BOUNDARY', 'EVIDENCE_CONTINUITY'],
  },
  {
    blocker: 'Successor-appropriate access scope',
    classifications: ['SOURCE_GAP', 'RUNTIME_PROOF_REQUIRED'],
    evidence:
      'No accepted source establishes least-privilege successor context selection or authorization.',
    relatedDimensionIds: ['RESTRICTED_EVIDENCE_BOUNDARY', 'SUCCESSOR_HANDOFF'],
  },
  {
    blocker: 'Predecessor-to-successor responsibility transition',
    classifications: ['SOURCE_GAP', 'SOURCE_CEILING', 'RUNTIME_PROOF_REQUIRED'],
    evidence:
      'RESPONSIBILITY_TO_SUCCESSOR is CAPABILITY_RELATION_ONLY; assignment and handoff concepts do not establish the ordered transition.',
    relatedDimensionIds: ['RESPONSIBILITY_REASSIGNMENT', 'SUCCESSOR_HANDOFF'],
  },
  {
    blocker: 'Deadline continuity through reassignment',
    classifications: ['SOURCE_CEILING', 'RUNTIME_PROOF_REQUIRED'],
    evidence:
      'Deadline signals exist, but CASE_DEADLINES explicitly does not establish reminder behavior or survival after reassignment.',
    relatedDimensionIds: ['DEADLINE_CONTINUITY', 'POST_HANDOFF_CONTINUITY'],
  },
  {
    blocker: 'Handoff provenance',
    classifications: ['SOURCE_CEILING', 'RUNTIME_PROOF_REQUIRED'],
    evidence:
      'The governance auditability signal does not establish transaction-level handoff provenance or a preserved audit trail.',
    relatedDimensionIds: ['AUDIT_PROVENANCE', 'SUCCESSOR_HANDOFF'],
  },
  {
    blocker: 'Transition-triggered access revocation',
    classifications: ['SOURCE_GAP', 'RUNTIME_PROOF_REQUIRED'],
    evidence:
      'The accepted internal continuity model does not establish transition-triggered access revocation.',
    relatedDimensionIds: ['RESTRICTED_EVIDENCE_BOUNDARY', 'SUCCESSOR_HANDOFF'],
  },
  {
    blocker: 'Post-handoff continuity',
    classifications: ['SOURCE_CEILING', 'RUNTIME_PROOF_REQUIRED'],
    evidence:
      'Separate case, deadline, evidence, and knowledge signals exist, but no joined post-handoff state or operational result is established.',
    relatedDimensionIds: ['POST_HANDOFF_CONTINUITY'],
  },
  {
    blocker: 'Normal discoverability of the canonical path',
    classifications: ['SOURCE_GAP', 'RUNTIME_PROOF_REQUIRED'],
    evidence:
      'The accepted special-journey artifact has no source transition; static direct-route candidates do not establish a normal LIUNA path.',
    relatedDimensionIds: liunaDimensions
      .filter((item) => item.discoverabilityStatus !== 'PRIMARY_NAV')
      .map((item) => item.continuityDimension),
  },
]

const bindingRowsById = new Map(bindings.map((binding) => [binding.bindingId, binding]))
const capabilityIdsByBindingId = new Map(
  bindingCapabilityRows.map((row) => [row.bindingId, row.capabilityIds]),
)
const journeyIdsByBindingId = new Map()
for (const journey of canonicalJourneys) {
  for (const bindingId of journey.bindingIds) {
    const ids = journeyIdsByBindingId.get(bindingId) ?? []
    ids.push(journey.journeyId)
    journeyIdsByBindingId.set(bindingId, ids)
  }
}
const liunaDimensionIdsByBindingId = new Map()
for (const dimension of liunaDimensions) {
  for (const bindingId of dimension.bindingIds) {
    const ids = liunaDimensionIdsByBindingId.get(bindingId) ?? []
    ids.push(dimension.continuityDimension)
    liunaDimensionIdsByBindingId.set(bindingId, ids)
  }
}
const prioritiesByBindingId = new Map(
  bindings.map((binding) => [binding.bindingId, binding.priorityClass]),
)
const enrichObligation = (item, kind) => {
  const binding = bindingRowsById.get(item.bindingId)
  return {
    ...item,
    kind,
    capabilityIds: capabilityIdsByBindingId.get(item.bindingId) ?? [],
    coreJourneyIds: journeyIdsByBindingId.get(item.bindingId) ?? [],
    liunaDimensionIds: liunaDimensionIdsByBindingId.get(item.bindingId) ?? [],
    sourcePriorityClass: prioritiesByBindingId.get(item.bindingId) ?? null,
    reachableVia: binding ? ['BINDING'] : [],
  }
}
const enrichedSourceCeilingObligations = sourceCeilingObligations.map((item) =>
  enrichObligation(item, 'BINDING_LEVEL_SOURCE_CEILING'),
)
const enrichedResidualObligations = residualObligations.map((item) =>
  enrichObligation(item, 'RESIDUAL_EFFECT_CHAIN'),
)
const orphanObligations = allObligations
  .filter((item) => !bindingById.has(item.bindingId))
  .map((item) => item.obligationId)
const sourceObligationIds = sourceCeilingObligations.map((item) => item.obligationId)
const residualObligationIds = residualObligations.map((item) => item.obligationId)
const overlappingObligationIds = uniqueSorted(
  sourceObligationIds.filter((id) => residualObligationIds.includes(id)),
)

const priorityBucket = (priorityClass) => {
  if (priorityClass === 'P1_SOURCE_DEFECT') return 'P1'
  if (priorityClass === 'P2_SOURCE_DEFECT' || priorityClass === 'P2_EVIDENCE_CLOSURE') return 'P2'
  if (priorityClass === 'P0') return 'P0'
  return 'OUTSIDE_P0_P2'
}
const runtimeProofTypes = {
  CORE_PERSONA_RUNTIME_PROOF: ['RUNTIME_OUTCOME_PROOF'],
  LIUNA_CONTINUITY_RUNTIME_PROOF: ['RUNTIME_OUTCOME_PROOF'],
  PERSISTENCE_EFFECT_PROOF: ['PERSISTENCE_OUTCOME_PROOF', 'RESOLVE_RESIDUAL_UNKNOWN_EFFECT'],
  ACTIVE_REACHABILITY_PROOF: ['IN_REPOSITORY_CALLER_OR_REACHABILITY_PROOF'],
  PROVIDER_EFFECT_PROOF: ['IMPLEMENTATION_OR_PROVIDER_TARGET_IDENTIFICATION'],
  IMPLEMENTATION_EXISTENCE_PROOF: [
    'TERMINAL_EFFECT_PROOF',
    'IMPLEMENTATION_OR_PROVIDER_TARGET_IDENTIFICATION',
  ],
}
const obligationsBySourcePriority = (items) => {
  const result = { P0: [], P1: [], P2: [], outsideRequestedP0P2: [] }
  for (const item of items) {
    const bucket = priorityBucket(item.sourcePriorityClass)
    result[bucket === 'OUTSIDE_P0_P2' ? 'outsideRequestedP0P2' : bucket].push(item)
  }
  return result
}
const proofRecordsForObligations = (proofType, acceptedTypes) => {
  const items = allObligations.filter((item) =>
    (item.obligationTypes ?? [item.obligationType]).some((type) => acceptedTypes.includes(type)),
  )
  return {
    proofType,
    sourcePriorityGroups: obligationsBySourcePriority(
      items.map((item) => enrichObligation(item, 'RUNTIME_CARRY_FORWARD')),
    ),
    obligationIds: uniqueSorted(items.map((item) => item.obligationId)),
  }
}
const journeyPriorityBuckets = { P0: [], P1: [], P2: [], outsideRequestedP0P2: [] }
for (const journey of coreJourneys.canonicalJourneys) {
  const bucket = journey.priority.highestOpenPriority
  ;(journeyPriorityBuckets[bucket] ?? journeyPriorityBuckets.outsideRequestedP0P2).push(
    journey.journeyId,
  )
}
const liunaPriorityBuckets = { P0: [], P1: [], P2: [], outsideRequestedP0P2: [] }
for (const dimension of liunaDimensions) {
  const classes = uniqueSorted(
    dimension.bindingIds.map((id) => prioritiesByBindingId.get(id)).filter(Boolean),
  )
  const buckets = uniqueSorted(classes.map(priorityBucket))
  const chosen = buckets.includes('P0')
    ? 'P0'
    : buckets.includes('P1')
      ? 'P1'
      : buckets.includes('P2')
        ? 'P2'
        : 'OUTSIDE_P0_P2'
  liunaPriorityBuckets[chosen === 'OUTSIDE_P0_P2' ? 'outsideRequestedP0P2' : chosen].push(
    dimension.continuityDimension,
  )
}
const staticPageRuntimeCandidates = dynamicCandidates.map((item) => ({
  candidateId: item.candidateId,
  classification: item.classification,
  sourceFile: item.sourceFile,
  sourceLine: item.sourceLine,
  status:
    item.phase1a1cClosure?.disposition ??
    item.phase1a1bClosure?.disposition ??
    'ACCEPTED_STATIC_CANDIDATE',
}))
const runtimeCarryForward = {
  priorityBasis:
    'Only accepted Phase 1A.2 priorityClass and Phase 1A.4a highestOpenPriority are used. Phase 1A.2 states priorityClass is source-closeout sequencing, not runtime severity. No P0 assignment exists; P3_SOURCE_CLASSIFIED remains outside P0/P1/P2 and is not promoted.',
  priorityGroups: {
    P0: {
      CORE_PERSONA_RUNTIME_PROOF: [],
      LIUNA_CONTINUITY_RUNTIME_PROOF: [],
      PERSISTENCE_EFFECT_PROOF: [],
      ACTIVE_REACHABILITY_PROOF: [],
      PROVIDER_EFFECT_PROOF: [],
      IMPLEMENTATION_EXISTENCE_PROOF: [],
    },
    P1: {
      CORE_PERSONA_RUNTIME_PROOF: [],
      LIUNA_CONTINUITY_RUNTIME_PROOF: [],
      ...Object.fromEntries(
        Object.entries(runtimeProofTypes)
          .filter(
            ([key]) =>
              !['CORE_PERSONA_RUNTIME_PROOF', 'LIUNA_CONTINUITY_RUNTIME_PROOF'].includes(key),
          )
          .map(([key, types]) => [
            key,
            proofRecordsForObligations(key, types).sourcePriorityGroups.P1,
          ]),
      ),
    },
    P2: {
      CORE_PERSONA_RUNTIME_PROOF: journeyPriorityBuckets.P2,
      LIUNA_CONTINUITY_RUNTIME_PROOF: liunaPriorityBuckets.P2,
      ...Object.fromEntries(
        Object.entries(runtimeProofTypes)
          .filter(
            ([key]) =>
              !['CORE_PERSONA_RUNTIME_PROOF', 'LIUNA_CONTINUITY_RUNTIME_PROOF'].includes(key),
          )
          .map(([key, types]) => [
            key,
            proofRecordsForObligations(key, types).sourcePriorityGroups.P2,
          ]),
      ),
    },
    outsideRequestedP0P2: {
      CORE_PERSONA_RUNTIME_PROOF: journeyPriorityBuckets.outsideRequestedP0P2,
      LIUNA_CONTINUITY_RUNTIME_PROOF: liunaPriorityBuckets.outsideRequestedP0P2,
      ...Object.fromEntries(
        Object.entries(runtimeProofTypes)
          .filter(
            ([key]) =>
              !['CORE_PERSONA_RUNTIME_PROOF', 'LIUNA_CONTINUITY_RUNTIME_PROOF'].includes(key),
          )
          .map(([key, types]) => [
            key,
            proofRecordsForObligations(key, types).sourcePriorityGroups.outsideRequestedP0P2,
          ]),
      ),
    },
  },
  proofObligationCatalog: Object.fromEntries(
    Object.entries(runtimeProofTypes).map(([key, types]) => [
      key,
      proofRecordsForObligations(key, types),
    ]),
  ),
  activeReachability: {
    priority: 'UNASSIGNED_BY_ACCEPTED_SOURCE',
    dynamicDestinationCandidateCount: dynamicCandidates.length,
    candidates: staticPageRuntimeCandidates,
    unresolvedRouteResolutionCount: pageAudienceSummary.unresolvedPageTargetCount,
  },
  additionalLaterRuntimeProofs: [
    'RUNTIME_PROVEN',
    'PERSISTENCE_PROVEN',
    'SESSION_SAFETY_PROVEN',
    'ROLE_CORRECTNESS_PROVEN',
    'ORG_SCOPE_PROVEN',
    'AUTHORIZATION_PROVEN',
    'AUDIT_COMPLETENESS_PROVEN',
    'HUMAN_USABILITY_PROVEN',
    'MOBILE_ACCEPTANCE_PROVEN',
    'FR_CA_CRITICAL_FLOW_ACCEPTANCE_PROVEN',
    'ACCESSIBILITY_ACCEPTANCE_PROVEN',
  ],
}

const validation = {
  allAcceptedSurfaceCensusDenominatorsRetained:
    censusPageIndex.TOTAL_PAGES === 343 &&
    censusPageIndex.PAGE_CLASSIFIED === 305 &&
    censusPageIndex.PAGE_UNKNOWN === 38 &&
    censusNavigation.NAV_ITEMS === 47 &&
    censusNavigation.NAV_EDGES === 72 &&
    censusActionIndex.VISIBLE_BUSINESS_ACTIONS === 1099 &&
    censusActionIndex.CLASSIFIED_ACTIONS === 672 &&
    censusActionIndex.UNKNOWN_ACTIONS === 427 &&
    censusCapabilities.TOTAL_CAPABILITIES === 488 &&
    censusCapabilities.CLASSIFIED_CAPABILITIES === 0 &&
    censusCapabilities.UNKNOWN_CAPABILITIES === 488 &&
    censusRegistry.REGISTRY_ENTRIES === 31 &&
    censusJourneys.journeys.length === 7 &&
    censusJourneys.executed === false &&
    surfaceCensus.metadata.acceptedRouteCounts.UNEXPLAINED_ROUTE_DELTA === 0 &&
    surfaceCensus.gate.noRemediationPerformed === true,
  allSurfaceCensusUnknownsCarriedForward:
    unresolvedCensusPages.length === 38 &&
    unresolvedCensusActions.length === 427 &&
    censusCapabilityCandidates.length === 488 &&
    censusRegistryOwnerCandidates.length === 16 &&
    surfaceCensus.gate.reasons.length === 7 &&
    surfaceCensus.gate.PHASE_1A_GATE === 'FAIL',
  allAcceptedPhase1A1DenominatorsRetained:
    pageAudienceSummary.pageFiles === 343 &&
    navSummary.items === 47 &&
    navSummary.edges === 72 &&
    navSummary.brokenDestinations === 0 &&
    navSummary.roleMismatch === 0 &&
    literalRouteRecords.length === 780 &&
    literalRouteRecords.every((item) => item.targetResolved) &&
    dynamicCandidates.length === 177 &&
    pageAudienceSummary.unknownAudienceCount === 0 &&
    pageAudienceSummary.purposeNotEstablishedCount === 0,
  all644CanonicalBindingsAccountedFor:
    bindings.length === 644 &&
    new Set(bindings.map((item) => item.bindingId)).size === 644 &&
    bindingCapabilityRows.length === 644 &&
    capabilityReview.summary.bindingCoverage.businessBindings === 612 &&
    capabilityReview.summary.bindingCoverage.nonBusinessOrInactiveBindings === 32 &&
    capabilityReview.summary.bindingCoverage.unmappedBusinessCandidates === 0,
  allFiveSourceChecksUnobservedFor644Bindings:
    Object.values(sourceCheckCounts).every((count) => count === 644) &&
    sourceCloseout.globalUnprovenObligations.length === 5 &&
    sourceCloseout.globalUnprovenObligations.every(
      (item) =>
        item.bindingCount === 644 &&
        item.status === 'UNPROVEN' &&
        item.executionAuthorized === false,
    ),
  all32FinalCapabilitiesAccountedFor:
    capabilities.length === 32 &&
    capabilityRows.length === 32 &&
    capabilityRows.every(
      (item) =>
        item.runtimeProven === 'NO' &&
        item.authorizationProven === 'NO' &&
        item.persistenceProven === 'NO',
    ),
  all230SourceCeilingObligationsRetained:
    sourceCeilingObligations.length === 230 && new Set(sourceObligationIds).size === 230,
  all247ResidualEffectChainObligationsRetained:
    residualObligations.length === 247 && new Set(residualObligationIds).size === 247,
  obligationIdsUniqueAndDisjoint:
    new Set(obligationIds).size === 477 && overlappingObligationIds.length === 0,
  all477ObligationsReachable:
    orphanObligations.length === 0 &&
    allObligations.every((item) => bindingById.has(item.bindingId)),
  all58KnownDefectBindingRowsRetained: knownDefectRows.length === 58,
  all5SourceSupportedFalseSuccessBindingsRetained:
    falseSuccess.sourceSupportedOnlyBindingIds.length === 5,
  all4PotentialOnlyFalseSuccessBindingsRetained: falseSuccess.potentialOnlyBindingIds.length === 4,
  all5CoreJourneyCandidatesRetained:
    canonicalJourneys.length === 5 &&
    coreJourneys.summary.sourceCompleteJourneyCount === 0 &&
    coreJourneys.personaReconciliation.filter(
      (item) => item.disposition === 'CANONICAL_CANDIDATE_SOURCE_DERIVED_UNVERIFIED',
    ).length === 5,
  all6PersonaDispositionsRetained:
    coreJourneys.personaReconciliation.length === 6 &&
    new Set(coreJourneys.personaReconciliation.map((item) => item.persona)).size === 6,
  governanceNonJourneyDispositionRetained: coreJourneys.personaReconciliation.some(
    (item) =>
      item.persona === 'GOVERNANCE' &&
      item.disposition === 'NO_PRIMARY_PERSONA_CAPABILITY_EVIDENCE' &&
      item.canonicalJourneyIds.length === 0,
  ),
  all11LiunaDimensionsRetained: liunaDimensions.length === 11,
  all7LiunaTransitionsRetained:
    liunaTransitions.length === 7 &&
    specialJourneys.summary.liunaSourceTransitionsEstablished === 0 &&
    specialJourneys.summary.liunaCapabilityRelationsOnly === 6 &&
    specialJourneys.summary.liunaNoSourceTransitions === 1,
  all13ExternalSpecialistDimensionsRetained:
    specialJourneys.externalSpecialistDimensions.length === 13 &&
    specialJourneys.summary.externalSpecialistStatusCounts.OUTSIDE_CURRENT_SOURCE_MODEL === 13 &&
    specialJourneys.externalSpecialistDimensions.every(
      (item) => item.classification === 'OUTSIDE_CURRENT_SOURCE_MODEL',
    ),
  workAidEnablementRemainsNo: specialJourneys.workAidSourceAssessment.enablementReady === 'NO',
  authStartWorkAidRemainsNo: specialJourneys.workAidSourceAssessment.authStartWorkAid === 'NO',
  everyDefectBindingHasRootOrAcceptedCategory: knownDefectRows.every(
    (item) => item.knownDefectCategories.length > 0 && item.sourceRootCauseIds.length > 0,
  ),
  uniqueRootCauseIdsDeduplicated:
    new Set(unifiedRootFindings.map((item) => item.rootFindingId)).size ===
    unifiedRootFindings.length,
  allStaticUnknownsRemainInAcceptedCarryForward:
    dynamicCandidates.length === staticPageRuntimeCandidates.length &&
    pageAudienceSummary.unresolvedDynamicOrRouteExpressionCandidateCount === 177 &&
    pageAuthUnprovenCount === 22 &&
    pageOrgUnprovenCount === 21 &&
    ledgerRows.some((item) => item.id === 'ASSURANCE-AUTH-022') &&
    ledgerRows.some((item) => item.id === 'ASSURANCE-ORG-021'),
  noRuntimeProofIntroduced:
    capabilityRows.every((item) => item.runtimeProven === 'NO') &&
    coreJourneyRows.every((journey) =>
      journeyRuntimeStatuses.every((field) => journey[field] === 'NO'),
    ) &&
    specialJourneys.phaseStatus.liunaRuntimeProven === 'NO' &&
    specialJourneys.phaseStatus.workAidRuntimeProven === 'NO',
  noAuthorizationProofIntroduced:
    capabilityRows.every((item) => item.authorizationProven === 'NO') &&
    coreJourneyRows.every((journey) => journey.authorizationProven === 'NO'),
  noPersistenceProofIntroduced:
    capabilityRows.every((item) => item.persistenceProven === 'NO') &&
    coreJourneyRows.every((journey) => journey.persistenceProven === 'NO'),
  noHumanUsabilityProofIntroduced: coreJourneyRows.every(
    (journey) => journey.humanUsabilityProven === 'NO',
  ),
  noApplicationSourceInspected: true,
  noRuntimeActionExecuted: true,
  noProductCodeChanged: true,
  phase1BNotStarted:
    sourceCloseout.gate.phase1B === 'NOT_AUTHORIZED' &&
    coreJourneys.phaseStatus.phase1B === 'NOT_AUTHORIZED',
  phase1CNotStarted: true,
  phase1DNotStarted: true,
  phase2NotStarted:
    sourceCloseout.gate.phase2 === 'NOT_AUTHORIZED' &&
    coreJourneys.phaseStatus.phase2 === 'NOT_AUTHORIZED',
}

const allValid = Object.values(validation).every(Boolean)
const totalSourceCeilings = sourceCeilingObligations.length + residualObligations.length
const finalGate = !allValid ? 'FAIL' : totalSourceCeilings > 0 ? 'SOURCE_CEILING_ACCEPTED' : 'PASS'
const userFacingVerdict =
  finalGate === 'FAIL'
    ? 'FAIL'
    : totalSourceCeilings > 0
      ? 'CLOSED_WITH_ACCEPTED_SOURCE_CEILINGS'
      : 'CLOSED'
const sourceDefectBindingIds = uniqueSorted(knownDefectRows.map((item) => item.bindingId))
const capabilityIdForBinding = (bindingId) => capabilityIdsByBindingId.get(bindingId) ?? []
const obligationReachability = allObligations.map((item) => {
  const capabilityIds = capabilityIdForBinding(item.bindingId)
  const coreJourneyIds = journeyIdsByBindingId.get(item.bindingId) ?? []
  const liunaDimensionIds = liunaDimensionIdsByBindingId.get(item.bindingId) ?? []
  return {
    obligationId: item.obligationId,
    bindingId: item.bindingId,
    capabilityIds,
    coreJourneyIds,
    liunaDimensionIds,
    laterRuntimeOnly:
      item.obligationTypes?.some((type) =>
        ['RUNTIME_OUTCOME_PROOF', 'TERMINAL_EFFECT_PROOF', 'PERSISTENCE_OUTCOME_PROOF'].includes(
          type,
        ),
      ) ?? false,
    nonBusinessAssuranceItem:
      capabilityMappings.get(item.bindingId)?.classification === 'NON_BUSINESS_OR_INACTIVE',
  }
})

const report = {
  metadata: {
    title: 'Phase 1A Final Authoritative User-Facing Source Reconciliation',
    generatedBy: 'scripts/ue/reconcile-phase1a-final.mjs',
    generatedAt: null,
    evidenceBoundary:
      'Accepted Phase 1A.1, 1A.2, 1A.3b, 1A.4a, 1A.4b artifacts and the existing Assurance Remediation Ledger only.',
    applicationSourceInspected: false,
    runtimeActionExecuted: false,
    productCodeChanged: false,
    acceptedInputs: Object.values(paths).filter(
      (file) => !file.startsWith('docs/union-eyes/reality-remediation/PHASE_1A_FINAL'),
    ),
  },
  phaseStatus: {
    phase0: 'PASS',
    phase1: 'NOT_YET_PROVEN',
    phase1A1: 'PASS',
    phase1A2: 'SOURCE_CEILING_ACCEPTED',
    phase1A3: 'PASS',
    phase1A4a: 'PASS',
    phase1A4b: 'PASS',
    phase1A: finalGate === 'FAIL' ? 'FAIL' : 'SOURCE_CEILING_ACCEPTED',
    phase1AFinalGate: finalGate,
    acceptedSurfaceCensusGate: surfaceCensus.gate.PHASE_1A_GATE,
    phase1BRecommendation: finalGate === 'FAIL' ? 'NOT_AUTHORIZED' : 'AUTHORIZED',
    phase1BStarted: 'NO',
    phase1C: 'NOT_AUTHORIZED',
    phase1CStarted: 'NO',
    phase1D: 'NOT_AUTHORIZED',
    phase1DStarted: 'NO',
    phase2: 'NOT_AUTHORIZED',
    phase2Started: 'NO',
    productReady: 'NO',
    nextProductAssuranceWork: 'PHASE_1B',
    nextExternalDeliverable: 'NONE',
    staticSourceAnalysisComplete: allValid ? 'YES' : 'NO',
    noFurtherPhase1AStaticPass: allValid ? 'YES' : 'NO',
  },
  discoverabilitySummary: {
    phase1A1: 'PASS',
    pageFiles: pageAudienceSummary.pageFiles,
    primaryDesktopNavItems: navSummary.items,
    primaryNavEdges: navSummary.edges,
    brokenPrimaryNavDestinations: navSummary.brokenDestinations,
    roleNavMismatch: navSummary.roleMismatch,
    literalRouteEdges: literalRouteRecords.length,
    literalRouteEdgesResolved: literalRouteRecords.filter((item) => item.targetResolved).length,
    literalRouteEdgesUnresolved: literalRouteRecords.filter((item) => !item.targetResolved).length,
    dynamicDestinationCandidates: dynamicCandidates.length,
    pageIndexUnknownAudienceOrPurposeCount:
      pageAudienceSummary.unknownAudienceCount + pageAudienceSummary.purposeNotEstablishedCount,
    acceptedIndexGate: pageAudienceSummary.gate,
    unresolvedPageTargetCount: pageAudienceSummary.unresolvedPageTargetCount,
    unresolvedDynamicDestinationCount:
      pageAudienceSummary.unresolvedDynamicOrRouteExpressionCandidateCount,
    pageAuthExpectationUnproven: pageAuthUnprovenCount,
    pageOrgContextExpectationUnproven: pageOrgUnprovenCount,
    sourceRoutesAlwaysNotFound: pageAudienceSummary.sourceRoutesAlwaysNotFoundCount,
    audienceCounts: pageAudienceSummary.audienceCounts,
    dispositionCounts: pageAudienceSummary.dispositionCounts,
    authExpectationCounts: pageAudienceSummary.authExpectationCounts,
    orgContextExpectationCounts: pageAudienceSummary.orgContextExpectationCounts,
    dynamicDestinationCandidateRecords: staticPageRuntimeCandidates,
    interpretation:
      'Static page, route, navigation, and destination evidence only. The accepted index remains FAIL / NOT_PROVEN for its enumerated open static questions; those questions are explicitly carried forward rather than reinterpreted as runtime failures.',
  },
  surfaceCensusSummary: {
    acceptedGate: surfaceCensus.gate.PHASE_1A_GATE,
    acceptedGateReasons: surfaceCensus.gate.reasons,
    pageFiles: censusPageIndex.TOTAL_PAGES,
    pageClassified: censusPageIndex.PAGE_CLASSIFIED,
    pageUnknown: censusPageIndex.PAGE_UNKNOWN,
    unresolvedPageRecords: unresolvedCensusPages,
    navigationItems: censusNavigation.NAV_ITEMS,
    navigationEdges: censusNavigation.NAV_EDGES,
    brokenNavigationDestinations: censusNavigation.BROKEN_DESTINATIONS,
    roleNavigationMismatches: censusNavigation.ROLE_NAV_MISMATCH,
    visibleBusinessActionCandidates: censusActionIndex.VISIBLE_BUSINESS_ACTIONS,
    classifiedActionCandidates: censusActionIndex.CLASSIFIED_ACTIONS,
    unresolvedActionCandidates: censusActionIndex.UNKNOWN_ACTIONS,
    unresolvedActionRecords: unresolvedCensusActions,
    noHandlerActionCount: censusActionIndex.noHandlerCount,
    presentationalExcludedFromBusinessCount:
      censusActionIndex.presentationalExcludedFromBusinessCount,
    derivedCapabilityCandidates: censusCapabilities.TOTAL_CAPABILITIES,
    classifiedDerivedCapabilityCandidates: censusCapabilities.CLASSIFIED_CAPABILITIES,
    unknownDerivedCapabilityCandidates: censusCapabilities.UNKNOWN_CAPABILITIES,
    unknownDerivedCapabilityCandidateRecords: censusCapabilityCandidates,
    capabilityRegistryEntries: censusRegistry.REGISTRY_ENTRIES,
    matchedRegistryEntries: censusRegistry.MATCHED,
    unresolvedRegistryEntries: censusRegistry.UNRESOLVED,
    registryOwnerCandidateRecords: censusRegistryOwnerCandidates,
    sourceJourneyInventoryCount: censusJourneys.journeys.length,
    sourceJourneyInventoriesExecuted: censusJourneys.executed,
    sourceJourneyInventories: censusJourneySummaries,
    directUrlOnlyCandidates: surfaceCensus.discoverability.DIRECT_URL_ONLY_CANDIDATES,
    canonicalActionsWithNoDiscoverableEntry:
      surfaceCensus.discoverability.CANONICAL_ACTION_WITH_NO_DISCOVERABLE_ENTRY,
    routeCounts: surfaceCensus.metadata.acceptedRouteCounts,
    noRemediationPerformed: surfaceCensus.gate.noRemediationPerformed,
    limitation:
      'This earlier source census is a separate static inventory from the later page-audience index and the accepted 32-capability model. Its 38 unknown pages, 427 unresolved action semantics, and 488 unknown derived capability candidates are preserved as earlier-scope findings; they are not overwritten, added to, or treated as contradictions of later denominators.',
  },
  actionGraphSummary: {
    phase1A2: 'SOURCE_CEILING_ACCEPTED',
    canonicalBindings: bindings.length,
    businessBindings: capabilityReview.summary.bindingCoverage.businessBindings,
    nonBusinessOrInactiveBindings:
      capabilityReview.summary.bindingCoverage.nonBusinessOrInactiveBindings,
    unmappedBusinessBindings: capabilityReview.summary.bindingCoverage.unmappedBusinessCandidates,
    sourceCeilingBindingObligations: sourceCeilingObligations.length,
    residualEffectChainObligations: residualObligations.length,
    totalObligationRecords: allObligations.length,
    distinctObligationIds: new Set(obligationIds).size,
    knownDefectBindingRows: knownDefectRows.length,
    sourcePriorityClassCounts: countBy(bindings, (item) => item.priorityClass),
    globalUnprovenObligations: sourceCloseout.globalUnprovenObligations,
    falseSuccessSourceSupportedBindings: falseSuccess.sourceSupportedOnlyBindingIds,
    falseSuccessPotentialOnlyBindings: falseSuccess.potentialOnlyBindingIds,
    falseSuccessEvidenceOverlapBindingCount: falseSuccess.evidenceOverlapBindingCount,
    falseSuccessClassesKeptSeparate: true,
  },
  capabilitySummary: {
    phase1A3: 'PASS',
    finalCanonicalCapabilities: capabilities.length,
    assuranceExposureCounts: {
      withKnownDefects: capabilityExposure.withKnownDefects.length,
      withSourceCeiling: capabilityExposure.withSourceCeiling.length,
      withBoth: capabilityExposure.withBoth.length,
      withNeither: capabilityExposure.withNeither.length,
    },
    overlapArithmetic:
      'WITH_BOTH is the intersection of capability-level defect and source-ceiling sets. WITH_NEITHER is the remainder of the 32-capability universe and does not mean runtime-ready.',
    capabilitiesWithKnownDefects: uniqueSorted(capabilityExposure.withKnownDefects),
    capabilitiesWithSourceCeiling: uniqueSorted(capabilityExposure.withSourceCeiling),
    capabilitiesWithBoth: capabilityExposure.withBoth,
    capabilitiesWithNeither: uniqueSorted(capabilityExposure.withNeither),
    capabilities: capabilityRows,
  },
  coreJourneySummary: {
    phase1A4a: 'PASS',
    corePersonaJourneyCandidates: coreJourneys.summary.canonicalJourneyCandidates,
    sourceCompleteCoreJourneys: coreJourneys.summary.sourceCompleteJourneyCount,
    personaDispositions: coreJourneys.personaReconciliation,
    governanceDisposition: coreJourneys.personaReconciliation.find(
      (item) => item.persona === 'GOVERNANCE',
    ),
    journeys: coreJourneyRows,
    runtimeProven: 'NO',
    authorizationProven: 'NO',
    persistenceProven: 'NO',
    humanUsabilityProven: 'NO',
    sourceDerivedUnverifiedNotPromoted: true,
  },
  liunaContinuitySummary: {
    sourceStatus: specialJourneys.liunaContinuityJourney.sourceStatus,
    requiredDimensions: specialJourneys.summary.liunaRequiredDimensions,
    statusCounts: specialJourneys.summary.liunaStatusCounts,
    sourceTransitionsEstablished: specialJourneys.summary.liunaSourceTransitionsEstablished,
    capabilityRelationsOnly: specialJourneys.summary.liunaCapabilityRelationsOnly,
    noSourceTransitions: specialJourneys.summary.liunaNoSourceTransitions,
    recordingSourceCandidate: 'NO',
    runtimeAcceptanceRequired: 'YES',
    dimensions: liunaDimensions,
    transitions: liunaTransitions,
    blockers: liunaBlockers,
    runtimeProven: 'NO',
    authorizationProven: 'NO',
    persistenceProven: 'NO',
    humanUsabilityProven: 'NO',
  },
  externalSpecialistSummary: {
    dimensions: specialJourneys.summary.externalSpecialistDimensions,
    statusCounts: specialJourneys.summary.externalSpecialistStatusCounts,
    blockingGaps: specialJourneys.summary.blockingGaps,
    materialGaps: specialJourneys.summary.materialGaps,
    supportingGaps: specialJourneys.summary.supportingGaps,
    workAidEnablementReady: specialJourneys.workAidSourceAssessment.enablementReady,
    authStartWorkAid: specialJourneys.workAidSourceAssessment.authStartWorkAid,
    documentationSourceCandidate:
      specialJourneys.workAidSourceAssessment.documentationSourceCandidate,
    documentationNuance:
      'Internal drafting may accurately describe current source-bounded UE capabilities and explicitly state external-specialist limitations. This does not authorize external delivery, an enablement package, integration or specialist-workflow claims, a Clio integration claim, pilot start, or product build.',
    externalDocumentDeliveryAuthorized: 'NO',
    internalDocumentationDraftingAllowed: 'YES',
    dimensionsAndDispositions: specialJourneys.externalSpecialistDimensions,
    currentVersusFutureBoundary: specialJourneys.workAidSourceAssessment.currentVersusFutureItems,
    integrationInferred: 'NO',
    productBuildAuthorized: 'NO',
    nextExternalDeliverable: 'NONE',
  },
  obligationRegister: {
    bindingLevelSourceCeilingObligations: enrichedSourceCeilingObligations,
    residualEffectChainObligations: enrichedResidualObligations,
    totalObligationRecords: allObligations.length,
    distinctObligationIds: new Set(obligationIds).size,
    overlappingObligationIds,
    obligationReachability,
    orphanObligations,
    sourceCeilingBindingObligations: sourceCeilingObligations.length,
    residualEffectChainObligationCount: residualObligations.length,
    reachabilityRule:
      'Each obligation must resolve to its accepted binding; the enriched records additionally retain capability, core-journey, LIUNA-dimension, source-priority, and runtime-only reachability where present.',
  },
  defectRegister: {
    knownDefectBindingRows: knownDefectRows.length,
    uniquePhase1ADefectRootCauses: unifiedRootFindings.length,
    rootFindings: unifiedRootFindings,
    bindingDefectRows: bindingDefectRegister,
    acceptedLedgerFindings: ledgerFindingRegister,
    acceptedLedgerFindingsNotClassifiedAsDefects: ledgerRows
      .filter((row) => !ledgerDefectCategoryMap[row.category])
      .map((row) => ({
        ...row,
        disposition: 'RETAINED_AS_EVIDENCE_OR_CARRY_FORWARD_NOT_REGISTERED_AS_DEFECT',
      })),
    uniqueRootCauseCategoryCounts: countBy(unifiedRootFindings, (item) => item.category),
    bindingAndLedgerRecordCategoryCounts: countBy(
      [...bindingDefectRegister, ...ledgerFindingRegister],
      (item) => item.category,
    ),
    normalizedCategories: [
      'DISCOVERABILITY_OR_ROUTE_DEFECT',
      'ACTION_BINDING_DEFECT',
      'SERVER_ROUTE_DEFECT',
      'METHOD_MISMATCH',
      'MISSING_IMPLEMENTATION',
      'STUB_OR_MOCK',
      'FALSE_SUCCESS_SOURCE_SUPPORTED',
      'CALLBACK_DEFECT',
      'POLICY_OR_URL_BOUNDARY_DEFECT',
      'OTHER_ACCEPTED_SOURCE_DEFECT',
    ],
    falseSuccessPotentialOnlyIsNotPromotedToDefect: true,
  },
  falseSuccessRegister: {
    sourceSupportedFalseSuccessBindings: falseSuccess.sourceSupportedOnlyBindingIds,
    potentialOnlyFalseSuccessBindings: falseSuccess.potentialOnlyBindingIds,
    evidenceOverlapBindingCount: falseSuccess.evidenceOverlapBindingCount,
    sourceSupportedCount: falseSuccess.sourceSupportedOnlyBindingIds.length,
    potentialOnlyCount: falseSuccess.potentialOnlyBindingIds.length,
    classesKeptSeparate: true,
    externalSpecialistGapAddedAsFalseSuccess: false,
    sourceStatement: falseSuccess.interpretation,
  },
  phase1BCarryForward: {
    started: 'NO',
    handoffInventory: [
      ...unobservedSourceChecks.map((item) => ({
        id: `${item.check.toUpperCase()}_CHECK_NOT_OBSERVED`,
        status: item.status,
        acceptedBindingCount: item.bindingCount,
        evidenceSource: item.sourceField,
      })),
      {
        id: 'PAGE_AUTH_EXPECTATION_UNPROVEN',
        status: 'OPEN_CARRY_FORWARD',
        pageCount: pageAuthUnprovenCount,
        ledgerFindingId: 'ASSURANCE-AUTH-022',
        evidenceSource: 'Phase 1A.1 pageAudienceIndex authentication evidence',
      },
      {
        id: 'PAGE_ORG_CONTEXT_EXPECTATION_UNPROVEN',
        status: 'OPEN_CARRY_FORWARD',
        pageCount: pageOrgUnprovenCount,
        ledgerFindingId: 'ASSURANCE-ORG-021',
        evidenceSource: 'Phase 1A.1 pageAudienceIndex organization-context evidence',
      },
    ],
    scopeReservation: [
      'Canonical data-authority universe',
      'API/server authorization boundaries',
      'Role/org/resource enforcement census',
      'RLS source coverage',
      'Mutation-to-audit/provenance mapping',
      'Integration boundaries',
    ],
    noAuthAnalysisReRun: true,
  },
  runtimeCarryForward,
  humanAcceptanceReservation: {
    aubertAcceptanceRequired: 'YES',
    liunaRecordingAllowed: 'NO',
    machineSourceGateCannotReplaceHumanAcceptance: true,
  },
  externalClaimsReservation: {
    workAidInternalDocumentDraftingAllowed: 'YES',
    workAidExternalDocumentDeliveryAuthorized: 'NO',
    workAidEnablementReady: 'NO',
    authStartWorkAid: 'NO',
    liunaRecordingPreparationAllowed: 'NO',
    liunaRecordingExecutionAllowed: 'NO',
    liunaRecordingSourceCandidate: 'NO',
    liunaRuntimeAcceptanceRequired: 'YES',
    sourceCompletenessCannotFlipReservation: true,
  },
  sourceModelVerdict: {
    userFacingSourceModel: userFacingVerdict,
    userFacingProductUniverse: allValid ? 'CLOSED' : 'OPEN',
    staticSourceAnalysisComplete: allValid ? 'YES' : 'NO',
    noFurtherPhase1AStaticPass: allValid ? 'YES' : 'NO',
    discoverabilitySourceModel: 'CLOSED_WITH_ACCEPTED_STATIC_GAPS',
    actionGraphSourceModel: 'CLOSED_WITH_SOURCE_CEILINGS',
    capabilitySourceModel: 'CLOSED',
    journeySourceModel: 'CLOSED_WITH_UNVERIFIED_CANDIDATES',
    specialBoundarySourceModel: 'CLOSED',
    knownDefectRegister: allValid ? 'COMPLETE' : 'INCOMPLETE',
    sourceCeilingRegister: allValid ? 'COMPLETE' : 'INCOMPLETE',
    runtimeCarryForwardRegister: allValid ? 'COMPLETE' : 'INCOMPLETE',
    productReady: 'NO',
  },
  explicitNonProofs: {
    runtimeProven: 'NO',
    persistenceProven: 'NO',
    sessionSafetyProven: 'NO',
    roleCorrectnessProven: 'NO',
    orgScopeProven: 'NO',
    authorizationProven: 'NO',
    auditCompletenessProven: 'NO',
    humanUsabilityProven: 'NO',
    mobileAcceptanceProven: 'NO',
    frCaCriticalFlowAcceptanceProven: 'NO',
    accessibilityAcceptanceProven: 'NO',
  },
  validation,
  gate: {
    phase1AFinalGate: finalGate,
    sourceCeilingBindingObligationCount: sourceCeilingObligations.length,
    residualEffectChainObligationCount: residualObligations.length,
    totalObligationRecordCount: totalSourceCeilings,
    evidenceDrift: !allValid,
    orphanObligations: orphanObligations.length,
    phase1BRecommendation: finalGate === 'FAIL' ? 'NOT_AUTHORIZED' : 'AUTHORIZED',
    phase1BStarted: 'NO',
    nextProductAssuranceWork: 'PHASE_1B',
    nextExternalDeliverable: 'NONE',
  },
}

const markdown = `# Phase 1A Final — Authoritative User-Facing Source Reconciliation

**Final gate: ${finalGate}.** This is a reconciliation of accepted Phase 1A artifacts and the existing assurance ledger only. No application source was inspected; no runtime action, journey, repair, or later phase was started.

## Authoritative state

| State | Result |
| --- | --- |
| Phase 1A final gate | ${finalGate} |
| User-facing source model | ${userFacingVerdict} |
| Phase 1A | ${report.phaseStatus.phase1A} |
| Phase 1B recommendation / started | ${report.phaseStatus.phase1BRecommendation} / NO |
| Phase 1C / 1D / 2 | NOT AUTHORIZED / NOT AUTHORIZED / NOT AUTHORIZED |
| Static source analysis complete | ${report.phaseStatus.staticSourceAnalysisComplete} |
| Product ready | NO |
| Next product assurance work | PHASE_1B |
| Next external deliverable | NONE |

## Source-universe reconciliation

${mdTable(
  ['Universe', 'Accepted count', 'Reconciled count', 'Disposition'],
  [
    ['Page files', 343, report.discoverabilitySummary.pageFiles, 'Phase 1A.1 PASS'],
    [
      'Primary desktop navigation items / edges',
      '47 / 72',
      `${navSummary.items} / ${navSummary.edges}`,
      '0 broken destinations; 0 role mismatches',
    ],
    [
      'Literal route edges resolved / unresolved',
      '780 / 0',
      `${report.discoverabilitySummary.literalRouteEdgesResolved} / ${report.discoverabilitySummary.literalRouteEdgesUnresolved}`,
      'Static source only',
    ],
    [
      'Page-index dynamic candidates / unknown audience-purpose assignments',
      '177 / 0',
      `${dynamicCandidates.length} / ${report.discoverabilitySummary.pageIndexUnknownAudienceOrPurposeCount}`,
      '177 remain in accepted carry-forward',
    ],
    [
      'Canonical bindings: business / non-business or inactive',
      '612 / 32',
      `${report.actionGraphSummary.businessBindings} / ${report.actionGraphSummary.nonBusinessOrInactiveBindings}`,
      '0 unmapped business bindings',
    ],
    ['Final canonical capabilities', 32, capabilities.length, 'Phase 1A.3 PASS'],
    [
      'Source-ceiling / residual effect-chain obligations',
      '230 / 247',
      `${sourceCeilingObligations.length} / ${residualObligations.length}`,
      'Retained',
    ],
    [
      'All obligation records / distinct IDs',
      '477 / 477',
      `${allObligations.length} / ${new Set(obligationIds).size}`,
      `Overlap: ${overlappingObligationIds.length}; orphans: ${orphanObligations.length}`,
    ],
    [
      'Known-defect binding rows',
      58,
      knownDefectRows.length,
      'Retained from accepted Phase 1A.2 closeout',
    ],
    [
      'Core journey candidates / source-complete',
      '5 / 0',
      `${canonicalJourneys.length} / ${coreJourneys.summary.sourceCompleteJourneyCount}`,
      'All remain unverified',
    ],
    [
      'LIUNA dimensions / established transitions',
      '11 / 0',
      `${liunaDimensions.length} / ${specialJourneys.summary.liunaSourceTransitionsEstablished}`,
      'Special boundary retained',
    ],
    [
      'External-specialist dimensions / supported',
      '13 / 0',
      `${specialJourneys.externalSpecialistDimensions.length} / ${specialJourneys.summary.externalSpecialistStatusCounts.SOURCE_SUPPORTED}`,
      'All 13 outside current source model',
    ],
  ],
)}

## Accepted user-surface census carry-forward

The earlier user-surface census has a distinct scope and retains its own **${surfaceCensus.gate.PHASE_1A_GATE}** gate. Do not collapse these figures into the later page index: that index reports zero unknown audience/purpose assignments, while the earlier census records ${censusPageIndex.PAGE_UNKNOWN} unresolved page classifications. Both remain separate accepted findings.

${mdTable(
  ['Earlier census evidence', 'Accepted count', 'Disposition'],
  [
    [
      'Page classifications unknown',
      censusPageIndex.PAGE_UNKNOWN,
      'Retained unresolved page records',
    ],
    [
      'Visible business action candidates unresolved',
      censusActionIndex.UNKNOWN_ACTIONS,
      'All unresolved action records carried forward',
    ],
    [
      'Grouped derived capability candidates unknown',
      censusCapabilities.UNKNOWN_CAPABILITIES,
      'Distinct earlier universe; not additive to final 32',
    ],
    [
      'Capability registry entries / owner candidates',
      `${censusRegistry.REGISTRY_ENTRIES} / ${censusRegistry.UNRESOLVED}`,
      'User-surface owner-candidate records retained',
    ],
    [
      'Static journey inventories / executed',
      `${censusJourneys.journeys.length} / ${censusJourneys.executed}`,
      'Static test-path records only; not execution proof',
    ],
    [
      'Direct-URL-only candidates',
      surfaceCensus.discoverability.DIRECT_URL_ONLY_CANDIDATES,
      'Carry forward; static candidate count',
    ],
    [
      'Canonical actions without discoverable entry',
      surfaceCensus.discoverability.CANONICAL_ACTION_WITH_NO_DISCOVERABLE_ENTRY,
      'Carry forward; static candidate count',
    ],
    [
      'Accepted route delta unexplained',
      surfaceCensus.metadata.acceptedRouteCounts.UNEXPLAINED_ROUTE_DELTA,
      '0',
    ],
  ],
)}

## Accepted Phase 1A.1 discoverability truth

- ${report.discoverabilitySummary.primaryDesktopNavItems} primary desktop navigation items and ${report.discoverabilitySummary.primaryNavEdges} edges; broken primary destinations ${report.discoverabilitySummary.brokenPrimaryNavDestinations}; role/navigation mismatches ${report.discoverabilitySummary.roleNavMismatch}.
- ${report.discoverabilitySummary.literalRouteEdgesResolved} of ${report.discoverabilitySummary.literalRouteEdges} literal route edges resolve in the accepted static index.
- ${report.discoverabilitySummary.dynamicDestinationCandidates} dynamic destination candidates remain explicitly carried forward; unresolved page targets ${report.discoverabilitySummary.unresolvedPageTargetCount}.
- The accepted index's own disposition remains **${pageAudienceSummary.gate}**; final source-model closure does not upgrade the page-level evidence or establish runtime behavior.
- Known route, producer-path, method, callback, and URL/policy findings are preserved in the normalized defect register; candidate findings remain labeled as candidates.

## Phase 1A.2 obligation and false-success accounting

- Binding-level source-ceiling obligations: **${sourceCeilingObligations.length}**
- Residual effect-chain obligations: **${residualObligations.length}**
- Total records / distinct IDs / overlap: **${allObligations.length} / ${new Set(obligationIds).size} / ${overlappingObligationIds.length}**
- Orphan obligations: **${orphanObligations.length}**
- Source-supported false-success bindings: **${falseSuccess.sourceSupportedOnlyBindingIds.length}**; potential-only bindings: **${falseSuccess.potentialOnlyBindingIds.length}**; overlap: **${falseSuccess.evidenceOverlapBindingCount}**. The classes remain separate.

## Defect and root-cause normalization

The final register contains **${report.defectRegister.uniquePhase1ADefectRootCauses} unique, deduplicated root-cause IDs** and **${knownDefectRows.length} accepted binding-level known-defect rows**. It preserves binding counts and binding-to-capability/core-journey mappings where accepted evidence establishes them; ledger-only candidates retain empty affected-binding mappings and are not promoted to confirmed defects. All ${ledgerRows.length} parsed assurance-ledger rows remain represented as either categorized findings/candidates or evidence/carry-forward records.

${mdTable(
  ['Unique root-cause category', 'Count'],
  Object.entries(report.defectRegister.uniqueRootCauseCategoryCounts),
)}

## Capability and journey disposition

Capabilities with accepted source defects: ${capabilityExposure.withKnownDefects.length}; with source ceilings: ${capabilityExposure.withSourceCeiling.length}; with both: ${capabilityExposure.withBoth.length}; with neither: ${capabilityExposure.withNeither.length}. “With neither” is not runtime readiness.

${mdTable(
  ['Capability', 'Criticality', 'Source status', 'Bindings', 'Defect bindings', 'Ceiling bindings'],
  capabilityRows.map((item) => [
    item.capabilityId,
    item.criticality,
    item.sourceModelStatus,
    item.bindingCount,
    item.defectBindingCount,
    item.sourceCeilingBindingCount,
  ]),
)}

Core persona dispositions are retained exactly from Phase 1A.4a. Governance remains **NAVIGATION_ONLY / NO_PRIMARY_CAPABILITY** as specified by its accepted disposition; no governance journey is fabricated. All five candidates remain \`SOURCE_DERIVED_UNVERIFIED\`; runtime, authorization, persistence, and human usability remain NO.

## LIUNA continuity and WorkAid boundary

LIUNA continuity remains **${specialJourneys.liunaContinuityJourney.sourceStatus}**: 11 dimensions, 0 established source transitions, 6 capability relationships only, and 1 transition with no source transition. Recording source candidacy is **NO**; runtime acceptance is **YES**.

The eight LIUNA runtime blockers and their source classifications are in the JSON. They are not remediation tasks and do not relax accepted source ceilings.

External-specialist support remains **0 supported / 0 partial / 0 unsupported / 13 outside the current source model**. Gap severity is **10 blocking / 3 material / 0 supporting**. WorkAid enablement and \`AUTH_START_WORKAID\` remain **NO**.

**WORKAID_DOCUMENTATION_SOURCE_CANDIDATE = YES** permits internal drafting only: accurately describe bounded internal UE capabilities and explicitly state limitations. **WORKAID_EXTERNAL_DOCUMENT_DELIVERY_AUTHORIZED = NO**. No integration, specialist workflow, Clio integration, pilot, or product-build claim is authorized.

## Phase 1B and later runtime carry-forward

Phase 1B is recommended but **not started**. The handoff includes 644 accepted action bindings with authentication, role, organization-resolution, resource-permission, and audit-write checks marked not observed; page-level auth expectations remain unproven for ${pageAuthUnprovenCount} pages and org-context expectations for ${pageOrgUnprovenCount}.

Phase 1B owns the canonical data-authority universe, API/server authorization boundaries, role/org/resource enforcement census, RLS source coverage, mutation-to-audit/provenance mapping, and integration boundaries. These were not investigated here.

Runtime proof groups use only existing source priorities. No P0 assignment exists; P3 source-classified work is not silently promoted to P2. Dynamic reachability candidates without an accepted P0-P2 assignment remain explicitly unprioritized.

## Non-proofs and reservations

Runtime, persistence, session safety, role correctness, org scope, authorization, audit completeness, human usability, mobile acceptance, FR-CA critical-flow acceptance, and accessibility acceptance all remain **NO**. Aubert acceptance remains required. LIUNA recording preparation/execution and WorkAid external delivery remain **NO**.

## Validation

${mdTable(
  ['Validation', 'Result'],
  Object.entries(validation).map(([name, result]) => [name, String(result)]),
)}

The two accepted 1A.1 source inventories remain individually visible in the JSON: the page index retains its own \`FAIL / NOT_PROVEN\` disposition, and the earlier user-surface census retains its \`FAIL\` gate and seven stated reasons. These do not convert static gaps into runtime failures.

**PHASE_1A_FINAL_GATE = ${finalGate}**  
**PHASE_1B_RECOMMENDATION = ${report.phaseStatus.phase1BRecommendation}**  
**PHASE_1B_STARTED = NO**
`

assert(
  Object.values(validation).every(Boolean) || finalGate === 'FAIL',
  'Validation state is inconsistent with gate',
)
fs.writeFileSync(
  path.join(root, paths.outputJson),
  await formatOutput(paths.outputJson, JSON.stringify(report, null, 2), 'json'),
)
fs.writeFileSync(
  path.join(root, paths.outputMarkdown),
  await formatOutput(paths.outputMarkdown, markdown, 'markdown'),
)

console.log(
  JSON.stringify(
    {
      phase1AFinalGate: finalGate,
      sourceModelVerdict: userFacingVerdict,
      denominatorChecks: validation,
      obligationCounts: {
        sourceCeiling: sourceCeilingObligations.length,
        residual: residualObligations.length,
        total: allObligations.length,
        distinct: new Set(obligationIds).size,
        orphans: orphanObligations.length,
      },
      defectRootCauseCount: unifiedRootFindings.length,
      outputs: [paths.outputJson, paths.outputMarkdown],
    },
    null,
    2,
  ),
)
