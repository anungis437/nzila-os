import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const base = 'docs/union-eyes/reality-remediation/'
const predecessorName = 'PHASE_1B_3A_RLS_TENANT_ISOLATION_SURFACE_CENSUS'
const outputName = 'PHASE_1B_3B_STATIC_RLS_POLICY_CORRECTNESS_RECONCILIATION'
const predecessorHash = '5755b17e89fbb81b3afb1b6fda4e18ba107153cd52680bad21041e466c13a883'
const hash = (value) => createHash('sha256').update(value).digest('hex')
const digest = (value) => hash(JSON.stringify(value))
const id = (kind, key) => `UE-1B3B-${kind}-${hash(key).slice(0, 16)}`
const unique = (values) => [...new Set(values)].sort()
const absolute = (file) => path.resolve(root, ...file.split('/'))
await normalizeAcceptedArtifacts()
process.exit(0)

async function normalizeAcceptedArtifacts() {
  const frozenEvidenceHashes = {
    OBJECT_EVIDENCE: 'ec9fcb24f748bf6dc6b7df4d971d95de2fbf62b20ed39862df6cfd15e22891df',
    POLICY_EVIDENCE: '25d7c12ba46ce1d15808232992831f0885d8d04612bd9b8d6d661a01baea98d7',
    COMMAND_ANALYSES: 'a6fd68371e4afb222184bd10dbdaca5c29bc025c628e2c0975cee9bd1ea62ca8',
    POLICY_COMPOSITION_EVIDENCE: '9322ad44932b0ec7218f09920ec896e87c3c114827c6f7d282fe581aaff0fe08',
    STATIC_FINDINGS: '24f672f1ef90bd6d291dd1fd2d8ed20a348f974949e2d7b8637c5c21e38b3acb',
    CORRECTNESS_CEILINGS: '5ed0364d7cdae1adbc722c291ede8e802522658f6320be67b96baf30181c8f91',
    CONTEXT_EVIDENCE: '3ac05ea17e8abfff94ffc870d97c177dd3936362278348ec7e44f2838fe18ae3',
    PRIVILEGED_CLIENT_EVIDENCE: 'fe3624509e04ce7b2f27585cf2c288b9c9bf9341d31dad44c8c5c5d5ec61c291',
    FUNCTION_EVIDENCE: 'e2fc71a137ac583194e3537c19f1619494d01faf1a630e17d32d621d90e23285',
    GRANT_EVIDENCE: 'a27148d2a6badb17f9789f12b9bc70e3c0c02f30388ab5da8447af75981553b4',
    RUNTIME_PROOF_PACKET_EVIDENCE:
      '68b4ec96563ca90c5e0fd5ecd05c7846d7831cdec0acd19c96cb6aba9bfda45c',
    PREDECESSOR_CARRY_FORWARDS: '2ea1e58b63e6c73fb7b5253c857d20c7f0aec5077335d0645581765e1af8ce93',
    ENTRY_BOUNDARY_SOURCE_REGISTRY:
      '726e0e8139ff4e2b79633586c1b381c0459d26099d9eaba87c135c1b6758e941',
    SOURCE_EVIDENCE_REGISTRY: '4f7f50368ef02fd2dd0d17f3c1b6cb80fe54b46b193505874c79f66478204f7e',
    CONTEXT_PRIMITIVE_CONTRACTS: '8309102eaab69932eeb37a7801c8d6677170fd8c7d3155116b0eacf93a94711f',
    DATABASE_CLIENT_CONTRACTS: 'bbda642bdbd6baa49625e4d4308cf372d62595131fd816cd1be074cdf17ad981',
    GRANT_SOURCE_CONTRACTS: 'b80cbe29b7e5a5e01744b4e49898a675a271339c5f6b94a2a3f079c05c44d477',
    INLINE_DECLARATION_CANDIDATES:
      '6c0d0d4cc26f257813d4ef185f91c6d4b6f25ac80dbdac634ba008e8a27ba838',
    DISCOVERED_OBJECT_REGISTER: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    PREDECESSOR_INPUT_FINGERPRINTS:
      '9a700160ad0e1a64f4f09b90af2c8ff877a8729ae5f2df4a9aa90374e14e55a1',
  }
  const inputA = `${base}${predecessorName}.json`
  const inputB = `${base}${outputName}.json`
  const bytesA = readFileSync(absolute(inputA))
  assert.equal(hash(bytesA), predecessorHash, 'FAIL_EVIDENCE_DRIFT: B3A bytes')
  const a = JSON.parse(bytesA.toString('utf8'))
  const bytesB = readFileSync(absolute(inputB))
  const b = JSON.parse(bytesB.toString('utf8'))
  if (!b.statusNormalization)
    assert.equal(
      hash(bytesB),
      'cca0edbd11e1a4a4619b6eb4d0d69de0a6d018a734b67ff93a7bbcb610b77b19',
      'FAIL_EVIDENCE_DRIFT: accepted B3B bytes',
    )
  function evidencePayloads(report) {
    return {
      OBJECT_EVIDENCE: report.objectRecords.map(
        ({ STATIC_CORRECTNESS_DISPOSITION, ...record }) => record,
      ),
      POLICY_EVIDENCE: report.policyExpressionAnalyses,
      COMMAND_ANALYSES: report.policyExpressionAnalyses.map(
        (record) => record.EXPRESSIONS_BY_COMMAND_AND_DIRECTION,
      ),
      POLICY_COMPOSITION_EVIDENCE: report.policyCombinations,
      STATIC_FINDINGS: report.staticCorrectnessFindings,
      CORRECTNESS_CEILINGS: report.sourceCeilings,
      CONTEXT_EVIDENCE: report.objectRecords.map((record) => record.CONTEXT_CORRECTNESS),
      PRIVILEGED_CLIENT_EVIDENCE: report.objectRecords.map(
        (record) => record.PRIVILEGED_CLIENT_REACHABILITY,
      ),
      FUNCTION_EVIDENCE: report.helperFunctionReconciliation,
      GRANT_EVIDENCE: report.grantReconciliation,
      RUNTIME_PROOF_PACKET_EVIDENCE: report.proposedNextGatePacket,
      PREDECESSOR_CARRY_FORWARDS: report.predecessorCarryForward,
      ENTRY_BOUNDARY_SOURCE_REGISTRY: report.entryBoundarySourceRegistry,
      SOURCE_EVIDENCE_REGISTRY: report.sourceEvidenceRegistry,
      CONTEXT_PRIMITIVE_CONTRACTS: report.contextPrimitiveSourceContracts,
      DATABASE_CLIENT_CONTRACTS: report.databaseClientSourceContracts,
      GRANT_SOURCE_CONTRACTS: report.relevantGrantSourceContracts,
      INLINE_DECLARATION_CANDIDATES: report.inlineDeclarationSourceCandidates,
      DISCOVERED_OBJECT_REGISTER: report.post1B3ADiscoveredObjects,
      PREDECESSOR_INPUT_FINGERPRINTS: report.metadata,
    }
  }
  const evidenceHashes = (report) =>
    Object.fromEntries(
      Object.entries(evidencePayloads(report)).map(([key, value]) => [key, digest(value)]),
    )
  const beforeHashes = evidenceHashes(b)
  assert.deepEqual(beforeHashes, frozenEvidenceHashes, 'FAIL_EVIDENCE_DRIFT: substantive payloads')
  const enumDispositions = [
    'STATIC_RLS_MATCH',
    'STATIC_RLS_PARTIAL',
    'STATIC_RLS_REQUIRED_CONTROL_MISSING',
    'STATIC_RLS_SEMANTIC_MISMATCH',
    'STATIC_RLS_REQUIREMENT_CEILING',
    'STATIC_RLS_POLICY_CEILING',
    'MIXED_STATIC_RLS_RESULT',
  ]
  const enumDimensions = [
    'STATIC_MATCH',
    'STATIC_PARTIAL',
    'STATIC_REQUIRED_CONTROL_MISSING',
    'STATIC_SEMANTIC_MISMATCH',
    'NOT_APPLICABLE',
    'REQUIREMENT_SOURCE_CEILING',
    'POLICY_SOURCE_CEILING',
    'RUNTIME_CATALOG_EVIDENCE_REQUIRED',
  ]
  const enumReconciliations = [
    'RESOLVED_BY_STATIC_ANALYSIS',
    'RETAINED_AS_REQUIREMENT_CEILING',
    'RETAINED_AS_POLICY_CEILING',
    'RETAINED_AS_RUNTIME_CATALOG_CEILING',
    'SPLIT_INTO_MULTIPLE_B3B_CEILINGS',
  ]
  const enumProofClasses = [
    'CROSS_ORG_READ',
    'CROSS_ORG_INSERT',
    'CROSS_ORG_UPDATE',
    'CROSS_ORG_DELETE',
    'OWNER_RLS',
    'BYPASSRLS_ROLE',
    'PRIVILEGED_CLIENT',
    'CONTEXT_ISOLATION',
    'CONNECTION_POOL_CONTEXT_LEAKAGE',
    'FUNCTION_EXECUTION',
    'GRANT_EFFECT',
    'OTHER_EXPLICIT',
  ]
  const enumProofStates = [
    'READY_FOR_RUNTIME_PROOF',
    'BLOCKED_BY_KNOWN_STATIC_DEFECT',
    'BLOCKED_BY_REQUIREMENT_DECISION',
    'BLOCKED_BY_FIXTURE_OR_ENVIRONMENT_PRECONDITION',
    'CATALOG_EVIDENCE_ONLY',
  ]
  const uniqueIds = (records, field, count) => {
    const ids = new Set(records.map((record) => record[field]))
    assert.equal(ids.size, records.length, `FAIL_EVIDENCE_DRIFT: duplicate ${field}`)
    assert.ok(!ids.has(undefined), `Missing ${field}`)
    if (count !== undefined) assert.equal(ids.size, count)
    return ids
  }
  const objectIds = uniqueIds(b.objectRecords, 'OBJECT_ID', 612)
  const policyIds = uniqueIds(b.policyExpressionAnalyses, 'POLICY_ID', 1490)
  const combinationIds = uniqueIds(b.policyCombinations, 'COMBINATION_ID', 6120)
  const ceilingIds = uniqueIds(b.sourceCeilings, 'SOURCE_CEILING_ID', 2656)
  const aCeilingIds = uniqueIds(a.sourceCeilings, 'SOURCE_CEILING_ID', 842)
  const findingIds = uniqueIds(b.staticCorrectnessFindings, 'FINDING_ID', 3169)
  const clientIds = uniqueIds(b.databaseClientSourceContracts, 'DB_CLIENT_ID', 8)
  const primitiveIds = uniqueIds(b.contextPrimitiveSourceContracts, 'CONTEXT_PRIMITIVE_ID', 9)
  uniqueIds(b.helperFunctionReconciliation, 'FUNCTION_ID', 11)
  uniqueIds(b.grantReconciliation, 'GRANT_ID', 26)
  assert.equal(b.summary.FINDING_RECORDS, 3169, 'FAIL_EVIDENCE_DRIFT: finding count field')
  assert.equal(b.summary.SOURCE_CEILING_RECORDS, 2656, 'FAIL_EVIDENCE_DRIFT: ceiling count field')
  assert.equal(
    b.policyExpressionAnalyses.reduce(
      (sum, record) => sum + record.EXPRESSIONS_BY_COMMAND_AND_DIRECTION.length,
      0,
    ),
    3244,
  )
  assert.deepEqual(
    objectIds,
    new Set(a.relationalSecurityObjects.map((record) => record.OBJECT_ID)),
  )
  assert.deepEqual(policyIds, new Set(a.rlsPolicies.map((record) => record.POLICY_ID)))
  assert.equal(b.post1B3ADiscoveredObjects.length, 0)
  const findings = new Map(b.staticCorrectnessFindings.map((record) => [record.FINDING_ID, record]))
  const currentCeilings = new Map(
    b.sourceCeilings.map((record) => [record.SOURCE_CEILING_ID, record]),
  )
  const objectMap = new Map(b.objectRecords.map((record) => [record.OBJECT_ID, record]))
  const countBy = (records, field, values) =>
    Object.fromEntries(
      (values ?? unique(records.map((record) => record[field]))).map((value) => [
        value,
        records.filter((record) => record[field] === value).length,
      ]),
    )
  function dispositionFor(results) {
    assert.ok(results.length && results.every((result) => enumDimensions.includes(result)))
    const missing = results.includes('STATIC_REQUIRED_CONTROL_MISSING')
    const mismatch = results.includes('STATIC_SEMANTIC_MISMATCH')
    const partial = results.includes('STATIC_PARTIAL')
    const requirement = results.includes('REQUIREMENT_SOURCE_CEILING')
    const policy =
      results.includes('POLICY_SOURCE_CEILING') ||
      results.includes('RUNTIME_CATALOG_EVIDENCE_REQUIRED')
    if (((missing || mismatch || partial) && (requirement || policy)) || (missing && mismatch))
      return 'MIXED_STATIC_RLS_RESULT'
    if (missing) return 'STATIC_RLS_REQUIRED_CONTROL_MISSING'
    if (mismatch) return 'STATIC_RLS_SEMANTIC_MISMATCH'
    if (partial) return 'STATIC_RLS_PARTIAL'
    if (requirement) return 'STATIC_RLS_REQUIREMENT_CEILING'
    if (policy) return 'STATIC_RLS_POLICY_CEILING'
    return 'STATIC_RLS_MATCH'
  }
  const aliases = {
    BOUNDARY_LOGIC_PRESENT: 'STATIC_MATCH',
    BOUNDARY_LOGIC_WITH_SOURCE_CEILING: 'STATIC_PARTIAL',
    AUTHORITY_DIMENSION_GAP: 'STATIC_PARTIAL',
    NO_APPLICABLE_POLICY_DEFAULT_DENY: 'POLICY_SOURCE_CEILING',
    DENY_ALL: 'POLICY_SOURCE_CEILING',
    SOURCE_CEILING: 'POLICY_SOURCE_CEILING',
  }
  const canonicalDimensionResults = b.objectRecords.map((object) => {
    const linkedFindings = object.FINDING_IDS.map((findingId) => findings.get(findingId))
    const results = []
    const result = (dimension, canonical, internal, evidenceIds = [], ceilingLinks = []) =>
      results.push({
        DIMENSION: dimension,
        RESULT: canonical,
        FROZEN_INTERNAL_RESULT: internal,
        FINDING_IDS: evidenceIds,
        SOURCE_CEILING_IDS: ceilingLinks,
        SOURCE_OBJECT_ID: object.OBJECT_ID,
        EVIDENCE_REEVALUATED: 'NO',
      })
    result(
      'AUTHORITY_REQUIREMENT',
      object.RLS_REQUIREMENT === 'REQUIREMENT_SOURCE_CEILING'
        ? 'REQUIREMENT_SOURCE_CEILING'
        : 'STATIC_MATCH',
      object.RLS_REQUIREMENT,
    )
    const missing = linkedFindings.filter(
      (record) => record.FINDING_CLASS === 'RLS_REQUIRED_BUT_NOT_DECLARED',
    )
    result(
      'RLS_DECLARATION',
      missing.length
        ? 'STATIC_REQUIRED_CONTROL_MISSING'
        : object.RLS_STATE === 'RLS_ENABLED_AND_FORCED' || object.RLS_STATE === 'RLS_ENABLED'
          ? 'STATIC_MATCH'
          : 'POLICY_SOURCE_CEILING',
      object.RLS_STATE,
      missing.map((record) => record.FINDING_ID),
    )
    result(
      'OWNER_FORCE_COMPOSITION',
      object.FORCE_RLS_STATE === 'YES' ? 'STATIC_MATCH' : 'RUNTIME_CATALOG_EVIDENCE_REQUIRED',
      object.FORCE_RLS_STATE,
    )
    const semantic = linkedFindings.filter(
      (record) =>
        record.FINDING_CLASS === 'USING_EXPRESSION_OVERBROAD' &&
        ['union-eyes::public.account_mappings', 'union-eyes::public.holidays'].includes(
          object.OBJECT_ID,
        ),
    )
    if (semantic.length)
      result(
        'NULLABLE_ORG_READ_VS_FROZEN_AUTHORITY',
        'STATIC_SEMANTIC_MISMATCH',
        'FROZEN_USING_EXPRESSION_OVERBROAD_FINDING',
        semantic.map((record) => record.FINDING_ID),
      )
    for (const command of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
      for (const evaluation of object[`${command}_COVERAGE`].ROLE_DIRECTION_EVALUATIONS) {
        if (evaluation.ROLE !== 'union_eyes_runtime') continue
        const canonical =
          object.RLS_REQUIREMENT === 'REQUIREMENT_SOURCE_CEILING'
            ? 'REQUIREMENT_SOURCE_CEILING'
            : aliases[evaluation.STATUS]
        assert.ok(canonical, `Unknown frozen dimension alias: ${evaluation.STATUS}`)
        result(
          `${command}_${evaluation.DIRECTION}_DECLARED_RUNTIME_ROLE`,
          canonical,
          evaluation.STATUS,
        )
      }
    const requirementCeilings = object.SOURCE_CEILING_IDS.filter((ceilingId) =>
      [
        'AUTHORITY_REQUIREMENT',
        'RESOURCE_AUTHORITY_CONTRACT',
        'COMMAND_AND_AUTHORITY_INTENT',
        'FROZEN_REQUIREMENT_VS_DECLARED_GLOBAL_READ_INTENT',
      ].includes(currentCeilings.get(ceilingId).CEILING_CLASS),
    )
    const policyCeilings = object.SOURCE_CEILING_IDS.filter(
      (ceilingId) => !requirementCeilings.includes(ceilingId),
    )
    if (requirementCeilings.length)
      result(
        'INDEPENDENT_OPERATION_OR_RESOURCE_REQUIREMENT',
        'REQUIREMENT_SOURCE_CEILING',
        'FROZEN_REQUIREMENT_CEILING_REGISTER',
        [],
        requirementCeilings,
      )
    if (policyCeilings.length)
      result(
        'INDEPENDENT_POLICY_PATH_AND_CATALOG_COMPOSITION',
        'POLICY_SOURCE_CEILING',
        'FROZEN_POLICY_AND_CATALOG_CEILING_REGISTER',
        [],
        policyCeilings,
      )
    result(
      'DEPLOYED_ROLE_OWNER_RLS_AND_CONTEXT',
      'RUNTIME_CATALOG_EVIDENCE_REQUIRED',
      'FROZEN_RUNTIME_PROOF_EXCLUSION',
    )
    return {
      OBJECT_ID: object.OBJECT_ID,
      DIMENSION_RESULTS: results,
      DERIVATION:
        'Serialization alias mapping of frozen state, findings, command results and ceiling classes; no expression/source adjudication',
      CANONICAL_OBJECT_DISPOSITION: dispositionFor(results.map((record) => record.RESULT)),
    }
  })
  for (const record of canonicalDimensionResults)
    objectMap.get(record.OBJECT_ID).STATIC_CORRECTNESS_DISPOSITION =
      record.CANONICAL_OBJECT_DISPOSITION
  const missingObjects = unique(
    b.staticCorrectnessFindings
      .filter((record) => record.FINDING_CLASS === 'RLS_REQUIRED_BUT_NOT_DECLARED')
      .flatMap((record) => record.AFFECTED_OBJECT_IDS),
  )
  const mismatchObjects = unique(
    b.staticCorrectnessFindings
      .filter((record) => record.FINDING_CLASS === 'USING_EXPRESSION_OVERBROAD')
      .flatMap((record) => record.AFFECTED_OBJECT_IDS),
  )
  assert.equal(missingObjects.length, 159)
  assert.deepEqual(mismatchObjects, [
    'union-eyes::public.account_mappings',
    'union-eyes::public.holidays',
  ])
  const effectiveGroups = new Map()
  for (const combination of b.policyCombinations) {
    const key = `${combination.OBJECT_ID}|${combination.COMMAND}|${combination.ROLE}`
    if (!effectiveGroups.has(key))
      effectiveGroups.set(key, {
        POLICY_GROUP_ID: id('NORMALIZED-GROUP', key),
        OBJECT_ID: combination.OBJECT_ID,
        COMMAND: combination.COMMAND,
        ROLE_SCOPE: combination.ROLE,
        ROW_DIRECTION_COMBINATION_IDS: [],
        POLICY_IDS: [],
        EVIDENCE_NORMALIZED_NOT_REEVALUATED: 'YES',
      })
    const group = effectiveGroups.get(key)
    group.ROW_DIRECTION_COMBINATION_IDS.push(combination.COMBINATION_ID)
    group.POLICY_IDS = unique([
      ...group.POLICY_IDS,
      ...combination.PERMISSIVE_POLICY_IDS,
      ...combination.RESTRICTIVE_POLICY_IDS,
    ])
  }
  const groups = [...effectiveGroups.values()]
  const groupIds = uniqueIds(groups, 'POLICY_GROUP_ID', 4896)
  assert.deepEqual(new Set(groups.flatMap((group) => group.POLICY_IDS)), policyIds)
  const ceilingClasses = new Map()
  for (const current of b.sourceCeilings) {
    if (!ceilingClasses.has(current.CEILING_CLASS)) ceilingClasses.set(current.CEILING_CLASS, [])
    ceilingClasses.get(current.CEILING_CLASS).push(current)
  }
  const predecessorCeilingReconciliation = a.sourceCeilings.map((prior) => {
    let matches = b.sourceCeilings.filter((current) =>
      current.PREDECESSOR_SOURCE_CEILING_IDS.includes(prior.SOURCE_CEILING_ID),
    )
    let linkage = 'EXISTING_EXPLICIT_PREDECESSOR_ID_LINK'
    if (!matches.length) {
      const mappedClasses = {
        GRANT_SCOPE: ['GRANT_EFFECTIVE_SCOPE_AND_ROLE'],
        CLIENT_BYPASS: ['CLIENT_BYPASS_AND_PRIVILEGED_PRECONDITION'],
        CONTEXT_SCOPE: ['CONTEXT_QUERY_ORDER'],
        DATABASE_SCOPE: ['CLIENT_BYPASS_AND_PRIVILEGED_PRECONDITION'],
        DATABASE_ROLE: ['CARRY_FORWARD_AUTHORITY_ROLE_AND_APPLICATION'],
        RELATIONAL_OBJECT_IDENTITY: ['CARRY_FORWARD_AUTHORITY_ROLE_AND_APPLICATION'],
      }[prior.CEILING_CLASS]
      assert.ok(mappedClasses, `Unmapped predecessor ceiling ${prior.SOURCE_CEILING_ID}`)
      matches = mappedClasses.flatMap((kind) => ceilingClasses.get(kind) ?? [])
      if (prior.AFFECTED_OBJECTS.length)
        matches = matches.filter((current) =>
          current.AFFECTED_OBJECT_IDS.some((objectId) => prior.AFFECTED_OBJECTS.includes(objectId)),
        )
      linkage = 'EXISTING_CORRECTNESS_REGISTER_SHARED_SCOPE_CARRY_FORWARD_NOT_RESOLUTION'
    }
    assert.ok(matches.length, `Unaccounted predecessor ceiling ${prior.SOURCE_CEILING_ID}`)
    const classification =
      matches.length > 1
        ? 'SPLIT_INTO_MULTIPLE_B3B_CEILINGS'
        : prior.CEILING_CLASS === 'REQUIREMENT'
          ? 'RETAINED_AS_REQUIREMENT_CEILING'
          : [
                'DATABASE_ROLE',
                'RLS_STATE',
                'CLIENT_BYPASS',
                'GRANT_SCOPE',
                'DATABASE_SCOPE',
              ].includes(prior.CEILING_CLASS)
            ? 'RETAINED_AS_RUNTIME_CATALOG_CEILING'
            : 'RETAINED_AS_POLICY_CEILING'
    return {
      B3A_SOURCE_CEILING_ID: prior.SOURCE_CEILING_ID,
      B3A_CEILING_CLASS: prior.CEILING_CLASS,
      B3A_AFFECTED_OBJECTS: prior.AFFECTED_OBJECTS,
      B3B_RECONCILIATION: classification,
      B3B_CORRECTNESS_CEILING_IDS: unique(matches.map((current) => current.SOURCE_CEILING_ID)),
      LINKAGE_BASIS: linkage,
      RESOLUTION_EVIDENCE_ID: null,
      ORIGINAL_SCOPE_AND_REQUIRED_EVIDENCE_PRESERVED: {
        WHY_STATIC_SOURCE_CANNOT_RESOLVE: prior.WHY_STATIC_SOURCE_CANNOT_RESOLVE,
        ADDITIONAL_EVIDENCE_TYPE_REQUIRED: prior.ADDITIONAL_EVIDENCE_TYPE_REQUIRED,
        AFFECTED_ENTRY_IDS: prior.AFFECTED_ENTRY_IDS,
        SOURCE_EVIDENCE: prior.SOURCE_EVIDENCE,
      },
      SCOPE_LIMITATION: prior.AFFECTED_OBJECTS.length
        ? null
        : 'Original ceiling has no exact affected object denominator. Shared B3B scope links preserve the original unresolved global/dynamic obligation; they do not resolve target, role or execution identity.',
    }
  })
  assert.deepEqual(
    uniqueIds(predecessorCeilingReconciliation, 'B3A_SOURCE_CEILING_ID', 842),
    aCeilingIds,
  )
  for (const record of predecessorCeilingReconciliation) {
    assert.ok(enumReconciliations.includes(record.B3B_RECONCILIATION))
    assert.ok(record.B3B_CORRECTNESS_CEILING_IDS.length)
    for (const ceilingId of record.B3B_CORRECTNESS_CEILING_IDS) assert.ok(ceilingIds.has(ceilingId))
  }
  const reconciliationCounts = countBy(
    predecessorCeilingReconciliation,
    'B3B_RECONCILIATION',
    enumReconciliations,
  )
  assert.equal(
    Object.values(reconciliationCounts).reduce((a, value) => a + value, 0),
    842,
  )
  const runtimeProofItems = []
  const groupsFor = (objects, command) =>
    groups
      .filter(
        (group) => objects.includes(group.OBJECT_ID) && (!command || group.COMMAND === command),
      )
      .map((group) => group.POLICY_GROUP_ID)
  const clientsFor = (objects) =>
    unique(
      objects.flatMap(
        (objectId) => objectMap.get(objectId).PRIVILEGED_CLIENT_REACHABILITY.CANDIDATE_CLIENT_IDS,
      ),
    )
  const priorPacketHash = digest(b.proposedNextGatePacket)
  const addProof = (
    proofClass,
    key,
    objects,
    catalogOnly = false,
    command = null,
    clients = null,
    references = {},
  ) => {
    const defects = objects.filter(
      (objectId) => missingObjects.includes(objectId) || mismatchObjects.includes(objectId),
    )
    const decisions = objects.filter(
      (objectId) => objectMap.get(objectId).RLS_REQUIREMENT === 'REQUIREMENT_SOURCE_CEILING',
    )
    const status = catalogOnly
      ? 'CATALOG_EVIDENCE_ONLY'
      : defects.length
        ? 'BLOCKED_BY_KNOWN_STATIC_DEFECT'
        : decisions.length ||
            (command &&
              objects.some(
                (objectId) =>
                  objectMap.get(objectId)[`${command}_COVERAGE`].STATIC_COMMAND_CORRECTNESS !==
                  'BOUNDARY_LOGIC_PRESENT_WITH_PATH_CEILINGS',
              ))
          ? 'BLOCKED_BY_REQUIREMENT_DECISION'
          : 'BLOCKED_BY_FIXTURE_OR_ENVIRONMENT_PRECONDITION'
    const linkedFindings = unique(
      objects.flatMap((objectId) => objectMap.get(objectId).FINDING_IDS),
    )
    runtimeProofItems.push({
      RUNTIME_PROOF_ITEM_ID: id('RUNTIME-PROOF', `${proofClass}|${key}`),
      OBJECT_IDS: unique(objects),
      POLICY_GROUP_IDS: groupsFor(objects, command),
      CLIENT_IDS: clients ?? clientsFor(objects),
      PROOF_CLASS: proofClass,
      EXECUTION_CLASSIFICATION: status,
      EXPECTED_ALLOW_CASE: catalogOnly
        ? {
            CASE: 'NOT_APPLICABLE_CATALOG_ONLY',
            EXPECTATION:
              'Read-only capture of exact role/owner/grant attributes; no data operation is implied',
          }
        : {
            CASE: 'AUTHORITATIVE_POSITIVE_CASE_REQUIRED',
            COMMAND: command,
            EXPECTATION:
              'Approved same-org/user/resource or explicitly authorized system case must match the frozen authority and future item-specific contract',
            CONCRETE_FIXTURE_AND_EXPECTED_ROW_SET:
              'NOT_ESTABLISHED_IN_ACCEPTED_PROPOSAL; precondition, not invented allow evidence',
          },
      EXPECTED_DENY_CASE: catalogOnly
        ? {
            CASE: 'NOT_APPLICABLE_CATALOG_ONLY',
            EXPECTATION: 'Catalog capture alone proves no denied application operation',
          }
        : {
            CASE: 'CROSS_ORG_OR_UNAUTHORIZED_RESOURCE_NEGATIVE_CASE',
            COMMAND: command,
            EXPECTATION:
              'Unauthorized second-org/user/resource row visibility or mutation must be denied under the future approved contract',
            CONCRETE_FIXTURE_AND_EXPECTED_ROW_SET: 'NOT_ESTABLISHED_IN_ACCEPTED_PROPOSAL',
          },
      REQUIRED_FIX_OR_ACCEPTANCE_PRECONDITION: {
        KNOWN_STATIC_DEFECT_OBJECT_IDS: defects,
        REQUIREMENT_DECISION_OBJECT_IDS: decisions,
        FINDING_IDS: linkedFindings,
        REQUIRED_APPROVALS: b.proposedNextGatePacket.BLOCKERS,
        REPAIRS_AUTHORIZED: 'NO',
        ITEM_EXECUTABLE_NOW: 'NO',
      },
      RUNTIME_OR_CATALOG_EVIDENCE_REQUIRED: b.proposedNextGatePacket.PROPOSED_EVIDENCE,
      SOURCE_PROPOSAL_SHA256: priorPacketHash,
      SOURCE_REFERENCES: references,
      RUNTIME_EXECUTION: 'NOT_STARTED',
    })
  }
  for (const object of b.objectRecords) {
    for (const [command, proofClass] of [
      ['SELECT', 'CROSS_ORG_READ'],
      ['INSERT', 'CROSS_ORG_INSERT'],
      ['UPDATE', 'CROSS_ORG_UPDATE'],
      ['DELETE', 'CROSS_ORG_DELETE'],
    ])
      addProof(proofClass, `${object.OBJECT_ID}|${command}`, [object.OBJECT_ID], false, command)
    addProof('OWNER_RLS', object.OBJECT_ID, [object.OBJECT_ID], true)
  }
  for (const role of a.databaseRoles.filter(
    (role) => role.ROLE_KIND !== 'POSTGRESQL_ALL_ROLES_POLICY_PSEUDO_ROLE',
  ))
    addProof('BYPASSRLS_ROLE', role.DATABASE_ROLE, [...objectIds], true, null, [...clientIds], {
      DATABASE_ROLE: role.DATABASE_ROLE,
    })
  for (const client of b.databaseClientSourceContracts) {
    const targets = b.objectRecords
      .filter((object) =>
        object.PRIVILEGED_CLIENT_REACHABILITY.CANDIDATE_CLIENT_IDS.includes(client.DB_CLIENT_ID),
      )
      .map((object) => object.OBJECT_ID)
    addProof('PRIVILEGED_CLIENT', client.DB_CLIENT_ID, targets, false, null, [client.DB_CLIENT_ID])
    addProof('CONNECTION_POOL_CONTEXT_LEAKAGE', client.DB_CLIENT_ID, targets, false, null, [
      client.DB_CLIENT_ID,
    ])
  }
  for (const primitive of b.contextPrimitiveSourceContracts) {
    const targets = b.objectRecords
      .filter(
        (object) =>
          object.CONTEXT_CORRECTNESS.CANDIDATE_PRIMITIVE_IDS.includes(
            primitive.CONTEXT_PRIMITIVE_ID,
          ) ||
          object.CONTEXT_CORRECTNESS.SOURCE_OPERATION_CONTEXT_PATHS.some(
            (proof) => proof.CONTEXT_PRIMITIVE_ID === primitive.CONTEXT_PRIMITIVE_ID,
          ),
      )
      .map((object) => object.OBJECT_ID)
    addProof('CONTEXT_ISOLATION', primitive.CONTEXT_PRIMITIVE_ID, targets, false, null, null, {
      CONTEXT_PRIMITIVE_ID: primitive.CONTEXT_PRIMITIVE_ID,
    })
  }
  for (const fn of b.helperFunctionReconciliation) {
    const targets = unique(
      b.sourceCeilings.find((ceiling) => ceiling.SOURCE_CEILING_ID === fn.SOURCE_CEILING_ID)
        .AFFECTED_OBJECT_IDS,
    )
    addProof('FUNCTION_EXECUTION', fn.FUNCTION_ID, targets, false, null, null, {
      FUNCTION_ID: fn.FUNCTION_ID,
    })
  }
  for (const grant of b.grantReconciliation)
    addProof('GRANT_EFFECT', grant.GRANT_ID, grant.ACCEPTED_TARGET_OBJECT_IDS, true, null, null, {
      GRANT_ID: grant.GRANT_ID,
      GRANTEE: grant.GRANTEE,
      SCOPE_CLASS: grant.SCOPE_CLASS,
    })
  uniqueIds(runtimeProofItems, 'RUNTIME_PROOF_ITEM_ID', 3124)
  for (const item of runtimeProofItems) {
    assert.ok(enumProofClasses.includes(item.PROOF_CLASS))
    assert.ok(enumProofStates.includes(item.EXECUTION_CLASSIFICATION))
    for (const objectId of item.OBJECT_IDS) assert.ok(objectIds.has(objectId))
    for (const groupId of item.POLICY_GROUP_IDS) assert.ok(groupIds.has(groupId))
    for (const clientId of item.CLIENT_IDS) assert.ok(clientIds.has(clientId))
  }
  for (const values of [
    [['STATIC_MATCH', 'NOT_APPLICABLE'], 'STATIC_RLS_MATCH'],
    [['STATIC_PARTIAL'], 'STATIC_RLS_PARTIAL'],
    [['STATIC_REQUIRED_CONTROL_MISSING'], 'STATIC_RLS_REQUIRED_CONTROL_MISSING'],
    [['STATIC_SEMANTIC_MISMATCH'], 'STATIC_RLS_SEMANTIC_MISMATCH'],
    [
      ['REQUIREMENT_SOURCE_CEILING', 'RUNTIME_CATALOG_EVIDENCE_REQUIRED'],
      'STATIC_RLS_REQUIREMENT_CEILING',
    ],
    [['POLICY_SOURCE_CEILING'], 'STATIC_RLS_POLICY_CEILING'],
    [['STATIC_REQUIRED_CONTROL_MISSING', 'POLICY_SOURCE_CEILING'], 'MIXED_STATIC_RLS_RESULT'],
    [['STATIC_SEMANTIC_MISMATCH', 'REQUIREMENT_SOURCE_CEILING'], 'MIXED_STATIC_RLS_RESULT'],
    [['STATIC_REQUIRED_CONTROL_MISSING', 'STATIC_SEMANTIC_MISMATCH'], 'MIXED_STATIC_RLS_RESULT'],
  ])
    assert.equal(dispositionFor(values[0]), values[1])
  const canonicalCounts = countBy(
    b.objectRecords,
    'STATIC_CORRECTNESS_DISPOSITION',
    enumDispositions,
  )
  assert.equal(
    Object.values(canonicalCounts).reduce((sum, value) => sum + value, 0),
    612,
  )
  const requirementCounts = countBy(b.objectRecords, 'RLS_REQUIREMENT')
  assert.deepEqual(requirementCounts, {
    ORG_AND_RESOURCE_RLS_REQUIRED: 114,
    ORG_RLS_REQUIRED: 337,
    REQUIREMENT_SOURCE_CEILING: 132,
    USER_OR_RESOURCE_RLS_REQUIRED: 29,
  })
  const carry = b.predecessorCarryForward
  assert.equal(b.entryBoundarySourceRegistry.length, 1910)
  for (const [key, value] of Object.entries({
    PHASE_1B_2_SOURCE_FINDINGS: 1710,
    PHASE_1B_2_SOURCE_CEILING_RECORDS: 3672,
    HISTORICAL_PAGE_EXPECTATION_SOURCE_CEILING_CARRY_FORWARD: 43,
    AUTHORITY_SOURCE_CEILING_CARRY_FORWARD: 207,
    R2B_KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD: 3,
    R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS: 56,
    R2C_RESOLVED_TARGET_CHAINS: 43,
    TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD: 13,
    FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD: 247,
  }))
    assert.equal(carry[key], value, `Prior-phase accounting drift: ${key}`)
  assert.deepEqual(evidenceHashes(b), beforeHashes)
  b.canonicalDimensionResults = canonicalDimensionResults
  b.effectivePolicyGroups = groups
  b.predecessorCeilingReconciliation = predecessorCeilingReconciliation
  b.fixedB3CRuntimeProofPacket = {
    SOURCE_PROPOSAL_SHA256: priorPacketHash,
    PROPOSAL_EVIDENCE_CHANGED: 'NO',
    PACKET_CLASS: 'FIXED_DENOMINATOR_NORMALIZED_FROM_ACCEPTED_PROPOSAL_NOT_EXECUTION',
    EXPECTATION_SCOPE:
      'Generic proposed allow/deny shapes are preserved; concrete fixtures, credentials and row expectations are explicitly unsatisfied preconditions, not invented runtime evidence.',
    RUNTIME_PROOF_ITEM_COUNT: runtimeProofItems.length,
    PROOF_CLASS_COUNTS: countBy(runtimeProofItems, 'PROOF_CLASS'),
    EXECUTION_CLASSIFICATION_COUNTS: countBy(
      runtimeProofItems,
      'EXECUTION_CLASSIFICATION',
      enumProofStates,
    ),
    ITEMS: runtimeProofItems,
    PHASE_1B_3C: 'AUTHORIZED_NOT_STARTED',
    PHASE_1B_3C_STARTED: 'NO',
    ITEMS_EXECUTABLE_NOW: 0,
  }
  b.statusNormalization = {
    PHASE: 'PHASE_1B_3BN',
    METHOD: 'FIXED_ARTIFACTS_ONLY_NO_SOURCE_RESCAN_NO_SQL_REEVALUATION',
    ORIGINAL_ACCEPTED_B3B_SHA256:
      'cca0edbd11e1a4a4619b6eb4d0d69de0a6d018a734b67ff93a7bbcb610b77b19',
    ORIGINAL_OBJECT_RECORDS_SHA256:
      'f7ee3043e2a2bdbe3a802d0cad46938f7a3024d431fea718ab8facbddc524941',
    ORIGINAL_DISPOSITION_COUNTS: {
      STATIC_RLS_CORRECT: 0,
      STATIC_RLS_CORRECT_WITH_SOURCE_CEILING: 0,
      STATIC_RLS_INCORRECT: 161,
      RLS_NOT_REQUIRED: 0,
      STATIC_CORRECTNESS_UNRESOLVED: 451,
    },
    HISTORICAL_REPORTED_GATE: 'STATIC_RLS_POLICY_CORRECTNESS_CLOSED_WITH_SOURCE_CEILINGS',
    FROZEN_EVIDENCE_SHA256_BEFORE: frozenEvidenceHashes,
    FROZEN_EVIDENCE_SHA256_AFTER: evidenceHashes(b),
    EVIDENCE_PRESERVATION: Object.fromEntries(
      Object.keys(frozenEvidenceHashes).map((key) => [`${key}_CHANGED`, 'NO']),
    ),
    SEMANTIC_ALIAS_MAP: aliases,
    REQUIRED_RLS_GAP_OBJECT_IDS: missingObjects,
    NULLABLE_ORG_MISMATCH_OBJECT_IDS: mismatchObjects,
    REQUIREMENT_INTENT_CONFLICTS: mismatchObjects.map((objectId) => ({
      OBJECT_ID: objectId,
      MIGRATION_COMMENT_DESCRIBES_INTENTIONAL_GLOBAL_READ: 'YES',
      FROZEN_REQUIREMENT_REMAINS_STRICT_ORG: 'YES',
      EXEMPTION_INVENTED: 'NO',
      RUNTIME_DEFECT_PROVEN: 'NO',
      REQUIREMENT_DECISION_RESOLVED: 'NO',
    })),
    PREDECESSOR_CEILING_RECONCILIATION_COUNTS: reconciliationCounts,
    FINAL_SERVER_ENTRY_DISPOSITIONS: 1910,
    NO_APPLICATION_OR_MIGRATION_SOURCE_NEWLY_INSPECTED: 'YES',
    NO_POLICY_EXPRESSION_REEVALUATED: 'YES',
    NO_RUNTIME_DB_ACCESSED: 'YES',
    NO_RUNTIME_AUTH_EXECUTED: 'YES',
    NO_MIGRATION_EXECUTED: 'YES',
    NO_DATABASE_WRITE: 'YES',
    NO_PRODUCT_REPAIR: 'YES',
    NO_PR_CREATED: 'YES',
  }
  b.summary.DISPOSITION_COUNTS = canonicalCounts
  b.summary.REQUIREMENT_BY_DISPOSITION = Object.fromEntries(
    Object.keys(requirementCounts).map((requirement) => [
      requirement,
      countBy(
        b.objectRecords.filter((object) => object.RLS_REQUIREMENT === requirement),
        'STATIC_CORRECTNESS_DISPOSITION',
        enumDispositions,
      ),
    ]),
  )
  Object.assign(b.summary, {
    INPUT_OBJECTS: 612,
    UNIQUE_OBJECT_IDS: 612,
    INPUT_ACTIVE_POLICY_IDENTITIES: 1490,
    UNIQUE_POLICY_IDENTITIES: 1490,
    LOST_POLICY_IDENTITIES: 0,
    DUPLICATE_POLICY_IDENTITIES: 0,
    TOTAL_EFFECTIVE_POLICY_GROUPS: groups.length,
    UNACCOUNTED_POLICY_GROUPS: 0,
    KNOWN_REQUIRED_RLS_DECLARATION_GAP_OBJECTS: 159,
    KNOWN_NULLABLE_ORG_SEMANTIC_MISMATCH_OBJECTS: 2,
    B3A_SOURCE_CEILINGS_INPUT: 842,
    B3A_CEILINGS_RESOLVED_BY_STATIC_ANALYSIS: reconciliationCounts.RESOLVED_BY_STATIC_ANALYSIS,
    B3A_CEILINGS_RETAINED_AS_REQUIREMENT: reconciliationCounts.RETAINED_AS_REQUIREMENT_CEILING,
    B3A_CEILINGS_RETAINED_AS_POLICY: reconciliationCounts.RETAINED_AS_POLICY_CEILING,
    B3A_CEILINGS_RETAINED_AS_RUNTIME_CATALOG:
      reconciliationCounts.RETAINED_AS_RUNTIME_CATALOG_CEILING,
    B3A_CEILINGS_SPLIT_TO_MULTIPLE_B3B_RECORDS:
      reconciliationCounts.SPLIT_INTO_MULTIPLE_B3B_CEILINGS,
    B3A_CEILINGS_UNACCOUNTED: 0,
    B3B_CORRECTNESS_CEILING_RECORD_COUNT: 2656,
    B3B_UNIQUE_AFFECTED_OBJECT_COUNT: new Set(
      b.sourceCeilings.flatMap((current) => current.AFFECTED_OBJECT_IDS),
    ).size,
    RUNTIME_PROOF_ITEMS: runtimeProofItems.length,
    PHASE_1B_3B_STATIC_WORK_REMAINING: 0,
  })
  Object.assign(b.validation, {
    SUBSTANTIVE_EVIDENCE_DIGESTS_UNCHANGED: 'PASS',
    CANONICAL_612_OBJECT_DISPOSITIONS: 'PASS',
    ALL_842_B3A_CEILINGS_EXACTLY_ONCE: 'PASS',
    NO_B3A_CEILING_LOST: 'PASS',
    ALL_EFFECTIVE_POLICY_GROUPS_AND_IDENTITIES_PRESERVED: 'PASS',
    NORMALIZATION_INPUTS: [inputA, inputB],
    SOURCE_HASHES_RECHECKED_BY_READING_APPLICATION_SOURCE: 'NO',
    SOURCE_RANGE_VALIDATION: 'PRESERVED_ACCEPTED_VALIDATION_NO_NEW_SOURCE_INSPECTION',
    RUNTIME_PROOF_PACKET_FIXED_FOREIGN_IDS: 'PASS',
    B3C_STARTED: 'NO',
  })
  Object.assign(b.phaseStatus, {
    PHASE_1B_3BN_GATE: 'PASS',
    PHASE_1B_3B_ANALYSIS_WORK: 'ACCEPTED',
    PHASE_1B_3B_GATE: 'PASS',
    PHASE_1B_3B: 'SOURCE_CEILING_ACCEPTED',
    STATIC_RLS_POLICY_MODEL: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
    PHASE_1B_3B_STATIC_WORK_REMAINING: 0,
    NO_FURTHER_PHASE_1B_3B_GENERAL_STATIC_PASS: 'YES',
    RLS_STATIC_MODEL_CLOSED: 'YES',
    RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
    TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
    PRIVILEGED_DB_RUNTIME_BEHAVIOR_PROVEN: 'NO',
    DATABASE_ROLE_RUNTIME_IDENTITY_PROVEN: 'NO',
    OWNER_RLS_RUNTIME_BEHAVIOR_PROVEN: 'NO',
    PHASE_1B_3: 'NOT_YET_COMPLETE',
    PHASE_1B_3C: 'AUTHORIZED_NOT_STARTED',
    PHASE_1B_3C_AUTHORIZED: 'YES',
    PHASE_1B_3C_STARTED: 'NO',
    PRODUCT_READY: 'NO',
  })
  assert.deepEqual(evidenceHashes(b), frozenEvidenceHashes)
  if (process.argv.includes('--self-test')) {
    console.log(
      'PASS: artifact-only canonical disposition precedence, 20 preservation digests, exact 842 ledger, 4896 policy groups, 3124 runtime items and foreign IDs.',
    )
    return
  }
  const table = (counts) =>
    `| Classification | Count |\n|---|---:|\n${Object.entries(counts)
      .map(([key, value]) => `| ${key} | ${value} |`)
      .join('\n')}`
  const markdown = `# Phase 1B.3B — normalized static RLS policy model

## Normalized gate and state

\`\`\`text
PHASE_1B_3BN_GATE = PASS
PHASE_1B_3B_ANALYSIS_WORK = ACCEPTED
PHASE_1B_3B_GATE = PASS
PHASE_1B_3B = SOURCE_CEILING_ACCEPTED
STATIC_RLS_POLICY_MODEL = CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS
PHASE_1B_3B_STATIC_WORK_REMAINING = 0
NO_FURTHER_PHASE_1B_3B_GENERAL_STATIC_PASS = YES
RLS_STATIC_MODEL_CLOSED = YES
PHASE_1B_3 = NOT_YET_COMPLETE
PHASE_1B_3C = AUTHORIZED_NOT_STARTED
PHASE_1B_3C_STARTED = NO
PRODUCT_READY = NO
\`\`\`

PASS measures completion of exact-once bounded adjudication and normalization, not absence of known defects or proof of deployed policy correctness. Source/catalog ceilings are categorized assurance obligations, not unfinished general static analysis.

Authoritative [B3A census](./${predecessorName}.json), SHA-256 \`${predecessorHash}\`. [Normalized JSON](./${outputName}.json) preserves accepted evidence and adds canonical dimensions, exact ceiling linkage and the fixed runtime-proof denominator. [Deterministic reconciler](../../../scripts/ue/reconcile-static-rls-policy-correctness.mjs) now runs the artifact-only normalization path; historical analysis code is not executed.

## Canonical 612-object accounting

${table(canonicalCounts)}

**612 = ${enumDispositions.map((key) => canonicalCounts[key]).join(' + ')}**. All object IDs and all dimension-level internal results remain preserved. Canonical dimension values are aliases derived from those existing results/findings/ceiling records only; no SQL expression, authority requirement or source path is re-adjudicated.

Requirements remain **337 organization**, **29 user/resource**, **114 organization-plus-resource**, **132 requirement ceilings**. Requirement-by-canonical-disposition arithmetic is retained in JSON.

## Known defects and source ceilings preserved

- **159** unique objects retain required-RLS declaration-gap findings.
- **2** exact objects retain nullable-org semantic mismatches: \`union-eyes::public.account_mappings\` and \`union-eyes::public.holidays\`.
- The two migration-comment global-read intents remain documented; their frozen requirements remain strict-org. No exemption or runtime defect proof is invented.
- **3,169** static finding records and **2,656** correctness ceiling records are unchanged; **${b.summary.B3B_UNIQUE_AFFECTED_OBJECT_COUNT}** unique objects are affected by current ceiling records.
- Mixed dispositions preserve known missing/partial/mismatch facts alongside independent requirement, policy and catalog obligations. No known defect is collapsed into a generic ceiling.

## Exact 842-predecessor-ceiling reconciliation

${table(reconciliationCounts)}

Sum: **842** predecessor IDs, each represented once; unaccounted: **0**. These counts describe predecessor records, not current output ceiling-record counts.

No predecessor ceiling is declared resolved without resolution evidence. Existing direct predecessor links are used first. Shared-scope obligations without exact affected objects are explicitly linked to the existing B3B register and retain their original scope/reason/required evidence. One-to-many links are counted as splits; no substantive B3B ceiling is added, removed or claimed resolved. Original dynamic/global obligations remain explicit.

## Policy and effective-group preservation

**1,490** unique final policy identities; lost **0**, duplicates **0**. **3,244** row-direction analyses and **6,120** direction-combination records remain unchanged. **4,896** object/command/role groups retain those direction records and all applicable policy IDs; unaccounted groups **0**.

All **8 clients**, **9 context primitives**, **11 SQL function boundaries** and **26 grants/revokes** are preserved. The accepted partial callback/context and privileged-path adjudications are unchanged.

## Fixed B3C runtime-proof denominator

**${runtimeProofItems.length}** deterministic runtime-proof items normalized from the unchanged accepted proposal:

${table(b.fixedB3CRuntimeProofPacket.PROOF_CLASS_COUNTS)}

${table(b.fixedB3CRuntimeProofPacket.EXECUTION_CLASSIFICATION_COUNTS)}

Each item includes an ID, exact object/group/client linkage, allow/deny-case shape, fix/acceptance preconditions and required runtime/catalog evidence. No concrete fixture or row-set expectation is invented; absent item-specific contracts and environment evidence are explicitly unsatisfied preconditions. No item is executable now. Catalog-only items distinguish attribute capture from application allow/deny probes.

B3C is **AUTHORIZED_NOT_STARTED** as a controlled future mission. Known-defect and requirement-decision items remain blocked; execution still requires its future prompt and satisfied item preconditions. No repairs or runtime tests are performed here.

## Evidence preservation and validation

All **20** substantive pre/post SHA-256 digests are unchanged. The historical full 612-object digest is also retained; only final classifications/state change. Policy expressions, row-direction analyses, combinations, findings, ceilings, context/client/function/grant adjudications, proposal evidence, source/entry registries and prior-phase carry-forwards remain unchanged.

Only the two fixed JSON artifacts and this reconciler are inspected by normalization. No application/migration source is read, no SQL expression re-evaluated, no runtime DB/auth accessed, no migration/write executed, no policy/product repaired and no PR created.

Preserved: **1,910** server entries, **1,710** prior findings, **3,672** prior ceilings, **43** historical expectations, **207** authority ceilings, **3** R2B defects, **56** R2C chains (**43** resolved, **13** target ceilings), and **247** frozen Phase 1A unknown-effect chains. Fingerprints and prior validated source ranges are preserved without rescanning source.

Validation commands:

- \`node --check scripts/ue/reconcile-static-rls-policy-correctness.mjs\`
- \`node scripts/ue/reconcile-static-rls-policy-correctness.mjs --self-test\`
- \`node scripts/ue/reconcile-static-rls-policy-correctness.mjs\`
- \`node scripts/ue/reconcile-static-rls-policy-correctness.mjs --check\`
- Scoped \`pnpm exec prettier --check\` for the reconciler and two reports.
- \`pnpm validate:docs\`

## Proof boundaries

\`\`\`text
RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN = NO
TENANT_ISOLATION_RUNTIME_PROVEN = NO
PRIVILEGED_DB_RUNTIME_BEHAVIOR_PROVEN = NO
DATABASE_ROLE_RUNTIME_IDENTITY_PROVEN = NO
OWNER_RLS_RUNTIME_BEHAVIOR_PROVEN = NO
PHASE_1B_3C_STARTED = NO
PRODUCT_READY = NO
\`\`\`
`
  const config = await resolveConfig(absolute(`${base}${outputName}.md`))
  const outputs = [
    ['json', await format(JSON.stringify(b), { ...config, parser: 'json' })],
    ['md', await format(markdown, { ...config, parser: 'markdown' })],
  ]
  for (const [extension, content] of outputs) {
    const file = absolute(`${base}${outputName}.${extension}`)
    if (process.argv.includes('--check'))
      assert.equal(readFileSync(file, 'utf8'), content, `Normalized artifact drift: ${extension}`)
    else writeFileSync(file, content)
  }
  console.log(
    `${process.argv.includes('--check') ? 'Verified' : 'Normalized'} 612 canonical objects, 842 predecessor ceilings, 1490 policies, 4896 groups, ${runtimeProofItems.length} runtime items; B3BN PASS, B3B PASS, B3C AUTHORIZED_NOT_STARTED.`,
  )
}

// Historical B3B analysis is retained below for provenance; normalization exits before it.
const commands = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
const dispositions = [
  'STATIC_RLS_CORRECT',
  'STATIC_RLS_CORRECT_WITH_SOURCE_CEILING',
  'STATIC_RLS_INCORRECT',
  'RLS_NOT_REQUIRED',
  'STATIC_CORRECTNESS_UNRESOLVED',
]
const findingClasses = [
  'RLS_REQUIRED_BUT_NOT_DECLARED',
  'RLS_ENABLED_NOT_FORCED',
  'COMMAND_COVERAGE_GAP',
  'ORG_POLICY_SIGNAL_GAP',
  'RESOURCE_POLICY_SIGNAL_GAP',
  'USER_POLICY_SIGNAL_GAP',
  'USING_EXPRESSION_OVERBROAD',
  'WITH_CHECK_EXPRESSION_OVERBROAD',
  'USING_WITH_CHECK_ASYMMETRY',
  'PRIVILEGED_PATH_WITHOUT_STATIC_AUTHORITY_BOUNDARY',
  'CONTEXT_DEPENDENCY_WITHOUT_STATIC_ESTABLISHMENT',
  'POLICY_HELPER_AUTHORITY_BROADENING',
  'POLICY_COMBINATION_OVERBROAD',
  'POLICY_COMBINATION_CONTRADICTORY',
  'INLINE_POLICY_DRIFT_CANDIDATE',
  'SOURCE_CEILING_STATIC_CORRECTNESS',
]
const consumed = new Map()
function read(file, expected) {
  const bytes = readFileSync(absolute(file))
  const sha = hash(bytes)
  if (expected) assert.equal(sha, expected, `Frozen source drift: ${file}`)
  const text = bytes.toString('utf8')
  consumed.set(file, {
    FILE: file,
    SHA256: sha,
    LINE_START: 1,
    LINE_END: text.split('\n').length,
    RANGE_SHA256: hash(text),
  })
  return text
}
const predecessor = JSON.parse(read(`${base}${predecessorName}.json`, predecessorHash))
assert.equal(predecessor.phaseStatus.PHASE_1B_3A, 'SOURCE_CEILING_ACCEPTED')
assert.equal(predecessor.phaseStatus.PHASE_1B_3B_STARTED, 'NO')
assert.equal(predecessor.relationalSecurityObjects.length, 612)
assert.equal(predecessor.rlsPolicies.length, 1490)
assert.equal(predecessor.databaseClients.length, 8)
assert.equal(predecessor.contextEstablishmentPrimitives.length, 9)
assert.equal(predecessor.sourceSqlFunctionBoundaries.length, 11)
assert.equal(predecessor.relevantGrants.length, 26)
const accepted = Object.fromEntries(
  Object.entries(predecessor.metadata.ACCEPTED_INPUT_SHA256).map(([name, expected]) => [
    name,
    JSON.parse(read(`${base}${name}.json`, expected)),
  ]),
)
const sourceTexts = new Map()
for (const record of predecessor.metadata.CONSUMED_SOURCE)
  sourceTexts.set(record.FILE, read(record.FILE, record.SHA256))
const finalServer = accepted.PHASE_1B_2B2B2B_ENTRY_LOCAL_ENFORCEMENT_ADJUDICATION
const server = accepted.PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS
const authority = accepted.PHASE_1B_1_CANONICAL_DATA_AUTHORITY_CENSUS
const frozenPayloads = {
  FINAL_SERVER_ENTRY_DISPOSITIONS: finalServer.reconciledEntryDispositions,
  PHASE_1B_2_FINDINGS: finalServer.knownEnforcementDefects,
  PHASE_1B_2_CEILINGS: finalServer.sourceCeilings,
  HISTORICAL_PAGES: finalServer.frozenB1Registers.historicalPageExpectations,
  R2B_RECORDS: accepted.PHASE_1B_1_R2B_AUTHORITY_OBJECT_CLOSEOUT.records,
  R2C_RECORDS: accepted.PHASE_1B_1_R2C_TARGETLESS_EFFECT_CLOSEOUT.records,
}
for (const [key, value] of Object.entries(frozenPayloads))
  assert.equal(digest(value), predecessor.metadata.FROZEN_PAYLOAD_SHA256[key], key)
const objectMap = new Map(
  predecessor.relationalSecurityObjects.map((record) => [record.OBJECT_ID, record]),
)
const entryMap = new Map(server.ENTRIES.map((entry) => [entry.ENTRY_ID, entry]))
const authorityMap = new Map(
  authority.persistenceUniverse.map((record) => [record.objectId, record]),
)
const finalEntryMap = new Map(
  finalServer.reconciledEntryDispositions.map((entry) => [entry.ENTRY_ID, entry]),
)
assert.equal(objectMap.size, 612)
assert.equal(entryMap.size, 1910)
for (const entry of server.ENTRIES)
  for (const range of entry.BOUNDARY_EVIDENCE) {
    const text = sourceTexts.get(range.SOURCE_FILE)
    assert.ok(text !== undefined, `Unfingerprinted boundary ${range.SOURCE_FILE}`)
    assert.equal(
      hash(
        text
          .split(/\r?\n/)
          .slice(range.LINE_START - 1, range.LINE_END)
          .join('\n'),
      ),
      range.RANGE_SHA256,
      `${entry.ENTRY_ID} boundary drift`,
    )
  }

function lex(text) {
  const tokens = []
  let i = 0
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++
      continue
    }
    if (text.startsWith('--', i)) {
      const end = text.indexOf('\n', i)
      i = end < 0 ? text.length : end
      continue
    }
    if (text.startsWith('/*', i)) {
      let depth = 1
      i += 2
      while (i < text.length && depth) {
        if (text.startsWith('/*', i)) {
          depth++
          i += 2
        } else if (text.startsWith('*/', i)) {
          depth--
          i += 2
        } else i++
      }
      assert.equal(depth, 0, 'Unterminated policy comment')
      continue
    }
    if (text[i] === "'" || text[i] === '"') {
      const quote = text[i++]
      let value = ''
      let closed = false
      while (i < text.length) {
        if (text[i] === quote) {
          if (text[i + 1] === quote) {
            value += quote
            i += 2
            continue
          }
          closed = true
          i++
          break
        }
        value += text[i++]
      }
      assert.ok(closed, 'Unterminated policy quote')
      tokens.push({ kind: quote === "'" ? 'string' : 'identifier', value })
      continue
    }
    const word = text.slice(i).match(/^[A-Za-z_][\w$]*/)?.[0]
    const number = text.slice(i).match(/^\d+(?:\.\d+)?/)?.[0]
    if (word) {
      tokens.push({ kind: 'word', value: word.toLowerCase() })
      i += word.length
      continue
    }
    if (number) {
      tokens.push({ kind: 'number', value: number })
      i += number.length
      continue
    }
    const operator = text.slice(i).match(/^(?:::|<=|>=|<>|!=|\|\|)/)?.[0] ?? text[i]
    tokens.push({ kind: 'punct', value: operator })
    i += operator.length
  }
  return tokens
}
const keyword = (token, value) => token?.kind === 'word' && token.value === value
class UnsupportedExpression extends Error {}
class Parser {
  constructor(tokens) {
    this.tokens = tokens
    this.index = 0
  }
  peek(value) {
    const token = this.tokens[this.index]
    return token?.value === value && (token.kind === 'word' || token.kind === 'punct')
  }
  take(value) {
    if (!this.peek(value)) return false
    this.index++
    return true
  }
  expect(value) {
    if (!this.take(value))
      throw new UnsupportedExpression(`Expected ${value} at token ${this.index}`)
  }
  identifier() {
    const token = this.tokens[this.index++]
    if (!token || !['word', 'identifier'].includes(token.kind))
      throw new UnsupportedExpression('Expected SQL identifier')
    return token.value
  }
  expression() {
    return this.or()
  }
  or() {
    const args = [this.and()]
    while (this.take('or')) args.push(this.and())
    return args.length === 1 ? args[0] : { type: 'or', args }
  }
  and() {
    const args = [this.not()]
    while (this.take('and')) args.push(this.not())
    return args.length === 1 ? args[0] : { type: 'and', args }
  }
  not() {
    if (this.take('not')) return { type: 'not', arg: this.not() }
    if (this.take('exists')) return this.query()
    let left = this.value()
    const operator = this.tokens[this.index]?.value
    if (['=', '<>', '!=', '<', '>', '<=', '>='].includes(operator)) {
      this.index++
      return {
        type: 'compare',
        operator: operator === '!=' ? '<>' : operator,
        left,
        right: this.value(),
      }
    }
    if (this.take('is')) {
      const negate = this.take('not')
      if (this.take('null')) return { type: 'null', negate, arg: left }
      throw new UnsupportedExpression('Unsupported IS predicate')
    }
    return left
  }
  value() {
    let result
    if (this.take('(')) {
      result = this.expression()
      this.expect(')')
    } else {
      const token = this.tokens[this.index]
      if (!token) throw new UnsupportedExpression('Missing expression')
      if (token.kind === 'string') {
        this.index++
        result = { type: 'literal', value: token.value }
      } else if (token.kind === 'number') {
        this.index++
        result = { type: 'number', value: token.value }
      } else if (keyword(token, 'true') || keyword(token, 'false')) {
        this.index++
        result = { type: 'bool', value: token.value === 'true' }
      } else {
        const parts = [this.identifier()]
        while (this.take('.')) parts.push(this.identifier())
        if (this.take('(')) {
          const args = []
          if (!this.take(')')) {
            args.push(this.expression())
            while (this.take(',')) args.push(this.expression())
            this.expect(')')
          }
          result = { type: 'call', name: parts.join('.'), args }
        } else result = { type: 'column', parts }
      }
    }
    while (this.take('::')) {
      const cast = this.identifier()
      result = { type: 'cast', cast, arg: result }
    }
    return result
  }
  query() {
    this.expect('(')
    this.expect('select')
    const projection = this.value()
    this.expect('from')
    const relations = [this.relation()]
    const joinConditions = []
    while (this.take('join')) {
      relations.push(this.relation())
      this.expect('on')
      joinConditions.push(this.expression())
    }
    this.expect('where')
    const where = this.expression()
    this.expect(')')
    return {
      type: 'exists',
      projection,
      relations,
      where: joinConditions.length ? { type: 'and', args: [...joinConditions, where] } : where,
    }
  }
  relation() {
    const parts = [this.identifier()]
    if (this.take('.')) parts.push(this.identifier())
    let alias = parts.at(-1)
    if (this.take('as')) alias = this.identifier()
    else if (
      ['word', 'identifier'].includes(this.tokens[this.index]?.kind) &&
      !['join', 'where', 'on'].includes(this.tokens[this.index].value)
    )
      alias = this.identifier()
    return { parts, alias }
  }
}
function normalize(node) {
  if (node.type === 'and' || node.type === 'or') {
    const args = node.args
      .map(normalize)
      .flatMap((arg) => (arg.type === node.type ? arg.args : [arg]))
    const byValue = new Map(args.map((arg) => [JSON.stringify(arg), arg]))
    const sorted = [...byValue].sort(([a], [b]) => a.localeCompare(b)).map(([, arg]) => arg)
    return sorted.length === 1 ? sorted[0] : { type: node.type, args: sorted }
  }
  if (node.type === 'compare') {
    let left = normalize(node.left),
      right = normalize(node.right)
    if (['=', '<>'].includes(node.operator) && JSON.stringify(left) > JSON.stringify(right))
      [left, right] = [right, left]
    return { ...node, left, right }
  }
  if (node.type === 'exists') {
    const aliases = new Map(
      node.relations.map((relation, index) => [relation.alias, `$relation${index}`]),
    )
    return {
      ...node,
      projection: normalize(node.projection),
      relations: node.relations.map((relation, index) => ({
        ...relation,
        alias: `$relation${index}`,
      })),
      where: normalize(renameAliases(node.where, aliases)),
    }
  }
  if (node.arg) return { ...node, arg: normalize(node.arg) }
  if (node.args) return { ...node, args: node.args.map(normalize) }
  return node
}
function renameAliases(node, aliases) {
  if (node.type === 'column' && node.parts.length > 1 && aliases.has(node.parts[0]))
    return { ...node, parts: [aliases.get(node.parts[0]), ...node.parts.slice(1)] }
  if (node.type === 'exists') {
    const visible = new Map(
      [...aliases].filter(
        ([alias]) => !node.relations.some((relation) => relation.alias === alias),
      ),
    )
    return { ...node, where: renameAliases(node.where, visible) }
  }
  if (node.arg) return { ...node, arg: renameAliases(node.arg, aliases) }
  if (node.args) return { ...node, args: node.args.map((arg) => renameAliases(arg, aliases)) }
  if (node.left)
    return {
      ...node,
      left: renameAliases(node.left, aliases),
      right: renameAliases(node.right, aliases),
    }
  return node
}
function parse(text) {
  if (text === null) return { status: 'ABSENT_CLAUSE', ast: null, canonical: null }
  const tokens = lex(text)
  const parser = new Parser(tokens)
  try {
    const ast = normalize(parser.expression())
    if (parser.index !== tokens.length)
      throw new UnsupportedExpression(`Trailing token ${parser.index}`)
    return { status: 'PARSED', ast, canonical: JSON.stringify(ast) }
  } catch (error) {
    if (!(error instanceof UnsupportedExpression)) throw error
    return {
      status: 'SOURCE_CEILING_EXPRESSION_GRAMMAR',
      ast: null,
      canonical: null,
      reason: error.message,
      tokens,
    }
  }
}
function visit(node, callback) {
  if (!node) return
  callback(node)
  if (node.arg) visit(node.arg, callback)
  for (const arg of node.args ?? []) visit(arg, callback)
  if (node.left) {
    visit(node.left, callback)
    visit(node.right, callback)
  }
  if (node.where) visit(node.where, callback)
}
const unwrap = (node) => (node.type === 'cast' ? unwrap(node.arg) : node)
function contextName(node) {
  const value = unwrap(node)
  return value.type === 'call' &&
    ['current_setting', 'pg_catalog.current_setting'].includes(value.name) &&
    value.args[0]?.type === 'literal'
    ? value.args[0].value
    : null
}
function dnf(node) {
  if (node.type === 'or') return node.args.flatMap(dnf)
  if (node.type === 'and') {
    let branches = [[]]
    for (const arg of node.args) {
      const next = dnf(arg)
      if (branches.length * next.length > 256)
        throw new UnsupportedExpression('Boolean branch expansion exceeds bounded 256 branches')
      branches = branches.flatMap((left) => next.map((right) => [...left, ...right]))
    }
    return branches
  }
  return [[node]]
}
function contradictory(atoms) {
  const nullStates = new Map()
  const values = new Map()
  for (const atom of atoms) {
    if (atom.type === 'bool' && !atom.value) return true
    if (atom.type === 'not' && atom.arg.type === 'bool' && atom.arg.value) return true
    if (atom.type === 'null') {
      const key = JSON.stringify(atom.arg)
      if (nullStates.has(key) && nullStates.get(key) !== atom.negate) return true
      nullStates.set(key, atom.negate)
    }
    if (atom.type === 'compare' && atom.operator === '=') {
      for (const [left, right] of [
        [atom.left, atom.right],
        [atom.right, atom.left],
      ]) {
        if (unwrap(left).type !== 'column' || !['literal', 'number'].includes(right.type)) continue
        const key = JSON.stringify(left),
          value = JSON.stringify(right)
        if (values.has(key) && values.get(key) !== value) return true
        values.set(key, value)
      }
    }
  }
  return false
}
const orgColumns = new Set([
  'organization_id',
  'org_id',
  'tenant_id',
  'union_local_id',
  'source_organization_id',
  'from_organization_id',
  'to_organization_id',
  'verified_organization_id',
])
const userColumns = new Set(['user_id', 'owner_id', 'claimed_by_user_id', 'representative_user_id'])
const discovered = new Map()
function relationId(scope, parts) {
  const qualified = parts.length === 1 ? `public.${parts[0]}` : parts.join('.')
  return `${scope}::${qualified}`
}
function bindingsFor(object, relations = []) {
  const aliases = new Map([
    [object.OBJECT_NAME, object.OBJECT_ID],
    [object.QUALIFIED_NAME, object.OBJECT_ID],
  ])
  for (const relation of relations)
    aliases.set(relation.alias, relationId(object.DATABASE_SCOPE, relation.parts))
  return aliases
}
function resolveColumn(node, object, relations = []) {
  const value = unwrap(node)
  if (value.type !== 'column') return null
  const column = value.parts.at(-1)
  let objectId
  if (value.parts.length === 1) {
    if (!relations.length) objectId = object.OBJECT_ID
    else {
      const matches = relations
        .map((relation) => relationId(object.DATABASE_SCOPE, relation.parts))
        .filter((key) => objectMap.get(key)?.COLUMNS.includes(column))
      if (matches.length !== 1) return null
      objectId = matches[0]
    }
  } else {
    objectId = bindingsFor(object, relations).get(value.parts.slice(0, -1).join('.'))
  }
  if (!objectId) return null
  return {
    objectId,
    column,
    valid: objectMap.get(objectId)?.COLUMNS.includes(column) === true,
    outer:
      objectId === object.OBJECT_ID &&
      !(value.parts.length === 1 && relations.length) &&
      !relations.some((relation) => relation.alias === value.parts[0]),
    relationInstance:
      value.parts.length === 1 && relations.length
        ? relations.find(
            (relation) => relationId(object.DATABASE_SCOPE, relation.parts) === objectId,
          )?.alias
        : relations.some((relation) => relation.alias === value.parts[0])
          ? value.parts[0]
          : '$outer',
  }
}
function atomFacts(atom, object, relations = []) {
  const facts = {
    dimensions: [],
    contexts: [],
    comparisons: [],
    joins: [],
    unknown: [],
    widening: [],
  }
  if (atom.type === 'compare' && atom.operator === '=') {
    for (const [left, right] of [
      [atom.left, atom.right],
      [atom.right, atom.left],
    ]) {
      const column = resolveColumn(left, object, relations),
        context = contextName(right)
      if (column && context) {
        facts.contexts.push(context)
        facts.comparisons.push({
          ...column,
          context,
          casts: [
            left.type === 'cast' ? left.cast : null,
            right.type === 'cast' ? right.cast : null,
          ],
        })
        if (!column.valid)
          facts.unknown.push('Compared column is not established in accepted object columns')
        if (column.valid && column.outer) {
          if (
            context === 'app.current_org_id' &&
            (orgColumns.has(column.column) ||
              (object.OBJECT_NAME === 'organizations' && column.column === 'id'))
          )
            facts.dimensions.push('ORGANIZATION_IDENTITY')
          if (context === 'app.current_user_id' && userColumns.has(column.column))
            facts.dimensions.push(
              column.column === 'user_id' ? 'USER_IDENTITY' : 'RESOURCE_OWNER_IDENTITY',
            )
          if (context === 'app.current_user_id' && column.column === 'member_id')
            facts.unknown.push(
              'Membership record ID is not proven equivalent to authenticated user ID',
            )
        }
      }
    }
    const left = resolveColumn(atom.left, object, relations),
      right = resolveColumn(atom.right, object, relations)
    if (left && right) facts.joins.push({ left, right })
    if (!facts.comparisons.length && !facts.joins.length) {
      if (![atom.left, atom.right].every((value) => ['literal', 'number'].includes(value.type)))
        facts.unknown.push('Non-context equality needs authority-contract interpretation')
      if (
        [atom.left, atom.right].some(
          (value) => value.type === 'literal' && value.value === 'public',
        )
      )
        facts.widening.push('PUBLIC_SHARING_BRANCH')
    }
  } else if (atom.type === 'exists') {
    const branches = dnf(atom.where).filter((branch) => !contradictory(branch))
    const branchFacts = branches.map((branch) =>
      branch.map((child) => atomFacts(child, object, atom.relations)),
    )
    const results = []
    for (const branch of branchFacts) {
      const graph = new Map()
      for (const join of branch.flatMap((fact) => fact.joins)) {
        if (!join.left.valid || !join.right.valid) continue
        if (!graph.has(join.left.relationInstance)) graph.set(join.left.relationInstance, new Set())
        if (!graph.has(join.right.relationInstance))
          graph.set(join.right.relationInstance, new Set())
        graph.get(join.left.relationInstance).add(join.right.relationInstance)
        graph.get(join.right.relationInstance).add(join.left.relationInstance)
      }
      const connected = new Set(['$outer']),
        queue = ['$outer']
      while (queue.length)
        for (const next of graph.get(queue.shift()) ?? [])
          if (!connected.has(next)) {
            connected.add(next)
            queue.push(next)
          }
      const enforced = new Set()
      for (const comparison of branch.flatMap((fact) => fact.comparisons)) {
        if (!comparison.valid || !connected.has(comparison.relationInstance) || comparison.outer)
          continue
        if (comparison.context === 'app.current_org_id' && orgColumns.has(comparison.column))
          enforced.add('ORGANIZATION_IDENTITY')
        if (comparison.context === 'app.current_user_id' && userColumns.has(comparison.column))
          enforced.add(
            comparison.column === 'user_id' ? 'USER_IDENTITY' : 'RESOURCE_OWNER_IDENTITY',
          )
      }
      results.push(enforced)
      facts.unknown.push(...branch.flatMap((fact) => fact.unknown))
      facts.widening.push(...branch.flatMap((fact) => fact.widening))
      facts.contexts.push(...branch.flatMap((fact) => fact.contexts))
      facts.joins.push(...branch.flatMap((fact) => fact.joins))
      facts.comparisons.push(...branch.flatMap((fact) => fact.comparisons))
    }
    facts.dimensions = results.length
      ? [...results[0]].filter((dimension) => results.every((set) => set.has(dimension)))
      : []
    facts.unknown.push(
      'Correlated-row join logic is source-analyzed; key lineage, parent RLS recursion and intended business authority need explicit reconciliation',
    )
  } else if (atom.type === 'bool') {
    if (atom.value) facts.widening.push('UNCONDITIONAL_TRUE')
  } else if (atom.type === 'null') {
    if (!atom.negate) facts.widening.push('NULL_ADMISSIBLE_BRANCH')
  } else if (atom.type === 'not') {
    facts.unknown.push('Negated predicate requires authority-contract interpretation')
  } else facts.unknown.push('Predicate has no established authority implication')
  visit(atom, (node) => {
    const context = contextName(node)
    if (context) facts.contexts.push(context)
    if (node.type === 'cast' && !['text', 'uuid', 'varchar'].includes(node.cast))
      facts.unknown.push(`Cast ${node.cast} requires conversion semantics`)
  })
  for (const comparison of facts.comparisons)
    if (comparison.casts.includes('uuid'))
      facts.unknown.push(
        'UUID conversion can reject absent/empty/malformed context; runtime context domain is unproven',
      )
  return facts
}
function dimensionsFor(object) {
  const org = ['ORG_RLS_REQUIRED', 'ORG_AND_RESOURCE_RLS_REQUIRED'].includes(
    object.RLS_REQUIREMENT_CLASS,
  )
  const resource = ['USER_OR_RESOURCE_RLS_REQUIRED', 'ORG_AND_RESOURCE_RLS_REQUIRED'].includes(
    object.RLS_REQUIREMENT_CLASS,
  )
  return {
    org,
    resource,
    required: [
      ...(org ? ['ORGANIZATION_IDENTITY'] : []),
      ...(resource ? ['USER_OR_RESOURCE_AUTHORITY'] : []),
    ],
    frozenResourceSignals: object.RESOURCE_BOUNDARY_SIGNAL,
    limitation: resource
      ? 'Frozen user/resource requirement is not silently narrowed to arbitrary user/member/creator equality'
      : null,
  }
}
function analyzeAst(ast, object) {
  const expected = dimensionsFor(object)
  let branches
  try {
    branches = dnf(ast)
  } catch (error) {
    if (!(error instanceof UnsupportedExpression)) throw error
    return {
      status: 'SOURCE_CEILING',
      unknown: [error.message],
      branches: [],
      missing: expected.required,
      dimensions: [],
    }
  }
  const viable = branches.filter((branch) => !contradictory(branch))
  if (!viable.length)
    return { status: 'DENY_ALL', branches: [], dimensions: [], missing: [], unknown: [] }
  const analyses = viable.map((branch) => {
    const facts = branch.map((atom) => atomFacts(atom, object))
    const dimensions = unique(facts.flatMap((fact) => fact.dimensions))
    return {
      NORMALIZED_ATOMS: branch,
      DIMENSIONS: dimensions,
      CONTEXT_COMPARISONS: facts.flatMap((fact) => fact.comparisons),
      JOIN_EDGES: facts.flatMap((fact) => fact.joins),
      CONTEXT_VARIABLES: unique(facts.flatMap((fact) => fact.contexts)),
      UNKNOWN_SEMANTICS: unique(facts.flatMap((fact) => fact.unknown)),
      WIDENING_SIGNALS: unique(facts.flatMap((fact) => fact.widening)),
      MISSING_DIMENSIONS: [
        ...(expected.org && !dimensions.includes('ORGANIZATION_IDENTITY')
          ? ['ORGANIZATION_IDENTITY']
          : []),
        ...(expected.resource &&
        !dimensions.some((dimension) =>
          ['USER_IDENTITY', 'RESOURCE_OWNER_IDENTITY'].includes(dimension),
        )
          ? ['USER_OR_RESOURCE_AUTHORITY']
          : []),
      ],
    }
  })
  const dimensions = analyses[0].DIMENSIONS.filter((dimension) =>
    analyses.every((branch) => branch.DIMENSIONS.includes(dimension)),
  )
  const unknown = unique(analyses.flatMap((branch) => branch.UNKNOWN_SEMANTICS))
  if (expected.resource)
    unknown.push(
      'Exact owner/member/assignee/case authority and command-specific intent are not established by the frozen structural resource requirement alone',
    )
  return {
    status: analyses.some((branch) => branch.MISSING_DIMENSIONS.length)
      ? 'AUTHORITY_DIMENSION_GAP'
      : unknown.length
        ? 'BOUNDARY_LOGIC_WITH_SOURCE_CEILING'
        : 'BOUNDARY_LOGIC_PRESENT',
    branches: analyses,
    dimensions,
    missing: unique(analyses.flatMap((branch) => branch.MISSING_DIMENSIONS)),
    unknown: unique(unknown),
  }
}
function effectiveClause(policy, command, direction) {
  if (direction === 'USING') return policy.USING_EXPRESSION ?? 'true'
  if (policy.WITH_CHECK_EXPRESSION !== null) return policy.WITH_CHECK_EXPRESSION
  if (['UPDATE', 'ALL'].includes(policy.COMMAND)) return policy.USING_EXPRESSION ?? 'true'
  assert.equal(command, 'INSERT')
  return 'true'
}
function directions(command) {
  return command === 'INSERT'
    ? ['WITH_CHECK']
    : command === 'UPDATE'
      ? ['USING', 'WITH_CHECK']
      : ['USING']
}
const semanticRoles = ['union_eyes_runtime', 'union_eyes_system']
function combinedAst(policies, command, direction, role, parsedPolicies) {
  const applicable = policies.filter(
    (policy) =>
      policy.APPLICABLE_ROLES.includes(role) || policy.APPLICABLE_ROLES.includes('PUBLIC'),
  )
  const permissive = applicable.filter((policy) => policy.MODE !== 'RESTRICTIVE')
  const restrictive = applicable.filter((policy) => policy.MODE === 'RESTRICTIVE')
  const clause = (policy) => parsedPolicies.get(`${policy.POLICY_ID}|${command}|${direction}`)
  if (applicable.some((policy) => clause(policy).status !== 'PARSED'))
    return { status: 'SOURCE_CEILING', applicable, permissive, restrictive, ast: null }
  const permit = permissive.length
    ? { type: 'or', args: permissive.map((policy) => clause(policy).ast) }
    : { type: 'bool', value: false }
  const ast = normalize({
    type: 'and',
    args: [permit, ...restrictive.map((policy) => clause(policy).ast)],
  })
  return { status: 'PARSED', applicable, permissive, restrictive, ast }
}
function selfTest() {
  const object = {
    OBJECT_ID: 'test::public.items',
    DATABASE_SCOPE: 'test',
    OBJECT_NAME: 'items',
    QUALIFIED_NAME: 'public.items',
    COLUMNS: ['organization_id', 'user_id', 'parent_id'],
    RLS_REQUIREMENT_CLASS: 'ORG_RLS_REQUIRED',
    RESOURCE_BOUNDARY_SIGNAL: [],
  }
  objectMap.set(object.OBJECT_ID, object)
  const parent = {
    ...object,
    OBJECT_ID: 'test::public.parents',
    OBJECT_NAME: 'parents',
    QUALIFIED_NAME: 'public.parents',
    COLUMNS: ['id', 'organization_id'],
  }
  objectMap.set(parent.OBJECT_ID, parent)
  const equality = `organization_id::text = current_setting('app.current_org_id', true)`
  assert.equal(
    parse(equality).canonical,
    parse(`(current_setting('app.current_org_id',true) = "organization_id"::text)`).canonical,
  )
  assert.notEqual(
    parse(equality).canonical,
    parse(`"Organization_id"::text = current_setting('app.current_org_id',true)`).canonical,
  )
  assert.equal(analyzeAst(parse(equality).ast, object).status, 'BOUNDARY_LOGIC_PRESENT')
  assert.equal(
    analyzeAst(parse(`${equality} OR organization_id IS NULL`).ast, object).status,
    'AUTHORITY_DIMENSION_GAP',
  )
  assert.equal(analyzeAst(parse(`${equality} AND false`).ast, object).status, 'DENY_ALL')
  assert.equal(
    analyzeAst(parse(`organization_id IS NULL AND organization_id IS NOT NULL`).ast, object).status,
    'DENY_ALL',
  )
  assert.equal(
    analyzeAst(
      parse(
        `EXISTS (SELECT 1 FROM parents p WHERE p.id = items.parent_id AND p.organization_id::text = current_setting('app.current_org_id', true))`,
      ).ast,
      object,
    ).dimensions.includes('ORGANIZATION_IDENTITY'),
    true,
  )
  assert.equal(
    analyzeAst(
      parse(
        `EXISTS (SELECT 1 FROM parents p WHERE p.organization_id::text = current_setting('app.current_org_id', true))`,
      ).ast,
      object,
    ).dimensions.includes('ORGANIZATION_IDENTITY'),
    false,
  )
  assert.equal(
    parse(
      `EXISTS (SELECT 1 FROM parents p WHERE p.id=items.parent_id AND p.organization_id::text=current_setting('app.current_org_id',true))`,
    ).canonical,
    parse(
      `EXISTS (SELECT 1 FROM parents renamed WHERE renamed.organization_id::text=current_setting('app.current_org_id',true) AND renamed.id=items.parent_id)`,
    ).canonical,
  )
  assert.equal(
    analyzeAst(
      parse(
        `EXISTS (SELECT 1 FROM items p WHERE p.organization_id::text = current_setting('app.current_org_id',true))`,
      ).ast,
      object,
    ).dimensions.includes('ORGANIZATION_IDENTITY'),
    false,
  )
  assert.equal(
    analyzeAst(
      parse(
        `EXISTS (SELECT 1 FROM parents p WHERE organization_id::text = current_setting('app.current_org_id',true))`,
      ).ast,
      object,
    ).dimensions.includes('ORGANIZATION_IDENTITY'),
    false,
  )
  assert.equal(
    parse(`organization_id IN (SELECT id FROM organizations)`).status,
    'SOURCE_CEILING_EXPRESSION_GRAMMAR',
  )
  assert.equal(
    effectiveClause(
      { COMMAND: 'UPDATE', USING_EXPRESSION: equality, WITH_CHECK_EXPRESSION: null },
      'UPDATE',
      'WITH_CHECK',
    ),
    equality,
  )
  assert.equal(
    effectiveClause(
      { COMMAND: 'INSERT', USING_EXPRESSION: null, WITH_CHECK_EXPRESSION: null },
      'INSERT',
      'WITH_CHECK',
    ),
    'true',
  )
  const policies = [
    {
      POLICY_ID: 'a',
      COMMAND: 'ALL',
      MODE: 'PERMISSIVE',
      APPLICABLE_ROLES: ['union_eyes_runtime'],
      USING_EXPRESSION: equality,
      WITH_CHECK_EXPRESSION: equality,
    },
    {
      POLICY_ID: 'b',
      COMMAND: 'ALL',
      MODE: 'PERMISSIVE',
      APPLICABLE_ROLES: ['union_eyes_system'],
      USING_EXPRESSION: 'true',
      WITH_CHECK_EXPRESSION: 'true',
    },
  ]
  const parsed = new Map(
    policies.map((policy) => [`${policy.POLICY_ID}|SELECT|USING`, parse(policy.USING_EXPRESSION)]),
  )
  assert.equal(
    analyzeAst(combinedAst(policies, 'SELECT', 'USING', 'union_eyes_runtime', parsed).ast, object)
      .status,
    'BOUNDARY_LOGIC_PRESENT',
  )
  assert.equal(combinedAst(policies, 'SELECT', 'USING', 'other', parsed).ast.value, false)
  policies.push({
    ...policies[0],
    POLICY_ID: 'c',
    APPLICABLE_ROLES: ['PUBLIC'],
    USING_EXPRESSION: 'true',
  })
  parsed.set('c|SELECT|USING', parse('true'))
  assert.equal(
    analyzeAst(combinedAst(policies, 'SELECT', 'USING', 'union_eyes_runtime', parsed).ast, object)
      .status,
    'AUTHORITY_DIMENSION_GAP',
  )
  policies[2].MODE = 'RESTRICTIVE'
  parsed.set('c|SELECT|USING', parse('false'))
  assert.equal(
    analyzeAst(combinedAst(policies, 'SELECT', 'USING', 'union_eyes_runtime', parsed).ast, object)
      .status,
    'DENY_ALL',
  )
  objectMap.delete(object.OBJECT_ID)
  objectMap.delete(parent.OBJECT_ID)
  assert.equal(objectMap.size, 612)
}
selfTest()

const findings = new Map()
const ceilings = new Map()
const sourceEvidenceRegistry = new Map()
function evidenceReferences(evidence) {
  return evidence.map((source) => {
    const evidenceId = id('EVIDENCE', digest(source))
    sourceEvidenceRegistry.set(evidenceId, { SOURCE_EVIDENCE_ID: evidenceId, ...source })
    return { SOURCE_EVIDENCE_ID: evidenceId }
  })
}
function finding(
  kind,
  key,
  objects,
  policies,
  rationale,
  evidence,
  consequence = 'STATIC_CORRECTNESS_SIGNAL',
) {
  assert.ok(findingClasses.includes(kind))
  const findingId = id('FINDING', `${kind}|${key}`)
  findings.set(findingId, {
    FINDING_ID: findingId,
    FINDING_CLASS: kind,
    AFFECTED_OBJECT_IDS: unique(objects),
    AFFECTED_POLICY_IDS: unique(policies),
    STATIC_FACT: rationale,
    DISPOSITION_EFFECT: consequence,
    SOURCE_EVIDENCE: evidenceReferences(evidence),
    RUNTIME_EXPLOIT_CLAIM: 'NO',
  })
  return findingId
}
function ceiling(kind, key, objects, why, required, evidence, predecessorIds = []) {
  const ceilingId = id('CEILING', `${kind}|${key}`)
  ceilings.set(ceilingId, {
    SOURCE_CEILING_ID: ceilingId,
    CEILING_CLASS: kind,
    AFFECTED_OBJECT_IDS: unique(objects),
    WHY_STATIC_CORRECTNESS_REMAINS_UNRESOLVED: why,
    REQUIRED_ADDITIONAL_EVIDENCE: required,
    SOURCE_EVIDENCE: evidenceReferences(evidence),
    PREDECESSOR_SOURCE_CEILING_IDS: unique(predecessorIds),
  })
  return ceilingId
}
const policyAnalyses = []
const parsedPolicies = new Map()
const policyByObject = new Map()
const objectPolicyAnalysis = new Map()
const functionsById = new Map(
  predecessor.sourceSqlFunctionBoundaries.map((fn) => [fn.FUNCTION_ID, fn]),
)
const builtins = new Set(['current_setting', 'pg_catalog.current_setting', 'any'])
for (const policy of predecessor.rlsPolicies) {
  const object = objectMap.get(policy.OBJECT_ID)
  assert.ok(object, 'Policy denominator drift')
  if (!policyByObject.has(object.OBJECT_ID)) policyByObject.set(object.OBJECT_ID, [])
  policyByObject.get(object.OBJECT_ID).push(policy)
  const rawUsing = parse(policy.USING_EXPRESSION),
    rawCheck = parse(policy.WITH_CHECK_EXPRESSION)
  const expressions = []
  const contexts = new Set(),
    helpers = new Set(),
    relations = new Set()
  const contextReads = new Map()
  const policyCeilings = []
  for (const command of policy.COMMAND === 'ALL' ? commands : [policy.COMMAND])
    for (const direction of directions(command)) {
      const expression = effectiveClause(policy, command, direction)
      const parsed = parse(expression)
      parsedPolicies.set(`${policy.POLICY_ID}|${command}|${direction}`, parsed)
      const analysis = parsed.ast ? analyzeAst(parsed.ast, object) : null
      if (parsed.ast)
        visit(parsed.ast, (node) => {
          const context = contextName(node)
          if (context) contexts.add(context)
          if (
            node.type === 'call' &&
            ['current_setting', 'pg_catalog.current_setting'].includes(node.name) &&
            node.args[0]?.type === 'literal'
          )
            contextReads.set(JSON.stringify(node), {
              VARIABLE: node.args[0].value,
              MISSING_OK: node.args[1]?.type === 'bool' ? node.args[1].value : 'SOURCE_UNSPECIFIED',
              ABSENT_CONTEXT_SEMANTICS:
                node.args[1]?.type === 'bool' && node.args[1].value
                  ? 'NULL; ordinary equality evaluates UNKNOWN and does not grant access; explicit OR NULL/public branches analyzed separately'
                  : 'Missing-setting error or dynamic missing_ok semantics require explicit interpretation',
              EMPTY_OR_MALFORMED_CONTEXT:
                'Text equality can differ from UUID cast behavior; authoritative nonempty values and conversions remain source ceilings',
            })
          if (node.type === 'call' && !builtins.has(node.name)) helpers.add(node.name)
          if (node.type === 'exists')
            for (const relation of node.relations)
              relations.add(relationId(object.DATABASE_SCOPE, relation.parts))
        })
      if (!parsed.ast)
        policyCeilings.push(
          ceiling(
            'POLICY_EXPRESSION',
            `${policy.POLICY_ID}|${command}|${direction}`,
            [object.OBJECT_ID],
            `Exact expression is retained but the bounded parser does not establish its semantics: ${parsed.reason}`,
            'Explicit interpretation of unsupported SQL expression grammar',
            [policy.SOURCE_EVIDENCE],
          ),
        )
      expressions.push({
        COMMAND: command,
        DIRECTION: direction,
        RAW_EXPRESSION: expression,
        CLAUSE_ORIGIN:
          direction === 'WITH_CHECK' && policy.WITH_CHECK_EXPRESSION === null
            ? ['UPDATE', 'ALL'].includes(policy.COMMAND)
              ? 'POSTGRESQL_IMPLICIT_USING_CHECK'
              : 'POSTGRESQL_UNCONSTRAINED_DEFAULT_CHECK'
            : direction === 'USING' && policy.USING_EXPRESSION === null
              ? 'POSTGRESQL_UNCONSTRAINED_DEFAULT_USING'
              : 'EXPLICIT',
        PARSE_STATUS: parsed.status,
        NORMALIZED_AST: parsed.ast,
        SEMANTIC_ANALYSIS: analysis,
      })
    }
  for (const relation of relations)
    if (!objectMap.has(relation))
      discovered.set(relation, {
        OBJECT_ID: relation,
        CLASSIFICATION: 'POST_1B3A_DISCOVERED_OBJECT',
        DISCOVERY_POLICY_IDS: unique([
          ...(discovered.get(relation)?.DISCOVERY_POLICY_IDS ?? []),
          policy.POLICY_ID,
        ]),
        DENOMINATOR_MUTATED: 'NO',
        RECONCILIATION_REQUIRED: 'EXPLICIT_HUMAN_DENOMINATOR_RECONCILIATION',
      })
  const analysis = {
    POLICY_ID: policy.POLICY_ID,
    OBJECT_ID: object.OBJECT_ID,
    COMMAND: policy.COMMAND,
    MODE: policy.MODE,
    EFFECTIVE_MODE: policy.MODE === 'RESTRICTIVE' ? 'RESTRICTIVE' : 'PERMISSIVE',
    APPLICABLE_ROLES: policy.APPLICABLE_ROLES,
    RAW_USING: policy.USING_EXPRESSION,
    RAW_WITH_CHECK: policy.WITH_CHECK_EXPRESSION,
    NORMALIZED_USING: rawUsing.ast,
    NORMALIZED_WITH_CHECK: rawCheck.ast,
    EXPRESSIONS_BY_COMMAND_AND_DIRECTION: expressions,
    CONTEXT_VARIABLES_REFERENCED: [...contexts].sort(),
    CONTEXT_READ_SEMANTICS: [...contextReads.values()],
    POLICY_HELPERS_REFERENCED: [...helpers].sort(),
    RESOURCE_RELATIONSHIPS_REFERENCED: [...relations].sort(),
    DECLARATION_HELPER_FUNCTION_ID: policy.SOURCE_EVIDENCE.HELPER_FUNCTION_ID ?? null,
    SOURCE_APPLICATION_CONDITION: policy.SOURCE_APPLICATION_CONDITION,
    SOURCE_CEILING_IDS: unique(policyCeilings),
    SOURCE_EVIDENCE: [policy.SOURCE_EVIDENCE],
  }
  policyAnalyses.push(analysis)
  if (!objectPolicyAnalysis.has(object.OBJECT_ID)) objectPolicyAnalysis.set(object.OBJECT_ID, [])
  objectPolicyAnalysis.get(object.OBJECT_ID).push(analysis)
}
const helperAnalyses = predecessor.sourceSqlFunctionBoundaries.map((fn) => ({
  FUNCTION_ID: fn.FUNCTION_ID,
  DATABASE_SCOPE: fn.DATABASE_SCOPE,
  QUALIFIED_NAME: fn.QUALIFIED_NAME,
  SECURITY_MODE: fn.SECURITY_MODE,
  BODY: fn.BODY,
  INPUTS: fn.INPUTS,
  REFERENCED_OBJECT_IDS: fn.DATABASE_OBJECTS_ACCESSED,
  REFERENCED_CONTEXT: unique(
    [...fn.BODY.matchAll(/current_setting\s*\(\s*'([^']+)'/gi)].map((match) => match[1]),
  ),
  SEARCH_PATH_DECLARATION: fn.SEARCH_PATH_BEHAVIOR,
  OWNER_SOURCE_STATUS: fn.OWNER,
  EXECUTE_GRANT_SOURCE_STATUS: fn.CALLABLE_BY_ROLES,
  CALL_SITE_CLASS: fn.OBJECTS_SECURITY_MODIFIED?.length
    ? 'MIGRATION_DECLARATION_GENERATOR_NOT_PER_ROW_POLICY_HELPER'
    : 'TRIGGER_OR_SQL_BOUNDARY',
  ACTIVE_POLICY_CALL_IDS: policyAnalyses
    .filter((policy) =>
      policy.POLICY_HELPERS_REFERENCED.some(
        (name) => fn.QUALIFIED_NAME === name || fn.QUALIFIED_NAME === `public.${name}`,
      ),
    )
    .map((policy) => policy.POLICY_ID),
  GENERATED_POLICY_IDS: policyAnalyses
    .filter((policy) => policy.DECLARATION_HELPER_FUNCTION_ID === fn.FUNCTION_ID)
    .map((policy) => policy.POLICY_ID),
  STATIC_LOGIC_ANALYSIS: fn.OBJECTS_SECURITY_MODIFIED?.length
    ? 'Exact generated policy predicates analyzed per target, role, command and row direction. Conditional missing-relation skips remain migration-application ceilings.'
    : 'Body retained with source object/context and trigger linkage; not assumed to bypass RLS or to mediate tenant authority.',
  CAN_WIDEN_AUTHORITY: 'SOURCE_CEILING_OWNER_EXECUTE_SEARCH_PATH_AND_CALLER_AUTHORITY',
  PREDECESSOR_SOURCE_CEILING_ID: fn.SOURCE_CEILING_ID,
  SOURCE_EVIDENCE: [fn.DECLARATION],
}))
for (const helper of helperAnalyses) {
  const fn = functionsById.get(helper.FUNCTION_ID)
  helper.SOURCE_CEILING_ID = ceiling(
    'SQL_FUNCTION_OWNER_EXECUTE_AND_SEARCH_PATH',
    helper.FUNCTION_ID,
    unique([...(fn.DATABASE_OBJECTS_ACCESSED ?? []), ...(fn.OBJECTS_SECURITY_MODIFIED ?? [])]),
    'Function logic and generated target predicates are retained, but actual owner, execute grants, search path and role inheritance are not established.',
    'Explicit function authority contract and separately authorized owner/execute/search-path composition',
    helper.SOURCE_EVIDENCE,
    [helper.PREDECESSOR_SOURCE_CEILING_ID],
  )
}
const grantAnalyses = predecessor.relevantGrants.map((grant) => {
  const tokens = lex(grant.OBJECT)
  let scopeClass = 'SOURCE_CEILING_GRANT_SCOPE'
  let targets = []
  if (keyword(tokens[0], 'table')) {
    const parser = new Parser(tokens.slice(1))
    const parts = [parser.identifier()]
    if (parser.take('.')) parts.push(parser.identifier())
    if (parser.index === parser.tokens.length) {
      const target = relationId(grant.DATABASE_SCOPE, parts)
      if (objectMap.has(target)) {
        targets = [target]
        scopeClass = 'EXACT_ACCEPTED_RELATION_SOURCE_SCOPE'
      } else
        discovered.set(target, {
          OBJECT_ID: target,
          CLASSIFICATION: 'POST_1B3A_DISCOVERED_OBJECT',
          DISCOVERY_GRANT_IDS: [grant.GRANT_ID],
          DENOMINATOR_MUTATED: 'NO',
        })
    }
  } else if (keyword(tokens[0], 'schema')) scopeClass = 'SCHEMA_USAGE_NOT_ROW_AUTHORIZATION'
  else if (
    keyword(tokens[0], 'all') &&
    keyword(tokens[1], 'tables') &&
    keyword(tokens[2], 'in') &&
    keyword(tokens[3], 'schema')
  ) {
    scopeClass = 'CATALOG_TABLE_SET_AT_DECLARATION_TIME_SOURCE_CEILING'
    const schema = tokens[4]?.value
    targets = predecessor.relationalSecurityObjects
      .filter(
        (object) => object.DATABASE_SCOPE === grant.DATABASE_SCOPE && object.SCHEMA === schema,
      )
      .map((object) => object.OBJECT_ID)
  } else if (keyword(tokens[0], 'all') && keyword(tokens[1], 'sequences'))
    scopeClass = 'SEQUENCE_PRIVILEGES_NOT_ROW_AUTHORIZATION'
  else if (keyword(tokens[0], 'tables') || keyword(tokens[0], 'sequences'))
    scopeClass = 'DEFAULT_PRIVILEGES_OWNER_AND_FUTURE_OBJECT_SCOPE_CEILING'
  const ceilingId = ceiling(
    'GRANT_EFFECTIVE_SCOPE_AND_ROLE',
    grant.GRANT_ID,
    targets,
    'Checked-in GRANT/REVOKE operation is preserved; effective ordered privileges, ACL owner/default-privilege scope, schema catalog membership, inherited roles and deployed application are not inferred.',
    'Exact role/ACL/default-owner and migration-application composition',
    [grant.SOURCE],
  )
  return {
    GRANT_ID: grant.GRANT_ID,
    OPERATION: grant.OPERATION,
    DATABASE_SCOPE: grant.DATABASE_SCOPE,
    GRANTEE: grant.GRANTEE,
    OBJECT_SCOPE_SOURCE: grant.OBJECT,
    PRIVILEGES_SOURCE: grant.PRIVILEGE,
    GRANT_OPTION: grant.GRANT_OPTION,
    SCOPE_CLASS: scopeClass,
    ACCEPTED_TARGET_OBJECT_IDS: targets,
    RLS_INTERACTION:
      'Table privilege is necessary but not sufficient; it does not itself override enabled/forced RLS. Schema/sequence usage is not row authorization.',
    SOURCE_CEILING_ID: ceilingId,
    SOURCE_EVIDENCE: [grant.SOURCE],
  }
})
for (const policy of policyAnalyses)
  for (const helper of policy.POLICY_HELPERS_REFERENCED) {
    const resolved = helperAnalyses.find(
      (fn) => fn.QUALIFIED_NAME === helper || fn.QUALIFIED_NAME === `public.${helper}`,
    )
    policy.SOURCE_CEILING_IDS.push(
      ceiling(
        'POLICY_HELPER',
        `${policy.POLICY_ID}|${helper}`,
        [policy.OBJECT_ID],
        resolved
          ? 'Helper body is retained, but its authority implication and effective owner/execute/search-path composition are not proven'
          : `No accepted SQL definition establishes policy helper ${helper}`,
        'Exact helper logic, source authority contract and effective execution composition',
        policy.SOURCE_EVIDENCE,
      ),
    )
  }
const primitiveSets = new Map(
  predecessor.contextEstablishmentPrimitives.map((primitive) => [
    primitive.CONTEXT_PRIMITIVE_ID,
    new Set(primitive.REACHABLE_FROM_ENTRY_IDS),
  ]),
)
const privilegedEntriesByClient = new Map()
for (const record of predecessor.privilegedEntryPaths) {
  if (!privilegedEntriesByClient.has(record.CLIENT_SOURCE_FILE))
    privilegedEntriesByClient.set(record.CLIENT_SOURCE_FILE, new Set())
  privilegedEntriesByClient.get(record.CLIENT_SOURCE_FILE).add(record.ENTRY_ID)
}
const operationsByObject = new Map()
for (const operation of predecessor.phase1BLinkage.OBJECT_OPERATION_LINKS) {
  if (!operationsByObject.has(operation.OBJECT_ID)) operationsByObject.set(operation.OBJECT_ID, [])
  operationsByObject.get(operation.OBJECT_ID).push(operation)
}
const moduleAsts = new Map()
function moduleAst(file) {
  if (!moduleAsts.has(file)) {
    const text = sourceTexts.get(file)
    if (text === undefined || !/\.[cm]?[jt]sx?$/.test(file)) return null
    moduleAsts.set(
      file,
      ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      ),
    )
  }
  return moduleAsts.get(file)
}
function visitTs(node, callback) {
  callback(node)
  ts.forEachChild(node, (child) => visitTs(child, callback))
}
function resolveSourceImport(file, specifier) {
  let candidate
  if (specifier.startsWith('.'))
    candidate = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
  else if (specifier.startsWith('@/')) candidate = `apps/union-eyes/${specifier.slice(2)}`
  else if (specifier.startsWith('@nzila/')) {
    const [name, ...subpath] = specifier.slice(7).split('/')
    const packageFile = `packages/${name}/package.json`
    const manifest = sourceTexts.get(packageFile)
    if (!manifest) return null
    const pkg = JSON.parse(manifest)
    const target = pkg.exports?.[subpath.length ? `./${subpath.join('/')}` : '.']
    const exported =
      typeof target === 'string' ? target : (target?.import ?? target?.default ?? target?.types)
    if (typeof exported !== 'string') return null
    candidate = path.posix.normalize(`packages/${name}/${exported}`)
  } else return null
  return (
    [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}/index.ts`].find((name) =>
      sourceTexts.has(name),
    ) ?? null
  )
}
const primitivesBySymbol = new Map(
  predecessor.contextEstablishmentPrimitives.map((primitive) => [
    `${primitive.SOURCE_FILE}|${primitive.SYMBOL}`,
    primitive,
  ]),
)
function resolvePrimitive(file, symbol, seen = new Set()) {
  if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(symbol)) return null
  const key = `${file}|${symbol}`
  if (seen.has(key)) return null
  seen.add(key)
  if (primitivesBySymbol.has(key)) return primitivesBySymbol.get(key)
  const ast = moduleAst(file)
  if (!ast) return null
  for (const statement of ast.statements) {
    if (
      !(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue
    const target = resolveSourceImport(file, statement.moduleSpecifier.text)
    if (!target) continue
    const binding = ts.isImportDeclaration(statement)
      ? statement.importClause?.namedBindings
      : statement.exportClause
    if (binding && (ts.isNamedImports(binding) || ts.isNamedExports(binding))) {
      const element = binding.elements.find(
        (element) => !element.isTypeOnly && element.name.text === symbol,
      )
      if (element) {
        const primitive = resolvePrimitive(
          target,
          element.propertyName?.text ?? element.name.text,
          seen,
        )
        if (primitive) return primitive
      }
    } else if (
      binding &&
      ts.isNamespaceImport(binding) &&
      symbol.startsWith(`${binding.name.text}.`)
    ) {
      const primitive = resolvePrimitive(target, symbol.slice(binding.name.text.length + 1), seen)
      if (primitive) return primitive
    } else if (ts.isExportDeclaration(statement) && !statement.exportClause) {
      const primitive = resolvePrimitive(target, symbol, seen)
      if (primitive) return primitive
    }
  }
  return null
}
const operationContexts = new Map()
const entryBoundaryRegistry = new Map(
  [...entryMap].map(([entryId, entry]) => [
    entryId,
    {
      ENTRY_ID: entryId,
      SOURCE_FILE: entry.SOURCE_FILE,
      RLS_CONTEXT_HELPERS: entry.RLS_CONTEXT_HELPERS,
      RLS_CONTEXT_CLASS: entry.RLS_CONTEXT_CLASS,
      PRIVILEGED_DIMENSION_RESULTS: finalEntryMap
        .get(entryId)
        .DIMENSION_RESULTS.filter((dimension) =>
          [
            'ADMIN_SCOPE',
            'SYSTEM_IDENTITY',
            'PROVIDER_AUTH',
            'PRIVILEGED_DB_PRECONDITION',
          ].includes(dimension.DIMENSION),
        )
        .map((dimension) => ({
          DIMENSION: dimension.DIMENSION,
          RESULT: dimension.RESULT,
          EVIDENCE_CLASS: dimension.EVIDENCE_CLASS,
          SOURCE_SLICE_ID: dimension.SOURCE_SLICE_ID ?? null,
        })),
      BOUNDARY_EVIDENCE: entry.BOUNDARY_EVIDENCE,
    },
  ]),
)
function operationContext(operation) {
  const key = `${operation.SOURCE.FILE}|${operation.SOURCE.LINE_START}|${operation.SOURCE.LINE_END}|${operation.OPERATION}`
  if (operationContexts.has(key)) return operationContexts.get(key)
  const ast = moduleAst(operation.SOURCE.FILE)
  const matches = []
  if (ast)
    visitTs(ast, (node) => {
      if (
        !ts.isCallExpression(node) ||
        !ts.isPropertyAccessExpression(node.expression) ||
        node.expression.name.text !== operation.OPERATION ||
        ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 !==
          operation.SOURCE.LINE_START ||
        ast.getLineAndCharacterOfPosition(node.end).line + 1 !== operation.SOURCE.LINE_END
      )
        return
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (!ts.isCallExpression(parent)) continue
        const primitive = resolvePrimitive(operation.SOURCE.FILE, parent.expression.getText(ast))
        if (!primitive) continue
        const callback = parent.arguments.find(
          (argument) =>
            (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) &&
            argument.pos <= node.pos &&
            argument.end >= node.end,
        )
        if (!callback) continue
        let nestedFunction = false
        for (let scope = node.parent; scope && scope !== callback; scope = scope.parent)
          if (
            ts.isFunctionDeclaration(scope) ||
            ts.isArrowFunction(scope) ||
            ts.isFunctionExpression(scope)
          )
            nestedFunction = true
        const variables = unique(
          primitive.VALUES_SET.filter((value) => value.VALUE_EXPRESSION !== "''").map(
            (value) => value.VARIABLE,
          ),
        )
        if (primitive.SYMBOL === 'withExplicitUserContext' && parent.arguments.length < 3)
          variables.splice(
            variables.indexOf('app.current_org_id'),
            variables.includes('app.current_org_id') ? 1 : 0,
          )
        let clearingOrg = false
        if (
          primitive.SYMBOL === 'withRLSContext' &&
          parent.arguments[0] &&
          ts.isObjectLiteralExpression(parent.arguments[0])
        ) {
          const org = parent.arguments[0].properties.find(
            (property) =>
              ts.isPropertyAssignment(property) && property.name.getText(ast) === 'organizationId',
          )
          clearingOrg =
            org && ts.isStringLiteral(org.initializer) && org.initializer.text === 'system'
        }
        const entryLocal = operation.ENTRY_IDS.filter((entryId) => {
          const entry = entryMap.get(entryId)
          return (
            entry?.SOURCE_FILE === operation.SOURCE.FILE &&
            entry.BOUNDARY_EVIDENCE.some(
              (range) =>
                range.LINE_START <= operation.SOURCE.LINE_START &&
                range.LINE_END >= operation.SOURCE.LINE_END,
            )
          )
        })
        matches.push({
          CONTEXT_PRIMITIVE_ID: primitive.CONTEXT_PRIMITIVE_ID,
          WRAPPER_SYMBOL: primitive.SYMBOL,
          SOURCE: {
            FILE: operation.SOURCE.FILE,
            LINE_START: ast.getLineAndCharacterOfPosition(parent.getStart(ast)).line + 1,
            LINE_END: ast.getLineAndCharacterOfPosition(parent.end).line + 1,
            FILE_SHA256: consumed.get(operation.SOURCE.FILE).SHA256,
          },
          OPERATION_SOURCE: operation.SOURCE,
          VARIABLES_WITH_NONEMPTY_SETTER_SOURCE: clearingOrg
            ? variables.filter((variable) => variable !== 'app.current_org_id')
            : variables,
          WRAPPER_ARGUMENT_SOURCE: parent.arguments.map((argument) =>
            argument === callback
              ? 'PROTECTED_CALLBACK_CONTAINING_OPERATION'
              : argument.getText(ast),
          ),
          ENTRY_LOCAL_IDS: entryLocal,
          STATIC_CALLBACK_ORDER: nestedFunction
            ? 'NESTED_FUNCTION_INVOCATION_OR_ESCAPE_UNRESOLVED'
            : 'SETTER_BEFORE_DIRECT_PROTECTED_CALLBACK_OPERATION_IF_WRAPPER_INVOKED',
          VALUE_AND_CLIENT_AUTHORITY: 'SOURCE_CEILING',
          RUNTIME_CONTEXT_PROVEN: 'NO',
        })
      }
    })
  if (ast && !matches.length) {
    const localEntries = operation.ENTRY_IDS.filter((entryId) => {
      const entry = entryMap.get(entryId)
      return (
        entry?.SOURCE_FILE === operation.SOURCE.FILE &&
        entry.BOUNDARY_EVIDENCE.some(
          (range) =>
            range.LINE_START <= operation.SOURCE.LINE_START &&
            range.LINE_END >= operation.SOURCE.LINE_END,
        )
      )
    })
    if (localEntries.length)
      matches.push({
        CONTEXT_PRIMITIVE_ID: null,
        SOURCE: operation.SOURCE,
        OPERATION_SOURCE: operation.SOURCE,
        VARIABLES_WITH_NONEMPTY_SETTER_SOURCE: [],
        ENTRY_LOCAL_IDS: localEntries,
        STATIC_CALLBACK_ORDER: 'NO_LEXICALLY_ENCLOSING_ACCEPTED_CONTEXT_PRIMITIVE',
        VALUE_AND_CLIENT_AUTHORITY: 'CALLER_OR_INDIRECT_CONTEXT_SOURCE_CEILING',
        RUNTIME_CONTEXT_PROVEN: 'NO',
      })
  }
  operationContexts.set(key, matches)
  return matches
}
function contextFor(object, variables) {
  const candidates = predecessor.contextEstablishmentPrimitives.filter(
    (primitive) =>
      primitive.VALUES_SET.some(
        (value) => variables.includes(value.VARIABLE) && value.VALUE_EXPRESSION !== "''",
      ) &&
      object.REACHABLE_FROM_ENTRY_IDS.some((entry) =>
        primitiveSets.get(primitive.CONTEXT_PRIMITIVE_ID).has(entry),
      ),
  )
  const localEntries = object.REACHABLE_FROM_ENTRY_IDS.map((entry) => entryMap.get(entry)).filter(
    Boolean,
  )
  const observed = localEntries.filter((entry) => entry.RLS_CONTEXT_HELPERS.length > 0)
  const operationProofs = (operationsByObject.get(object.OBJECT_ID) ?? []).flatMap(operationContext)
  const byVariable = variables.map((variable) => ({
    VARIABLE: variable,
    CANDIDATE_PRIMITIVE_IDS: candidates
      .filter((primitive) =>
        primitive.VALUES_SET.some(
          (value) => value.VARIABLE === variable && value.VALUE_EXPRESSION !== "''",
        ),
      )
      .map((primitive) => primitive.CONTEXT_PRIMITIVE_ID),
    DIRECT_CALLBACK_OPERATION_COUNT: operationProofs.filter(
      (proof) =>
        proof.VARIABLES_WITH_NONEMPTY_SETTER_SOURCE.includes(variable) &&
        proof.STATIC_CALLBACK_ORDER.startsWith('SETTER_BEFORE'),
    ).length,
  }))
  return {
    CONTEXT_VARIABLES: variables,
    CANDIDATE_PRIMITIVE_IDS: candidates.map((primitive) => primitive.CONTEXT_PRIMITIVE_ID),
    VARIABLE_ESTABLISHMENT: byVariable,
    SOURCE_OPERATION_CONTEXT_PATHS: operationProofs,
    ENTRY_LOCAL_HELPER_OBSERVATION_IDS: observed.map((entry) => entry.ENTRY_ID),
    STATIC_CONTEXT_PATH_STATUS: !variables.length
      ? 'NOT_DEPENDENT_ON_CONTEXT'
      : byVariable.every(
            (record) =>
              record.CANDIDATE_PRIMITIVE_IDS.length || record.DIRECT_CALLBACK_OPERATION_COUNT,
          )
        ? 'STATIC_CONTEXT_PATH_PRESENT'
        : 'NO_STATIC_ESTABLISHMENT_PATH_OBSERVED',
    DATA_ACCESS_ORDER_PROVEN: 'PARTIAL_DIRECT_CALLBACK_PROOFS_RETAINED_NOT_ALL_PATHS',
    SAME_TRANSACTION_AND_AUTHORITY_VALUE_PROVEN: 'NO',
    RUNTIME_CONTEXT_PROVEN: 'NO',
    INTERPRETATION:
      'A non-empty setter implementation and conservative entry/import path exist; this does not establish invocation before every exact object operation, correct authority values or same-client/transaction execution.',
  }
}
function bypassFor(object) {
  const relevant = predecessor.databaseClients.filter(
    (client) =>
      client.DATABASE_SCOPE === object.DATABASE_SCOPE &&
      (object.REACHABLE_FROM_ENTRY_IDS.some((entry) =>
        client.REACHABLE_FROM_ENTRY_IDS.includes(entry),
      ) ||
        (operationsByObject.get(object.OBJECT_ID) ?? []).some(
          (operation) =>
            operation.SOURCE.FILE.startsWith('apps/union-eyes/services/financial-service/') &&
            client.SOURCE_FILE.startsWith('apps/union-eyes/services/financial-service/'),
        )),
  )
  const paths = relevant
    .filter((client) => ['EXPECTED_BYPASS', 'MIXED'].includes(client.RLS_EXPECTATION))
    .map((client) => ({
      CLIENT_ID: client.DB_CLIENT_ID,
      SOURCE_FILE: client.SOURCE_FILE,
      BYPASS_MECHANISM: client.BYPASS_MECHANISM,
      INTENDED_AUTHORITY_BOUNDARY: client.INTENDED_CALLER_CLASS,
      PRECONDITIONS: client.PRECONDITIONS,
      SOURCE_CANDIDATE_ENTRY_IDS: object.REACHABLE_FROM_ENTRY_IDS.filter((entry) =>
        privilegedEntriesByClient.get(client.SOURCE_FILE)?.has(entry),
      ),
      ENTRY_AUTHORITY_BOUNDARY_EVIDENCE_IDS: object.REACHABLE_FROM_ENTRY_IDS.filter((entry) =>
        privilegedEntriesByClient.get(client.SOURCE_FILE)?.has(entry),
      ),
      EXACT_OBJECT_THROUGH_PRIVILEGED_CLIENT_PROVEN: 'NO',
    }))
  return {
    CLASSIFICATION: paths.length
      ? relevant.some((client) => client.RLS_EXPECTATION === 'MIXED')
        ? 'MIXED_POLICY_AND_PRIVILEGED_PATHS'
        : 'PRIVILEGED_PATH_PRESENT'
      : 'SOURCE_CEILING_CLIENT_BYPASS',
    CANDIDATE_CLIENT_IDS: relevant.map((client) => client.DB_CLIENT_ID),
    PRIVILEGED_PATHS: paths,
    SOURCE_SCOPE_ONLY: 'YES',
    NATIVE_BYPASS_RLS_INFERRED_FROM_NAME: 'NO',
    LIMITATION:
      'Entry-to-object and entry-to-client paths are conservatively joined, not proven identical runtime calls. Credential role binding, memberships, owner privileges and route-specific privileged preconditions remain ceilings.',
  }
}
const combinations = []
if (process.argv.includes('--self-test')) {
  const tested = [...operationsByObject.values()].flat().flatMap(operationContext)
  assert.ok(tested.some((proof) => proof.STATIC_CALLBACK_ORDER.startsWith('SETTER_BEFORE')))
  assert.ok(
    tested.some(
      (proof) =>
        proof.OPERATION_SOURCE.FILE === 'apps/union-eyes/app/api/users/me/profile/route.ts' &&
        proof.STATIC_CALLBACK_ORDER === 'NO_LEXICALLY_ENCLOSING_ACCEPTED_CONTEXT_PRIMITIVE',
    ),
  )
  assert.ok(
    tested
      .filter((proof) => proof.CONTEXT_PRIMITIVE_ID !== null)
      .every((proof) => primitiveSets.has(proof.CONTEXT_PRIMITIVE_ID)),
  )
  console.log(
    'PASS: canonical SQL, null widening, correlated/self/uncorrelated joins, row directions, role combination semantics, direct protected-callback source paths and unwrapped entry-local operations.',
  )
  process.exit(0)
}
const objectRecords = []
for (const object of predecessor.relationalSecurityObjects) {
  const objectId = object.OBJECT_ID
  const expected = dimensionsFor(object)
  const policies = policyByObject.get(objectId) ?? []
  const analyses = objectPolicyAnalysis.get(objectId) ?? []
  const objectFindingIds = []
  const objectCeilingIds = [...analyses.flatMap((policy) => policy.SOURCE_CEILING_IDS)]
  objectCeilingIds.push(
    ...helperAnalyses
      .filter((helper) =>
        ceilings.get(helper.SOURCE_CEILING_ID).AFFECTED_OBJECT_IDS.includes(objectId),
      )
      .map((helper) => helper.SOURCE_CEILING_ID),
  )
  objectCeilingIds.push(
    ...grantAnalyses
      .filter((grant) => grant.ACCEPTED_TARGET_OBJECT_IDS.includes(objectId))
      .map((grant) => grant.SOURCE_CEILING_ID),
  )
  const evidence = [
    ...new Map(
      [...object.SOURCE_EVIDENCE, ...policies.map((policy) => policy.SOURCE_EVIDENCE)].map(
        (source) => [digest(source), source],
      ),
    ).values(),
  ]
  const addFinding = (kind, key, fact, consequence = 'STATIC_CORRECTNESS_SIGNAL', policyIds = []) =>
    objectFindingIds.push(
      finding(kind, `${objectId}|${key}`, [objectId], policyIds, fact, evidence, consequence),
    )
  const addCeiling = (kind, why, required, prior = []) =>
    objectCeilingIds.push(
      ceiling(kind, `${objectId}|${hash(why)}`, [objectId], why, required, evidence, prior),
    )
  const inherited = predecessor.sourceCeilings.filter((record) =>
    record.AFFECTED_OBJECTS.includes(objectId),
  )
  addCeiling(
    'CARRY_FORWARD_AUTHORITY_ROLE_AND_APPLICATION',
    'Accepted authority, physical identity, migration applicability, credential role/owner binding and associated source ceilings are preserved; they are not runtime evidence.',
    'Exact source authority contract and separately authorized deployment/role/application evidence',
    inherited.map((record) => record.SOURCE_CEILING_ID),
  )
  if (object.RLS_REQUIREMENT_CLASS === 'REQUIREMENT_SOURCE_CEILING')
    addCeiling(
      'AUTHORITY_REQUIREMENT',
      'Frozen source evidence does not establish the required authority dimensions',
      'Explicit authority dimensions and command-specific intent; no permissive exemption inferred',
    )
  if (expected.resource)
    addCeiling(
      'RESOURCE_AUTHORITY_CONTRACT',
      'Frozen structural user/resource signals do not define exact owner, membership, assignee, delegated or case authority for each command',
      'Object-specific resource authority contract and identity-to-resource relationship',
    )
  if (
    (expected.org || expected.resource) &&
    object.OBSERVED_RLS_STATE === 'NO_RLS_DECLARATION_OBSERVED'
  )
    addFinding(
      'RLS_REQUIRED_BUT_NOT_DECLARED',
      'state',
      'Frozen requirement requires RLS, but no configured forward RLS state declaration is observed. This is a checked-in source gap, not a claim that deployed RLS is disabled.',
      'STATIC_RLS_INCORRECT',
    )
  if ((expected.org || expected.resource) && object.OBSERVED_RLS_STATE === 'RLS_ENABLED')
    addFinding(
      'RLS_ENABLED_NOT_FORCED',
      'force',
      'Source enables RLS without FORCE; owner mediation is not established',
      'STATIC_RLS_INCORRECT',
    )
  const coverage = {}
  for (const command of commands) {
    const relevant = policies.filter(
      (policy) => policy.COMMAND === 'ALL' || policy.COMMAND === command,
    )
    const evaluations = []
    for (const role of semanticRoles)
      for (const direction of directions(command)) {
        const combined = combinedAst(relevant, command, direction, role, parsedPolicies)
        const evaluation = combined.ast ? analyzeAst(combined.ast, object) : null
        let classification = 'SOURCE_CEILING_COMBINATION'
        if (
          combined.ast &&
          role === 'union_eyes_system' &&
          combined.applicable.length &&
          evaluation.status === 'AUTHORITY_DIMENSION_GAP'
        )
          classification = 'INTENTIONALLY_PERMISSIVE'
        else if (combined.ast && evaluation.status === 'DENY_ALL')
          classification = combined.applicable.length
            ? 'POTENTIALLY_CONTRADICTORY'
            : 'SOURCE_CEILING_COMBINATION'
        else if (combined.ast && role === 'union_eyes_runtime' && evaluation.missing.length)
          classification = 'POTENTIALLY_OVERBROAD'
        else if (
          combined.ast &&
          combined.applicable.length > 1 &&
          new Set(
            combined.applicable.map(
              (policy) =>
                parsedPolicies.get(`${policy.POLICY_ID}|${command}|${direction}`).canonical,
            ),
          ).size === 1
        )
          classification = 'STATICALLY_EQUIVALENT'
        const combinationId = id('COMBINATION', `${objectId}|${command}|${role}|${direction}`)
        combinations.push({
          COMBINATION_ID: combinationId,
          OBJECT_ID: objectId,
          COMMAND: command,
          ROLE: role,
          DIRECTION: direction,
          CLASSIFICATION: classification,
          PERMISSIVE_POLICY_IDS: combined.permissive.map((policy) => policy.POLICY_ID),
          RESTRICTIVE_POLICY_IDS: combined.restrictive.map((policy) => policy.POLICY_ID),
          POSTGRESQL_COMBINATION:
            'OR(permissive applicable policies) AND AND(restrictive applicable policies); no permissive policy means deny. Roles are analyzed separately, not ORed across runtime/system.',
          EFFECTIVE_EXPRESSION_AST: combined.ast,
          SEMANTIC_ANALYSIS: evaluation,
          ROLE_MEMBERSHIP_MODEL:
            'DIRECT_DECLARED_ROLE_AND_PUBLIC_ONLY; inherited roles, owner and BYPASSRLS remain ceilings',
        })
        evaluations.push({
          ROLE: role,
          DIRECTION: direction,
          COMBINATION_ID: combinationId,
          STATUS: !combined.applicable.length
            ? 'NO_APPLICABLE_POLICY_DEFAULT_DENY'
            : !evaluation
              ? 'SOURCE_CEILING'
              : evaluation.status,
          POLICY_IDS: combined.applicable.map((policy) => policy.POLICY_ID),
          CLASSIFICATION: classification,
        })
        if (role !== 'union_eyes_runtime' || !expected.required.length) continue
        if (!combined.applicable.length) {
          addFinding(
            'COMMAND_COVERAGE_GAP',
            `${command}|${direction}`,
            `${command} ${direction}: no policy applies to the declared runtime role. PostgreSQL RLS defaults to deny; this is not unfiltered access. Whether denial is intended requires an operation contract.`,
          )
          continue
        }
        if (!evaluation) {
          addCeiling(
            'POLICY_COMBINATION',
            'At least one applicable predicate remains unparsed',
            'Complete aggregate predicate semantics',
          )
          continue
        }
        if (evaluation.status === 'DENY_ALL') {
          addFinding(
            'POLICY_COMBINATION_CONTRADICTORY',
            `${command}|${direction}`,
            'Aggregate policy rejects every row in the bounded boolean model; intended denial versus unintended command blockage remains unresolved',
            'STATIC_CORRECTNESS_SIGNAL',
            combined.applicable.map((policy) => policy.POLICY_ID),
          )
          continue
        }
        if (evaluation.unknown.length)
          addCeiling(
            'PREDICATE_AUTHORITY_SEMANTICS',
            evaluation.unknown.join('; '),
            'Exact relationship, cast, helper and operation-specific authority interpretation',
          )
        for (const missing of evaluation.missing) {
          const kind =
            missing === 'ORGANIZATION_IDENTITY'
              ? 'ORG_POLICY_SIGNAL_GAP'
              : object.RESOURCE_BOUNDARY_SIGNAL.includes('USER_ID')
                ? 'USER_POLICY_SIGNAL_GAP'
                : 'RESOURCE_POLICY_SIGNAL_GAP'
          addFinding(
            kind,
            `${command}|${direction}`,
            `${command} ${direction}: at least one satisfiable source predicate branch does not imply frozen ${missing}. Membership, existence, creator or system authority is not substituted for that dimension.`,
            'STATIC_CORRECTNESS_SIGNAL',
            combined.applicable.map((policy) => policy.POLICY_ID),
          )
        }
        const definiteWidening = evaluation.branches.some(
          (branch) =>
            branch.MISSING_DIMENSIONS.length &&
            branch.UNKNOWN_SEMANTICS.length === 0 &&
            branch.WIDENING_SIGNALS.some((signal) =>
              ['UNCONDITIONAL_TRUE', 'NULL_ADMISSIBLE_BRANCH', 'PUBLIC_SHARING_BRANCH'].includes(
                signal,
              ),
            ),
        )
        if (definiteWidening) {
          addFinding(
            direction === 'USING'
              ? 'USING_EXPRESSION_OVERBROAD'
              : 'WITH_CHECK_EXPRESSION_OVERBROAD',
            `${command}|${direction}`,
            'A declared-runtime-role branch admits rows without a required authority comparison (unconditional, null or public branch). No frozen exemption authorizes that widening.',
            'STATIC_RLS_INCORRECT',
            combined.applicable.map((policy) => policy.POLICY_ID),
          )
          if (combined.permissive.length > 1)
            addFinding(
              'POLICY_COMBINATION_OVERBROAD',
              `${command}|${direction}`,
              'Permissive OR aggregation retains the authority-free branch; a sibling permissive constraint cannot narrow it.',
              'STATIC_RLS_INCORRECT',
              combined.applicable.map((policy) => policy.POLICY_ID),
            )
        } else if (evaluation.missing.length)
          addCeiling(
            'UNESTABLISHED_POLICY_AUTHORITY_DIMENSION',
            'Predicate does not establish every frozen dimension; exact intended resource/relationship semantics remain unresolved',
            'Explicit object-specific authority interpretation without weakening the frozen requirement',
          )
      }
    coverage[command] = {
      POLICY_PRESENCE: relevant.length ? 'PRESENT_NOT_CORRECTNESS_PROOF' : 'ABSENT',
      ROLE_DIRECTION_EVALUATIONS: evaluations,
      STATIC_COMMAND_CORRECTNESS: evaluations
        .filter((record) => record.ROLE === 'union_eyes_runtime')
        .every((record) => record.STATUS === 'BOUNDARY_LOGIC_PRESENT')
        ? 'BOUNDARY_LOGIC_PRESENT_WITH_PATH_CEILINGS'
        : 'STATIC_CORRECTNESS_REQUIRES_FINDINGS_OR_CEILINGS',
      RUNTIME_COMMAND_PROVEN: 'NO',
    }
  }
  for (const policy of analyses) {
    const update = policy.EXPRESSIONS_BY_COMMAND_AND_DIRECTION.filter(
      (record) => record.COMMAND === 'UPDATE',
    )
    if (
      update.length === 2 &&
      digest(update[0].NORMALIZED_AST) !== digest(update[1].NORMALIZED_AST)
    )
      addFinding(
        'USING_WITH_CHECK_ASYMMETRY',
        policy.POLICY_ID,
        'Existing-row and resulting-row predicates differ structurally after normalization; difference is not automatically an authority defect.',
        'STATIC_CORRECTNESS_SIGNAL',
        [policy.POLICY_ID],
      )
  }
  const variables = unique(analyses.flatMap((policy) => policy.CONTEXT_VARIABLES_REFERENCED))
  const context = contextFor(object, variables)
  if (variables.length) {
    addCeiling(
      'CONTEXT_QUERY_ORDER',
      'Non-empty context-setter implementation/import candidates do not establish execution before every exact object query in the same transaction or authoritative value selection',
      'Entry-to-exact-operation callback/order and same-client data-flow proof',
    )
    if (
      context.STATIC_CONTEXT_PATH_STATUS === 'NO_STATIC_ESTABLISHMENT_PATH_OBSERVED' &&
      object.REACHABLE_FROM_ENTRY_IDS.length
    )
      addFinding(
        'CONTEXT_DEPENDENCY_WITHOUT_STATIC_ESTABLISHMENT',
        'context',
        'Context-dependent policy has accepted source entry linkage but no non-empty context-setting primitive path is observed',
      )
    for (const proof of context.SOURCE_OPERATION_CONTEXT_PATHS) {
      if (
        proof.STATIC_CALLBACK_ORDER !== 'NO_LEXICALLY_ENCLOSING_ACCEPTED_CONTEXT_PRIMITIVE' ||
        !proof.ENTRY_LOCAL_IDS.every((entryId) => !entryMap.get(entryId).RLS_CONTEXT_HELPERS.length)
      )
        continue
      const findingId = finding(
        'CONTEXT_DEPENDENCY_WITHOUT_STATIC_ESTABLISHMENT',
        `${objectId}|${proof.OPERATION_SOURCE.FILE}|${proof.OPERATION_SOURCE.LINE_START}`,
        [objectId],
        policies.map((policy) => policy.POLICY_ID),
        'Context-dependent object operation occurs inside an accepted entry source range with no enclosing accepted context primitive and no entry-local RLS helper observation. Indirect caller/session establishment remains a ceiling, not assumed absent at runtime.',
        [proof.OPERATION_SOURCE],
      )
      objectFindingIds.push(findingId)
    }
  }
  const bypass = bypassFor(object)
  addCeiling(
    'CLIENT_BYPASS_AND_PRIVILEGED_PRECONDITION',
    bypass.LIMITATION,
    'Exact object-operation-to-client flow and entry-specific authenticated system/admin authority before privileged access',
  )
  for (const privileged of bypass.PRIVILEGED_PATHS)
    if (!privileged.INTENDED_AUTHORITY_BOUNDARY || !privileged.PRECONDITIONS)
      addFinding(
        'PRIVILEGED_PATH_WITHOUT_STATIC_AUTHORITY_BOUNDARY',
        privileged.CLIENT_ID,
        'Privileged client candidate lacks an explicit accepted intended caller/precondition boundary',
      )
    else if (
      privileged.ENTRY_AUTHORITY_BOUNDARY_EVIDENCE_IDS.some(
        (entryId) =>
          !entryBoundaryRegistry
            .get(entryId)
            .PRIVILEGED_DIMENSION_RESULTS.some(
              (dimension) =>
                [
                  'ADMIN_SCOPE',
                  'SYSTEM_IDENTITY',
                  'PROVIDER_AUTH',
                  'PRIVILEGED_DB_PRECONDITION',
                ].includes(dimension.DIMENSION) &&
                dimension.RESULT.startsWith('OBSERVED_ENFORCEMENT'),
            ),
      )
    )
      addFinding(
        'PRIVILEGED_PATH_WITHOUT_STATIC_AUTHORITY_BOUNDARY',
        privileged.CLIENT_ID,
        'At least one entry/object/system-client candidate intersection lacks observed entry-local privileged/admin/system/provider authority in the accepted dimension results. Client-level documented intent does not supply an entry-specific precondition; exact call applicability remains ceiling.',
      )
  const inline = predecessor.inlineRlsDeclarations.filter((record) =>
    record.TARGET_OBJECT_IDS.includes(objectId),
  )
  const inlineComparisons = inline.map((candidate) => {
    const configured = policies.find((policy) => policy.POLICY_NAME === candidate.POLICY_NAME)
    const using = parse(candidate.USING_EXPRESSION ?? null),
      check = parse(candidate.WITH_CHECK_EXPRESSION ?? null)
    const conflict =
      candidate.POLICY_NAME !== null &&
      (!configured ||
        configured.COMMAND !== candidate.POLICY_COMMAND ||
        (configured.MODE === 'RESTRICTIVE' ? 'RESTRICTIVE' : 'PERMISSIVE') !==
          candidate.POLICY_MODE ||
        parse(configured.USING_EXPRESSION).canonical !== using.canonical ||
        parse(configured.WITH_CHECK_EXPRESSION).canonical !== check.canonical ||
        digest(unique(configured.APPLICABLE_ROLES)) !== digest(unique(candidate.APPLICABLE_ROLES)))
    if (conflict)
      addFinding(
        'INLINE_POLICY_DRIFT_CANDIDATE',
        candidate.DECLARATION_ID,
        'Reachable inline candidate is absent or differs from configured final policy identity/command/role/predicate. It does not replace configured migration evidence.',
      )
    return {
      DECLARATION_ID: candidate.DECLARATION_ID,
      CONFIGURED_POLICY_ID: configured?.POLICY_ID ?? null,
      CLASSIFICATION: conflict ? 'STATIC_POLICY_DRIFT_CANDIDATE' : 'INLINE_NON_FORWARD_CANDIDATE',
      AUTHORITY_PROMOTED: 'NO',
    }
  })
  if (
    ['account_mappings', 'holidays'].includes(object.OBJECT_NAME) &&
    object.DATABASE_SCOPE === 'union-eyes'
  ) {
    const intentFile =
      'apps/union-eyes/db/migrations-cache/0011_storage_authority_rls_completion.sql'
    const intent = sourceTexts.get(intentFile)
    assert.ok(intent.includes('reads see global (NULL) OR own-org rows'))
    addCeiling(
      'FROZEN_REQUIREMENT_VS_DECLARED_GLOBAL_READ_INTENT',
      'Migration source explicitly intends global NULL-org reads, but the accepted object requirement remains organization-scoped with no exemption. Strict frozen dimension mismatch is reported without inventing a permissive requirement or declaring an unintended runtime defect.',
      'Explicit reconciliation of the frozen requirement against documented mixed-global read intent',
    )
    evidence.push({
      FILE: intentFile,
      LINE_START: 37,
      LINE_END: 45,
      FILE_SHA256: consumed.get(intentFile).SHA256,
    })
  }
  addCeiling(
    'COMMAND_AND_AUTHORITY_INTENT',
    'Frozen structural requirements specify dimensions but do not fully establish allowed operations, delegation, intended denial and row-transition rules for this object.',
    'Explicit per-object SELECT/INSERT/UPDATE/DELETE business authority contract',
  )
  const incorrect = objectFindingIds.some(
    (findingId) => findings.get(findingId).DISPOSITION_EFFECT === 'STATIC_RLS_INCORRECT',
  )
  const disposition = incorrect
    ? 'STATIC_RLS_INCORRECT'
    : object.RLS_REQUIREMENT_CLASS === 'RLS_NOT_APPLICABLE'
      ? 'RLS_NOT_REQUIRED'
      : 'STATIC_CORRECTNESS_UNRESOLVED'
  objectFindingIds.push(
    finding(
      'SOURCE_CEILING_STATIC_CORRECTNESS',
      objectId,
      [objectId],
      [],
      'Material authority, context/client flow, role/application or command-intent questions remain explicit; no static or runtime correctness claim is made.',
      evidence,
    ),
  )
  objectRecords.push({
    OBJECT_ID: objectId,
    DATABASE_SCOPE: object.DATABASE_SCOPE,
    OBJECT_TYPE: object.OBJECT_TYPE,
    RLS_REQUIREMENT: object.RLS_REQUIREMENT_CLASS,
    RLS_STATE: object.OBSERVED_RLS_STATE,
    FORCE_RLS_STATE: object.FORCE_ROW_LEVEL_SECURITY,
    EXPECTED_AUTHORITY_DIMENSIONS: expected,
    FROZEN_AUTHORITY_OBJECT_ID: object.PHASE_1B1_OBJECT_ID,
    FROZEN_AUTHORITY_DISPOSITION: object.PHASE_1B1_AUTHORITY_DISPOSITION,
    FROZEN_AUTHORITY_REQUIREMENT: authorityMap.get(objectId)?.rls ?? null,
    OBSERVED_POLICY_IDS: policies.map((policy) => policy.POLICY_ID),
    OBSERVED_POLICY_COMMANDS: unique(policies.map((policy) => policy.COMMAND)),
    SELECT_COVERAGE: coverage.SELECT,
    INSERT_COVERAGE: coverage.INSERT,
    UPDATE_COVERAGE: coverage.UPDATE,
    DELETE_COVERAGE: coverage.DELETE,
    USING_EXPRESSIONS: analyses.map((policy) => ({
      POLICY_ID: policy.POLICY_ID,
      RAW: policy.RAW_USING,
      NORMALIZED_AST: policy.NORMALIZED_USING,
    })),
    WITH_CHECK_EXPRESSIONS: analyses.map((policy) => ({
      POLICY_ID: policy.POLICY_ID,
      RAW: policy.RAW_WITH_CHECK,
      NORMALIZED_AST: policy.NORMALIZED_WITH_CHECK,
    })),
    CONTEXT_VARIABLES_REFERENCED: variables,
    POLICY_HELPERS_REFERENCED: unique(
      analyses.flatMap((policy) => policy.POLICY_HELPERS_REFERENCED),
    ),
    DECLARATION_GENERATOR_FUNCTION_IDS: unique(
      analyses.map((policy) => policy.DECLARATION_HELPER_FUNCTION_ID).filter(Boolean),
    ),
    RESOURCE_RELATIONSHIPS_REFERENCED: unique(
      analyses.flatMap((policy) => policy.RESOURCE_RELATIONSHIPS_REFERENCED),
    ),
    ROLE_PREDICATES: policies.map((policy) => ({
      POLICY_ID: policy.POLICY_ID,
      ROLE_TARGETS: policy.APPLICABLE_ROLES,
      ROLE_INHERITANCE_PROVEN: 'NO',
    })),
    PRIVILEGED_CLIENT_REACHABILITY: bypass,
    CONTEXT_CORRECTNESS: context,
    INLINE_DECLARATION_COMPARISONS: inlineComparisons,
    STATIC_CORRECTNESS_DISPOSITION: disposition,
    FINDING_IDS: unique(objectFindingIds),
    SOURCE_CEILING_IDS: unique(objectCeilingIds),
    SOURCE_EVIDENCE: evidenceReferences(evidence),
    RUNTIME_EXISTENCE_OR_ISOLATION_PROVEN: 'NO',
  })
}
const tally = (records, field, keys) =>
  Object.fromEntries(
    (keys ?? unique(records.map((record) => record[field]))).map((key) => [
      key,
      records.filter((record) => record[field] === key).length,
    ]),
  )
const summary = {
  ACCEPTED_OBJECTS: 612,
  OBJECT_RECORDS: objectRecords.length,
  DISPOSITION_COUNTS: tally(objectRecords, 'STATIC_CORRECTNESS_DISPOSITION', dispositions),
  REQUIREMENT_COUNTS: tally(objectRecords, 'RLS_REQUIREMENT'),
  REQUIREMENT_BY_DISPOSITION: Object.fromEntries(
    unique(objectRecords.map((record) => record.RLS_REQUIREMENT)).map((requirement) => [
      requirement,
      tally(
        objectRecords.filter((record) => record.RLS_REQUIREMENT === requirement),
        'STATIC_CORRECTNESS_DISPOSITION',
        dispositions,
      ),
    ]),
  ),
  FINAL_MIGRATION_POLICY_IDENTITIES: policyAnalyses.length,
  EXPRESSION_DIRECTION_RECORDS: policyAnalyses.reduce(
    (sum, policy) => sum + policy.EXPRESSIONS_BY_COMMAND_AND_DIRECTION.length,
    0,
  ),
  PARSER_SOURCE_CEILING_RECORDS: policyAnalyses.reduce(
    (sum, policy) =>
      sum +
      policy.EXPRESSIONS_BY_COMMAND_AND_DIRECTION.filter(
        (record) => record.PARSE_STATUS !== 'PARSED',
      ).length,
    0,
  ),
  OBJECTS_WITH_DIRECT_CONTEXT_CALLBACK_EVIDENCE: objectRecords.filter((record) =>
    record.CONTEXT_CORRECTNESS.SOURCE_OPERATION_CONTEXT_PATHS.some((proof) =>
      proof.STATIC_CALLBACK_ORDER.startsWith('SETTER_BEFORE'),
    ),
  ).length,
  ROLE_COMMAND_DIRECTION_COMBINATIONS: combinations.length,
  COMBINATION_COUNTS: tally(combinations, 'CLASSIFICATION'),
  FINDING_RECORDS: findings.size,
  FINDING_CLASS_COUNTS: tally([...findings.values()], 'FINDING_CLASS', findingClasses),
  SOURCE_CEILING_RECORDS: ceilings.size,
  SOURCE_CEILING_CLASS_COUNTS: tally([...ceilings.values()], 'CEILING_CLASS'),
  POST_1B3A_DISCOVERED_OBJECTS: discovered.size,
  DATABASE_CLIENTS_PRESERVED: predecessor.databaseClients.length,
  CONTEXT_PRIMITIVES_PRESERVED: predecessor.contextEstablishmentPrimitives.length,
  SQL_FUNCTION_BOUNDARIES_PRESERVED: helperAnalyses.length,
  GRANT_REVOKE_RECORDS_PRESERVED: predecessor.relevantGrants.length,
}
assert.equal(objectRecords.length, 612)
assert.equal(new Set(objectRecords.map((record) => record.OBJECT_ID)).size, 612)
assert.equal(
  Object.values(summary.DISPOSITION_COUNTS).reduce((a, b) => a + b, 0),
  612,
)
assert.deepEqual(summary.REQUIREMENT_COUNTS, {
  ORG_AND_RESOURCE_RLS_REQUIRED: 114,
  ORG_RLS_REQUIRED: 337,
  REQUIREMENT_SOURCE_CEILING: 132,
  USER_OR_RESOURCE_RLS_REQUIRED: 29,
})
assert.equal(summary.FINAL_MIGRATION_POLICY_IDENTITIES, 1490)
const policyIds = new Set(policyAnalyses.map((policy) => policy.POLICY_ID))
assert.equal(policyIds.size, 1490)
assert.equal(new Set(combinations.map((record) => record.COMBINATION_ID)).size, combinations.length)
for (const record of objectRecords) {
  for (const findingId of record.FINDING_IDS) assert.ok(findings.has(findingId))
  for (const ceilingId of record.SOURCE_CEILING_IDS) assert.ok(ceilings.has(ceilingId))
  for (const policyId of record.OBSERVED_POLICY_IDS) assert.ok(policyIds.has(policyId))
}
for (const record of [...findings.values(), ...ceilings.values()]) {
  for (const objectId of record.AFFECTED_OBJECT_IDS) assert.ok(objectMap.has(objectId))
  for (const policyId of record.AFFECTED_POLICY_IDS ?? []) assert.ok(policyIds.has(policyId))
}
assert.equal(entryBoundaryRegistry.size, 1910)
assert.equal(new Set(grantAnalyses.map((grant) => grant.GRANT_ID)).size, 26)
for (const grant of grantAnalyses) {
  assert.ok(ceilings.has(grant.SOURCE_CEILING_ID))
  for (const objectId of grant.ACCEPTED_TARGET_OBJECT_IDS) assert.ok(objectMap.has(objectId))
}
for (const helper of helperAnalyses) assert.ok(ceilings.has(helper.SOURCE_CEILING_ID))
const clientIds = new Set(predecessor.databaseClients.map((client) => client.DB_CLIENT_ID))
for (const object of objectRecords) {
  for (const clientId of object.PRIVILEGED_CLIENT_REACHABILITY.CANDIDATE_CLIENT_IDS)
    assert.ok(clientIds.has(clientId))
  for (const proof of object.CONTEXT_CORRECTNESS.SOURCE_OPERATION_CONTEXT_PATHS) {
    if (proof.CONTEXT_PRIMITIVE_ID !== null)
      assert.ok(primitiveSets.has(proof.CONTEXT_PRIMITIVE_ID))
    for (const entryId of proof.ENTRY_LOCAL_IDS) assert.ok(entryBoundaryRegistry.has(entryId))
  }
  for (const entryId of object.CONTEXT_CORRECTNESS.ENTRY_LOCAL_HELPER_OBSERVATION_IDS)
    assert.ok(entryBoundaryRegistry.has(entryId))
}
for (const record of [...objectRecords, ...findings.values(), ...ceilings.values()])
  for (const source of record.SOURCE_EVIDENCE)
    if (source.SOURCE_EVIDENCE_ID) assert.ok(sourceEvidenceRegistry.has(source.SOURCE_EVIDENCE_ID))
let validatedRanges = 0
for (const collection of [
  objectRecords,
  [...entryBoundaryRegistry.values()],
  policyAnalyses,
  helperAnalyses,
  [...findings.values()],
  [...ceilings.values()],
  [...sourceEvidenceRegistry.values()],
]) {
  const stack = [...collection]
  while (stack.length) {
    const value = stack.pop()
    if (!value || typeof value !== 'object') continue
    if (Array.isArray(value)) {
      stack.push(...value)
      continue
    }
    if (value.FILE && value.FILE_SHA256) {
      const record = consumed.get(value.FILE)
      assert.ok(record, `Unfingerprinted evidence ${value.FILE}`)
      assert.equal(value.FILE_SHA256, record.SHA256)
      assert.ok(
        value.LINE_START >= 1 &&
          value.LINE_END >= value.LINE_START &&
          value.LINE_END <= record.LINE_END,
      )
      validatedRanges++
    }
    for (const child of Object.values(value))
      if (child && typeof child === 'object') stack.push(child)
  }
}
const preservedPayloads = {
  RELATIONAL_SECURITY_OBJECTS: digest(predecessor.relationalSecurityObjects),
  FINAL_MIGRATION_POLICIES: digest(predecessor.rlsPolicies),
  DATABASE_CLIENTS: digest(predecessor.databaseClients),
  CONTEXT_PRIMITIVES: digest(predecessor.contextEstablishmentPrimitives),
  SQL_FUNCTION_BOUNDARIES: digest(predecessor.sourceSqlFunctionBoundaries),
  GRANTS: digest(predecessor.relevantGrants),
  INLINE_DECLARATIONS: digest(predecessor.inlineRlsDeclarations),
  FROZEN_PREDECESSOR_INPUT_HASHES: digest(predecessor.metadata.ACCEPTED_INPUT_SHA256),
}
const gate = discovered.size
  ? 'STATIC_RLS_POLICY_CORRECTNESS_NOT_CLOSED'
  : ceilings.size
    ? 'STATIC_RLS_POLICY_CORRECTNESS_CLOSED_WITH_SOURCE_CEILINGS'
    : 'STATIC_RLS_POLICY_CORRECTNESS_CLOSED'
const report = {
  metadata: {
    PHASE: outputName,
    METHOD: 'CHECKED_IN_SOURCE_ONLY_NO_APPLICATION_MODULE_OR_SQL_EXECUTION',
    PREDECESSOR_SHA256: predecessorHash,
    ACCEPTED_INPUT_SHA256: predecessor.metadata.ACCEPTED_INPUT_SHA256,
    FROZEN_PAYLOAD_SHA256: predecessor.metadata.FROZEN_PAYLOAD_SHA256,
    PREDECESSOR_PRESERVED_PAYLOAD_SHA256: preservedPayloads,
    CONSUMED_SOURCE: [...consumed.values()].sort((a, b) => a.FILE.localeCompare(b.FILE)),
    SEMANTIC_MODEL:
      'Conservative parsed SQL boolean constraints; direct context equality, correlated join graph, branch-specific dimension implication, explicit null/public widening, per-role permissive OR/restrictive AND and old/new row direction. Unknown contracts are ceilings, not success.',
    STATIC_CLOSURE_MEANING:
      'Exact-once bounded reconciliation completion, including explicit incorrect objects and source ceilings. It is not an assertion that all policies are correct.',
    ROLE_MODEL_LIMITATION:
      'Declared union_eyes_runtime/union_eyes_system plus PUBLIC applicability only. Deployment, role inheritance and owner/BYPASSRLS behavior are not inferred.',
    SOURCE_EVIDENCE_LIMITATION:
      'Historical/non-forward declarations remain references, not configured final policy state. Import/candidate path intersection is not exact function execution or query-order proof.',
    NO_RUNTIME_DB_INSPECTED: 'YES',
    NO_RUNTIME_AUTH_EXECUTED: 'YES',
    NO_MIGRATION_EXECUTED: 'YES',
    NO_DATABASE_WRITE_EXECUTED: 'YES',
    NO_POLICY_CHANGED: 'YES',
    NO_APPLICATION_CODE_CHANGED: 'YES',
    NO_PREDECESSOR_ARTIFACT_CHANGED: 'YES',
    NO_PR_CREATED: 'YES',
  },
  objectRecords,
  policyExpressionAnalyses: policyAnalyses,
  entryBoundarySourceRegistry: [...entryBoundaryRegistry.values()],
  sourceEvidenceRegistry: [...sourceEvidenceRegistry.values()].sort((a, b) =>
    a.SOURCE_EVIDENCE_ID.localeCompare(b.SOURCE_EVIDENCE_ID),
  ),
  policyCombinations: combinations,
  helperFunctionReconciliation: helperAnalyses,
  grantReconciliation: grantAnalyses,
  contextPrimitiveSourceContracts: predecessor.contextEstablishmentPrimitives,
  databaseClientSourceContracts: predecessor.databaseClients,
  relevantGrantSourceContracts: predecessor.relevantGrants,
  inlineDeclarationSourceCandidates: predecessor.inlineRlsDeclarations,
  post1B3ADiscoveredObjects: [...discovered.values()],
  staticCorrectnessFindings: [...findings.values()].sort((a, b) =>
    a.FINDING_ID.localeCompare(b.FINDING_ID),
  ),
  sourceCeilings: [...ceilings.values()].sort((a, b) =>
    a.SOURCE_CEILING_ID.localeCompare(b.SOURCE_CEILING_ID),
  ),
  predecessorCarryForward: predecessor.carryForward,
  summary,
  validation: {
    EXACT_612_OBJECT_RECORDS: 'PASS',
    EXACT_1490_POLICY_IDENTITIES: 'PASS',
    REQUIREMENT_AND_DISPOSITION_ARITHMETIC: 'PASS',
    DUPLICATE_IDS: 'NONE',
    FOREIGN_ID_LINKAGE: 'PASS',
    SOURCE_RANGES_VALIDATED: validatedRanges,
    FIVE_FROZEN_PHASE_1B_INPUT_HASHES: 'PASS',
    SIX_FROZEN_PHASE_1B_PAYLOAD_HASHES: 'PASS',
    PREDECESSOR_OBJECT_POLICY_CLIENT_CONTEXT_FUNCTION_GRANT_PAYLOADS_PRESERVED: 'PASS',
    FINAL_1910_SERVER_ENTRIES_PRESERVED: 'PASS',
    PRIOR_1710_FINDINGS_PRESERVED: 'PASS',
    PRIOR_3672_CEILINGS_PRESERVED: 'PASS',
    HISTORICAL_43_EXPECTATIONS_PRESERVED: 'PASS',
    DENOMINATOR_MUTATED: 'NO',
    RUNTIME_TESTS_EXECUTED: 'NO',
  },
  phaseStatus: {
    PHASE_1B_3B_GATE: gate,
    RLS_POLICY_CORRECTNESS_PROVEN: objectRecords.every((record) =>
      ['STATIC_RLS_CORRECT', 'RLS_NOT_REQUIRED'].includes(record.STATIC_CORRECTNESS_DISPOSITION),
    )
      ? 'YES'
      : 'NO',
    TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
    PHASE_1B_3: 'NOT_YET_COMPLETE',
    PHASE_1B_3C_AUTHORIZED: 'NO',
    PHASE_1B_3C_STARTED: 'NO',
    PHASE_1C: 'NOT_AUTHORIZED',
    PHASE_1D: 'NOT_AUTHORIZED',
    PHASE_2: 'NOT_AUTHORIZED',
  },
  proposedNextGatePacket: {
    STATUS: 'PROPOSAL_ONLY_NOT_AUTHORIZATION',
    PROPOSED_GATE: 'RUNTIME_RLS_AND_TENANT_ISOLATION_PROOF',
    ACCEPTED_OBJECT_IDS: [...objectMap.keys()],
    BLOCKERS: [
      'Resolve/accept the static incorrect-object register before treating runtime probes as proof of the intended authority model',
      'Establish object-specific operation and resource/delegation authority contracts',
      'Bind actual credentials, role attributes/inheritance, owner identities, grants and applied migration state',
      'Approve isolated environment, fixtures, positive/negative expectations and non-destructive test protocol',
    ],
    PROPOSED_EVIDENCE: [
      'Per-role, per-object SELECT/INSERT/UPDATE/DELETE old/new row matrix across two organizations and distinct users/resources',
      'Missing/empty/malformed context, nullable/shared branches, transaction/pool cleanup and query-order evidence',
      'System/admin authority preconditions, native BYPASSRLS/owner/FORCE composition and helper search-path/execute evidence',
    ],
    RUNTIME_EXECUTION_AUTHORIZED: 'NO',
    PHASE_1B_3C_STARTED: 'NO',
  },
}
const markdownTable = (counts) =>
  `| Classification | Count |\n|---|---:|\n${Object.entries(counts)
    .map(([key, count]) => `| ${key} | ${count} |`)
    .join('\n')}`
const markdown = `# Phase 1B.3B — Static RLS policy correctness reconciliation

## Gate and scope

\`${gate}\`

Exactly **612** accepted objects are reconciled once, without denominator mutation. Closure measures completion of bounded static adjudication, not absence of incorrect policies. **RLS_POLICY_CORRECTNESS_PROVEN = ${report.phaseStatus.RLS_POLICY_CORRECTNESS_PROVEN}**. **TENANT_ISOLATION_RUNTIME_PROVEN = NO**. Phase 1B.3 remains **NOT_YET_COMPLETE**.

Authoritative predecessor: [Phase 1B.3A census](./${predecessorName}.json), SHA-256 \`${predecessorHash}\`. [Machine-readable reconciliation](./${outputName}.json) retains every object, command/row-direction, expression AST, combination, finding, ceiling, source range and helper/client/context contract. [Generator](../../../scripts/ue/reconcile-static-rls-policy-correctness.mjs) supports \`--self-test\` and \`--check\`.

## Exact denominator

${markdownTable(summary.DISPOSITION_COUNTS)}

**612 = ${dispositions.map((value) => summary.DISPOSITION_COUNTS[value]).join(' + ')}** in the disposition order above.

${markdownTable(summary.REQUIREMENT_COUNTS)}

Requirement-by-disposition arithmetic is independently asserted and retained in JSON. No global exemption, weaker authority shape or new relational target is invented.

## Predicate and command reconciliation

**${policyAnalyses.length}** final configured migration-policy identities; **${summary.EXPRESSION_DIRECTION_RECORDS}** command/row-direction expression records; **${summary.PARSER_SOURCE_CEILING_RECORDS}** parser-limitation records. All original predicates are preserved alongside parsed, normalized ASTs.

SELECT/DELETE evaluate existing-row USING; INSERT evaluates new-row WITH CHECK; UPDATE evaluates both. An absent UPDATE/ALL check inherits USING; an absent otherwise applicable clause is unconstrained. FOR ALL is analyzed across all four commands. Missing role-applicable policies default to denial, not unfiltered access, and remain coverage/intent findings rather than fabricated authorization.

Direct organization identity differs from membership, user identity differs from ownership, and correlated parent existence differs from business authorization. Branch-wise analysis preserves casts, nullable predicates, EXISTS joins, context comparisons and public/shared branches. Boolean normalization flattens commutative AND/OR and equality without discarding casts, identifier case or helper/join semantics. Structural normalization is not a general SQL equivalence theorem.

## Role-scoped combinations

${markdownTable(summary.COMBINATION_COUNTS)}

**${combinations.length}** object/command/role/direction records. PostgreSQL aggregation is OR of applicable permissive policies AND all restrictive policies; no permissive policy means denial. The declared runtime and system roles are evaluated separately. A system full-access policy does not broaden the ordinary runtime role unless role applicability/inheritance actually composes them; effective inheritance remains ceiling.

## Context and privileged paths

All **9** context primitives and **8** clients are preserved. Non-empty setters are distinguished from intentionally cleared system/admin context. \`STATIC_CONTEXT_PATH_PRESENT\` denotes source setter/import candidates, not complete query-order or transaction/client proof. **${summary.OBJECTS_WITH_DIRECT_CONTEXT_CALLBACK_EVIDENCE}** objects have exact lexical protected-callback source evidence, retained separately from unwrapped entry-local operations and nested-function/escape uncertainty. Context-dependent objects retain remaining order/value/client ceilings; no \`RUNTIME_CONTEXT_PROVEN\` claim is made.

Per-object privileged classifications preserve policy-mediated system access versus native BYPASSRLS. Entry/object and entry/client paths are conservatively joined and explicitly qualified. Client intent does not prove entry-specific privileged authority. Ordinary/system credential binding, role membership, ownership and preconditions remain ceilings.

## SQL helpers, grants and non-forward declarations

All **11** accepted SQL function boundaries and **26** grant/revoke records are preserved. Migration helpers generate declarations; they are not silently treated as per-row authorization helpers. Their exact resulting predicates are analyzed per policy/target/command/role. Function body, security mode, inputs, referenced objects/context, owner/execute/search-path source status and invocation links remain available.

Inline candidates are compared to configured final migration policies without promotion. Historical/non-forward lineage does not override configured state. Inline identity/role/command/predicate differences are drift candidates, not automatic deployed defects.

Schema usage and sequence privileges are not row authority; explicit table GRANT/REVOKE records are distinguished from catalog-time all-table sets and owner/future-object default privileges. The 26 grant records receive separate effective-scope/role/application ceilings.

## Static findings

${markdownTable(summary.FINDING_CLASS_COUNTS)}

**${findings.size}** finding records; repeated operation findings are not unique object counts. A definite source-state or authority-free runtime predicate defect yields \`STATIC_RLS_INCORRECT\`; incomplete resource/relationship/context/command intent yields \`STATIC_CORRECTNESS_UNRESOLVED\`. Incorrect records can also carry unresolved assurance obligations. These are not runtime exploit claims.

For account_mappings and holidays, migration source explicitly describes intentional NULL-org global reads. That documented intent conflicts with the frozen strict organization requirement; the report flags the mismatch relative to that requirement and carries the requirement/intent conflict forward. It neither invents an exemption nor declares those reads an unintended runtime defect.

## Explicit source ceilings

${markdownTable(summary.SOURCE_CEILING_CLASS_COUNTS)}

**${ceilings.size}** ceiling records. Source ceilings name the unresolved question, affected exact objects and evidence needed. They do not imply absent, invalid, unused or runtime-broken objects. Newly discovered objects: **${discovered.size}**; any discovery is registered separately and prevents closure without mutating the 612-object denominator.

## Preservation and executable validation

The generator verifies the predecessor byte fingerprint, five accepted Phase 1B input hashes, six frozen payload hashes, all ${predecessor.metadata.CONSUMED_SOURCE.length} predecessor-consumed source hashes, and accepted entry-range hashes. The 612 objects, 1,490 policies, 8 clients, 9 contexts, 11 functions, 26 grants and inline candidates retain separate preservation digests.

The **1,910** server entries, **1,710** prior findings, **3,672** prior ceilings, **43** historical expectations and all Phase 1B.1 carry-forwards remain unchanged. Foreign IDs, source ranges, duplicate IDs and requirement/disposition arithmetic are checked. No runtime DB/auth, SQL execution, migrations, writes, policies, role/client/application changes or PR creation.

Shared source-evidence and entry-boundary registries preserve exact ranges and frozen dimension results without duplicating them in every object/finding. Every reference is validated; this keeps deterministic generation within the ordinary Node heap.

Required checks:

- \`node --check scripts/ue/reconcile-static-rls-policy-correctness.mjs\`
- \`node scripts/ue/reconcile-static-rls-policy-correctness.mjs --self-test\`
- \`node scripts/ue/reconcile-static-rls-policy-correctness.mjs\`
- \`node scripts/ue/reconcile-static-rls-policy-correctness.mjs --check\`
- Scoped \`pnpm exec prettier --check\` on the generator and both reports.
- \`pnpm validate:docs\`

## Proposed next-gate packet — not authorization

Runtime RLS/tenant-isolation proof is a proposal only. The JSON packet lists frozen targets, incorrect-object/authority-contract blockers, environment/fixture approval, deployed role/owner/grant/migration evidence and proposed two-org/two-user per-command positive/negative tests. It grants no permission to execute them.

\`\`\`text
PHASE_1B_3B_GATE = ${gate}
RLS_POLICY_CORRECTNESS_PROVEN = ${report.phaseStatus.RLS_POLICY_CORRECTNESS_PROVEN}
TENANT_ISOLATION_RUNTIME_PROVEN = NO
PHASE_1B_3 = NOT_YET_COMPLETE
PHASE_1B_3C_AUTHORIZED = NO
PHASE_1B_3C_STARTED = NO
\`\`\`
`
const config = await resolveConfig(absolute(`${base}${outputName}.md`))
const json = await format(JSON.stringify(report), { ...config, parser: 'json' })
const md = await format(markdown, { ...config, parser: 'markdown' })
for (const [extension, content] of [
  ['json', json],
  ['md', md],
]) {
  const file = `${base}${outputName}.${extension}`
  if (process.argv.includes('--check'))
    assert.equal(readFileSync(absolute(file), 'utf8'), content, `Generated artifact drift: ${file}`)
  else writeFileSync(absolute(file), content)
}
console.log(
  `${process.argv.includes('--check') ? 'Verified' : 'Generated'} 612 object records, 1490 policies, ${findings.size} findings, ${ceilings.size} ceilings; ${gate}.`,
)
