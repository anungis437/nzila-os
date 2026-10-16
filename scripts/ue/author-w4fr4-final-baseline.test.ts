import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildAuthoring,
  columnSql,
  files,
  generate,
  identifier,
  main,
  originalContracts,
  validateSql,
} from './author-w4fr4-final-baseline'
import { digest, read, sha } from './w4-physical-producers'
import type { buildRegeneration } from './regenerate-w4fr-definitions'
import type { buildScope } from './normalize-w4s-authoring-scope'

let model: Awaited<ReturnType<typeof buildAuthoring>>
beforeAll(async () => {
  model = await buildAuthoring()
}, 120000)
const frozen: ReturnType<typeof buildRegeneration>['registry'] = JSON.parse(read(files.resolved))
const scope: ReturnType<typeof buildScope> = JSON.parse(read(files.scope))
const definitions = frozen.definitionObligationLinkage
const relations = definitions.filter((record) => record.DEFINITION_OPERATION === 'CREATE_RELATION')
const included = definitions.filter(
  (record) => record.DEFINITION_OPERATION === 'RELATION_CREATE_INCLUDES_COLUMN',
)
const additions = definitions.filter(
  (record) => record.DEFINITION_OPERATION === 'ADD_COLUMN_TO_EXISTING_RELATION',
)
const column = (identity: string) =>
  frozen.columnDefinitions.find((record) => record.PHYSICAL_IDENTITY === identity)!

describe('W4FR4 exact inactive final baseline', () => {
  it.each(relations)(
    'creates only authorized relation prerequisites:$PHYSICAL_IDENTITY',
    (record) => {
      const payload = model.payloads.RELATION_CREATE_PAYLOADS.find((p) =>
        p.DEFINITION_OBLIGATION_IDS.includes(record.DEFINITION_OBLIGATION_ID),
      )!
      expect(payload).toBeDefined()
      const owned = included.filter(
        (c) => c.RELATION_DEFINITION_ID === record.RELATION_DEFINITION_ID,
      )
      expect(payload.PHYSICAL_IDENTITIES_PRODUCED).toEqual([
        record.PHYSICAL_IDENTITY,
        ...owned.map((c) => c.PHYSICAL_IDENTITY),
      ])
      const names = [...payload.SQL.matchAll(/^\s{2}"([a-z_][a-z0-9_]*)" /gm)].map(
        (match) => match[1],
      )
      expect(names).toEqual(owned.map((c) => column(c.PHYSICAL_IDENTITY).COLUMN_NAME))
      expect(payload.SQL).toMatch(/^CREATE TABLE "public"\./)
      validateSql(payload)
    },
  )
  it.each(included)('materializes included column exactly once:$PHYSICAL_IDENTITY', (record) => {
    const all = [...model.payloads.RELATION_CREATE_PAYLOADS, ...model.payloads.ADD_COLUMN_PAYLOADS]
    const payloads = all.filter((p) =>
      p.PHYSICAL_IDENTITIES_PRODUCED.includes(record.PHYSICAL_IDENTITY),
    )
    expect(payloads).toHaveLength(1)
    expect(payloads[0].PAYLOAD_KIND).toBe('CREATE_RELATION')
    expect(payloads[0].SQL).toContain(columnSql(column(record.PHYSICAL_IDENTITY)))
  })
  it.each(additions)(
    'adds only the governed prerequisite to an existing parent:$PHYSICAL_IDENTITY',
    (record) => {
      const payload = model.payloads.ADD_COLUMN_PAYLOADS.find((p) =>
        p.DEFINITION_OBLIGATION_IDS.includes(record.DEFINITION_OBLIGATION_ID),
      )!
      expect(payload.PHYSICAL_IDENTITIES_PRODUCED).toEqual([record.PHYSICAL_IDENTITY])
      expect(payload.SQL).toMatch(/^ALTER TABLE "public"\./)
      expect(payload.SQL.match(/\bADD COLUMN\b/g)).toHaveLength(1)
      expect(payload.SQL).toContain(columnSql(column(record.PHYSICAL_IDENTITY)))
      expect(record.ACCEPTED_PARENT_CREATION_AUTHORITY?.CREATION_DEFINITION_ESTABLISHED).toBe('YES')
      validateSql(payload)
    },
  )
  const types: {
    typeRecords: {
      CANONICAL_TYPE_IDENTITY: string
      SELECTED: { ORDERED_ENUM_MEMBERS: string[] }
      INACTIVE_TYPE_DESCRIPTOR: { SQL: string }
    }[]
    referenceLinks: unknown[]
  } = JSON.parse(read(files.types))
  it.each(types.typeRecords)(
    'preserves exact inactive type payload:$CANONICAL_TYPE_IDENTITY',
    (record) => {
      const payload = model.payloads.TYPE_PAYLOADS.find(
        (p) => p.CANONICAL_TYPE_IDENTITY === record.CANONICAL_TYPE_IDENTITY,
      )!
      expect(payload.SQL).toBe(record.INACTIVE_TYPE_DESCRIPTOR.SQL)
      expect(payload.EXACT_SELECTED_DEFINITION).toEqual(record.SELECTED)
      expect(payload.DEFINITION_OBLIGATION_IDS).toEqual([])
      validateSql(payload)
    },
  )
  it('accounts separately for all38 contextual dependencies without invented edges', () => {
    expect(model.registry.typeReferences).toHaveLength(38)
    expect(model.report.summary).toMatchObject({
      W4_MATERIALIZED_CONSUMER_TYPE_REFERENCES: 0,
      CONTEXTUAL_NON_W4_TYPE_REFERENCES: 38,
    })
    expect(
      model.registry.typeReferences.every(
        (r) => r.W4_CONSUMER_PAYLOAD_ID === null && r.CONTEXTUAL_TYPE_REFERENCE === 'YES',
      ),
    ).toBe(true)
    expect(
      [...model.payloads.RELATION_CREATE_PAYLOADS, ...model.payloads.ADD_COLUMN_PAYLOADS].every(
        (p) => p.DEPENDENCY_PAYLOAD_IDS.length === 0,
      ),
    ).toBe(true)
  })
  it('links seven exact deferred constraints and preserves all fourteen timing dispositions', () => {
    expect(model.report.deferredConstraintLinkage).toHaveLength(7)
    expect(model.report.historical14BlockerDispositions).toHaveLength(14)
    for (const link of model.report.deferredConstraintLinkage) {
      const p = model.payloads.RELATION_CREATE_PAYLOADS.find(
        (p) => p.PAYLOAD_ID === link.PAYLOAD_ID,
      )!
      expect(p.DEFERRED_CONSTRAINT_HANDOFF_IDS).toContain(
        link.HANDOFF.DEFERRED_CONSTRAINT_HANDOFF_ID,
      )
      expect(link.HANDOFF.MATERIALIZATION_STATUS).toBe('DEFERRED_NOT_EXECUTED')
      expect(link.HANDOFF.CONSTRAINT_SEMANTICS).toBe('PRESERVED')
      expect(p.SQL).not.toMatch(/\bUNIQUE\b/)
      expect(
        link.HANDOFF.SOURCE_W4_OBLIGATION_IDS.every((id) =>
          p.DEFINITION_OBLIGATION_IDS.includes(id),
        ),
      ).toBe(true)
    }
  })
  it('preserves126 explicit materialized columns and all out-of-scope contexts', () => {
    expect(model.registry.columnAuthorityClassification).toEqual(
      scope.columnAuthorityClassification,
    )
    expect(model.registry.relationContexts).toEqual(frozen.relationDefinitions)
    expect(model.registry.inheritedGapDisposition).toEqual(scope.w4fr2BlockerDisposition)
    expect(model.report.summary).toMatchObject({
      RELATION_CONTEXTS_ACCOUNTED: 125,
      SELECTED_COLUMNS_AUTHORITY_CLASSIFIED: 2121,
      PARENT_OWNED_COLUMNS_CONTEXTUAL: 1299,
      PARENT_OWNED_COLUMNS_REAUTHORED: 0,
      INHERITED_PARENT_GAPS: 108,
    })
    const produced = [
      ...model.payloads.RELATION_CREATE_PAYLOADS,
      ...model.payloads.ADD_COLUMN_PAYLOADS,
    ]
      .flatMap((p) => p.PHYSICAL_IDENTITIES_PRODUCED)
      .filter((id) => id.includes('::COLUMN::'))
    expect(produced.sort()).toEqual(
      [...scope.revisedCompletionContract.FUTURE_MATERIALIZATION_COLUMN_IDS].sort(),
    )
    for (const parent of scope.parentOwnedContext)
      expect(produced).not.toContain(parent.PHYSICAL_IDENTITY)
  })
  it('preserves property/provenance and exact183 unique obligation links', () => {
    expect(model.registry.physicalDefinitions.map((d) => d.DEFINITION_OBLIGATION_ID)).toEqual(
      scope.w4ObligationUniverse.EXACT_DEFINITION_OBLIGATION_IDS,
    )
    for (const d of model.registry.physicalDefinitions) {
      const original = definitions.find(
        (r) => r.DEFINITION_OBLIGATION_ID === d.DEFINITION_OBLIGATION_ID,
      )!
      expect(d.CANONICAL_PROPERTIES).toEqual(original.CANONICAL_PROPERTIES)
      expect(d.PROPERTY_PROVENANCE.length).toBeGreaterThan(0)
      expect(d.DEFINITION_STATUS).toBe('COMPLETE')
      expect(d.PAYLOAD_ID).toBeTruthy()
    }
    expect(model.report.summary).toMatchObject({
      TOTAL_INACTIVE_PAYLOADS: 162,
      OBLIGATION_PAYLOAD_LINKS: 183,
      UNLINKED_W4_OBLIGATIONS: 0,
      MULTI_LINKED_W4_OBLIGATIONS: 0,
    })
  })
  it('preserves case_documents text and exact A/A/B blueprint selection context', () => {
    expect(model.registry.blueprintSelections).toEqual(frozen.blueprintSelections)
    for (const name of ['linked_by', 'link_type']) {
      const context = model.registry.relationContexts.find(
        (r) => r.RELATION_NAME === 'case_documents',
      )!
      expect(
        context.GOVERNED_COLUMN_DEFINITIONS.find(
          (c) => c.COLUMN_NAME === name,
        )?.SELECTED_PROPERTIES.find((p) => p.PROPERTY === 'POSTGRES_TYPE')?.VALUE,
      ).toBe('text')
      expect(
        [...model.payloads.RELATION_CREATE_PAYLOADS, ...model.payloads.ADD_COLUMN_PAYLOADS].some(
          (p) =>
            p.PHYSICAL_IDENTITIES_PRODUCED.includes(
              `union-eyes::COLUMN::public.case_documents.${name}`,
            ),
        ),
      ).toBe(false)
    }
  })
  it('integrates183 producer definitions plus36 types and7 nonactivated handoffs', () => {
    const producer: {
      platformProducerRegistry: {
        DEFINITION_OBLIGATION_ID: string
        CANONICAL_DEFINITION_DIGEST: string
        DEFINITION_STATUS: string
        EXECUTION_ALLOWED: string
        MUTATING_OPERATIONS: unknown[]
      }[]
      canonicalDefinitionAuthoring: {
        TYPE_DEFINITION_METADATA: unknown[]
        DEFERRED_CONSTRAINT_METADATA: unknown[]
      }
      phaseStatus: { W4: string }
    } = JSON.parse(model.producerBytes)
    const records = producer.platformProducerRegistry.filter((p) =>
      model.registry.physicalDefinitions.some(
        (d) => d.DEFINITION_OBLIGATION_ID === p.DEFINITION_OBLIGATION_ID,
      ),
    )
    expect(records).toHaveLength(183)
    for (const p of records) {
      const definition = model.registry.physicalDefinitions.find(
        (d) => d.DEFINITION_OBLIGATION_ID === p.DEFINITION_OBLIGATION_ID,
      )!
      expect(p.CANONICAL_DEFINITION_DIGEST).toBe(definition.DEFINITION_DIGEST)
      expect(p.DEFINITION_STATUS).toBe('COMPLETE')
      expect(p.EXECUTION_ALLOWED).toBe('NO')
      expect(p.MUTATING_OPERATIONS).toEqual([])
    }
    expect(producer.canonicalDefinitionAuthoring.TYPE_DEFINITION_METADATA).toHaveLength(36)
    expect(producer.canonicalDefinitionAuthoring.DEFERRED_CONSTRAINT_METADATA).toHaveLength(7)
    expect(producer.phaseStatus.W4).toBe('BLOCKED_ORDERING_COMPATIBILITY_PENDING')
  })
  it('proves exact full version reconstruction and future-only compatibility authorization', () => {
    expect(
      model.report.versionAmendment.VERSION_CHAIN_RECONSTRUCTION.map((v) => v.VERSION),
    ).toEqual(['1.3.2', '1.3.1', '1.3', '1.2', '1.1', '1.0'])
    expect(model.report.versionAmendment.VERSION_1_3_1_SHA256).toBe(
      '6b4c81a8ceded4f70ae59e313656149e9c3246aa0feeee1973062d63ea8c114e',
    )
    expect(model.report.phaseStatus).toMatchObject({
      W4_COMPATIBILITY_GATE_NORMALIZATION: 'AUTHORIZED_NOT_STARTED',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
      CANONICAL_CONTRACT_VERSION: '1.3.2',
    })
    expect(model.report.summary).toMatchObject({
      EXISTING_LATE_PRODUCER_COMPATIBILITY_RECORDS: 127,
      SUPPLEMENTAL_DEFERRED_CONSTRAINT_HANDOFFS: 7,
      EXACT_CORRESPONDENCE_PROVEN: 0,
    })
    expect(model.report.proofBoundaries).toMatchObject({
      PHYSICAL_PRODUCERS_EXECUTED: 'NO',
      DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    })
  })
  it('verifies all upstream bytes through exact inverse reconstruction for amended contracts', async () => {
    const originals = await originalContracts()
    for (const [file, expected] of Object.entries(model.report.preservation.BYTE_COMMITMENTS)) {
      const bytes =
        file === files.canonical
          ? originals.canonicalBytes
          : file === files.producer
            ? originals.producerBytes
            : read(file)
      expect(sha(bytes)).toBe(expected)
    }
  })
  it('is exactly deterministic at model and generated artifact levels', async () => {
    expect(digest(await buildAuthoring())).toBe(digest(model))
    expect(await generate()).toEqual(await generate())
  }, 120000)
  it.each([
    'DROP TABLE "public"."x";',
    'CREATE TABLE x ("x" uuid);',
    'CREATE TABLE "public"."x" ("x" uuid); DELETE FROM x;',
  ])('rejects unsafe or unqualified SQL:%s', (sql) => {
    const payload = {
      ...model.payloads.RELATION_CREATE_PAYLOADS[0],
      SQL: sql,
      SQL_SHA256: sha(sql),
    }
    expect(() => validateSql(payload)).toThrow()
  })
  it('rejects invalid identifiers and unresolved governed types without fallback', () => {
    expect(() => identifier('x"; DROP')).toThrow()
    const c = structuredClone(column(additions[0].PHYSICAL_IDENTITY))
    c.SELECTED_PROPERTIES.find((p) => p.PROPERTY === 'POSTGRES_TYPE')!.VALUE = 'UNRESOLVED'
    expect(() => columnSql(c)).toThrow()
  })
  it.each(['--execute', '--activate', '--discover', '--compatibility', '--deploy'])(
    'rejects forbidden flag:%s',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_W4FR4_FLAG')
    },
  )
})
