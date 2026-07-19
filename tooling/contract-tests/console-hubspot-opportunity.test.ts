/**
 * Contract Test — Console HubSpot Opportunity Seed
 *
 * Ensures the console workspace keeps only the single CUPE4373 HubSpot
 * opportunity while the broader demo seed set stays out of the console sales
 * surface.
 */
import { describe, expect, it } from 'vitest'
import { hubspotOpportunitySeed } from '../../apps/console/app/(dashboard)/workspace/_lib/hubspot-opportunity'

describe('CONSOLE-HUBSPOT-001 — single HubSpot opportunity seed', () => {
  it('keeps exactly one opportunity in the console seed', () => {
    expect(hubspotOpportunitySeed).toHaveLength(1)
    expect(hubspotOpportunitySeed[0]).toMatchObject({
      accountName: 'CUPE 4373',
      source: 'hubspot',
      stage: 'demo_completed',
      product: 'union-eyes',
    })
  })
})