import { describe, it, expect } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { exportPack } from '../exporter'
import { EvidencePackOrchestrator } from '../orchestrator'
import type { EvidencePackIndex, ExporterPorts, OrchestratorPorts } from '../types'

function makeArtifact(id: string) {
  const content = `artifact-content-${id}`
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
    content: Buffer.from(content),
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

describe('exportPack', () => {
  it('should export as JSON', async () => {
    const { artifact: a1, content: c1 } = makeArtifact('doc-1')

    const orchPorts = createTestPorts()
    const orchestrator = new EvidencePackOrchestrator(orchPorts)

    const pack = await orchestrator.createPack({
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-E1',
      summary: 'Export test',
      controlsCovered: ['IR-01'],
      artifacts: [a1],
      createdBy: 'test',
    })

    const sealed = await orchestrator.sealPack(pack.packId)
    const exporterPorts: ExporterPorts = {
      readBlob: async () => c1,
    }

    const result = await exportPack(sealed, 'json', exporterPorts)
    expect(result.format).toBe('json')
    expect(result.packId).toBe(sealed.packId)
    expect(result.artifactCount).toBe(1)
    expect(typeof result.data).toBe('string')

    const parsed = JSON.parse(result.data as string)
    expect(parsed.seal).toBeDefined()
  })

  it('should export as zip bundle', async () => {
    const { artifact: a1, content: c1 } = makeArtifact('zip-doc')

    const blobStore = new Map<string, Buffer>()
    blobStore.set(a1.blobPath, c1)

    const orchPorts = createTestPorts()
    const orchestrator = new EvidencePackOrchestrator(orchPorts)

    const pack = await orchestrator.createPack({
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-Z1',
      summary: 'Zip export',
      controlsCovered: [],
      artifacts: [a1],
      createdBy: 'test',
    })

    const sealed = await orchestrator.sealPack(pack.packId)
    const exporterPorts: ExporterPorts = {
      readBlob: async (path) => {
        const buf = blobStore.get(path)
        if (!buf) throw new Error(`Not found: ${path}`)
        return buf
      },
    }

    const result = await exportPack(sealed, 'zip', exporterPorts)
    expect(result.format).toBe('zip')
    const bundle = JSON.parse(result.data as string)
    expect(bundle.index.seal).toBeDefined()
    expect(bundle.artifacts.length).toBe(1)
    expect(bundle.artifacts[0].content).toBeDefined()
  })

  it('should reject export of unsealed pack', async () => {
    const orchPorts = createTestPorts()
    const orchestrator = new EvidencePackOrchestrator(orchPorts)

    const pack = await orchestrator.createPack({
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-U1',
      summary: 'Unsealed',
      controlsCovered: [],
      artifacts: [makeArtifact('x').artifact],
      createdBy: 'test',
    })

    const exporterPorts: ExporterPorts = {
      readBlob: async () => Buffer.from(''),
    }

    await expect(exportPack(pack, 'json', exporterPorts)).rejects.toThrow('unsealed')
  })

  it('should include artifact error when blob read throws non-Error value', async () => {
    const { artifact: a1 } = makeArtifact('zip-fail')

    const orchPorts = createTestPorts()
    const orchestrator = new EvidencePackOrchestrator(orchPorts)

    const pack = await orchestrator.createPack({
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-Z2',
      summary: 'Zip export failure path',
      controlsCovered: [],
      artifacts: [a1],
      createdBy: 'test',
    })

    const sealed = await orchestrator.sealPack(pack.packId)
    const exporterPorts: ExporterPorts = {
      readBlob: async () => {
        throw 'blob missing'
      },
    }

    const result = await exportPack(sealed, 'zip', exporterPorts)
    const bundle = JSON.parse(result.data as string)

    expect(bundle.artifacts[0].content).toBeNull()
    expect(bundle.artifacts[0].error).toBe('blob missing')
  })

  it('should include artifact error when blob read throws Error instance', async () => {
    const { artifact: a1 } = makeArtifact('zip-fail-error')

    const orchPorts = createTestPorts()
    const orchestrator = new EvidencePackOrchestrator(orchPorts)

    const pack = await orchestrator.createPack({
      orgId: randomUUID(),
      controlFamily: 'IR',
      eventType: 'incident.resolved',
      eventId: 'INC-Z3',
      summary: 'Zip export failure path error object',
      controlsCovered: [],
      artifacts: [a1],
      createdBy: 'test',
    })

    const sealed = await orchestrator.sealPack(pack.packId)
    const exporterPorts: ExporterPorts = {
      readBlob: async () => {
        throw new Error('blob error object')
      },
    }

    const result = await exportPack(sealed, 'zip', exporterPorts)
    const bundle = JSON.parse(result.data as string)

    expect(bundle.artifacts[0].content).toBeNull()
    expect(bundle.artifacts[0].error).toBe('blob error object')
  })
})
