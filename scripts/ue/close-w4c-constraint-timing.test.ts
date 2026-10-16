import { describe, expect, it } from 'vitest'
import {
  buildClosure,
  exactConstraints,
  files,
  main,
  normalizeConstraints,
  resolveLinkage,
} from './close-w4c-constraint-timing'
import type { buildAuthoring } from './author-w4fr3-minimal-baseline'
import type { buildScope } from './normalize-w4s-authoring-scope'
import type { buildRegeneration } from './regenerate-w4fr-definitions'
import { digest, read, sha } from './w4-physical-producers'

const model = buildClosure()
const historical: ReturnType<typeof buildAuthoring>['report'] = JSON.parse(read(files.w4fr3))
const scope: ReturnType<typeof buildScope> = JSON.parse(read(files.scope))
const frozen: ReturnType<typeof buildRegeneration>['registry'] = JSON.parse(read(files.resolved))
describe('W4C exact mixed-authority timing closure', () => {
  it('accounts for exactly seven ordered constraints and fourteen blocked IDs', () => {
    expect(model.registry.handoffs).toHaveLength(7)
    expect(model.report.blockedIdDisposition).toHaveLength(14)
    expect(
      model.report.blockedIdDisposition.map((record) => record.DEFINITION_OBLIGATION_ID),
    ).toEqual(historical.exactBlockedW4ObligationIds)
    for (const record of model.registry.handoffs) {
      expect(record.ORDERED_OPERAND_COLUMNS).toEqual(exactConstraints[record.RELATION])
      expect(record.SOURCE_W4_OBLIGATION_IDS).toHaveLength(2)
    }
    expect(
      new Set(model.registry.handoffs.map((record) => record.DEFERRED_CONSTRAINT_ID)).size,
    ).toBe(7)
  })
  it('preserves exact accepted properties,declaration identity and ordered operands', () => {
    for (const record of model.registry.handoffs) {
      const original = historical.exactOwnedConstraintBlockers.find(
        (blocker) => blocker.BLOCKER_ID === record.SOURCE_W4FR3_BLOCKER_ID,
      )!
      expect(record.CANONICAL_CONSTRAINT_PROVENANCE.GOVERNED_UNIQUE_PROPERTY).toEqual(
        original.GOVERNED_UNIQUE_PROPERTY,
      )
      expect(record.CANONICAL_CONSTRAINT_PROVENANCE.FROZEN_DECLARATION_REFERENCE).toEqual(
        original.FROZEN_DECLARATION_REFERENCE,
      )
      expect(record).toMatchObject({
        CANONICAL_CONSTRAINT_DEFINITION: 'COMPLETE',
        CONSTRAINT_SEMANTICS: 'PRESERVED',
        CONSTRAINT_DROPPED: 'NO',
        CONSTRAINT_REPLACED: 'NO',
        CONSTRAINT_WEAKENED: 'NO',
      })
    }
  })
  it('retains context-only authority without inventing parent ownership or column authoring', () => {
    for (const record of model.registry.handoffs)
      for (const operand of record.OPERAND_AUTHORITY_EVIDENCE) {
        const original = scope.columnAuthorityClassification.find(
          (entry) => entry.PHYSICAL_IDENTITY === operand.PHYSICAL_IDENTITY,
        )!
        expect(operand.FROZEN_W4S_AUTHORITY_RECORD).toEqual(original)
        if (operand.W4_BASELINE_OPERAND_CLASS === 'NON_W4_BASELINE_OPERAND') {
          expect(original.W4_DEFINITION_OBLIGATION_ID).toBeNull()
          expect(original.W4_REAUTHOR).toBe('NO_INDEPENDENT_COLUMN_OBLIGATION_CONTEXT_ONLY')
          expect(original.AUTHORITY_CLASS).toBe('W4_OWNED')
        } else expect(original.W4_DEFINITION_OBLIGATION_ID).not.toBeNull()
      }
    expect(model.registry.summary.PARENT_OWNED_OPERAND_COLUMNS_CREATED_BY_W4).toBe(0)
    expect(model.registry.summary.PARENT_OWNED_OPERAND_COLUMNS_REAUTHORED_BY_W4).toBe(0)
  })
  it('defers exact UNIQUE invariants without partial substitutions or baseline SQL', () => {
    for (const record of model.registry.handoffs) {
      expect(record).toMatchObject({
        W4_BASELINE_MATERIALIZATION: 'DEFERRED',
        MATERIALIZATION_STATUS: 'DEFERRED_NOT_EXECUTED',
        MATERIALIZATION_PRECONDITION: 'ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST',
        PARTIAL_UNIQUE_SUBSTITUTION: 'PROHIBITED',
        EXECUTION_ALLOWED: 'NO',
      })
      expect(record.BASELINE_PAYLOAD_BEHAVIOR).toMatchObject({
        CREATE_RELATION: 'YES',
        CREATE_W4_OWNED_COLUMNS: 'YES',
        CREATE_PARENT_OWNED_OPERANDS: 'NO',
        CREATE_COMPOUND_UNIQUE_CONSTRAINT: 'NO',
        DEFERRED_CONSTRAINT_HANDOFF_ID: record.DEFERRED_CONSTRAINT_ID,
      })
    }
    expect(model.registry.summary).toMatchObject({
      SQL_AUTHORED: 0,
      SQL_EXECUTED: 0,
      PARTIAL_UNIQUE_SUBSTITUTIONS: 0,
      CONSTRAINTS_DROPPED: 0,
    })
  })
  it('uses seven supplemental handoffs when fixed evidence has no exact later producer', () => {
    expect(model.registry.summary).toMatchObject({
      EXACT_LATER_PRODUCERS_IDENTIFIED: 0,
      COMPATIBILITY_PHASE_RESOLUTION_REQUIRED: 7,
      EXISTING_LATE_PRODUCER_COMPATIBILITY_RECORDS: 127,
    })
    for (const record of model.registry.handoffs) {
      expect(record.DEFERRED_TO_PRODUCER_ID).toBeNull()
      expect(record.MATERIALIZATION_OWNER).toBe('LATE_PRODUCER_COMPATIBILITY_RESOLUTION')
      expect(record.HUMAN_SCHEMA_DECISION_REQUIRED).toBe('NO')
      expect(record.EXISTING_COMPATIBILITY_OBLIGATION_IDS).toEqual([])
      for (const evidence of record.LINKAGE_EVIDENCE) {
        expect(evidence.EXACT_LATE_DEFINITION_REFERENCES).toEqual([])
        expect(evidence.EXACT_COMPATIBILITY_REFERENCES).toEqual([])
        expect(evidence.EXACT_PLAN_REFERENCES).toEqual([])
        expect(evidence.EXACT_REGISTRY_PRODUCER_IDS).toEqual([])
      }
    }
  })
  it('retains183 obligations,responsibilities and all scope/type commitments', () => {
    expect(model.registry.summary).toMatchObject({
      W4_DEFINITION_OBLIGATIONS: 183,
      RELATION_CREATE_RESPONSIBILITIES: 57,
      INCLUDED_COLUMN_RESPONSIBILITIES: 57,
      ADD_COLUMN_RESPONSIBILITIES: 69,
    })
    expect(model.report.preservation.SCOPE_SUMMARY).toEqual(scope.w4ObligationUniverse.summary)
    expect(model.report.preservation.SCOPE_SUMMARY).toMatchObject({
      DISTINCT_NAMED_TYPES: 36,
      TYPE_REFERENCES_RESOLVED: 38,
      PARENT_OWNED_COLUMNS_EXCLUDED_FROM_REAUTHORING: 1299,
      SELECTED_RELATION_CONTEXTS: 125,
    })
  })
  it('authorizes only the future retry and preserves all runtime boundaries', () => {
    expect(model.report.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4C_GATE: 'PASS',
      W4FR4: 'AUTHORIZED_NOT_STARTED',
      W4FR4_STARTED: 'NO',
      W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      VERSION_1_3_2_PUBLISHED: 'NO',
    })
    expect(model.report.proofBoundaries).toMatchObject({
      DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
      DEFERRED_CONSTRAINTS_RUNTIME_PROVEN: 'NO',
      NAMED_TYPES_MATERIALIZED: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    })
    expect(model.registry.rules.W4FR4_PASS_REQUIREMENTS).toMatchObject({
      W4_OBLIGATIONS_PHYSICALLY_DEFINED: 183,
      NAMED_TYPE_REFERENCES_RESOLVED: 38,
      MIXED_AUTHORITY_CONSTRAINTS_CANONICALLY_RECORDED: 7,
      CONSTRAINT_MATERIALIZATIONS_EXPLICITLY_DEFERRED: 7,
      UNRESOLVED_W4_OWNED_PHYSICAL_PROPERTIES: 0,
    })
  })
  it('verifies fixed upstream bytes and keeps W4FR3 historical gate untouched', () => {
    for (const [file, hash] of Object.entries(model.report.preservation.BYTE_COMMITMENTS))
      expect(sha(read(file))).toBe(hash)
    expect(model.report.preservation.HISTORICAL_W4FR3_BYTES_CHANGED).toBe('NO')
    expect(historical.phaseStatus.PHASE_1B_3C_A1I_W4FR3_GATE).toBe('BLOCKED')
    expect(model.report.preservation.PRESERVED_SECTIONS).toEqual(
      scope.preservation.PRESERVED_SECTIONS,
    )
  })
  it('is deterministic', () => {
    expect(digest(buildClosure())).toBe(digest(model))
  })
  it.each([
    'extra-constraint',
    'operand-order',
    'missing-id',
    'property-override',
    'scope-expansion',
  ])('fails closed on %s', (mutation) => {
    const h = structuredClone(historical),
      s = structuredClone(scope)
    if (mutation === 'extra-constraint')
      h.exactOwnedConstraintBlockers.push(h.exactOwnedConstraintBlockers[0])
    if (mutation === 'operand-order')
      h.exactOwnedConstraintBlockers[0].EXACT_CONSTRAINT_COLUMNS.reverse()
    if (mutation === 'missing-id') h.exactBlockedW4ObligationIds.pop()
    if (mutation === 'property-override')
      h.exactOwnedConstraintBlockers[0].GOVERNED_UNIQUE_PROPERTY.VALUE = 'UNIQUE'
    if (mutation === 'scope-expansion')
      s.revisedCompletionContract.FUTURE_MATERIALIZATION_COLUMN_IDS.push(
        h.exactOwnedConstraintBlockers[0].NONMATERIALIZED_REQUIRED_COLUMN_IDENTITIES[0],
      )
    expect(() => normalizeConstraints(h, s, frozen)).toThrow()
  })
  it('uses exact producer and compatibility identity evidence where available', () => {
    const identity = 'union-eyes::COLUMN::public.example.missing'
    const source = {
      OBJECT_IDENTITY: identity,
      FROZEN_MIGRATION_ID: 'frozen',
      FROZEN_POSITION: 20,
      EXACT_DEFINITION_DIGEST: 'digest',
    }
    const result = resolveLinkage(
      [identity],
      [
        {
          DECISION_ID: 'decision',
          PHYSICAL_IDENTITY: identity,
          CANONICAL_DEFINITION_SOURCE: source,
        },
      ],
      [
        {
          COMPATIBILITY_OBLIGATION_ID: 'compat',
          PHYSICAL_IDENTITY: identity,
          SOURCE_W4_DECISION_ID: 'decision',
          CANONICAL_DEFINITION_SOURCE: source,
        },
      ],
      {
        canonicalProducerPlan: [
          { PRODUCER_ID: 'later', ORDER_INDEX: 20, EXPECTED_OUTPUT_IDENTITIES: [identity] },
        ],
        djangoProducerRegistry: [],
        platformProducerRegistry: [
          {
            PRODUCER_ID: 'later',
            PHYSICAL_IDENTITIES: [identity],
            CANONICAL_DEFINITION_SOURCE: source,
          },
        ],
        physicalIdentityAuthority: [],
      },
    )
    expect(result.STATUS).toBe('EXACT_LATER_PRODUCER_IDENTIFIED')
    expect(result.DEFERRED_TO_PRODUCER_ID).toBe('later')
    expect(
      result.LINKAGE_EVIDENCE[0].EXACT_COMPATIBILITY_REFERENCES[0].COMPATIBILITY_OBLIGATION_ID,
    ).toBe('compat')
  })
  it('does not infer final production from an unlinked plan identity', () => {
    const identity = 'union-eyes::COLUMN::public.example.missing'
    const result = resolveLinkage(
      [identity],
      [
        {
          DECISION_ID: 'decision',
          PHYSICAL_IDENTITY: identity,
          CANONICAL_DEFINITION_SOURCE: {
            OBJECT_IDENTITY: identity,
            FROZEN_MIGRATION_ID: 'frozen',
            FROZEN_POSITION: 20,
            EXACT_DEFINITION_DIGEST: 'digest',
          },
        },
      ],
      [],
      {
        canonicalProducerPlan: [
          { PRODUCER_ID: 'unlinked', ORDER_INDEX: 20, EXPECTED_OUTPUT_IDENTITIES: [identity] },
        ],
        djangoProducerRegistry: [],
        platformProducerRegistry: [],
        physicalIdentityAuthority: [],
      },
    )
    expect(result.STATUS).toBe('COMPATIBILITY_PHASE_RESOLUTION_REQUIRED')
    expect(result.DEFERRED_TO_PRODUCER_ID).toBeNull()
  })
  it.each(['--execute', '--publish', '--discover', '--retry', '--compatibility', '--activate'])(
    'rejects unauthorized flag %s',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_W4C_FLAG')
    },
  )
})
