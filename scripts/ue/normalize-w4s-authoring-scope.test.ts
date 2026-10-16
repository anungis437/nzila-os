import { describe, expect, it } from 'vitest'
import {
  buildScope,
  classifyContexts,
  files,
  main,
  reconcileResponsibilities,
  verifyGapDisjointness,
} from './normalize-w4s-authoring-scope'
import type { buildRegeneration } from './regenerate-w4fr-definitions'
import type { buildRetry } from './regenerate-w4fr2-definitions'
import { digest, read, sha } from './w4-physical-producers'

const frozen: ReturnType<typeof buildRegeneration>['registry'] = JSON.parse(read(files.resolved))
const retry: ReturnType<typeof buildRetry>['report'] = JSON.parse(read(files.w4fr2))
const model = buildScope()
const parentIds = new Set(model.parentOwnedContext.map((column) => column.PHYSICAL_IDENTITY))
describe('W4S exact scope normalization', () => {
  it('retains all183 obligation IDs,126 explicit columns and57/57/69 responsibilities exactly once', () => {
    expect(model.w4ObligationUniverse.EXACT_DEFINITION_OBLIGATION_IDS).toEqual(
      frozen.definitionObligationLinkage.map((record) => record.DEFINITION_OBLIGATION_ID),
    )
    const responsibilities = Object.values(model.w4OwnedResponsibilities).flat()
    expect(responsibilities).toHaveLength(183)
    expect(new Set(responsibilities.map((record) => record.DEFINITION_OBLIGATION_ID)).size).toBe(
      183,
    )
    expect(model.w4OwnedResponsibilities.RELATION_CREATE_OBLIGATIONS).toHaveLength(57)
    expect(model.w4OwnedResponsibilities.INCLUDED_COLUMN_OBLIGATIONS).toHaveLength(57)
    expect(model.w4OwnedResponsibilities.ADD_COLUMN_OBLIGATIONS).toHaveLength(69)
    expect(responsibilities.map((record) => record.DEFINITION_OBLIGATION_ID).sort()).toEqual(
      [...model.w4ObligationUniverse.EXACT_DEFINITION_OBLIGATION_IDS].sort(),
    )
  })
  it('classifies125 contexts,all2121 selected columns,and1299 parent columns without inference', () => {
    expect(model.relationContextUniverse).toHaveLength(125)
    expect(model.columnAuthorityClassification).toHaveLength(2121)
    expect(model.parentOwnedContext).toHaveLength(1299)
    expect(model.w4ObligationUniverse.summary).toMatchObject({
      W4_RELATION_PREREQUISITES: 57,
      PARENT_AUTHORITY_RELATION_CONTEXTS: 68,
      W4_GOVERNED_COLUMN_CONTEXTS: 822,
      EXPLICIT_W4_COLUMN_PREREQUISITES: 126,
      OTHER_GOVERNED_RELATION_COLUMN_CONTEXTS_NOT_INDEPENDENT_OBLIGATIONS: 696,
      UNCLASSIFIED_SELECTED_COLUMNS: 0,
      PARENT_OWNED_COLUMNS_REAUTHORED: 0,
    })
    for (const column of model.parentOwnedContext) {
      expect(column).toMatchObject({
        AUTHORITY_CLASS: 'EXISTING_PARENT_AUTHORITY',
        W4_REAUTHOR: 'NO',
        W4_PHYSICAL_COMPLETENESS_REQUIRED: 'NO',
        W4_DEFINITION_OBLIGATION_ID: null,
      })
      expect(column).not.toHaveProperty('POSTGRES_TYPE')
    }
  })
  it('uses explicit126 column obligation IDs,not blueprint column-count proxy', () => {
    const columns = model.columnAuthorityClassification.filter(
      (column) => column.W4_DEFINITION_OBLIGATION_ID,
    )
    expect(columns.map((column) => column.W4_DEFINITION_OBLIGATION_ID).sort()).toEqual(
      frozen.definitionObligationLinkage
        .filter((record) => record.OBJECT_KIND === 'COLUMN')
        .map((record) => record.DEFINITION_OBLIGATION_ID)
        .sort(),
    )
    expect(model.revisedCompletionContract.FUTURE_MATERIALIZATION_COLUMN_IDS).toEqual(
      frozen.definitionObligationLinkage
        .filter((record) => record.OBJECT_KIND === 'COLUMN')
        .map((record) => record.PHYSICAL_IDENTITY),
    )
  })
  it('does not treat696 embedded governed context columns as independent creation authorization', () => {
    const context = model.columnAuthorityClassification.filter(
      (column) => column.AUTHORITY_CLASS === 'W4_OWNED' && !column.W4_DEFINITION_OBLIGATION_ID,
    )
    expect(context).toHaveLength(696)
    for (const column of context) {
      expect(column.RELATED_RELATION_OBLIGATION_ID).toBeTruthy()
      expect(column.W4_REAUTHOR).toBe('NO_INDEPENDENT_COLUMN_OBLIGATION_CONTEXT_ONLY')
      expect(column.W4_PHYSICAL_COMPLETENESS_REQUIRED).toBe(
        'NO_INDEPENDENT_COLUMN_COMPLETENESS_DENOMINATOR',
      )
    }
  })
  it('proves108 gaps are parent subset,disjoint from allW4 obligations and required columns', () => {
    expect(() =>
      verifyGapDisjointness(
        retry.physicalCompletenessBlockers,
        parentIds,
        frozen.definitionObligationLinkage,
        frozen,
      ),
    ).not.toThrow()
    expect(model.w4fr2BlockerDisposition).toHaveLength(108)
    expect(model.w4ObligationUniverse.summary.W4_OWNED_GAPS_WITHIN_108).toBe(0)
    for (const gap of model.w4fr2BlockerDisposition) {
      expect(parentIds.has(gap.PHYSICAL_IDENTITY)).toBe(true)
      expect(
        frozen.definitionObligationLinkage.some(
          (record) => record.PHYSICAL_IDENTITY === gap.PHYSICAL_IDENTITY,
        ),
      ).toBe(false)
    }
  })
  it('preserves108 original gap facts;supersedes blocking effect only,not representation truth', () => {
    expect(model.w4fr2BlockerDisposition.map((record) => record.ORIGINAL_W4FR2_BLOCKER)).toEqual(
      retry.physicalCompletenessBlockers,
    )
    expect(model.w4ObligationUniverse.summary).toMatchObject({
      TIMESTAMP_REPRESENTATION_GAPS: 94,
      NUMERIC_PRECISION_SCALE_GAPS: 13,
      VARCHAR_LENGTH_OR_UNBOUNDED_GAPS: 1,
    })
    for (const gap of model.w4fr2BlockerDisposition)
      expect(gap).toMatchObject({
        W4FR2_BLOCKER_DISPOSITION: 'SUPERSEDED_BY_W4S_SCOPE_NORMALIZATION',
        UNDERLYING_REPRESENTATION_GAP: 'PRESERVED',
        GAP_RESOLVED: 'NO',
        GAP_ASSIGNED_TO_W4: 'NO',
        W4_REAUTHORING_AUTHORIZED: 'NO',
      })
  })
  it('fails rather than normalizing a gap that overlaps an actual W4 obligation', () => {
    const first = retry.physicalCompletenessBlockers[0]
    const definitions = frozen.definitionObligationLinkage.map((record, index) =>
      index === 0 ? { ...record, PHYSICAL_IDENTITY: first.PHYSICAL_IDENTITY } : record,
    )
    expect(() =>
      verifyGapDisjointness(retry.physicalCompletenessBlockers, parentIds, definitions, frozen),
    ).toThrow('FAIL_SCOPE_CLASSIFICATION_ERROR')
  })
  it('fails missing parent identity or forged governed gap classification', () => {
    const missing = new Set(parentIds)
    missing.delete(retry.physicalCompletenessBlockers[0].PHYSICAL_IDENTITY)
    expect(() =>
      verifyGapDisjointness(
        retry.physicalCompletenessBlockers,
        missing,
        frozen.definitionObligationLinkage,
        frozen,
      ),
    ).toThrow('GAP_NOT_PARENT_OWNED')
    const altered = retry.physicalCompletenessBlockers.map((gap, index) =>
      index === 0
        ? {
            ...gap,
            GOVERNED_W4_COLUMN_RECORD: frozen.relationDefinitions[0].GOVERNED_COLUMN_DEFINITIONS[0],
          }
        : gap,
    )
    expect(() =>
      verifyGapDisjointness(altered, parentIds, frozen.definitionObligationLinkage, frozen),
    ).toThrow('FAIL_SCOPE_CLASSIFICATION_ERROR')
  })
  it('rejects overlapping or unclassified selected columns', () => {
    const rel = frozen.relationDefinitions[0]
    const overlap = {
      ...frozen,
      relationDefinitions: [
        { ...rel, EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED: [rel.ORDERED_COLUMN_SET[0]] },
        ...frozen.relationDefinitions.slice(1),
      ],
    }
    expect(() => classifyContexts(overlap)).toThrow('COLUMN_AUTHORITY_UNCLASSIFIED_OR_OVERLAPPING')
    const unclassified = {
      ...frozen,
      relationDefinitions: [
        { ...rel, ORDERED_COLUMN_SET: [...rel.ORDERED_COLUMN_SET, 'invented'] },
        ...frozen.relationDefinitions.slice(1),
      ],
    }
    expect(() => classifyContexts(unclassified)).toThrow(
      'COLUMN_AUTHORITY_UNCLASSIFIED_OR_OVERLAPPING',
    )
  })
  it('rejects duplicate/lost IDs and missing accepted add-column parent authority', () => {
    expect(() => reconcileResponsibilities(frozen.definitionObligationLinkage.slice(1))).toThrow(
      'OBLIGATION_DENOMINATOR_DRIFT',
    )
    expect(() =>
      reconcileResponsibilities([
        frozen.definitionObligationLinkage[1],
        ...frozen.definitionObligationLinkage.slice(1),
      ]),
    ).toThrow('DUPLICATE_OBLIGATION')
    const changed = frozen.definitionObligationLinkage.map((record) =>
      record.DEFINITION_OPERATION === 'ADD_COLUMN_TO_EXISTING_RELATION'
        ? { ...record, ACCEPTED_PARENT_CREATION_AUTHORITY: null }
        : record,
    )
    expect(() => reconcileResponsibilities(changed)).toThrow()
  })
  it('retains A/A/B selected application shape and case_documents property governance without rewriting it', () => {
    for (const relation of frozen.relationDefinitions) {
      const classified = model.relationContextUniverse.find(
        (context) => context.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID,
      )!
      expect(classified.ORDERED_COLUMN_SET).toEqual(relation.ORDERED_COLUMN_SET)
      expect(classified.SOURCES).toEqual(relation.SOURCES)
      expect(classified.SOURCE_AUTHORITY).toBe(relation.AUTHORITY)
      expect(classified.APPLICATION_BLUEPRINT_IS_MATERIALIZATION_AUTHORIZATION).toBe('NO')
    }
    expect(model.preservation.RELATION_GOVERNANCE_CHANGED).toBe('NO')
    expect(model.w4ObligationUniverse.summary.HYBRID_APPLICATION_BLUEPRINTS_CREATED).toBe(0)
  })
  it('preserves36 type authority/definition records and38 reference identities', () => {
    const types: { typeRecords: unknown[]; referenceLinks: unknown[] } = JSON.parse(
      read(files.types),
    )
    expect(model.preservation.TYPE_DEFINITIONS_SHA256).toBe(digest(types.typeRecords))
    expect(model.preservation.TYPE_REFERENCES_SHA256).toBe(digest(types.referenceLinks))
    expect(model.w4ObligationUniverse.summary).toMatchObject({
      DISTINCT_NAMED_TYPES: 36,
      EXACT_TYPE_DEFINITIONS: 36,
      TYPE_REFERENCES_RESOLVED: 38,
      TYPE_HOLDS: 0,
    })
    expect(model.preservation.TYPE_GOVERNANCE_CHANGED).toBe('NO')
  })
  it('preserves historical W4FR2 and fixed upstream byte hashes', () => {
    for (const [file, hash] of Object.entries(model.preservation.BYTE_COMMITMENTS))
      expect(sha(read(file))).toBe(hash)
    expect(model.preservation.HISTORICAL_W4FR2_BYTES_CHANGED).toBe('NO')
    expect(model.preservation.PRESERVED_SECTIONS).toEqual(retry.preservedSections)
    expect(JSON.parse(read(files.w4fr2)).phaseStatus.PHASE_1B_3C_A1I_W4FR2_GATE).toBe('BLOCKED')
  })
  it('sets the revised183 prerequisite completion contract,not125 full-application relation reproduction', () => {
    expect(model.humanArchitectureDecision).toMatchObject({
      AUTHORITY: 'HUMAN_ARCHITECTURE_W4S',
      W4_PHYSICAL_AUTHORING_SCOPE: 'W4_OWNED_PRECONSUMER_PREREQUISITES_ONLY',
      PLATFORM_BASELINE_DOCTRINE: 'MINIMUM_GOVERNED_PRECONSUMER_PHYSICAL_BASELINE',
      INHERITED_PARENT_GAPS_BLOCK_W4: 'NO',
    })
    expect(model.revisedCompletionContract.PASS_REQUIREMENTS).toMatchObject({
      W4_OBLIGATIONS: 183,
      W4_RELATION_PREREQUISITES: 57,
      W4_COLUMN_PREREQUISITES: 126,
      PARENT_COLUMNS_REAUTHORED: 0,
    })
    expect(
      model.revisedCompletionContract.FULL125_APPLICATION_RELATIONS_AUTHORED_BY_W4_REQUIRED,
    ).toBe('NO')
  })
  it('authorizes W4FR3 without starting it,changing contract,or starting later phases', () => {
    expect(model.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4S_GATE: 'PASS',
      W4FR2_SCOPE_CONTRADICTION: 'CLOSED_BY_GOVERNANCE',
      W4FR3: 'AUTHORIZED_NOT_STARTED',
      W4FR3_STARTED: 'NO',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
    })
    expect(model.w4ObligationUniverse.summary).toMatchObject({ SQL_AUTHORED: 0, SQL_EXECUTED: 0 })
    expect(model.proofBoundaries).toMatchObject({
      PARENT_SCHEMA_RUNTIME_CORRECTNESS_PROVEN: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    })
    expect(model.preservation.COMPATIBILITY_ANALYSIS).toBe('NOT_STARTED')
  })
  it('produces deterministic model while preserving original facts', () => {
    expect(digest(buildScope())).toBe(digest(model))
  })
  it.each(['--execute', '--sql', '--retry', '--publish', '--compatibility', '--discover'])(
    'refuses out-of-scope flag%s',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_W4S_FLAG')
    },
  )
})
