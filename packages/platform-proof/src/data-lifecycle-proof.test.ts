import { describe, it, expect } from 'vitest'
import {
  generateDataLifecycleProofSection,
  type DataLifecycleProofPorts,
} from './data-lifecycle-proof'

function makePorts(overrides?: Partial<DataLifecycleProofPorts>): DataLifecycleProofPorts {
  return {
    fetchManifestSummaries: async () => [
      {
        appId: 'app-a',
        appName: 'App A',
        version: '1.0.0',
        dataCategoryCount: 3,
        containsPii: true,
        containsFinancial: false,
        highestRetentionClass: 'standard',
        residencyType: 'single_region',
        residencyRegions: ['canadacentral'],
        backupFrequency: 'daily',
        rtoHours: 4,
        rpoHours: 1,
        manifestHash: 'hash-a',
      },
      {
        appId: 'app-b',
        appName: 'App B',
        version: '2.0.0',
        dataCategoryCount: 2,
        containsPii: false,
        containsFinancial: true,
        highestRetentionClass: 'strict',
        residencyType: 'multi_region',
        residencyRegions: ['canadacentral', 'eastus2'],
        backupFrequency: 'hourly',
        rtoHours: 2,
        rpoHours: 1,
        manifestHash: 'hash-b',
      },
    ],
    fetchAllAppIds: async () => ['app-a', 'app-b'],
    ...overrides,
  }
}

describe('generateDataLifecycleProofSection', () => {
  it('returns an all-compliant section when all app ids have manifests', async () => {
    const section = await generateDataLifecycleProofSection(makePorts())

    expect(section.sectionType).toBe('data_lifecycle')
    expect(section.totalAppsWithManifests).toBe(2)
    expect(section.totalAppsMissingManifests).toBe(0)
    expect(section.allAppsCompliant).toBe(true)
    expect(section.missingApps).toEqual([])
    expect(section.signatureHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('marks missing apps and non-compliant status when manifests are absent', async () => {
    const section = await generateDataLifecycleProofSection(
      makePorts({ fetchAllAppIds: async () => ['app-a', 'app-b', 'app-c'] }),
    )

    expect(section.totalAppsWithManifests).toBe(2)
    expect(section.totalAppsMissingManifests).toBe(1)
    expect(section.missingApps).toEqual(['app-c'])
    expect(section.allAppsCompliant).toBe(false)
  })
})
