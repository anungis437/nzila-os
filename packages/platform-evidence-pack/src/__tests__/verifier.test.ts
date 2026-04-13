import { describe, it, expect } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { verifyPack } from '../verifier'
import type { EvidencePackIndex, VerifierPorts, EvidenceArtifact } from '../types'
import { EvidencePackOrchestrator } from '../orchestrator'
import type { OrchestratorPorts } from '../types'

function makeArtifactWithContent(id: string): { artifact: EvidenceArtifact; content: Buffer } {
  const content = Buffer.from(`artifact-content-${id}`)
  const sha256 = createHash('sha256').update(content).digest('hex')
  return {
    artifact: {
      artifactId: id,
      artifactType: 'document',
      sha256,
      sizeBytes: content.length,
      mimeType: 'text/plain',
      blobPath: `/evidence/${id}.txt`,
      collectedAt: new Date().toISOString(),
      metadata: {},
    },
    content,
  }
}

function createTestPorts(): OrchestratorPorts & { store: Map<string, EvidencePackIndex> } {
  const store = new Map<string, EvidencePackIndex>()
  return {
    store,
    savePack: async (pack) => { store.set(pack.packId, pack) },
    loadPack: async (packId) => store.get(packId) ?? null,
    listPacks: async (orgId) => [...store.values()].filter((p) => p.orgId === orgId),
    updateStatus: async () => {},
  }
}

describe('verifyPack', () => {
  it('should verify a validly sealed pack', async () => {
    const { artifact: a1, content: c1 } = makeArtifactWithContent('doc-1')
    const { artifact: a2, content: c2 } = makeArtifactWithContent('doc-2')

    const blobStore = new Map<string, Buffer>()
    blobStore.set(a1.blobPath, c1)
    blobStore.set(a2.blobPath, c2)

    const verifierPorts: VerifierPorts = {
      readBlob: async (path) => {
        const buf = blobStore.get(path)
        if (!buf) throw new Error(`Blob not found: ${path}`)
        return buf
      },
    }

    const orchPorts = createTestPorts()
    const orchestrator = new EvidencePackOrchestrator(orchPorts)

    const pack = await orchestrator.createPack({
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-V1',
      summary: 'Verify test',
      controlsCovered: ['IR-01'],
      artifacts: [a1, a2],
      createdBy: 'test',
    })

    const sealed = await orchestrator.sealPack(pack.packId)
    const result = await verifyPack(sealed, verifierPorts)

    expect(result.valid).toBe(true)
    expect(result.digestMatch).toBe(true)
    expect(result.merkleMatch).toBe(true)
    expect(result.artifactIntegrity.length).toBe(2)
    expect(result.artifactIntegrity.every((r) => r.match)).toBe(true)
    expect(result.errors.length).toBe(0)
  })

  it('should detect tampered artifact', async () => {
    const { artifact, content } = makeArtifactWithContent('tampered')

    const blobStore = new Map<string, Buffer>()
    blobStore.set(artifact.blobPath, Buffer.from('TAMPERED CONTENT'))

    const verifierPorts: VerifierPorts = {
      readBlob: async (path) => {
        const buf = blobStore.get(path)
        if (!buf) throw new Error(`Blob not found: ${path}`)
        return buf
      },
    }

    const orchPorts = createTestPorts()
    const orchestrator = new EvidencePackOrchestrator(orchPorts)

    const pack = await orchestrator.createPack({
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-T1',
      summary: 'Tamper test',
      controlsCovered: [],
      artifacts: [artifact],
      createdBy: 'test',
    })

    const sealed = await orchestrator.sealPack(pack.packId)
    const result = await verifyPack(sealed, verifierPorts)

    expect(result.valid).toBe(false)
    expect(result.artifactIntegrity[0]!.match).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should reject unsealed pack', async () => {
    const { artifact } = makeArtifactWithContent('no-seal')
    const pack: EvidencePackIndex = {
      packId: 'NO-SEAL-001',
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'test',
      eventId: 'T1',
      runId: randomUUID(),
      createdBy: 'test',
      createdAt: new Date().toISOString(),
      summary: 'No seal',
      controlsCovered: [],
      artifacts: [artifact],
    }

    const verifierPorts: VerifierPorts = {
      readBlob: async () => Buffer.from(''),
    }

    const result = await verifyPack(pack, verifierPorts)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Pack has no seal — cannot verify')
  })

  it('should handle missing blob gracefully', async () => {
    const { artifact } = makeArtifactWithContent('missing')

    const verifierPorts: VerifierPorts = {
      readBlob: async () => { throw new Error('Blob not found') },
    }

    const orchPorts = createTestPorts()
    const orchestrator = new EvidencePackOrchestrator(orchPorts)

    const pack = await orchestrator.createPack({
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'test',
      eventId: 'M1',
      summary: 'Missing blob',
      controlsCovered: [],
      artifacts: [artifact],
      createdBy: 'test',
    })

    const sealed = await orchestrator.sealPack(pack.packId)
    const result = await verifyPack(sealed, verifierPorts)

    expect(result.valid).toBe(false)
    expect(result.artifactIntegrity[0]!.match).toBe(false)
    expect(result.artifactIntegrity[0]!.error).toContain('Blob not found')
  })

  it('should report digest and merkle mismatches', async () => {
    const { artifact, content } = makeArtifactWithContent('mismatch')

    const blobStore = new Map<string, Buffer>()
    blobStore.set(artifact.blobPath, content)

    const verifierPorts: VerifierPorts = {
      readBlob: async (path) => {
        const buf = blobStore.get(path)
        if (!buf) throw new Error(`Blob not found: ${path}`)
        return buf
      },
    }

    const orchPorts = createTestPorts()
    const orchestrator = new EvidencePackOrchestrator(orchPorts)

    const pack = await orchestrator.createPack({
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-MIS',
      summary: 'Mismatch test',
      controlsCovered: [],
      artifacts: [artifact],
      createdBy: 'test',
    })

    const sealed = await orchestrator.sealPack(pack.packId)
    const tampered: EvidencePackIndex = {
      ...sealed,
      seal: {
        ...sealed.seal!,
        packDigest: 'f'.repeat(64),
        artifactsMerkleRoot: 'e'.repeat(64),
      },
    }

    const result = await verifyPack(tampered, verifierPorts)

    expect(result.digestMatch).toBe(false)
    expect(result.merkleMatch).toBe(false)
    expect(result.errors.some((e) => e.includes('Pack digest mismatch'))).toBe(true)
    expect(result.errors.some((e) => e.includes('Merkle root mismatch'))).toBe(true)
  })

  it('should verify sealed pack with zero artifacts', async () => {
    const orchPorts = createTestPorts()
    const orchestrator = new EvidencePackOrchestrator(orchPorts)

    const pack = await orchestrator.createPack({
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-EMPTY-VERIFY',
      summary: 'No artifacts verify path',
      controlsCovered: [],
      artifacts: [],
      createdBy: 'test',
    })

    const sealed = await orchestrator.sealPack(pack.packId)
    const verifierPorts: VerifierPorts = {
      readBlob: async () => Buffer.from('unused'),
    }

    const result = await verifyPack(sealed, verifierPorts)

    expect(result.valid).toBe(true)
    expect(result.artifactIntegrity).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('should verify pack with odd artifact count', async () => {
    const items = [
      makeArtifactWithContent('odd-1'),
      makeArtifactWithContent('odd-2'),
      makeArtifactWithContent('odd-3'),
    ]

    const blobStore = new Map<string, Buffer>()
    for (const item of items) {
      blobStore.set(item.artifact.blobPath, item.content)
    }

    const verifierPorts: VerifierPorts = {
      readBlob: async (path) => {
        const buf = blobStore.get(path)
        if (!buf) throw new Error(`Blob not found: ${path}`)
        return buf
      },
    }

    const orchPorts = createTestPorts()
    const orchestrator = new EvidencePackOrchestrator(orchPorts)

    const pack = await orchestrator.createPack({
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-ODD-VERIFY',
      summary: 'Odd Merkle verify path',
      controlsCovered: [],
      artifacts: items.map((i) => i.artifact),
      createdBy: 'test',
    })

    const sealed = await orchestrator.sealPack(pack.packId)
    const result = await verifyPack(sealed, verifierPorts)

    expect(result.valid).toBe(true)
    expect(result.artifactIntegrity).toHaveLength(3)
    expect(result.errors).toHaveLength(0)
  })

  it('should stringify non-Error read failures', async () => {
    const { artifact } = makeArtifactWithContent('string-failure')

    const verifierPorts: VerifierPorts = {
      readBlob: async () => {
        throw 'blob string failure'
      },
    }

    const orchPorts = createTestPorts()
    const orchestrator = new EvidencePackOrchestrator(orchPorts)

    const pack = await orchestrator.createPack({
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'test',
      eventId: 'S1',
      summary: 'String failure',
      controlsCovered: [],
      artifacts: [artifact],
      createdBy: 'test',
    })

    const sealed = await orchestrator.sealPack(pack.packId)
    const result = await verifyPack(sealed, verifierPorts)

    expect(result.valid).toBe(false)
    expect(result.artifactIntegrity[0]!.error).toBe('blob string failure')
  })
})
