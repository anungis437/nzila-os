import { describe, it, expect, beforeEach } from 'vitest'
import { DecisionEvidenceBuilder } from './builder.js'
import { computePackHash, computeSealHash } from './hash.js'
import { exportAsMarkdown, exportAsJson } from './export.js'
import type { DecisionEvidenceStore } from './store.js'
import type { DecisionEvidencePack, SealedDecisionEvidencePack } from './schema.js'

// ─── In-memory store ──────────────────────────────────────────────────────────

function makeEvidenceStore(): DecisionEvidenceStore {
  const packs = new Map<string, DecisionEvidencePack>()
  const sealedPacks = new Map<string, SealedDecisionEvidencePack>()

  return {
    async append(p) { packs.set(p.id, p) },
    async getById(id) { return packs.get(id) },
    async getByOrg(orgId, opts) {
      let results = [...packs.values()].filter((p) => p.orgId === orgId)
      if (opts?.sealed !== undefined) results = results.filter((p) => p.sealed === opts.sealed)
      if (opts?.packType) results = results.filter((p) => p.packType === opts.packType)
      return results
    },
    async seal(id, sealedAt, packHash) {
      const pack = packs.get(id)
      if (!pack) throw new Error(`Not found: ${id}`)
      const sealed: DecisionEvidencePack = { ...pack, sealed: true, sealedAt, packHash }
      packs.set(id, sealed)
      return sealed
    },
    async getSealedPack(id) { return sealedPacks.get(id) },
    async appendSealed(s) { sealedPacks.set(s.pack.id, s) },
  }
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const packInput = {
  orgId: 'org-1',
  packType: 'decision-analysis' as const,
  classification: 'CONFIDENTIAL' as const,
  executiveSummary: 'Evidence storage vendor was selected following structured KT Decision Analysis.',
  decisionTitle: 'Evidence storage vendor selection 2026',
  decisionOutcome: 'Azure Blob Storage + Cosmos DB selected',
  timeline: [
    {
      at: '2026-05-01T09:00:00Z',
      actor: 'cto',
      event: 'Decision analysis initiated',
      evidenceRef: null,
    },
    {
      at: '2026-05-10T14:00:00Z',
      actor: 'cto',
      event: 'Final decision recorded',
      evidenceRef: 'ev-decision-2026',
    },
  ],
  evidenceRefs: [
    {
      refId: '00000000-0000-0000-0000-000000000001',
      refType: 'governance-decision',
      description: 'Scoring matrix export',
      capturedAt: '2026-05-10T14:00:00Z',
      classification: 'CONFIDENTIAL' as const,
      hash: null,
    },
  ],
  scoringMatrix: null,
}

describe('DecisionEvidenceBuilder', () => {
  let builder: DecisionEvidenceBuilder

  beforeEach(() => {
    builder = new DecisionEvidenceBuilder(makeEvidenceStore())
  })

  it('creates a pack with a computed hash', async () => {
    const pack = await builder.create(packInput)

    expect(pack.id).toBeDefined()
    expect(pack.packHash).not.toBeNull()
    expect(pack.packHash).toHaveLength(64)
    expect(pack.sealed).toBe(false)
  })

  it('seals a pack and produces a seal hash', async () => {
    const pack = await builder.create(packInput)
    const sealed = await builder.seal(pack.id)

    expect(sealed.sealHash).toHaveLength(64)
    expect(sealed.pack.sealed).toBe(true)
    expect(sealed.pack.sealedAt).not.toBeNull()
    expect(sealed.exportFormats).toContain('json')
    expect(sealed.exportFormats).toContain('markdown')
  })

  it('prevents sealing an already-sealed pack', async () => {
    const pack = await builder.create(packInput)
    await builder.seal(pack.id)

    await expect(builder.seal(pack.id)).rejects.toThrow('already sealed')
  })

  it('exports sealed pack as JSON with schema field', async () => {
    const pack = await builder.create(packInput)
    const sealed = await builder.seal(pack.id)
    const json = await builder.export(pack.id, 'json')

    const parsed = JSON.parse(json)
    expect(parsed.$schema).toContain('decision-evidence')
    expect(parsed.sealHash).toBe(sealed.sealHash)
    expect(parsed.pack.id).toBe(pack.id)
  })

  it('exports sealed pack as Markdown with required sections', async () => {
    const pack = await builder.create(packInput)
    await builder.seal(pack.id)
    const md = await builder.export(pack.id, 'markdown')

    expect(md).toContain('# Decision Evidence Pack')
    expect(md).toContain('## Executive Summary')
    expect(md).toContain('Evidence storage vendor was selected')
    expect(md).toContain('## Evidence References')
  })

  it('throws when exporting an unsealed pack', async () => {
    const pack = await builder.create(packInput)
    await expect(builder.export(pack.id, 'json')).rejects.toThrow('not been sealed')
  })
})

describe('computePackHash', () => {
  it('produces stable identical hashes for identical inputs', () => {
    const pack: Parameters<typeof computePackHash>[0] = {
      id: '00000000-0000-0000-0000-000000000001',
      orgId: 'org-1',
      packType: 'decision-analysis',
      classification: 'CONFIDENTIAL',
      executiveSummary: 'Test',
      decisionTitle: 'Test Decision',
      decisionOutcome: 'Approved',
      timeline: [],
      evidenceRefs: [],
      policyReplayOutputs: [],
      alternativesRejected: [],
      acceptedRisks: [],
      mitigationPlans: [],
      approvers: [],
      continuityImplications: [],
      scoringMatrix: null,
      prevPackHash: null,
      schemaVersion: '1.0.0',
      createdAt: '2026-05-01T00:00:00Z',
    }

    const h1 = computePackHash(pack)
    const h2 = computePackHash(pack)
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(64)
  })
})
