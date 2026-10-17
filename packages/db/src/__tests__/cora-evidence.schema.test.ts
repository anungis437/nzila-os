import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  coraConclusionEvidenceRefs,
  coraEvidenceConclusions,
  coraEvidenceRecords,
} from '../schema/cora-evidence'
import { platformMethodologyVersions } from '../schema/methodology'

describe('Cora evidence foundation schema', () => {
  it('keeps evidence and conclusions Cora-owned while methodology history remains shared', () => {
    expect(getTableConfig(platformMethodologyVersions).name).toBe('platform_methodology_versions')
    expect(getTableConfig(coraEvidenceRecords).name).toBe('cora_evidence_records')
    expect(getTableConfig(coraEvidenceConclusions).name).toBe('cora_evidence_conclusions')
    expect(getTableConfig(coraConclusionEvidenceRefs).name).toBe('cora_conclusion_evidence_refs')
  })

  it('requires immutable shared methodology versions and exact evidence references', () => {
    const methodology = getTableConfig(platformMethodologyVersions)
    const evidence = getTableConfig(coraEvidenceRecords)
    const conclusion = getTableConfig(coraEvidenceConclusions)

    expect(
      methodology.indexes.some(
        (index) => index.config.name === 'platform_methodology_authority_version_uidx',
      ),
    ).toBe(true)
    expect(methodology.foreignKeys).toHaveLength(1)
    expect(evidence.foreignKeys).toHaveLength(2)
    expect(conclusion.foreignKeys).toHaveLength(2)
  })

  it('constrains conclusion evidence references to the same organization and exact payload hash', () => {
    const refs = getTableConfig(coraConclusionEvidenceRefs)
    expect(refs.foreignKeys).toHaveLength(2)
    expect(
      refs.indexes.some((index) => index.config.name === 'cora_conclusion_evidence_org_pair_uidx'),
    ).toBe(true)
  })
})
