import { describe, expect, it } from 'vitest'
import {
  buildRegeneration,
  creationOperation,
  files,
  main,
  provenance,
  typeAuthority,
} from './regenerate-w4fr-definitions'
import type { buildGovernance, Selection } from './govern-w4-definition-doctrine'
import type { buildRegistry } from './author-w4-canonical-definitions'
import type { buildProducerContract } from './w4-physical-producers'
import type { buildSelectionRecord } from './record-w4h3-human-selections'
import { digest, read, sha } from './w4-physical-producers'

type Producer = ReturnType<typeof buildProducerContract>
const producer: Producer = JSON.parse(read(files.producer))
const f: Awaited<ReturnType<typeof buildRegistry>> = JSON.parse(read(files.w4f))
const h: Awaited<ReturnType<typeof buildGovernance>> = JSON.parse(read(files.w4h))
const h3: Awaited<ReturnType<typeof buildSelectionRecord>> = JSON.parse(read(files.w4h3))
const selected: Selection = {
  PROPERTY: 'POSTGRES_TYPE',
  VALUE: 'uuid',
  PROVENANCE: 'EXACT_DECLARATION',
  RULE: 'current declaration',
  EVIDENCE_REFERENCES: [],
  STATUS: 'APPROVED',
  RATIONALE: 'fixture',
}
describe('W4FR exact property and production-authority guards', () => {
  it.each([
    ['EXACT_DECLARATION', 'W4H_GOVERNANCE_DECISION'],
    ['EXACT_HISTORICAL_EVIDENCE', 'EXACT_HISTORICAL_DESIGN_EVIDENCE'],
    ['W4H_GOVERNANCE_DEFAULT', 'W4H_GOVERNANCE_DEFAULT'],
    ['W4H_CONFLICT_RESOLUTION', 'W4H_CONFLICT_RESOLUTION'],
  ] as const)('retains explicit %s property provenance', (prior, expected) => {
    expect(provenance({ ...selected, PROVENANCE: prior })).toBe(expected)
  })
  it('recognizes final human architecture column-set authority', () => {
    expect(
      provenance({
        ...selected,
        RULE: 'HUMAN_ARCHITECTURE_W4H3_EXACT_SELECTED_CURRENT_COLUMN_SET',
      }),
    ).toBe('HUMAN_ARCHITECTURE_W4H3')
  })
  it('fails explicitly on unresolved governance without reopening discovery', () => {
    expect(() =>
      provenance({
        ...selected,
        STATUS: 'RESIDUAL_HUMAN_DECISION_REQUIRED',
        VALUE: null,
        PROVENANCE: null,
      }),
    ).toThrow('FAIL_GOVERNANCE_INCOMPLETE')
    expect(() => provenance({ ...selected, VALUE: null })).toThrow('FAIL_GOVERNANCE_INCOMPLETE')
  })
  it('does not treat a pgEnum name as established production authority', () => {
    expect(
      typeAuthority('union-eyes::TYPE::public.committee_meeting_status', producer, []).RESULT,
    ).toBe('NO_RECORDED_TYPE_PRODUCER_AUTHORITY')
  })
  it('accepts an exact governed late identity without authoring it in W4FR', () => {
    const result = typeAuthority(
      'union-eyes::TYPE::public.existing',
      { physicalIdentityAuthority: [] },
      [{ PHYSICAL_IDENTITY: 'union-eyes::TYPE::public.existing', OBJECT_KIND: 'TYPE' }],
    )
    expect(result.RESULT).toBe('RECORDED')
    expect(result.EXECUTION_ALLOWED).toBe('NO')
  })
  it('accepts an exact established producer identity but not a conditional one', () => {
    const authority = structuredClone(producer.physicalIdentityAuthority[0])
    authority.PHYSICAL_IDENTITY = 'union-eyes::TYPE::public.existing'
    expect(
      typeAuthority(authority.PHYSICAL_IDENTITY, { physicalIdentityAuthority: [authority] }, [])
        .RESULT,
    ).toBe('RECORDED')
    authority.CREATION_DEFINITION_ESTABLISHED = 'NO'
    expect(
      typeAuthority(authority.PHYSICAL_IDENTITY, { physicalIdentityAuthority: [authority] }, [])
        .RESULT,
    ).toBe('NO_RECORDED_TYPE_PRODUCER_AUTHORITY')
  })
  it('rejects duplicate exact creation authority', () => {
    const authority = producer.physicalIdentityAuthority[0]
    expect(() =>
      typeAuthority(
        authority.PHYSICAL_IDENTITY,
        { physicalIdentityAuthority: [authority, authority] },
        [],
      ),
    ).toThrow('MULTIPLE_CREATION_AUTHORITIES')
  })
  it('rejects duplicate late type identities', () => {
    const late = { PHYSICAL_IDENTITY: 'union-eyes::TYPE::public.same', OBJECT_KIND: 'TYPE' }
    expect(() =>
      typeAuthority(late.PHYSICAL_IDENTITY, { physicalIdentityAuthority: [] }, [late, late]),
    ).toThrow('MULTIPLE_LATE_TYPE_AUTHORITIES')
  })
  it('classifies create/includes/add using authority not table count', () => {
    expect(creationOperation('RELATION', true, undefined)).toBe('CREATE_RELATION')
    expect(creationOperation('COLUMN', true, undefined)).toBe('RELATION_CREATE_INCLUDES_COLUMN')
    expect(creationOperation('COLUMN', false, producer.physicalIdentityAuthority[0])).toBe(
      'ADD_COLUMN_TO_EXISTING_RELATION',
    )
  })
  it('rejects column additions lacking accepted parent creation', () => {
    expect(() => creationOperation('COLUMN', false, undefined)).toThrow(
      'NO_ACCEPTED_PARENT_CREATION_AUTHORITY',
    )
    expect(() => creationOperation('RELATION', false, undefined)).toThrow(
      'UNKNOWN_DEFINITION_OPERATION',
    )
  })
})
describe('W4FR bounded global fail-closed normalization', () => {
  const model = buildRegeneration()
  it('accounts for all183 exact obligation IDs and57/126 object kinds', () => {
    const records = model.registry.definitionObligationLinkage
    expect(records.map((record) => record.DEFINITION_OBLIGATION_ID).sort()).toEqual(
      f.definitionRecords.map((record) => record.DEFINITION_OBLIGATION_ID).sort(),
    )
    expect(new Set(records.map((record) => record.CANONICAL_DEFINITION_ID)).size).toBe(183)
    expect(records.filter((record) => record.OBJECT_KIND === 'RELATION')).toHaveLength(57)
    expect(records.filter((record) => record.OBJECT_KIND === 'COLUMN')).toHaveLength(126)
  })
  it('preserves all125 relation IDs and exact selected A/A/B ordered columns', () => {
    expect(
      model.registry.relationDefinitions.map((record) => record.RELATION_DEFINITION_ID).sort(),
    ).toEqual(f.relationDefinitions.map((record) => record.RELATION_DEFINITION_ID).sort())
    for (const selected of h3.selectedBlueprints) {
      const blueprint = model.registry.blueprintSelections.find(
        (record) => record.PHYSICAL_IDENTITY === `union-eyes::RELATION::${selected.RELATION}`,
      )!
      expect(blueprint.ORDERED_COLUMN_SET).toEqual(selected.ORDERED_COLUMN_SET)
      expect(blueprint.SOURCES).toEqual(
        selected.EXACT_SELECTED_VARIANT.EQUIVALENT_SOURCE_ALIASES.map((source) => ({
          FILE: source.SOURCE_FILE,
          DIGEST: source.DECLARATION_DIGEST,
          RANGE: source.SOURCE_RANGE,
        })),
      )
    }
  })
  it('does not overwrite authoritative property values or remove provenance', () => {
    for (const record of model.registry.definitionObligationLinkage) {
      const accounting = h3.governanceAccounting.obligationAccounting.find(
        (item) => item.DEFINITION_OBLIGATION_ID === record.DEFINITION_OBLIGATION_ID,
      )!
      expect(digest(record.PROPERTY_PROVENANCE.map((property) => property.GOVERNANCE_RECORD))).toBe(
        accounting.GOVERNED_PROPERTIES_SHA256,
      )
      expect(record.PROPERTY_PROVENANCE.every((property) => property.PROVENANCE)).toBe(true)
    }
  })
  it('preserves case_documents text and physical FK NONE rather than importing callbacks', () => {
    const caseRelation = model.registry.relationDefinitions.find(
      (relation) => relation.RELATION_NAME === 'case_documents',
    )!
    for (const name of ['linked_by', 'link_type']) {
      expect(
        caseRelation.GOVERNED_COLUMN_DEFINITIONS.find(
          (column) => column.COLUMN_NAME === name,
        )!.SELECTED_PROPERTIES.find((property) => property.PROPERTY === 'POSTGRES_TYPE')!.VALUE,
      ).toBe('text')
    }
    for (const selection of h3.threeSelections) {
      const record = model.registry.definitionObligationLinkage.find(
        (record) => record.DEFINITION_OBLIGATION_ID === selection.DEFINITION_OBLIGATION_ID,
      )!
      expect(
        record.CANONICAL_PROPERTIES.find(
          (property) => property.PROPERTY === 'organization_id.FOREIGN_KEY',
        )!.VALUE,
      ).toBe('NONE')
    }
  })
  it('identifies38 exact named references to36 unproduced type identities', () => {
    expect(model.report.dependencyBlockers).toHaveLength(38)
    expect(
      new Set(model.report.dependencyBlockers.map((blocker) => blocker.PHYSICAL_IDENTITY)).size,
    ).toBe(36)
    expect(model.report.summary.AFFECTED_RELATIONS).toBe(28)
    expect(model.report.summary.AFFECTED_OBLIGATIONS).toBe(28)
    for (const blocker of model.report.dependencyBlockers) {
      expect(blocker.GOVERNED_LATE_TYPE_IDENTITY).toBeNull()
      expect(blocker.RECORDED_PRODUCER_AUTHORITY).toBeNull()
      expect(blocker.GOVERNED_VALUE_AND_POSTURE.TYPE_DEPENDENCY_POSTURE).toContain(
        'does not author enum members',
      )
      expect(blocker.GOVERNED_VALUE_AND_POSTURE.VALUE).not.toBe('text')
    }
  })
  it('preserves creation lineage57 creates/57 covered column obligations/69 additions', () => {
    expect(model.report.summary).toMatchObject({
      CREATE_RELATION: 57,
      RELATION_CREATE_INCLUDES_COLUMN: 57,
      ADD_COLUMN_TO_EXISTING_RELATION: 69,
      MULTIPLE_CREATION_AUTHORITIES: 0,
      DUPLICATE_COLUMN_CREATION: 0,
      HYBRID_BLUEPRINTS_CREATED: 0,
    })
    for (const record of model.registry.definitionObligationLinkage.filter(
      (record) => record.DEFINITION_OPERATION === 'ADD_COLUMN_TO_EXISTING_RELATION',
    ))
      expect(record.ACCEPTED_PARENT_CREATION_AUTHORITY!.CREATION_DEFINITION_ESTABLISHED).toBe('YES')
  })
  it('does not invent governable properties for columns owned by existing authority', () => {
    const existing = model.registry.relationDefinitions.filter(
      (relation) => relation.CREATION_CLASS === 'ACCEPTED_EXISTING_RELATION_COLUMN_ADDITIONS',
    )
    expect(existing).toHaveLength(68)
    expect(
      existing.some((relation) => relation.EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED.length > 0),
    ).toBe(true)
    for (const relation of model.registry.relationDefinitions.filter(
      (record) => record.CREATION_CLASS === 'PLATFORM_RELATION_CREATE',
    ))
      expect(
        relation.GOVERNED_COLUMN_DEFINITIONS.map((column) => column.COLUMN_NAME).sort(),
      ).toEqual([...relation.ORDERED_COLUMN_SET].sort())
  })
  it('emits no SQL or falsely successful payload linkage on a blocked preflight', () => {
    expect(model.payloads.payloads).toEqual([])
    expect(model.payloads.obligationPayloadLinkage).toEqual([])
    expect(model.payloads.withheldObligations).toHaveLength(183)
    expect(
      model.registry.definitionObligationLinkage.every(
        (definition) => definition.SQL_PAYLOAD_ID === null,
      ),
    ).toBe(true)
    expect(model.payloads.metadata.EXECUTION_ALLOWED).toBe('NO')
    expect(model.report.summary.CANONICAL_DEFINITION_AUTHORED).toBe(0)
    expect(model.report.summary.RELATIONS_FULLY_DEFINED).toBe(0)
    expect(model.report.validation.SQL_SAFETY_AND_QUALIFICATION).toBe('NOT_RUN_NO_SQL_AUTHORED')
  })
  it('withholds producer integration,version1.3.2 and compatibility authorization', () => {
    expect(model.report.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4FR_GATE: 'BLOCKED',
      W4H: 'PASS',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      VERSION_1_3_2_PUBLISHED: 'NO',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
      W4_COMPATIBILITY_GATE_NORMALIZATION: 'NOT_AUTHORIZED',
    })
    expect(model.report.producerDefinitionMetadataIntegration.UPDATES).toEqual([])
    expect(model.report.versionAmendment.VERSION_1_3_2_SHA256).toBeNull()
    expect(model.report.proofBoundaries.READY_FOR_RUNTIME_PROOF).toBe(0)
  })
  it('preserves exact nine fixed input hashes and all accepted section commitments', () => {
    expect(Object.keys(model.report.preservation).sort()).toEqual(Object.values(files).sort())
    for (const [file, hash] of Object.entries(model.report.preservation))
      expect(sha(read(file))).toBe(hash)
    expect(model.report.preservedSections).toEqual(f.acceptedPreservation)
    expect(model.report.historicalEvidence.W4H).toEqual(h.phaseStatus)
    expect(model.report.historicalEvidence.W4F).toEqual(f.phaseStatus)
  })
  it('records matching registry,relation,column,SQL and producer model digests', () => {
    const again = buildRegeneration()
    expect(digest(again.registry)).toBe(digest(model.registry))
    expect(digest(again.payloads)).toBe(digest(model.payloads))
    expect(again.registry.digests).toEqual(model.registry.digests)
    expect(model.registry.digests.RELATION_DEFINITIONS_SHA256).toBe(
      digest(model.registry.relationDefinitions),
    )
    expect(model.registry.digests.COLUMN_DEFINITIONS_SHA256).toBe(
      digest(model.registry.columnDefinitions),
    )
    expect(model.registry.digests.OBLIGATION_LINKAGE_SHA256).toBe(
      digest(model.registry.definitionObligationLinkage),
    )
    expect(model.registry.digests.SQL_PAYLOADS_SHA256).toBe(digest([]))
    expect(model.registry.digests.PRODUCER_METADATA_SHA256).toBe(sha(read(files.producer)))
  })
  it.each(['--apply', '--execute', '--sql', '--migrate', '--unknown'])(
    'rejects unauthorized flag %s before writes',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_IMPLEMENTATION_OR_UNKNOWN_FLAG')
    },
  )
})
