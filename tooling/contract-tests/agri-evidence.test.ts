/**
 * Contract Test — Agri Evidence & Traceability
 *
 * AGRI_EVIDENCE_TRACEABILITY_004:
 *   1. Evidence pack builders exist in agri-traceability
 *   2. Evidence packs use @nzila/evidence for sealing
 *   3. Traceability chain builder exists
 *   4. Evidence wiring exists in apps/agrimo
 *
 * @invariant AGRI_EVIDENCE_TRACEABILITY_004
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')

describe('AGRI-EVID-01 — agri-traceability pack builders exist', () => {
  it('packs.ts exists', () => {
    expect(existsSync(join(ROOT, 'packages', 'agri-traceability', 'src', 'packs.ts'))).toBe(true)
  })

  it('chain.ts exists', () => {
    expect(existsSync(join(ROOT, 'packages', 'agri-traceability', 'src', 'chain.ts'))).toBe(true)
  })
})

describe('AGRI-EVID-02 — Evidence packs use @nzila/evidence', () => {
  it('packs.ts imports from @nzila/evidence', () => {
    const path = join(ROOT, 'packages', 'agri-traceability', 'src', 'packs.ts')
    if (!existsSync(path)) return
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('@nzila/evidence')
    expect(content).toContain('computeMerkleRoot')
    expect(content).toContain('generateSeal')
  })
})

describe('AGRI-EVID-03 — Pack builders for all required pack types', () => {
  it('exports all 4 pack builders', () => {
    const path = join(ROOT, 'packages', 'agri-traceability', 'src', 'packs.ts')
    if (!existsSync(path)) return
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('buildLotCertificationPack')
    expect(content).toContain('buildShipmentManifestPack')
    expect(content).toContain('buildPaymentDistributionPack')
    expect(content).toContain('buildTraceabilityChainPack')
  })
})

describe('AGRI-EVID-04 — Evidence wiring in apps/agrimo', () => {
  it('agri-evidence-packs.ts exists in agrimo', () => {
    expect(
      existsSync(join(ROOT, 'apps', 'agrimo', 'lib', 'evidence', 'agri-evidence-packs.ts')),
    ).toBe(true)
  })

  it('re-exports from @nzila/agri-traceability', () => {
    const path = join(ROOT, 'apps', 'agrimo', 'lib', 'evidence', 'agri-evidence-packs.ts')
    if (!existsSync(path)) return
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('@nzila/agri-traceability')
  })
})
