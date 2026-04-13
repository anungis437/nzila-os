import { describe, it, expect, beforeEach } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { EvidencePackOrchestrator } from '../orchestrator'
import type { EvidencePackIndex, OrchestratorPorts } from '../types'

function makeArtifact(id: string) {
  const content = `artifact-content-${id}`
  const sha256 = createHash('sha256').update(content).digest('hex')
  return {
    artifactId: id,
    artifactType: 'document',
    sha256,
    sizeBytes: content.length,
    mimeType: 'text/plain',
    blobPath: `/evidence/${id}.txt`,
    collectedAt: new Date().toISOString(),
    metadata: { source: 'test' },
  }
}

function createTestPorts(): OrchestratorPorts & { store: Map<string, EvidencePackIndex>; statuses: Map<string, string> } {
  const store = new Map<string, EvidencePackIndex>()
  const statuses = new Map<string, string>()
  return {
    store,
    statuses,
    savePack: async (pack) => { store.set(pack.packId, pack) },
    loadPack: async (packId) => store.get(packId) ?? null,
    listPacks: async (orgId) => [...store.values()].filter((p) => p.orgId === orgId),
    updateStatus: async (packId, status) => { statuses.set(packId, status) },
  }
}

describe('EvidencePackOrchestrator', () => {
  let orchestrator: EvidencePackOrchestrator
  let ports: ReturnType<typeof createTestPorts>

  const orgId = randomUUID()
  const createdBy = 'test-user'

  beforeEach(() => {
    ports = createTestPorts()
    orchestrator = new EvidencePackOrchestrator(ports)
  })

  it('should create a pack with artifacts', async () => {
    const pack = await orchestrator.createPack({
      orgId,
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-001',
      summary: 'Incident resolution evidence',
      controlsCovered: ['IR-01', 'IR-02'],
      artifacts: [makeArtifact('postmortem'), makeArtifact('audit-trail')],
      createdBy,
    })

    expect(pack.packId).toBeDefined()
    expect(pack.orgId).toBe(orgId)
    expect(pack.artifacts.length).toBe(2)
    expect(pack.controlsCovered).toContain('IR-01')
    expect(ports.store.has(pack.packId)).toBe(true)
  })

  it('should use custom pack ID when provided', async () => {
    const pack = await orchestrator.createPack({
      orgId,
      controlFamily: 'CM',
      eventType: 'change.approved',
      eventId: 'CHG-002',
      summary: 'Change management evidence',
      controlsCovered: ['CM-01'],
      artifacts: [makeArtifact('approval')],
      createdBy,
      packId: 'CUSTOM-PACK-001',
    })

    expect(pack.packId).toBe('CUSTOM-PACK-001')
  })

  it('should seal a pack with cryptographic integrity', async () => {
    const pack = await orchestrator.createPack({
      orgId,
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-003',
      summary: 'Test seal',
      controlsCovered: ['IR-01'],
      artifacts: [makeArtifact('evidence-a'), makeArtifact('evidence-b')],
      createdBy,
    })

    const sealed = await orchestrator.sealPack(pack.packId)
    expect(sealed.seal).toBeDefined()
    expect(sealed.seal!.sealVersion).toBe('1.0')
    expect(sealed.seal!.algorithm).toBe('sha256')
    expect(sealed.seal!.packDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(sealed.seal!.artifactsMerkleRoot).toMatch(/^[a-f0-9]{64}$/)
    expect(sealed.seal!.artifactCount).toBe(2)
    expect(ports.statuses.get(pack.packId)).toBe('sealed')
  })

  it('should throw when sealing non-existent pack', async () => {
    await expect(orchestrator.sealPack('nonexistent')).rejects.toThrow('not found')
  })

  it('should throw when sealing already sealed pack', async () => {
    const pack = await orchestrator.createPack({
      orgId,
      controlFamily: 'AC',
      eventType: 'access.reviewed',
      eventId: 'AC-001',
      summary: 'Already sealed test',
      controlsCovered: ['AC-01'],
      artifacts: [makeArtifact('review')],
      createdBy,
    })

    await orchestrator.sealPack(pack.packId)
    await expect(orchestrator.sealPack(pack.packId)).rejects.toThrow('already sealed')
  })

  it('should list packs by org', async () => {
    const otherOrg = randomUUID()
    await orchestrator.createPack({
      orgId,
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-A',
      summary: 'A',
      controlsCovered: [],
      artifacts: [makeArtifact('a')],
      createdBy,
    })
    await orchestrator.createPack({
      orgId: otherOrg,
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-B',
      summary: 'B',
      controlsCovered: [],
      artifacts: [makeArtifact('b')],
      createdBy,
    })

    const packs = await orchestrator.listPacks(orgId)
    expect(packs.length).toBe(1)
    expect(packs[0]!.orgId).toBe(orgId)
  })

  it('should get a pack by ID', async () => {
    const pack = await orchestrator.createPack({
      orgId,
      controlFamily: 'CM',
      eventType: 'change.approved',
      eventId: 'CHG-003',
      summary: 'Get test',
      controlsCovered: [],
      artifacts: [makeArtifact('doc')],
      createdBy,
    })

    const loaded = await orchestrator.getPack(pack.packId)
    expect(loaded).toBeDefined()
    expect(loaded!.packId).toBe(pack.packId)
  })

  it('should return null for non-existent pack', async () => {
    const loaded = await orchestrator.getPack('does-not-exist')
    expect(loaded).toBeNull()
  })

  it('should allow explicit status updates', async () => {
    await orchestrator.updateStatus('PACK-STATUS-1', 'archived')
    expect(ports.statuses.get('PACK-STATUS-1')).toBe('archived')
  })

  it('should seal pack with zero artifacts', async () => {
    const pack = await orchestrator.createPack({
      orgId,
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-EMPTY',
      summary: 'No artifacts',
      controlsCovered: [],
      artifacts: [],
      createdBy,
    })

    const sealed = await orchestrator.sealPack(pack.packId)

    expect(sealed.seal).toBeDefined()
    expect(sealed.seal!.artifactCount).toBe(0)
    expect(sealed.seal!.artifactsMerkleRoot).toMatch(/^[a-f0-9]{64}$/)
  })

  it('should seal pack with odd artifact count', async () => {
    const pack = await orchestrator.createPack({
      orgId,
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-ODD',
      summary: 'Odd Merkle path',
      controlsCovered: [],
      artifacts: [makeArtifact('odd-a'), makeArtifact('odd-b'), makeArtifact('odd-c')],
      createdBy,
    })

    const sealed = await orchestrator.sealPack(pack.packId)

    expect(sealed.seal).toBeDefined()
    expect(sealed.seal!.artifactCount).toBe(3)
    expect(sealed.seal!.artifactsMerkleRoot).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('barrel exports', () => {
  it('re-exports core APIs from index', async () => {
    const mod = await import('../index')

    expect(typeof mod.EvidencePackOrchestrator).toBe('function')
    expect(typeof mod.exportPack).toBe('function')
    expect(typeof mod.verifyPack).toBe('function')
    expect(typeof mod.RetentionManager).toBe('function')
  })
})
