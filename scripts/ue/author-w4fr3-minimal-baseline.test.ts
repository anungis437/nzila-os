import { describe, expect, it } from 'vitest'
import { buildAuthoring, constraintColumns, files, main } from './author-w4fr3-minimal-baseline'
import type { buildRegistry } from './author-w4-canonical-definitions'
import { digest, read, sha } from './w4-physical-producers'

const model = buildAuthoring()
const f: Awaited<ReturnType<typeof buildRegistry>> = JSON.parse(read(files.w4f))
const declaration = f.relationDefinitions.find(
  (relation) => relation.RELATION_NAME === 'org_configurations',
)!.DECLARATIONS[0]
describe('W4FR3 exact owned constraint boundary', () => {
  it('blocks exactly seven owned included-column unique requirements,not inherited physical gaps', () => {
    expect(
      model.report.exactOwnedConstraintBlockers.map((blocker) => blocker.RELATION).sort(),
    ).toEqual([
      'public.billing_periods',
      'public.contract_covered_orgs',
      'public.duplicate_group_members',
      'public.member_jurisdiction_preferences',
      'public.org_configurations',
      'public.org_entitlements',
      'public.pilot_checklist_items',
    ])
    expect(model.report.exactBlockedW4ObligationIds).toHaveLength(14)
    expect(model.report.PARENT108_GAPS_BLOCK_AUTHORING).toBe('NO')
    for (const blocker of model.report.exactOwnedConstraintBlockers) {
      expect(blocker.GOVERNED_UNIQUE_PROPERTY.STATUS).toBe('APPROVED')
      expect(blocker.GOVERNED_OBLIGATION_PROPERTY?.VALUE).toBe(
        blocker.GOVERNED_UNIQUE_PROPERTY.VALUE,
      )
      expect(blocker.NONMATERIALIZED_REQUIRED_COLUMN_IDENTITIES.length).toBeGreaterThan(0)
      expect(
        blocker.NONMATERIALIZED_COLUMN_SCOPE_RECORDS.every(
          (record) => record?.W4_DEFINITION_OBLIGATION_ID === null,
        ),
      ).toBe(true)
      expect(blocker.PARENT108_GAP_USED_AS_BLOCKER).toBe('NO')
    }
  })
  it('maps exact org_configurations keys without guessed snake-case transformation', () => {
    expect(
      constraintColumns(
        JSON.stringify(["uniqueIndex('idx').on(table.organizationId,table.category,table.key)"]),
        declaration,
      ),
    ).toEqual(['organization_id', 'category', 'key'])
    expect(
      constraintColumns(JSON.stringify(['UNIQUE(organization_id, category, key)']), declaration),
    ).toEqual(['organization_id', 'category', 'key'])
  })
  it.each([
    JSON.stringify(["uniqueIndex('x').on(table.guessed)"]),
    JSON.stringify(["uniqueIndex('x').on(sql`lower(column)`)"]),
    JSON.stringify(['UNIQUE(invented)']),
    JSON.stringify(['unknown declaration']),
  ])('rejects unsupported/unknown exact constraint references:%s', (value) => {
    expect(() => constraintColumns(value, declaration)).toThrow()
  })
  it('retains183 exact owned IDs and57/57/69 responsibilities without expanding the scope', () => {
    const scope = model.registry.acceptedScope
    const ids = model.registry.definitionObligationLinkage.map(
      (record) => record.DEFINITION_OBLIGATION_ID,
    )
    expect(ids).toEqual(scope.w4ObligationUniverse.EXACT_DEFINITION_OBLIGATION_IDS)
    expect(new Set(ids).size).toBe(183)
    expect(model.report.summary).toMatchObject({
      RELATION_CREATE_RESPONSIBILITIES: 57,
      INCLUDED_COLUMN_RESPONSIBILITIES: 57,
      ADD_COLUMN_RESPONSIBILITIES: 69,
      UNACCOUNTED: 0,
    })
    for (const id of model.report.exactBlockedW4ObligationIds) expect(ids).toContain(id)
  })
  it('demonstrates missing constraint columns are outside the authorized payload column set', () => {
    for (const blocker of model.report.exactOwnedConstraintBlockers)
      for (const identity of blocker.NONMATERIALIZED_REQUIRED_COLUMN_IDENTITIES)
        expect(
          model.registry.acceptedScope.revisedCompletionContract.FUTURE_MATERIALIZATION_COLUMN_IDS,
        ).not.toContain(identity)
    const witness = model.report.exactOwnedConstraintBlockers.find(
      (blocker) => blocker.RELATION === 'public.org_configurations',
    )!
    expect(witness.AUTHORIZED_CREATE_COLUMNS).toEqual(['organization_id'])
    expect(witness.EXACT_CONSTRAINT_COLUMNS).toEqual(['organization_id', 'category', 'key'])
  })
  it('retains36 exact type payloads,38 references and all frozen selected member orders', () => {
    const types: {
      typeRecords: { CANONICAL_TYPE_IDENTITY: string; SELECTED: unknown }[]
      referenceLinks: unknown[]
    } = JSON.parse(read(files.types))
    expect(model.payloads.TYPE_PAYLOADS).toHaveLength(36)
    expect(model.registry.typeReferences).toHaveLength(38)
    for (const payload of model.payloads.TYPE_PAYLOADS) {
      expect(payload.EXACT_SELECTED_DEFINITION).toEqual(
        types.typeRecords.find(
          (type) => type.CANONICAL_TYPE_IDENTITY === payload.CANONICAL_TYPE_IDENTITY,
        )!.SELECTED,
      )
      expect(payload.SQL_STATUS).toBe('DEFINITION_ONLY_NOT_EXECUTABLE')
      expect(payload.EXECUTION_ALLOWED).toBe('NO')
      expect(sha(payload.SQL)).toBe(payload.SQL_SHA256)
    }
  })
  it('does not claim38 physical consumer edges when consumer payloads are withheld', () => {
    expect(
      model.registry.typeReferences.every((reference) => reference.CONSUMER_W4_PAYLOAD_ID === null),
    ).toBe(true)
    expect(
      model.registry.typeReferences.every(
        (reference) => reference.CONSUMER_COLUMN_MATERIALIZED_UNDER_W4S === 'NO',
      ),
    ).toBe(true)
    expect(model.report.summary.TYPE_REFERENCE_DEPENDENCY_EDGES).toBe(0)
    expect(model.report.summary.TYPE_REFERENCES_RESOLVED).toBe(38)
  })
  it('does not omit constraints or emit invalid CREATE TABLE definitions', () => {
    expect(model.payloads.RELATION_CREATE_PAYLOADS).toEqual([])
    expect(model.payloads.ADD_COLUMN_PAYLOADS).toEqual([])
    expect(model.payloads.withheldObligations).toHaveLength(183)
    expect(
      model.registry.definitionObligationLinkage.every(
        (record) => record.PAYLOAD_ID === null && record.DEFINITION_STATUS !== 'COMPLETE',
      ),
    ).toBe(true)
    expect(model.registry.acceptedScope.parentOwnedContext).toHaveLength(1299)
    expect(model.report.summary.PARENT_OWNED_COLUMNS_REAUTHORED).toBe(0)
    expect(model.report.summary.INHERITED108_GAPS_REOPENED).toBe(0)
  })
  it('leaves producer metadata and canonical1.3.1 unchanged on BLOCKED', () => {
    expect(model.report.producerDefinitionMetadataIntegration).toMatchObject({
      STATUS: 'WITHHELD_GATE_BLOCKED',
      UPDATES: [],
      MUTATING_OPERATIONS: [],
      EXECUTION_ALLOWED: 'NO',
    })
    expect(model.report.versionAmendment).toMatchObject({
      VERSION_1_3_1_SHA256: '6b4c81a8ceded4f70ae59e313656149e9c3246aa0feeee1973062d63ea8c114e',
      VERSION_1_3_2_SHA256: null,
      PRIOR_JSON_INVERSE_PATCHES: [],
    })
    expect(model.report.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4FR3_GATE: 'BLOCKED',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      W4_COMPATIBILITY_GATE_NORMALIZATION: 'NOT_AUTHORIZED',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
    })
  })
  it('preserves historical/scope/type/governance/source bytes', () => {
    for (const [file, hash] of Object.entries({
      ...model.report.preservation,
      ...model.report.sourceHashes,
    }))
      expect(sha(read(file))).toBe(hash)
    expect(model.report.W4S_SCOPE_REPRODUCED).toBe('YES')
    expect(model.report.proofBoundaries).toMatchObject({
      PARENT_SCHEMA_RUNTIME_CORRECTNESS_PROVEN: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    })
  })
  it('is deterministic in model representation', () => {
    expect(digest(buildAuthoring())).toBe(digest(model))
  })
  it.each(['--execute', '--publish', '--discover', '--compatibility', '--activate'])(
    'refuses forbidden flag%s',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_W4FR3_FLAG')
    },
  )
})
