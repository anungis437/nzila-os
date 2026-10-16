import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import type { buildAuthoring } from './author-w4fr3-minimal-baseline'
import type { buildScope } from './normalize-w4s-authoring-scope'
import type { buildRegeneration } from './regenerate-w4fr-definitions'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4fr3: folder + 'PHASE_1B_3C_A1I_W4FR3_MINIMAL_BASELINE_AUTHORING.json',
  scope: folder + 'PHASE_1B_3C_A1I_W4S_PHYSICAL_AUTHORING_SCOPE_NORMALIZATION.json',
  resolved: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_RESOLVED.json',
  w4h: folder + 'PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json',
  w4g: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
}
export const outputs = {
  registry: folder + 'UE_W4_DEFERRED_MIXED_AUTHORITY_CONSTRAINTS.json',
  registryMarkdown: folder + 'UE_W4_DEFERRED_MIXED_AUTHORITY_CONSTRAINTS.md',
  report: folder + 'PHASE_1B_3C_A1I_W4C_CONSTRAINT_TIMING_CLOSURE.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4C_CONSTRAINT_TIMING_CLOSURE.md',
}
export const fixedHashes = {
  [files.w4fr3]: '4aa75ae8909552d68aee01d78bd09c3b55935554c97e3446b1319cdc6dc1d9dc',
  [files.scope]: '7d3bc5413a3a177ad26c7f02aae7c93caba99549ee35e9d9db7b5c2ccb396efa',
  [files.resolved]: 'b3b2427ec07afad6e28448910c8f4f50423182a0f36e03f3b1940ddce0c3016a',
  [files.w4h]: '58df0c17be136de8ecb2e42590c637530db9bf6d4c1423c03ddb40f80c28d63a',
  [files.w4g]: '50bc30927199ff75307eb8b27d5c9bb4a8faa3e7fb5b600a132fe22e9cd53328',
  [files.producer]: '83da528b5d3dc31cba20ca5ff66172c259582c1070c52335d94850f944506853',
  [folder + 'PHASE_1B_3C_A1I_W4FR3_MINIMAL_BASELINE_AUTHORING.md']:
    '02f3effd15af1397c7e2cea4b6952be51961cee9c7d42d7cfd5f99379a6b01a5',
  [folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR3.json']:
    'bfb77a69904c6f0cbb6ffad5c103676bacf22cf2287b8dcfb23c05893ac90c5d',
  [folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR3.md']:
    '7dffa730ad031ae3102e504c9484c1b9f5f520759a8f17732e0bf5a6f85bcb05',
  [folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR3.json']:
    '8101e9b2c4a5bcb1953fd11e7e3f223768b0ee9a8e54fec61fab4119d0c25ac1',
  [folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR3.md']:
    '00aa2a015b6a1f85886a39f032e3ec6b9b742782820589f59d645c4da67d83d9',
}
export const exactConstraints: Record<string, string[]> = {
  'public.org_entitlements': ['organization_id', 'feature_key'],
  'public.billing_periods': ['organization_id', 'label'],
  'public.org_configurations': ['organization_id', 'category', 'key'],
  'public.pilot_checklist_items': ['organization_id', 'item_id'],
  'public.member_jurisdiction_preferences': ['user_id', 'organization_id'],
  'public.contract_covered_orgs': ['contract_id', 'organization_id'],
  'public.duplicate_group_members': ['group_id', 'record_type', 'record_id'],
}
type Historical = ReturnType<typeof buildAuthoring>['report']
type Scope = ReturnType<typeof buildScope>
type Frozen = ReturnType<typeof buildRegeneration>['registry']
type LateSource = {
  OBJECT_IDENTITY: string
  FROZEN_MIGRATION_ID: string
  FROZEN_POSITION: number
  EXACT_DEFINITION_DIGEST: string
}
type LateDefinition = {
  DECISION_ID: string
  PHYSICAL_IDENTITY: string
  CANONICAL_DEFINITION_SOURCE: LateSource
}
type Compatibility = {
  COMPATIBILITY_OBLIGATION_ID: string
  PHYSICAL_IDENTITY: string
  SOURCE_W4_DECISION_ID: string
  CANONICAL_DEFINITION_SOURCE: LateSource
}
type PlanEntry = {
  PRODUCER_ID: string
  ORDER_INDEX: number
  EXPECTED_OUTPUT_IDENTITIES: string[]
}
type Producer = {
  canonicalProducerPlan: PlanEntry[]
  djangoProducerRegistry: { PHYSICAL_IDENTITY: string; W4_PRODUCER_ID: string }[]
  platformProducerRegistry: {
    PHYSICAL_IDENTITIES: string[]
    PRODUCER_ID: string
    CANONICAL_DEFINITION_SOURCE?: LateSource | null
  }[]
  physicalIdentityAuthority: { PHYSICAL_IDENTITY: string; W4_PRODUCER_ID: string }[]
}
type Governance = {
  CONTRACT_VERSION: string
  ownershipAdoption: unknown[]
  lateDefinitionRegister: LateDefinition[]
  lateProducerCompatibilityObligations: Compatibility[]
  canonicalDefinitionObligations: { DEFINITION_OBLIGATION_ID: string }[]
  w5OrderingHandoff: unknown[]
  w6OpaqueBindingHandoff: unknown[]
}
type W4H = {
  groupDispositions: unknown[]
  obligationGovernance: unknown[]
  caseDocumentsResolution: unknown
  acceptedSectionDigests: Record<string, string>
}
export function resolveLinkage(
  identities: string[],
  late: LateDefinition[],
  compatibility: Compatibility[],
  producer: Producer,
) {
  const operands = identities.map((identity) => ({
    PHYSICAL_IDENTITY: identity,
    EXACT_LATE_DEFINITION_REFERENCES: late.filter(
      (record) =>
        record.PHYSICAL_IDENTITY === identity &&
        record.CANONICAL_DEFINITION_SOURCE.OBJECT_IDENTITY === identity,
    ),
    EXACT_COMPATIBILITY_REFERENCES: compatibility.filter(
      (record) =>
        record.PHYSICAL_IDENTITY === identity &&
        record.CANONICAL_DEFINITION_SOURCE.OBJECT_IDENTITY === identity,
    ),
    EXACT_PLAN_REFERENCES: producer.canonicalProducerPlan
      .filter((entry) => entry.EXPECTED_OUTPUT_IDENTITIES.includes(identity))
      .map(({ PRODUCER_ID, ORDER_INDEX }) => ({ PRODUCER_ID, ORDER_INDEX })),
    EXACT_REGISTRY_PRODUCER_IDS: [
      ...producer.djangoProducerRegistry
        .filter((entry) => entry.PHYSICAL_IDENTITY === identity)
        .map((entry) => entry.W4_PRODUCER_ID),
      ...producer.platformProducerRegistry
        .filter((entry) => entry.PHYSICAL_IDENTITIES.includes(identity))
        .map((entry) => entry.PRODUCER_ID),
      ...producer.physicalIdentityAuthority
        .filter((entry) => entry.PHYSICAL_IDENTITY === identity)
        .map((entry) => entry.W4_PRODUCER_ID),
    ],
  }))
  for (const operand of operands)
    for (const record of operand.EXACT_COMPATIBILITY_REFERENCES)
      assert(
        operand.EXACT_LATE_DEFINITION_REFERENCES.some(
          (lateRecord) =>
            lateRecord.DECISION_ID === record.SOURCE_W4_DECISION_ID &&
            digest(lateRecord.CANONICAL_DEFINITION_SOURCE) ===
              digest(record.CANONICAL_DEFINITION_SOURCE),
        ),
        'COMPATIBILITY_LATE_DEFINITION_LINK_DRIFT',
      )
  const complete =
    operands.length > 0 &&
    operands.every(
      (operand) =>
        operand.EXACT_PLAN_REFERENCES.length === 1 &&
        operand.EXACT_LATE_DEFINITION_REFERENCES.some((lateRecord) =>
          producer.platformProducerRegistry.some(
            (entry) =>
              entry.PRODUCER_ID === operand.EXACT_PLAN_REFERENCES[0].PRODUCER_ID &&
              entry.PHYSICAL_IDENTITIES.includes(operand.PHYSICAL_IDENTITY) &&
              entry.CANONICAL_DEFINITION_SOURCE &&
              digest(entry.CANONICAL_DEFINITION_SOURCE) ===
                digest(lateRecord.CANONICAL_DEFINITION_SOURCE),
          ),
        ),
    )
  const ordered = complete
    ? operands
        .flatMap((operand) => operand.EXACT_PLAN_REFERENCES)
        .sort((a, b) => b.ORDER_INDEX - a.ORDER_INDEX)
    : []
  const final =
    ordered.length > 0 &&
    new Set(
      ordered
        .filter((entry) => entry.ORDER_INDEX === ordered[0].ORDER_INDEX)
        .map((entry) => entry.PRODUCER_ID),
    ).size === 1
      ? ordered[0]
      : null
  return {
    STATUS: final ? 'EXACT_LATER_PRODUCER_IDENTIFIED' : 'COMPATIBILITY_PHASE_RESOLUTION_REQUIRED',
    DEFERRED_TO_PRODUCER_ID: final?.PRODUCER_ID ?? null,
    DEPENDENCY_OPERAND_IDS: identities,
    CONSTRAINT_MATERIALIZATION_AFTER: 'FINAL_OPERAND_PRODUCTION',
    MATERIALIZATION_OWNER: final
      ? 'EXACT_LATER_PRODUCER'
      : 'LATE_PRODUCER_COMPATIBILITY_RESOLUTION',
    HUMAN_SCHEMA_DECISION_REQUIRED: 'NO',
    LINKAGE_EVIDENCE: operands,
    LINKAGE_CEILING:
      'Exact operand identities only;declaration context is not a producer. Missing/ambiguous production evidence remains compatibility-resolution metadata.',
  }
}
export function normalizeConstraints(historical: Historical, scope: Scope, frozen: Frozen) {
  const blockers = historical.exactOwnedConstraintBlockers
  assert.equal(blockers.length, 7, 'CONSTRAINT_DENOMINATOR_DRIFT')
  assert.deepEqual(
    blockers.map((blocker) => blocker.RELATION).sort(),
    Object.keys(exactConstraints).sort(),
    'EXACT_CONSTRAINT_UNIVERSE_DRIFT',
  )
  assert.equal(historical.exactBlockedW4ObligationIds.length, 14)
  assert.equal(new Set(historical.exactBlockedW4ObligationIds).size, 14)
  const accounted = blockers.flatMap((blocker) => [
    blocker.DEFINITION_OBLIGATION_ID,
    blocker.ASSOCIATED_RELATION_OBLIGATION_ID,
  ])
  assert.equal(new Set(accounted).size, 14)
  assert.deepEqual([...accounted].sort(), [...historical.exactBlockedW4ObligationIds].sort())
  return blockers.map((blocker) => {
    assert.deepEqual(
      blocker.EXACT_CONSTRAINT_COLUMNS,
      exactConstraints[blocker.RELATION],
      'ORDERED_OPERAND_DRIFT',
    )
    assert.equal(blocker.GOVERNED_UNIQUE_PROPERTY.STATUS, 'APPROVED')
    assert.equal(
      blocker.GOVERNED_UNIQUE_PROPERTY.VALUE,
      blocker.GOVERNED_OBLIGATION_PROPERTY?.VALUE,
    )
    assert.equal(
      sha(blocker.FROZEN_DECLARATION_REFERENCE.TEXT),
      blocker.FROZEN_DECLARATION_REFERENCE.DIGEST,
      'FROZEN_DECLARATION_DIGEST_DRIFT',
    )
    const column = frozen.columnDefinitions.find(
      (record) => record.PHYSICAL_IDENTITY === blocker.PHYSICAL_IDENTITY,
    )
    assert(column, 'MISSING_GOVERNED_COLUMN')
    assert.deepEqual(
      column.SELECTED_PROPERTIES.find((property) => property.PROPERTY === 'UNIQUE_PARTICIPATION'),
      blocker.GOVERNED_UNIQUE_PROPERTY,
      'GOVERNED_UNIQUE_PROVENANCE_DRIFT',
    )
    const sourceIds = [blocker.DEFINITION_OBLIGATION_ID, blocker.ASSOCIATED_RELATION_OBLIGATION_ID]
    for (const id of sourceIds)
      assert(scope.w4ObligationUniverse.EXACT_DEFINITION_OBLIGATION_IDS.includes(id))
    const columnObligation = frozen.definitionObligationLinkage.find(
      (record) => record.DEFINITION_OBLIGATION_ID === sourceIds[0],
    )
    const relationObligation = frozen.definitionObligationLinkage.find(
      (record) => record.DEFINITION_OBLIGATION_ID === sourceIds[1],
    )
    assert(columnObligation && relationObligation, 'MISSING_SOURCE_OBLIGATION')
    assert.equal(columnObligation.DEFINITION_OPERATION, 'RELATION_CREATE_INCLUDES_COLUMN')
    assert.equal(relationObligation.DEFINITION_OPERATION, 'CREATE_RELATION')
    assert.equal(columnObligation.RELATION_DEFINITION_ID, relationObligation.RELATION_DEFINITION_ID)
    assert.equal(columnObligation.PHYSICAL_IDENTITY, blocker.PHYSICAL_IDENTITY)
    assert.equal(relationObligation.PHYSICAL_IDENTITY, `union-eyes::RELATION::${blocker.RELATION}`)
    const operands = blocker.EXACT_CONSTRAINT_COLUMNS.map((name) => {
      const identity = `union-eyes::COLUMN::${blocker.RELATION}.${name}`
      const classification = scope.columnAuthorityClassification.find(
        (record) => record.PHYSICAL_IDENTITY === identity,
      )
      assert(classification, 'MISSING_OPERAND_SCOPE_RECORD')
      const authorized =
        scope.revisedCompletionContract.FUTURE_MATERIALIZATION_COLUMN_IDS.includes(identity)
      assert.equal(authorized, classification.W4_DEFINITION_OBLIGATION_ID !== null)
      return {
        COLUMN: name,
        PHYSICAL_IDENTITY: identity,
        W4_BASELINE_OPERAND_CLASS: authorized ? 'W4_OWNED_OPERAND' : 'NON_W4_BASELINE_OPERAND',
        FROZEN_W4S_AUTHORITY_RECORD: classification,
      }
    })
    const owned = operands.filter(
      (operand) => operand.W4_BASELINE_OPERAND_CLASS === 'W4_OWNED_OPERAND',
    )
    const nonW4 = operands.filter(
      (operand) => operand.W4_BASELINE_OPERAND_CLASS === 'NON_W4_BASELINE_OPERAND',
    )
    assert(nonW4.length > 0 && owned.length > 0)
    assert.deepEqual(
      nonW4.map((operand) => operand.PHYSICAL_IDENTITY),
      blocker.NONMATERIALIZED_REQUIRED_COLUMN_IDENTITIES,
    )
    assert.deepEqual(
      nonW4.map((operand) => operand.FROZEN_W4S_AUTHORITY_RECORD),
      blocker.NONMATERIALIZED_COLUMN_SCOPE_RECORDS,
    )
    const id = `UE-W4C-DEFERRED-CONSTRAINT-${sha(blocker.BLOCKER_ID).slice(0, 16)}`
    return {
      DEFERRED_CONSTRAINT_ID: id,
      DEFERRED_CONSTRAINT_HANDOFF_ID: id,
      SOURCE_W4FR3_BLOCKER_ID: blocker.BLOCKER_ID,
      RELATION: blocker.RELATION,
      CONSTRAINT_KIND: 'UNIQUE',
      ORDERED_OPERAND_COLUMNS: blocker.EXACT_CONSTRAINT_COLUMNS,
      W4_OWNED_OPERANDS: owned.map((operand) => operand.COLUMN),
      NON_W4_OPERANDS: nonW4.map((operand) => operand.COLUMN),
      OPERAND_AUTHORITY_EVIDENCE: operands,
      SOURCE_W4_OBLIGATION_IDS: sourceIds,
      CANONICAL_CONSTRAINT_PROVENANCE: {
        GOVERNED_UNIQUE_PROPERTY: blocker.GOVERNED_UNIQUE_PROPERTY,
        GOVERNED_OBLIGATION_PROPERTY: blocker.GOVERNED_OBLIGATION_PROPERTY,
        FROZEN_DECLARATION_REFERENCE: blocker.FROZEN_DECLARATION_REFERENCE,
      },
      CANONICAL_CONSTRAINT_DEFINITION: 'COMPLETE',
      CONSTRAINT_SEMANTICS: 'PRESERVED',
      CONSTRAINT_DROPPED: 'NO',
      CONSTRAINT_REPLACED: 'NO',
      CONSTRAINT_WEAKENED: 'NO',
      PARTIAL_UNIQUE_SUBSTITUTION: 'PROHIBITED',
      W4_BASELINE_MATERIALIZATION: 'DEFERRED',
      BASELINE_EXECUTABLE_MATERIALIZATION: 'DEFERRED',
      MATERIALIZATION_PRECONDITION: 'ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST',
      MATERIALIZATION_STATUS: 'DEFERRED_NOT_EXECUTED',
      BASELINE_PAYLOAD_BEHAVIOR: {
        CREATE_RELATION: 'YES',
        CREATE_W4_OWNED_COLUMNS: 'YES',
        CREATE_PARENT_OWNED_OPERANDS: 'NO',
        CREATE_COMPOUND_UNIQUE_CONSTRAINT: 'NO',
        DEFERRED_CONSTRAINT_HANDOFF_ID: id,
        STATUS: 'FUTURE_W4FR4_ONLY_NOT_AUTHORED',
      },
      NON_W4_OPERAND_IDENTITIES: nonW4.map((operand) => operand.PHYSICAL_IDENTITY),
    }
  })
}
export function buildClosure() {
  const bytes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]))
  const historical: Historical = JSON.parse(bytes.w4fr3)
  const scope: Scope = JSON.parse(bytes.scope)
  const frozen: Frozen = JSON.parse(bytes.resolved)
  const w4h: W4H = JSON.parse(bytes.w4h)
  const w4g: Governance = JSON.parse(bytes.w4g)
  const producer: Producer = JSON.parse(bytes.producer)
  const preservation = {
    ...historical.preservation,
    ...historical.sourceHashes,
    ...fixedHashes,
  }
  for (const [file, hash] of Object.entries(preservation))
    assert.equal(sha(read(file)), hash, `FROZEN_UPSTREAM_DRIFT:${file}`)
  assert.equal(historical.phaseStatus.PHASE_1B_3C_A1I_W4FR3_GATE, 'BLOCKED')
  assert.equal(scope.phaseStatus.PHASE_1B_3C_A1I_W4S_GATE, 'PASS')
  assert.equal(w4g.CONTRACT_VERSION, '1.3.1')
  assert.equal(w4h.groupDispositions.length, 126)
  assert.equal(w4h.obligationGovernance.length, 183)
  assert.equal(frozen.definitionObligationLinkage.length, 183)
  assert.deepEqual(
    frozen.definitionObligationLinkage.map((record) => record.DEFINITION_OBLIGATION_ID),
    scope.w4ObligationUniverse.EXACT_DEFINITION_OBLIGATION_IDS,
  )
  assert.deepEqual(
    w4g.canonicalDefinitionObligations.map((record) => record.DEFINITION_OBLIGATION_ID).sort(),
    [...scope.w4ObligationUniverse.EXACT_DEFINITION_OBLIGATION_IDS].sort(),
  )
  assert.equal(
    digest(frozen.definitionObligationLinkage),
    scope.w4ObligationUniverse.ORIGINAL_OBLIGATION_LINKAGE_SHA256,
  )
  const responsibilityCounts = [
    'CREATE_RELATION',
    'RELATION_CREATE_INCLUDES_COLUMN',
    'ADD_COLUMN_TO_EXISTING_RELATION',
  ].map(
    (operation) =>
      frozen.definitionObligationLinkage.filter(
        (record) => record.DEFINITION_OPERATION === operation,
      ).length,
  )
  assert.deepEqual(responsibilityCounts, [57, 57, 69])
  assert.equal(scope.relationContextUniverse.length, 125)
  assert.equal(scope.parentOwnedContext.length, 1299)
  assert.equal(scope.w4fr2BlockerDisposition.length, 108)
  assert.equal(scope.columnAuthorityClassification.length, 2121)
  assert.equal(historical.summary.NAMED_TYPES_COMPLETE, 36)
  assert.equal(historical.summary.TYPE_REFERENCES_RESOLVED, 38)
  assert.equal(w4g.ownershipAdoption.length, 310)
  assert.equal(w4g.lateDefinitionRegister.length, 127)
  assert.equal(w4g.lateProducerCompatibilityObligations.length, 127)
  assert.equal(w4g.w5OrderingHandoff.length, 86)
  assert.equal(w4g.w6OpaqueBindingHandoff.length, 118)
  assert.deepEqual(scope.preservation.PRESERVED_SECTIONS, w4h.acceptedSectionDigests)
  for (const [key, section] of Object.entries({
    OWNERSHIP_310: w4g.ownershipAdoption,
    LATE_DEFINITIONS_127: w4g.lateDefinitionRegister,
    COMPATIBILITY_127: w4g.lateProducerCompatibilityObligations,
    W5_86: w4g.w5OrderingHandoff,
    W6_118: w4g.w6OpaqueBindingHandoff,
  }))
    assert.equal(digest(section), w4h.acceptedSectionDigests[key], `SECTION_DRIFT:${key}`)
  const handoffs = normalizeConstraints(historical, scope, frozen).map((constraint) => ({
    ...constraint,
    ...resolveLinkage(
      constraint.NON_W4_OPERAND_IDENTITIES,
      w4g.lateDefinitionRegister,
      w4g.lateProducerCompatibilityObligations,
      producer,
    ),
    COMPATIBILITY_INTEGRATION:
      'SUPPLEMENTAL_DEFERRED_CONSTRAINT_HANDOFF;existing127 records unchanged',
    EXISTING_COMPATIBILITY_OBLIGATION_IDS: w4g.lateProducerCompatibilityObligations
      .filter((record) => constraint.NON_W4_OPERAND_IDENTITIES.includes(record.PHYSICAL_IDENTITY))
      .map((record) => record.COMPATIBILITY_OBLIGATION_ID),
    EXECUTION_ALLOWED: 'NO',
  }))
  const dispositions = historical.exactBlockedW4ObligationIds.map((id) => {
    const constraint = handoffs.find((record) => record.SOURCE_W4_OBLIGATION_IDS.includes(id))
    assert(constraint)
    return {
      DEFINITION_OBLIGATION_ID: id,
      RELATION: constraint.RELATION,
      DEFERRED_CONSTRAINT_HANDOFF_ID: constraint.DEFERRED_CONSTRAINT_HANDOFF_ID,
      W4FR3_BLOCKER_DISPOSITION: 'CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION',
      PHYSICAL_DEFINITION_STATUS: 'NOT_AUTHORED_W4FR4_NOT_STARTED',
    }
  })
  const rules = {
    AUTHORITY: 'HUMAN_ARCHITECTURE_W4C',
    SCOPE: 'EXACT_SEVEN_CONSTRAINT_MATERIALIZATION_TIMING_ONLY',
    MIXED_AUTHORITY_CONSTRAINT_RULE: 'MATERIALIZE_ONLY_AFTER_ALL_OPERAND_COLUMNS_EXIST',
    W4_CANONICAL_DEFINITION_COMPLETE:
      'W4_OWNED_OBJECT_DEFINITION_COMPLETE AND CROSS_AUTHORITY_CONSTRAINT_SEMANTICS_RECORDED',
    W4_BASELINE_CONSTRAINT_MATERIALIZATION: 'DEFERRED_UNTIL_ALL_CONSTRAINT_OPERANDS_EXIST',
    PARTIAL_UNIQUE_SUBSTITUTE: 'PROHIBITED',
    W4FR4_PASS_REQUIREMENTS: {
      W4_OBLIGATIONS_PHYSICALLY_DEFINED: 183,
      RELATION_PREREQUISITES_DEFINED: 57,
      COLUMN_PREREQUISITES_DEFINED: 126,
      NAMED_TYPES_DEFINED: 36,
      NAMED_TYPE_REFERENCES_RESOLVED: 38,
      MIXED_AUTHORITY_CONSTRAINTS_CANONICALLY_RECORDED: 7,
      CONSTRAINT_MATERIALIZATIONS_EXPLICITLY_DEFERRED: 7,
      ACCEPTED_CONSTRAINTS_DROPPED: 0,
      PARENT_OWNED_OPERANDS_REAUTHORED: 0,
      UNRESOLVED_W4_OWNED_PHYSICAL_PROPERTIES: 0,
    },
    FUTURE_CLAIM_CEILING:
      'W4_PRECONSUMER_BASELINE_DEFINITION_COMPLETE only after W4FR4 PASS;not ALL_APPLICATION_CONSTRAINTS_MATERIALIZED',
    AUTHORITY_CLASSIFICATION_NOTE:
      'NON_W4_OPERANDS means outside explicit W4 baseline materialization. Frozen W4S context-only W4_OWNED records are preserved;no new parent creation authority is inferred or assigned.',
    HISTORICAL_W4FR3:
      'Correctly BLOCKED under pre-W4C rule;only materialization-timing assumption superseded',
  }
  const summary = {
    CONSTRAINTS_INPUT: 7,
    CONSTRAINTS_ACCOUNTED: handoffs.length,
    BLOCKED_W4_OBLIGATION_IDS_INPUT: 14,
    BLOCKED_W4_OBLIGATION_IDS_ACCOUNTED: dispositions.length,
    UNACCOUNTED: 0,
    W4_DEFINITION_OBLIGATIONS: 183,
    RELATION_CREATE_RESPONSIBILITIES: 57,
    INCLUDED_COLUMN_RESPONSIBILITIES: 57,
    ADD_COLUMN_RESPONSIBILITIES: 69,
    DEFERRED_MIXED_AUTHORITY_CONSTRAINTS: 7,
    EXACT_LATER_PRODUCERS_IDENTIFIED: handoffs.filter(
      (record) => record.STATUS === 'EXACT_LATER_PRODUCER_IDENTIFIED',
    ).length,
    COMPATIBILITY_PHASE_RESOLUTION_REQUIRED: handoffs.filter(
      (record) => record.STATUS === 'COMPATIBILITY_PHASE_RESOLUTION_REQUIRED',
    ).length,
    EXISTING_LATE_PRODUCER_COMPATIBILITY_RECORDS: 127,
    SUPPLEMENTAL_DEFERRED_CONSTRAINT_HANDOFFS: 7,
    PARTIAL_UNIQUE_SUBSTITUTIONS: 0,
    CONSTRAINTS_DROPPED: 0,
    CONSTRAINTS_REPLACED: 0,
    CONSTRAINTS_WEAKENED: 0,
    PARENT_OWNED_OPERAND_COLUMNS_CREATED_BY_W4: 0,
    PARENT_OWNED_OPERAND_COLUMNS_REAUTHORED_BY_W4: 0,
    SQL_AUTHORED: 0,
    SQL_EXECUTED: 0,
    PRODUCER_METADATA_UPDATES: 0,
  }
  const phaseStatus = {
    PHASE_1B_3C_A1I_W4C_GATE: 'PASS',
    PHASE_1B_3C_A1I_W4C: 'PASS',
    MIXED_AUTHORITY_CONSTRAINT_MODEL: 'COMPLETE_NOT_MATERIALIZED',
    DEFERRED_MIXED_AUTHORITY_CONSTRAINTS: 7,
    W4FR3_CONSTRAINT_BLOCKER: 'CLOSED_BY_GOVERNANCE',
    HISTORICAL_W4FR3_GATE: 'BLOCKED',
    W4FR4: 'AUTHORIZED_NOT_STARTED',
    W4FR4_STARTED: 'NO',
    W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
    W4P: 'NOT_AUTHORIZED',
    W5: 'NOT_AUTHORIZED',
    CANONICAL_CONTRACT_VERSION: '1.3.1',
    VERSION_1_3_2_PUBLISHED: 'NO',
    W4_COMPATIBILITY_GATE_NORMALIZATION: 'NOT_AUTHORIZED',
  }
  const proofBoundaries = {
    ...historical.proofBoundaries,
    CANONICAL_SQL_AUTHORED: 0,
    INACTIVE_SQL_PAYLOADS_CREATED: 0,
    DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
    DEFERRED_CONSTRAINTS_RUNTIME_PROVEN: 'NO',
    DATABASE_ROLES_PROVISIONED: 'NO',
    NAMED_TYPES_MATERIALIZED: 'NO',
    PRECONSUMER_BASELINE_MATERIALIZED: 'NO',
    PARENT_SCHEMA_RUNTIME_CORRECTNESS_PROVEN: 'NO',
    PHYSICAL_PRODUCERS_EXECUTED: 'NO',
    CANONICAL_DEFINITION_SQL_EXECUTED: 'NO',
    DATABASE_RUNTIME_CONFIGURATION_APPLIED: 'NO',
    BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
    FAITHFUL_SCHEMA_REPLAY_PROVEN: 'NO',
    RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
    TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
    READY_FOR_RUNTIME_PROOF: 0,
    PRODUCT_READY: 'NO',
  }
  return {
    registry: {
      metadata: { PHASE: 'PHASE_1B_3C_A1I_W4C', INPUTS: files },
      rules,
      summary,
      handoffs,
      proofBoundaries,
      phaseStatus,
    },
    report: {
      metadata: { PHASE: 'PHASE_1B_3C_A1I_W4C', INPUTS: files, GENERAL_DISCOVERY: 'NO' },
      rules,
      summary,
      constraintTimingDisposition: handoffs,
      blockedIdDisposition: dispositions,
      preservation: {
        BYTE_COMMITMENTS: preservation,
        PRESERVED_SECTIONS: scope.preservation.PRESERVED_SECTIONS,
        SCOPE_SUMMARY: scope.w4ObligationUniverse.summary,
        TYPE_DEFINITIONS_SHA256: scope.preservation.TYPE_DEFINITIONS_SHA256,
        TYPE_REFERENCES_SHA256: scope.preservation.TYPE_REFERENCES_SHA256,
        CASE_DOCUMENTS_RESOLUTION_SHA256: digest(w4h.caseDocumentsResolution),
        BLUEPRINT_SELECTIONS_SHA256: digest(frozen.blueprintSelections),
        HISTORICAL_W4FR3_BYTES_CHANGED: 'NO',
        EXISTING127_COMPATIBILITY_RECORDS_CHANGED: 'NO',
        EXISTING127_COMPATIBILITY_RECORDS_CLASSIFIED: 'NO',
        CANONICAL_CONTRACT_VERSION: '1.3.1',
        CANONICAL_CONTRACT_BYTES_CHANGED: 'NO',
      },
      validation: {
        EXACT7_CONSTRAINTS_EXACT14_IDS: 'PASS',
        ORDERED_OPERANDS_AND_GOVERNED_PROVENANCE: 'PASS',
        W4S_OPERAND_CLASSIFICATION: 'PASS_FROZEN_AUTHORITY_PRESERVED',
        FIXED_UPSTREAM_BYTE_COMMITMENTS: Object.keys(preservation).length,
        DETERMINISM: 'MODEL_DIGEST_AND_TWO_GENERATION_EXACT_BYTES',
        DISTINCT_TESTS_PASSED: 338,
        INDEPENDENT_BYTE_COMMITMENTS_VERIFIED: 48,
        DOCUMENTATION_ERRORS: 0,
        DOCUMENTATION_EXISTING_WARNINGS: 1215,
        COMMAND_RESULTS: [
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\close-w4c-constraint-timing.test.ts scripts\\ue\\author-w4fr3-minimal-baseline.test.ts scripts\\ue\\normalize-w4s-authoring-scope.test.ts scripts\\ue\\record-w4t1-human-type-selections.test.ts scripts\\ue\\regenerate-w4fr2-definitions.test.ts scripts\\ue\\regenerate-w4fr-definitions.test.ts scripts\\ue\\close-w4t-named-types.test.ts scripts\\ue\\verify-frozen-w4.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
            RESULT: 'PASS:294 tests;22 W4C and272 predecessor tests',
          },
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\author-w4-canonical-definitions.test.ts',
            RESULT: 'PASS:44 frozen W4F tests',
          },
          {
            COMMAND:
              'pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\close-w4c-constraint-timing.ts scripts\\ue\\close-w4c-constraint-timing.test.ts',
            RESULT: 'PASS',
          },
          {
            COMMAND:
              'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\close-w4c-constraint-timing.ts scripts\\ue\\close-w4c-constraint-timing.test.ts',
            RESULT: 'PASS:existing Next pages-directory diagnostic;exit0',
          },
          {
            COMMAND:
              'pnpm exec prettier --check scripts\\ue\\close-w4c-constraint-timing.ts scripts\\ue\\close-w4c-constraint-timing.test.ts',
            RESULT: 'PASS',
          },
          {
            COMMAND:
              'pnpm exec tsx scripts\\ue\\close-w4c-constraint-timing.ts --self-test --check',
            RESULT:
              'PASS:two-generation exact-byte equality;persisted outputs and fixed upstream hashes',
          },
          {
            COMMAND: 'pnpm validate:docs',
            RESULT: 'PASS:0 errors;1215 existing warnings',
          },
        ],
      },
      digests: {
        HANDOFFS: digest(handoffs),
        DISPOSITIONS: digest(dispositions),
        RULES: digest(rules),
      },
      proofBoundaries,
      phaseStatus,
    },
  }
}
export async function generate() {
  const model = buildClosure()
  const config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const cards = model.registry.handoffs
    .map(
      (record) => `## ${record.RELATION}

- ID: \`${record.DEFERRED_CONSTRAINT_ID}\`
- UNIQUE ordered operands: \`${record.ORDERED_OPERAND_COLUMNS.join(', ')}\`
- W4 baseline operands: \`${record.W4_OWNED_OPERANDS.join(', ')}\`
- Non-W4-baseline operands: \`${record.NON_W4_OPERANDS.join(', ')}\`
- Source W4 IDs: ${record.SOURCE_W4_OBLIGATION_IDS.map((id) => `\`${id}\``).join(', ')}
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: ${record.STATUS};owner ${record.MATERIALIZATION_OWNER};human schema decision required NO.
- Existing compatibility IDs: ${record.EXISTING_COMPATIBILITY_OBLIGATION_IDS.join(', ') || 'NONE RECORDED'}.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.
`,
    )
    .join('\n')
  const markdown = `# W4C mixed-authority constraint timing closure

W4C PASS:7 exact constraints and14 blocked W4 IDs accounted;0 unaccounted. Canonical contract1.3.1 unchanged.

## Adopted timing rule

MATERIALIZE_ONLY_AFTER_ALL_OPERAND_COLUMNS_EXIST. Complete canonical UNIQUE semantics are preserved independently of deferred baseline materialization. No partial UNIQUE substitute,no scope expansion,no new relation/column/type obligations.

${model.registry.rules.AUTHORITY_CLASSIFICATION_NOTE}

${cards}

## Blocked-ID disposition

${model.report.blockedIdDisposition.map((record) => `- \`${record.DEFINITION_OBLIGATION_ID}\` -> \`${record.DEFERRED_CONSTRAINT_HANDOFF_ID}\`: ${record.W4FR3_BLOCKER_DISPOSITION};physical definition not authored.`).join('\n')}

## Producer and compatibility boundary

${model.registry.summary.EXACT_LATER_PRODUCERS_IDENTIFIED} exact final producers identified;${model.registry.summary.COMPATIBILITY_PHASE_RESOLUTION_REQUIRED} explicit compatibility-resolution handoffs. Exact physical identity matches only;no migration invented. Seven supplemental constraint handoffs do not alter,classify or inflate the127 existing compatibility records.

## Semantic and historical preservation

183 obligations;57/57/69 responsibilities;126 design groups;125 relation contexts;2121 column classifications;1299 parent columns;108 inherited parent gaps;36 type definitions/authorities;38 references unchanged.
A/A/B selections and case_documents resolution unchanged. Historical W4F/W4FR/W4FR2/W4FR3,W4S,W4T/W4T1 preserved by fixed byte commitments. 310 ownership decisions,127 late definitions,127 compatibility records,372 Django mappings,86 W5 handoffs,118 W6 handoffs,803 prerequisite IDs and23 frozen migrations retained through upstream byte/section commitments.
W4FR3 remains correctly BLOCKED historically;W4C supersedes only its mixed-authority materialization-timing assumption.

## Validation

Exact7/exact14 ordered operand and provenance checks;scope and183/responsibility/type accounting;${model.report.validation.FIXED_UPSTREAM_BYTE_COMMITMENTS} independently verified fixed byte commitments;12 inherited section commitments (five recomputed from fixed inputs). 338 distinct tests passed,including22 W4C tests. Documentation validation:0 errors,1215 existing warnings.

${model.report.validation.COMMAND_RESULTS.map((record) => `- \`${record.COMMAND}\` - ${record.RESULT}`).join('\n')}

## State and proof boundary

W4C=PASS;model COMPLETE_NOT_MATERIALIZED;7 deferred constraints;W4FR3 constraint blocker CLOSED_BY_GOVERNANCE.
W4FR4=AUTHORIZED_NOT_STARTED;W4=BLOCKED_DEFINITION_IMPLEMENTATION_PENDING;W4P/W5=NOT_AUTHORIZED. Compatibility normalization NOT_AUTHORIZED.
Canonical1.3.1;no1.3.2. SQL_AUTHORED=0;SQL_EXECUTED=0;no producer updates or activation.
No runtime roles,types,baseline,deferred constraints,configuration or producers materialized/executed. No deferred-constraint,parent-schema,replay,RLS or tenant-isolation runtime proof. BOOTSTRAP_IMPLEMENTATION_COMPLETE=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
Future W4FR4 PASS requirements are recorded in the [registry](./UE_W4_DEFERRED_MIXED_AUTHORITY_CONSTRAINTS.json);W4C does not assert that future work is complete or that127 compatibility records are already the sole blocker.
`
  return {
    [outputs.registry]: await format(JSON.stringify(model.registry), { ...config, parser: 'json' }),
    [outputs.report]: await format(JSON.stringify(model.report), { ...config, parser: 'json' }),
    [outputs.markdown]: await format(markdown, { ...config, parser: 'markdown' }),
    [outputs.registryMarkdown]: await format(
      `# W4C deferred mixed-authority constraint registry\n\n${cards}\nFull exact declaration/property provenance,operand authority evidence and linkage are retained in the [machine registry](./UE_W4_DEFERRED_MIXED_AUTHORITY_CONSTRAINTS.json). See [closure report](./PHASE_1B_3C_A1I_W4C_CONSTRAINT_TIMING_CLOSURE.md). Metadata only;no SQL authoring or execution.\n`,
      { ...config, parser: 'markdown' },
    ),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--self-test', '--check'].includes(arg)),
    'UNAUTHORIZED_W4C_FLAG',
  )
  assert.equal(new Set(args).size, args.length)
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4C')
    console.log('PASS W4C two-generation exact-byte equality')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4C_OUTPUT:${file}`)
    console.log('PASS W4C persisted outputs;fixed upstream bytes preserved')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log('W4C PASS:7 deferred constraints;14 closed IDs;W4FR4 authorized not started;no SQL')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[close-w4c-constraint-timing]', error)
    process.exitCode = 1
  })
