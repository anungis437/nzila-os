import { describe, it, expect } from 'vitest'
import { RetentionManager } from '../retention'
import type { RetentionPorts, EvidencePackIndex } from '../types'

function createTestPorts(packs: EvidencePackIndex[] = []): RetentionPorts & {
  archived: string[]
  deleted: string[]
} {
  const archived: string[] = []
  const deleted: string[] = []
  return {
    archived,
    deleted,
    loadPack: async (packId) => packs.find((p) => p.packId === packId) ?? null,
    listPacksOlderThan: async () => packs,
    archivePack: async (packId) => { archived.push(packId) },
    deletePack: async (packId) => { deleted.push(packId) },
  }
}

describe('RetentionManager', () => {
  it('should retain packs within retention period', () => {
    const ports = createTestPorts()
    const manager = new RetentionManager(ports)
    const result = manager.evaluatePack('PACK-1', new Date().toISOString(), 'standard')
    expect(result.action).toBe('retained')
    expect(result.reason).toContain('Within retention period')
  })

  it('should mark expired standard packs for deletion', () => {
    const ports = createTestPorts()
    const manager = new RetentionManager(ports)
    const twoYearsAgo = new Date(Date.now() - 365 * 2 * 24 * 60 * 60 * 1000).toISOString()
    const result = manager.evaluatePack('PACK-2', twoYearsAgo, 'standard')
    expect(result.action).toBe('deleted')
  })

  it('should mark expired extended packs for archive (not delete)', () => {
    const ports = createTestPorts()
    const manager = new RetentionManager(ports)
    const fiveYearsAgo = new Date(Date.now() - 365 * 5 * 24 * 60 * 60 * 1000).toISOString()
    const result = manager.evaluatePack('PACK-3', fiveYearsAgo, 'extended')
    expect(result.action).toBe('archived')
  })

  it('should never expire permanent packs', () => {
    const ports = createTestPorts()
    const manager = new RetentionManager(ports)
    const ancientDate = new Date('2010-01-01').toISOString()
    const result = manager.evaluatePack('PACK-PERM', ancientDate, 'permanent')
    expect(result.action).toBe('retained')
    expect(result.reason).toContain('Permanent')
  })

  it('should get policy by class', () => {
    const ports = createTestPorts()
    const manager = new RetentionManager(ports)
    const policy = manager.getPolicy('regulatory')
    expect(policy.retentionDays).toBe(365 * 7)
    expect(policy.autoArchive).toBe(true)
    expect(policy.autoDelete).toBe(false)
  })

  it('should process expired packs', async () => {
    const oldPack = {
      packId: 'OLD-PACK',
      orgId: 'org-1',
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-OLD',
      runId: 'run-1',
      createdBy: 'test',
      createdAt: new Date(Date.now() - 365 * 2 * 24 * 60 * 60 * 1000).toISOString(),
      summary: 'Old pack',
      controlsCovered: [],
      artifacts: [],
    } as EvidencePackIndex

    const ports = createTestPorts([oldPack])
    const manager = new RetentionManager(ports)

    const results = await manager.processExpired('standard')
    expect(results.length).toBe(1)
    expect(results[0]!.action).toBe('deleted')
    expect(ports.deleted).toContain('OLD-PACK')
  })

  it('should skip processing for permanent retention', async () => {
    const ports = createTestPorts()
    const manager = new RetentionManager(ports)
    const results = await manager.processExpired('permanent')
    expect(results.length).toBe(0)
  })

  it('should return skipped when retention expires without auto actions', () => {
    const ports = createTestPorts()
    const manager = new RetentionManager(ports, {
      standard: {
        retentionClass: 'standard',
        retentionDays: 1,
        autoArchive: false,
        autoDelete: false,
      },
    })

    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const result = manager.evaluatePack('PACK-SKIP', oldDate, 'standard')

    expect(result.action).toBe('skipped')
  })

  it('should archive expired packs for extended retention', async () => {
    const oldPack = {
      packId: 'OLD-EXTENDED',
      orgId: 'org-1',
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-OLD-EXT',
      runId: 'run-1',
      createdBy: 'test',
      createdAt: new Date(Date.now() - 365 * 5 * 24 * 60 * 60 * 1000).toISOString(),
      summary: 'Old extended pack',
      controlsCovered: [],
      artifacts: [],
    } as EvidencePackIndex

    const ports = createTestPorts([oldPack])
    const manager = new RetentionManager(ports)

    const results = await manager.processExpired('extended')

    expect(results).toHaveLength(1)
    expect(results[0]!.action).toBe('archived')
    expect(ports.archived).toContain('OLD-EXTENDED')
  })

  it('should keep expired packs unchanged when policy has no auto actions', async () => {
    const oldPack = {
      packId: 'OLD-NO-ACTION',
      orgId: 'org-1',
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-OLD-NO-ACTION',
      runId: 'run-1',
      createdBy: 'test',
      createdAt: new Date(Date.now() - 365 * 2 * 24 * 60 * 60 * 1000).toISOString(),
      summary: 'Old no action pack',
      controlsCovered: [],
      artifacts: [],
    } as EvidencePackIndex

    const ports = createTestPorts([oldPack])
    const manager = new RetentionManager(ports, {
      standard: {
        retentionClass: 'standard',
        retentionDays: 1,
        autoArchive: false,
        autoDelete: false,
      },
    })

    const results = await manager.processExpired('standard')

    expect(results).toHaveLength(1)
    expect(results[0]!.action).toBe('skipped')
    expect(ports.archived).toHaveLength(0)
    expect(ports.deleted).toHaveLength(0)
  })
})
