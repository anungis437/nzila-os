/**
 * Contract tests — NACP Evidence for Terminal States
 *
 * Enforces that:
 *   1. NACP terminal events produce evidence packs with hash chain.
 *   2. platform-proof exports an NACP integrity proof section.
 *   3. Console has a NACP integrity verification page.
 *   4. Hash chain functions are present and exported.
 *
 * @invariant NACP_EVIDENCE_REQUIRED_FOR_TERMINAL_STATES_002
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

describe('NACP — Evidence Required for Terminal States', () => {
  // ── Evidence pack builder ─────────────────────────────────────────────
  it('NACP_EVIDENCE_REQUIRED_002: NACP evidence-packs module defines terminal events', () => {
    const ep = readContent('apps/nacp-exams/lib/evidence-packs.ts')
    expect(ep).toBeTruthy()

    expect(
      ep.includes('SUBMISSION_SEALED'),
      'evidence-packs.ts must define SUBMISSION_SEALED terminal event',
    ).toBe(true)

    expect(
      ep.includes('GRADING_FINALIZED'),
      'evidence-packs.ts must define GRADING_FINALIZED terminal event',
    ).toBe(true)

    expect(
      ep.includes('EXPORT_GENERATED'),
      'evidence-packs.ts must define EXPORT_GENERATED terminal event',
    ).toBe(true)
  })

  // ── Hash chain ────────────────────────────────────────────────────────
  it('NACP_EVIDENCE_REQUIRED_002: NACP evidence packs implement hash chain', () => {
    const ep = readContent('apps/nacp-exams/lib/evidence-packs.ts')
    expect(ep).toBeTruthy()

    expect(
      ep.includes('computeHashChainEntry'),
      'evidence-packs.ts must export computeHashChainEntry for chain integrity',
    ).toBe(true)

    expect(
      ep.includes('verifyHashChainEntry'),
      'evidence-packs.ts must export verifyHashChainEntry for chain verification',
    ).toBe(true)

    expect(
      ep.includes('buildNacpEvidencePack'),
      'evidence-packs.ts must export buildNacpEvidencePack',
    ).toBe(true)
  })

  // ── NACP integrity proof section ──────────────────────────────────────
  it('NACP_EVIDENCE_REQUIRED_002: platform-proof exports NACP integrity proof section', () => {
    const proofIndex = readContent('packages/platform-proof/src/index.ts')
    expect(proofIndex).toBeTruthy()

    expect(
      proofIndex.includes('nacp-proof'),
      'platform-proof index must re-export from nacp-proof',
    ).toBe(true)

    const nacpProof = readContent('packages/platform-proof/src/nacp-proof.ts')
    expect(nacpProof).toBeTruthy()

    expect(
      nacpProof.includes('generateNacpIntegrityProofSection'),
      'nacp-proof.ts must export generateNacpIntegrityProofSection',
    ).toBe(true)

    expect(
      nacpProof.includes('NacpIntegrityProofSection'),
      'nacp-proof.ts must export NacpIntegrityProofSection type',
    ).toBe(true)

    expect(
      nacpProof.includes('NacpAnomaly'),
      'nacp-proof.ts must define NacpAnomaly type for anomaly tracking',
    ).toBe(true)
  })

  // ── Console verification page ─────────────────────────────────────────
  it('NACP_EVIDENCE_REQUIRED_002: console includes NACP integrity verification page', () => {
    const page = readContent('apps/console/app/(dashboard)/nacp-integrity/page.tsx')
    expect(page).toBeTruthy()

    expect(
      page.includes('NacpIntegrity'),
      'NACP integrity page must render NacpIntegrity component or contain NacpIntegrity in name',
    ).toBe(true)

    expect(
      page.includes('verdict'),
      'NACP integrity page must display a verification verdict',
    ).toBe(true)
  })

  // ── Verdict logic ─────────────────────────────────────────────────────
  it('NACP_EVIDENCE_REQUIRED_002: NACP proof section implements pass/warn/fail verdict', () => {
    const nacpProof = readContent('packages/platform-proof/src/nacp-proof.ts')
    expect(nacpProof).toBeTruthy()

    for (const verdict of ['pass', 'warn', 'fail']) {
      expect(
        nacpProof.includes(`'${verdict}'`),
        `nacp-proof.ts must include '${verdict}' verdict outcome`,
      ).toBe(true)
    }
  })
})
