import { describe, expect, it } from 'vitest'
import {
  buildRetry,
  files,
  main,
  physicalRepresentationGap,
  selectedDeclaration,
  validateTypeSql,
} from './regenerate-w4fr2-definitions'
import { digest, read, sha } from './w4-physical-producers'
import type { buildRegistry } from './author-w4-canonical-definitions'
import type { buildRegeneration } from './regenerate-w4fr-definitions'

type F = Awaited<ReturnType<typeof buildRegistry>>
const f: F = JSON.parse(read(files.w4f))
const frozen: ReturnType<typeof buildRegeneration>['registry'] = JSON.parse(read(files.resolved))
describe('W4FR2 exact fixed-input completeness preflight', () => {
  const model = buildRetry()
  it('preserves the exact183 IDs and57/126 partition without new obligations', () => {
    expect(
      model.registry.definitionObligationLinkage
        .map((record) => record.DEFINITION_OBLIGATION_ID)
        .sort(),
    ).toEqual(f.definitionRecords.map((record) => record.DEFINITION_OBLIGATION_ID).sort())
    expect(model.report.summary).toMatchObject({
      DEFINITION_OBLIGATIONS_INPUT: 183,
      RELATION_OBLIGATIONS: 57,
      COLUMN_OBLIGATIONS: 126,
      UNACCOUNTED: 0,
    })
  })
  it('retains all125 selected shapes and822 governed columns without merging parent authority', () => {
    expect(model.registry.governedDesignRegistry).toEqual(frozen)
    expect(model.registry.relationCompletenessPreflight).toHaveLength(125)
    expect(model.report.summary).toMatchObject({
      GOVERNED_COLUMNS_RETAINED: 822,
      EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED: 1299,
      RELATIONS_WITH_RECORDED_REPRESENTATION_GAP: 26,
      OTHER_RELATIONS_NOT_FULLY_LOWERED_OR_CLAIMED: 99,
    })
    for (const relation of model.registry.governedDesignRegistry.relationDefinitions)
      for (const column of relation.GOVERNED_COLUMN_DEFINITIONS)
        for (const property of column.SELECTED_PROPERTIES) expect(property.STATUS).toBe('APPROVED')
  })
  it('records exactly108 inherited non-enum representation gaps from frozen selected evidence', () => {
    const blockers = model.report.physicalCompletenessBlockers
    expect(blockers).toHaveLength(108)
    expect(new Set(blockers.map((record) => record.BLOCKER_ID)).size).toBe(108)
    expect(
      blockers.filter((record) =>
        record.FROZEN_PHYSICAL_TYPE_FACT.EVIDENCE.startsWith('Timestamp'),
      ),
    ).toHaveLength(94)
    expect(
      blockers.filter((record) => record.FROZEN_PHYSICAL_TYPE_FACT.EVIDENCE.startsWith('Numeric')),
    ).toHaveLength(13)
    expect(
      blockers.filter((record) =>
        record.FROZEN_PHYSICAL_TYPE_FACT.EVIDENCE.startsWith('Character'),
      ),
    ).toHaveLength(1)
    expect(blockers.every((record) => record.GOVERNED_W4_COLUMN_RECORD === null)).toBe(true)
    expect(
      blockers.every(
        (record) => record.PRIOR_AUTHORITY_BOUNDARY === 'EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED',
      ),
    ).toBe(true)
    expect(model.report.summary.DESIGN_DECISION_REQUIRED).toBe(0)
  })
  it('does not invent representation decisions for the accepted W4H3 clc_sync_log B shape', () => {
    const witness = model.report.physicalCompletenessBlockers.filter(
      (record) => record.RELATION === 'public.clc_sync_log',
    )
    expect(witness.map((record) => record.COLUMN)).toEqual([
      'sync_start_date',
      'sync_end_date',
      'data_hash',
      'verified_at',
      'created_at',
      'updated_at',
    ])
    expect(
      witness.every((record) => record.SELECTED_BLUEPRINT_AUTHORITY === 'HUMAN_ARCHITECTURE_W4H3'),
    ).toBe(true)
    const preflight = model.registry.relationCompletenessPreflight.find(
      (record) => record.RELATION === 'public.clc_sync_log',
    )!
    expect(preflight.SELECTED_COLUMN_COUNT).toBe(23)
    expect(preflight.GOVERNED_COLUMN_COUNT).toBe(1)
    expect(preflight.EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED).toHaveLength(22)
  })
  it('retains accepted A/A/B exact selected declaration identities and ordered column sets', () => {
    const h3: {
      selectedBlueprints: {
        RELATION: string
        SOURCE_FILE: string
        DECLARATION_DIGEST: string
        ORDERED_COLUMN_SET: string[]
      }[]
    } = JSON.parse(read(files.w4h3))
    for (const selected of h3.selectedBlueprints) {
      const relation = frozen.relationDefinitions.find(
        (record) => `public.${record.RELATION_NAME}` === selected.RELATION,
      )!
      const original = f.relationDefinitions.find(
        (record) => record.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID,
      )!
      const declaration = selectedDeclaration(relation, original.DECLARATIONS)
      expect(declaration.REFERENCE.FILE).toBe(selected.SOURCE_FILE)
      expect(declaration.REFERENCE.DIGEST).toBe(selected.DECLARATION_DIGEST)
      expect(relation.ORDERED_COLUMN_SET).toEqual(selected.ORDERED_COLUMN_SET)
    }
  })
  it('does not turn inherited enum references into a new named-type universe or reopen ownership', () => {
    expect(model.registry.typeDefinitions).toHaveLength(36)
    expect(model.registry.typeReferences).toHaveLength(38)
    expect(
      model.report.physicalCompletenessBlockers.some((record) =>
        record.FROZEN_PHYSICAL_TYPE_FACT.EVIDENCE.startsWith('References existing enum'),
      ),
    ).toBe(false)
    expect(
      model.report.physicalCompletenessBlockers.every(
        (record) => record.INHERITED_ENUM_GOVERNANCE_REOPENED === 'NO',
      ),
    ).toBe(true)
  })
  it('copies36 exact type selections and inactive SQL;preserves four CURRENT orders and32 prior records', () => {
    const types: {
      typeRecords: {
        CANONICAL_TYPE_IDENTITY: string
        SELECTED: unknown
        INACTIVE_TYPE_DESCRIPTOR: { SQL: string }
      }[]
    } = JSON.parse(read(files.types))
    for (const type of model.registry.typeDefinitions) {
      const prior = types.typeRecords.find(
        (record) => record.CANONICAL_TYPE_IDENTITY === type.CANONICAL_TYPE_IDENTITY,
      )!
      expect(type.SELECTED_DEFINITION).toEqual(prior.SELECTED)
      expect(type.SQL).toBe(prior.INACTIVE_TYPE_DESCRIPTOR.SQL)
      expect(type.TYPE_OWNERSHIP_AUTHORITY).toBe('HUMAN_GOVERNANCE_W4T')
      expect(type.DEFINITION_STATUS).toBe('COMPLETE')
      expect(type.TYPE_DEFINITION_DIGEST).toBe(sha(type.SELECTED_DEFINITION.EXACT_DEFINITION_TEXT))
    }
    expect(
      model.registry.typeDefinitions.filter(
        (record) => record.TYPE_DEFINITION_AUTHORITY === 'HUMAN_ARCHITECTURE_W4T1',
      ),
    ).toHaveLength(4)
  })
  it('resolves exact38 consumer identities and source obligation links with explicit type provenance', () => {
    const fr: {
      dependencyBlockers: {
        RELATION: string
        COLUMN: string
        GOVERNED_TYPE_NAME: string
        AFFECTED_DEFINITION_OBLIGATION_IDS: string[]
      }[]
    } = JSON.parse(read(files.w4fr))
    expect(
      model.registry.typeReferences.map((record) => ({
        RELATION: record.CONSUMER_RELATION,
        COLUMN: record.CONSUMER_COLUMN,
        GOVERNED_TYPE_NAME: record.GOVERNED_TYPE_NAME,
        AFFECTED_DEFINITION_OBLIGATION_IDS: record.SOURCE_W4_DEFINITION_OBLIGATION_IDS,
      })),
    ).toEqual(
      fr.dependencyBlockers.map((record) => ({
        RELATION: record.RELATION,
        COLUMN: record.COLUMN,
        GOVERNED_TYPE_NAME: record.GOVERNED_TYPE_NAME,
        AFFECTED_DEFINITION_OBLIGATION_IDS: record.AFFECTED_DEFINITION_OBLIGATION_IDS,
      })),
    )
    for (const reference of model.registry.typeReferences) {
      expect(reference.TYPE_KIND).toBe('ENUM')
      expect(reference.TYPE_DEFINITION_AUTHORITY).toBeTruthy()
      expect(reference.TYPE_DEFINITION_DIGEST).toBeTruthy()
      expect(reference.TYPE_REGISTRY_REFERENCE.FILE).toBe(files.types)
    }
  })
  it('records38 type-before-consumer requirements without pretending a complete payload graph exists', () => {
    for (const reference of model.payloads.typeBeforeConsumerRequirements) {
      expect(
        model.payloads.TYPE_PAYLOADS.some(
          (payload) => payload.PAYLOAD_ID === reference.DEPENDENCY_TYPE_PAYLOAD_ID,
        ),
      ).toBe(true)
      expect(reference.CONSUMER_PAYLOAD_ID).toBeNull()
      expect(reference.W5_EXECUTION_ORDER_AUTHORIZATION).toBe('NO')
    }
    expect(model.report.summary.COMPLETE_CONSUMER_PAYLOAD_DEPENDENCY_EDGES).toBe(0)
  })
  it('retains57/57/69 creation-vs-alteration lineage without duplicate SQL creation', () => {
    expect(model.report.summary).toMatchObject({
      CREATE_RELATION_RESPONSIBILITIES: 57,
      RELATION_CREATE_INCLUDES_COLUMN: 57,
      FUTURE_ADD_COLUMN_RESPONSIBILITIES: 69,
      DUPLICATE_COLUMN_CREATION: 0,
    })
    for (const definition of model.registry.definitionObligationLinkage) {
      const prior = frozen.definitionObligationLinkage.find(
        (record) => record.DEFINITION_OBLIGATION_ID === definition.DEFINITION_OBLIGATION_ID,
      )!
      expect(definition.DEFINITION_OPERATION).toBe(prior.DEFINITION_OPERATION)
      expect(definition.ACCEPTED_PARENT_CREATION_AUTHORITY).toEqual(
        prior.ACCEPTED_PARENT_CREATION_AUTHORITY,
      )
    }
  })
  it('withholds all183 relation/column payloads and never labels them COMPLETE', () => {
    expect(model.payloads.RELATION_CREATE_PAYLOADS).toEqual([])
    expect(model.payloads.COLUMN_ADD_PAYLOADS).toEqual([])
    expect(model.payloads.withheldObligations).toHaveLength(183)
    expect(
      new Set(model.payloads.withheldObligations.map((record) => record.DEFINITION_OBLIGATION_ID))
        .size,
    ).toBe(183)
    expect(
      model.registry.definitionObligationLinkage.every(
        (record) => record.SQL_PAYLOAD_ID === null && record.DEFINITION_STATUS !== 'COMPLETE',
      ),
    ).toBe(true)
    expect(model.report.summary.CANONICAL_DEFINITION_AUTHORED).toBe(0)
  })
  it('has36 unique explicitly qualified deterministic nonexecutable type payloads only', () => {
    expect(model.payloads.TYPE_PAYLOADS).toHaveLength(36)
    expect(
      new Set(model.payloads.TYPE_PAYLOADS.flatMap((record) => record.PHYSICAL_IDENTITIES_PRODUCED))
        .size,
    ).toBe(36)
    for (const payload of model.payloads.TYPE_PAYLOADS) {
      expect(() => validateTypeSql(payload.SQL)).not.toThrow()
      expect(payload.SQL_SHA256).toBe(sha(payload.SQL))
      expect(payload.SQL_STATUS).toBe('DEFINITION_ONLY_NOT_EXECUTABLE')
      expect(payload.EXECUTION_ALLOWED).toBe('NO')
    }
  })
  it('does not activate producer metadata or publish1.3.2 before full physical PASS', () => {
    expect(model.report.producerDefinitionMetadataIntegration).toMatchObject({
      STATUS: 'NOT_PERFORMED_GATE_BLOCKED',
      UPDATES: [],
      MUTATING_OPERATIONS: [],
      EXECUTION_ALLOWED: 'NO',
    })
    expect(model.report.versionAmendment).toMatchObject({
      STATUS: 'NOT_PERFORMED_GATE_BLOCKED',
      VERSION_1_3_2_SHA256: null,
      PRIOR_JSON_INVERSE_PATCHES: [],
    })
    expect(model.report.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4FR2_GATE: 'BLOCKED',
      DO_NOT_PERFORM_NEW_DISCOVERY: 'YES',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
      W4_COMPATIBILITY_GATE_NORMALIZATION: 'NOT_AUTHORIZED',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
    })
  })
  it('retains case_documents text resolution and no governance override', () => {
    const relation = model.registry.governedDesignRegistry.relationDefinitions.find(
      (record) => record.RELATION_NAME === 'case_documents',
    )!
    for (const name of ['linked_by', 'link_type'])
      expect(
        relation.GOVERNED_COLUMN_DEFINITIONS.find(
          (record) => record.COLUMN_NAME === name,
        )?.SELECTED_PROPERTIES.find((property) => property.PROPERTY === 'POSTGRES_TYPE')?.VALUE,
      ).toBe('text')
  })
  it('preserves fixed upstream,historical and exact selected-source hashes', () => {
    for (const [file, hash] of Object.entries({
      ...model.report.preservation,
      ...model.report.sourceHashes,
    }))
      expect(sha(read(file))).toBe(hash)
    expect(model.report.versionAmendment.VERSION_1_3_1_SHA256).toBe(
      '6b4c81a8ceded4f70ae59e313656149e9c3246aa0feeee1973062d63ea8c114e',
    )
    expect(model.report.historicalEvidence.HISTORICAL_W4FR_BYTES_CHANGED).toBe('NO')
  })
  it('keeps all no-runtime proof boundaries intact', () => {
    expect(model.report.proofBoundaries).toMatchObject({
      NAMED_TYPES_MATERIALIZED: 'NO',
      TYPE_SQL_EXECUTED: 'NO',
      CANONICAL_DEFINITION_SQL_EXECUTED: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    })
  })
  it('reproduces the exact model/digests without repeated expensive byte formatting', () => {
    expect(digest(buildRetry())).toBe(digest(model))
  })
})
describe('W4FR2 no-default/no-discovery and SQL boundaries', () => {
  it.each([
    'Timestamp timezone semantics not explicitly established; no preferred timezone inferred',
    'Numeric precision/scale or unconstrained representation requires explicit adoption',
    'Character length/unbounded choice not explicitly established',
  ])('recognizes frozen representation gap without choosing a value:%s', (evidence) => {
    expect(
      physicalRepresentationGap({ STATE: 'UNRESOLVED', VALUE: null, EVIDENCE: evidence }),
    ).toBe(true)
  })
  it('does not classify existing enum references or explicit accepted types as new physical governance', () => {
    expect(
      physicalRepresentationGap({
        STATE: 'UNRESOLVED',
        VALUE: null,
        EVIDENCE: 'References existing enum declaration unrelated_type',
      }),
    ).toBe(false)
    expect(physicalRepresentationGap({ STATE: 'EXPLICIT', VALUE: 'text', EVIDENCE: 'exact' })).toBe(
      false,
    )
  })
  it('rejects selected blueprint order drift and mixed-column schemas', () => {
    const relation = frozen.relationDefinitions[0]
    const original = f.relationDefinitions.find(
      (record) => record.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID,
    )!
    expect(() =>
      selectedDeclaration(
        { ...relation, ORDERED_COLUMN_SET: [...relation.ORDERED_COLUMN_SET].reverse() },
        original.DECLARATIONS,
      ),
    ).toThrow('BLUEPRINT_ORDER_DRIFT')
    expect(() =>
      selectedDeclaration(
        { ...relation, ORDERED_COLUMN_SET: [...relation.ORDERED_COLUMN_SET, 'invented'] },
        original.DECLARATIONS,
      ),
    ).toThrow('NO_EXACT_SELECTED_BLUEPRINT')
  })
  it.each([
    "CREATE TYPE status AS ENUM ('a');",
    'CREATE TYPE "public"."status" AS ENUM (\'a\'); DROP TABLE public.users;',
    'CREATE TYPE IF NOT EXISTS "public"."status" AS ENUM (\'a\');',
    'CREATE ROLE actor;',
    'CREATE EXTENSION vector;',
    'INSERT INTO public.x VALUES (1);',
  ])('rejects unsafe/unqualified/tolerance SQL:%s', (sql) => {
    expect(() => validateTypeSql(sql)).toThrow()
  })
  it('does not confuse member text with unsafe SQL operations', () => {
    expect(() =>
      validateTypeSql(`CREATE TYPE "public"."status" AS ENUM ('DROP', 'DELETE', 'UPDATE');`),
    ).not.toThrow()
  })
  it.each(['--execute', '--publish', '--discover', '--activate', '--compatibility'])(
    'rejects unauthorized flag%s',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_W4FR2_FLAG')
    },
  )
})
