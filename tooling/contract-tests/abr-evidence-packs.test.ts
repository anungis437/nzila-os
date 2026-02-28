/**
 * Contract Test — ABR Evidence Pack Parity
 *
 * Ensures terminal/irreversible ABR events generate evidence packs.
 *
 * @invariant ABR_EVIDENCE_TERMINAL_001: Terminal events defined and enforced
 * @invariant ABR_EVIDENCE_BUILDER_002: Evidence pack builder exists with seal
 * @invariant ABR_EVIDENCE_ORG_EXPORT_003: Evidence refs included in org export
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

function readContent(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

// ── ABR_EVIDENCE_TERMINAL_001 ─────────────────────────────────────────────

describe('ABR_EVIDENCE_TERMINAL_001 — Terminal events defined', () => {
  const evidencePacksPath = join(ROOT, 'apps', 'abr', 'lib', 'evidence-packs.ts')

  it('evidence-packs.ts exists', () => {
    expect(existsSync(evidencePacksPath), 'apps/abr/lib/evidence-packs.ts must exist').toBe(true)
  })

  const REQUIRED_TERMINAL_EVENTS = [
    'DECISION_ISSUED',
    'EXPORT_GENERATED',
    'CASE_CLOSED',
  ]

  it('all required terminal events are defined', () => {
    const content = readContent(evidencePacksPath)
    for (const event of REQUIRED_TERMINAL_EVENTS) {
      expect(
        content.includes(event),
        `ABR evidence packs missing terminal event definition: ${event}`,
      ).toBe(true)
    }
  })

  it('exports isTerminalEvent guard function', () => {
    const content = readContent(evidencePacksPath)
    expect(content).toContain('export function isTerminalEvent')
  })
})

// ── ABR_EVIDENCE_BUILDER_002 ──────────────────────────────────────────────

describe('ABR_EVIDENCE_BUILDER_002 — Evidence pack builder with seal', () => {
  const evidencePacksPath = join(ROOT, 'apps', 'abr', 'lib', 'evidence-packs.ts')

  it('exports buildAbrEvidencePack function', () => {
    const content = readContent(evidencePacksPath)
    expect(content).toContain('export async function buildAbrEvidencePack')
  })

  it('uses generateSeal from os-core', () => {
    const content = readContent(evidencePacksPath)
    expect(content).toContain('generateSeal')
  })

  it('uses buildEvidencePackFromAction from os-core', () => {
    const content = readContent(evidencePacksPath)
    expect(content).toContain('buildEvidencePackFromAction')
  })

  it('result type includes seal and audit event', () => {
    const content = readContent(evidencePacksPath)
    expect(content).toContain('seal: SealEnvelope')
    expect(content).toContain('auditEvent: AbrAuditEvent')
  })
})

// ── ABR_EVIDENCE_ORG_EXPORT_003 ───────────────────────────────────────────

describe('ABR_EVIDENCE_ORG_EXPORT_003 — ABR evidence accessible for org export', () => {
  it('ABR evidence.ts imports from os-core evidence pipeline', () => {
    const evidencePath = join(ROOT, 'apps', 'abr', 'lib', 'evidence.ts')
    if (!existsSync(evidencePath)) return

    const content = readContent(evidencePath)
    expect(
      content.includes('@nzila/os-core/evidence'),
      'ABR evidence.ts must import from @nzila/os-core/evidence for org export compatibility',
    ).toBe(true)
  })

  it('platform-export package exists for org evidence export', () => {
    const exportPkg = join(ROOT, 'packages', 'platform-export', 'package.json')
    expect(
      existsSync(exportPkg),
      'packages/platform-export must exist for evidence export',
    ).toBe(true)
  })
})
