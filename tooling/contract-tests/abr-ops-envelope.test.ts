/**
 * Contract tests — ABR Ops Performance Envelope
 *
 * Enforces that:
 *   1. ABR app includes performance instrumentation wiring.
 *   2. ABR performance middleware exists and wraps route handlers.
 *   3. platform-proof exports an ABR proof section.
 *   4. platform-export includes ABR fields in OrgExportDataset.
 *
 * @invariant ABR_OPS_ENVELOPE_REQUIRED_001
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = join(__dirname, '..', '..')

function readContent(rel: string): string {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

describe('ABR — Ops Performance Envelope', () => {
  // ── ABR_OPS_ENVELOPE_REQUIRED_001 (performance wiring) ────────────────
  it('ABR_OPS_ENVELOPE_REQUIRED_001: ABR performance bridge exists and exports metrics tracker', () => {
    const perf = readContent('apps/abr/lib/performance.ts')
    expect(perf).toBeTruthy()

    expect(
      perf.includes('trackAbrRequestMetrics'),
      'apps/abr/lib/performance.ts must export trackAbrRequestMetrics',
    ).toBe(true)

    expect(
      perf.includes('@nzila/platform-performance'),
      'ABR performance bridge must import from @nzila/platform-performance',
    ).toBe(true)
  })

  // ── ABR performance middleware ────────────────────────────────────────
  it('ABR_OPS_ENVELOPE_REQUIRED_001: ABR performance middleware wraps route handlers', () => {
    const mw = readContent('apps/abr/lib/performance-middleware.ts')
    expect(mw).toBeTruthy()

    expect(
      mw.includes('withAbrMetrics'),
      'ABR performance middleware must export withAbrMetrics wrapper',
    ).toBe(true)
  })

  // ── ABR proof section in platform-proof ───────────────────────────────
  it('ABR_OPS_ENVELOPE_REQUIRED_001: platform-proof exports ABR proof section', () => {
    const proofIndex = readContent('packages/platform-proof/src/index.ts')
    expect(proofIndex).toBeTruthy()

    expect(
      proofIndex.includes('abr-proof'),
      'platform-proof index must re-export from abr-proof',
    ).toBe(true)

    const abrProof = readContent('packages/platform-proof/src/abr-proof.ts')
    expect(abrProof).toBeTruthy()

    expect(
      abrProof.includes('generateAbrProofSection'),
      'abr-proof.ts must export generateAbrProofSection',
    ).toBe(true)

    expect(
      abrProof.includes('AbrProofSection'),
      'abr-proof.ts must export AbrProofSection type',
    ).toBe(true)
  })

  // ── ABR fields in org export ──────────────────────────────────────────
  it('ABR_OPS_ENVELOPE_REQUIRED_001: OrgExportDataset includes ABR data slices', () => {
    const exportIndex = readContent('packages/platform-export/src/index.ts')
    expect(exportIndex).toBeTruthy()

    expect(
      exportIndex.includes('abrCases'),
      'OrgExportDataset must include abrCases field',
    ).toBe(true)

    expect(
      exportIndex.includes('abrEvidenceIndex'),
      'OrgExportDataset must include abrEvidenceIndex field',
    ).toBe(true)

    expect(
      exportIndex.includes('abrAuditSlice'),
      'OrgExportDataset must include abrAuditSlice field',
    ).toBe(true)
  })

  // ── ABR package.json declares platform-performance dep ────────────────
  it('ABR_OPS_ENVELOPE_REQUIRED_001: ABR package.json includes platform-performance dependency', () => {
    const pkg = readContent('apps/abr/package.json')
    expect(pkg).toBeTruthy()

    expect(
      pkg.includes('@nzila/platform-performance'),
      'apps/abr/package.json must list @nzila/platform-performance as a dependency',
    ).toBe(true)
  })
})
