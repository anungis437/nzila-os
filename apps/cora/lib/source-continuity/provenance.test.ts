import { describe, expect, it } from 'vitest'
import { createCaptureProvenance } from './provenance'
import { buildSyntheticRouteFixture } from './fixtures/synthetic-routes'

describe('source continuity provenance', () => {
  it('keeps source issuer attribution distinct from the acquisition intermediary', () => {
    const { capture } = buildSyntheticRouteFixture('AGGREGATED_CONNECTOR')
    const edges = createCaptureProvenance(capture)
    expect(edges.find((edge) => edge.relation === 'ASSERTED_BY')).toMatchObject({
      sourceAuthorityId: 'synthetic-certifier-001',
      sourceProviderId: 'synthetic-certification-source',
      acquisitionChannel: 'AGGREGATED_CONNECTOR',
    })
    expect(edges.find((edge) => edge.relation === 'ACQUIRED_VIA')?.toRef).toBe(
      'synthetic-aggregator',
    )
  })
})
