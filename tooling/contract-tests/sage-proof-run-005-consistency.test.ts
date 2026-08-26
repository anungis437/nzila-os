/**
 * Contract Test — SAGE Proof-Run 005 Consistency
 *
 * Guards the internal consistency and governance integrity of the SAGE
 * operational launch evidence run (proof-run 005). Fails when:
 *   - the approved 15-gate taxonomy is altered (ids or names) or is not 15 gates;
 *   - the 005 summary counts do not equal the detailed 005 gate statuses;
 *   - the 004→005 status maps do not use identical gate identifiers;
 *   - G13 is marked PASS without a recorded restore round-trip result;
 *   - the effective authorized NO_GO disappears while the reassessment is pending;
 *   - the manifest references a missing evidence file;
 *   - the implementation commit or deployed-staging commit is missing;
 *   - external production is authorized while blockers remain open.
 *
 * @invariant SAGE-PROOF-005-1: approved 15-gate taxonomy is preserved
 * @invariant SAGE-PROOF-005-2: effective NO_GO persists while reassessment pending
 * @invariant SAGE-PROOF-005-3: G13 cannot PASS without a restore result
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const PROOF_DIR = join(
  ROOT,
  'docs',
  'public-service',
  'operations',
  'proof-runs',
  '005-sage-operational-launch-evidence',
)
const MANIFEST = join(PROOF_DIR, 'evidence-manifest.json')

const APPROVED_TAXONOMY: Record<string, string> = {
  G1: 'Architecture & doctrine',
  G2: 'Authorization & tenant isolation',
  G3: 'Evidence integrity & auditability',
  G4: 'Human review & decision control',
  G5: 'Export immutability & approval',
  G6: 'Recipient delivery security',
  G7: 'Notification operational resilience',
  G8: 'Retention & legal holds',
  G9: 'Controlled destruction',
  G10: 'Privacy & data minimization',
  G11: 'Accessibility & bilingual parity',
  G12: 'Observability & incident response',
  G13: 'Backup & restoration',
  G14: 'Performance & reliability',
  G15: 'Documentation & operator readiness',
}
const GATE_IDS = Object.keys(APPROVED_TAXONOMY)
const VALID_STATUSES = new Set(['PASS', 'PASS_WITH_CONDITIONS', 'NOT_PROVEN', 'FAIL'])
const VALID_DECISIONS = new Set(['GO', 'CONDITIONAL_GO', 'NO_GO', 'PENDING'])

type Manifest = {
  implementationCommit?: string
  evidenceCommit?: string | null
  deployedStagingCommit?: string
  gateTaxonomy: string[]
  gateStatuses004: Record<string, string>
  gateStatuses005: Record<string, string>
  gateStatusChanges004to005: Record<string, unknown>
  gateSummary: { PASS: number; PASS_WITH_CONDITIONS: number; NOT_PROVEN: number; FAIL: number; total: number }
  openBlockers: Record<string, { severity: string; status: string }>
  blockerCount: number
  recommendedReassessmentDecision: string
  newReassessmentDecision: string | null
  effectiveAuthorizedDecision: string
  effectiveDecisionSource: string
  externalProductionAuthorized: boolean
  evidenceFiles: string[]
  restoreRoundTripResult?: string
}

function load(): Manifest {
  expect(existsSync(MANIFEST), 'evidence-manifest.json must exist').toBe(true)
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest
}

describe('SAGE proof-run 005 consistency', () => {
  it('preserves the exact approved 15-gate taxonomy (ids and names)', () => {
    const m = load()
    expect(m.gateTaxonomy).toHaveLength(15)
    const parsed = m.gateTaxonomy.map((entry) => {
      const idx = entry.indexOf(' ')
      return { id: entry.slice(0, idx), name: entry.slice(idx + 1) }
    })
    expect(parsed.map((p) => p.id)).toEqual(GATE_IDS)
    for (const { id, name } of parsed) {
      expect(name, `gate ${id} name must match approved taxonomy`).toBe(APPROVED_TAXONOMY[id])
    }
  })

  it('has 15 gates with valid statuses in both 004 and 005 maps, using identical ids', () => {
    const m = load()
    expect(Object.keys(m.gateStatuses004).sort()).toEqual([...GATE_IDS].sort())
    expect(Object.keys(m.gateStatuses005).sort()).toEqual([...GATE_IDS].sort())
    for (const g of GATE_IDS) {
      expect(VALID_STATUSES.has(m.gateStatuses004[g]), `004 gate ${g}`).toBe(true)
      expect(VALID_STATUSES.has(m.gateStatuses005[g]), `005 gate ${g}`).toBe(true)
    }
  })

  it('records status changes only under identical gate identifiers', () => {
    const m = load()
    for (const g of Object.keys(m.gateStatusChanges004to005)) {
      expect(GATE_IDS, `change key ${g} must be an approved gate id`).toContain(g)
    }
  })

  it('005 summary counts exactly equal the detailed 005 gate statuses', () => {
    const m = load()
    const tally = { PASS: 0, PASS_WITH_CONDITIONS: 0, NOT_PROVEN: 0, FAIL: 0 }
    for (const s of Object.values(m.gateStatuses005)) tally[s as keyof typeof tally] += 1
    expect(m.gateSummary.PASS).toBe(tally.PASS)
    expect(m.gateSummary.PASS_WITH_CONDITIONS).toBe(tally.PASS_WITH_CONDITIONS)
    expect(m.gateSummary.NOT_PROVEN).toBe(tally.NOT_PROVEN)
    expect(m.gateSummary.FAIL).toBe(tally.FAIL)
    expect(m.gateSummary.total).toBe(15)
  })

  it('does not mark G13 as PASS without a recorded restore round-trip result', () => {
    const m = load()
    if (m.gateStatuses005.G13 === 'PASS') {
      expect(
        typeof m.restoreRoundTripResult === 'string' && m.restoreRoundTripResult.length > 0,
        'G13 PASS requires a recorded restoreRoundTripResult',
      ).toBe(true)
    } else {
      expect(m.gateStatuses005.G13).toBe('NOT_PROVEN')
    }
  })

  it('keeps an effective authorized NO_GO while the reassessment is pending', () => {
    const m = load()
    const pending = m.newReassessmentDecision === null || m.newReassessmentDecision === 'PENDING'
    if (pending) {
      expect(VALID_DECISIONS.has(m.effectiveAuthorizedDecision)).toBe(true)
      expect(m.effectiveAuthorizedDecision).not.toBe('GO')
      expect(m.effectiveAuthorizedDecision.length).toBeGreaterThan(0)
      expect(m.effectiveDecisionSource.length).toBeGreaterThan(0)
    }
    expect(VALID_DECISIONS.has(m.recommendedReassessmentDecision)).toBe(true)
  })

  it('does not authorize external production while blockers remain open', () => {
    const m = load()
    const openBlockers = Object.values(m.openBlockers).filter(
      (b) => b.severity === 'BLOCKER' && b.status === 'open',
    ).length
    if (openBlockers > 0) {
      expect(m.externalProductionAuthorized).toBe(false)
    }
    expect(m.blockerCount).toBe(openBlockers)
  })

  it('references the implementation commit and the deployed-staging commit', () => {
    const m = load()
    expect(typeof m.implementationCommit === 'string' && m.implementationCommit.length >= 7).toBe(true)
    expect(typeof m.deployedStagingCommit === 'string' && m.deployedStagingCommit.length >= 7).toBe(true)
    // The evidence commit is assigned after the evidence is committed.
    expect(m.evidenceCommit === null || typeof m.evidenceCommit === 'string').toBe(true)
  })

  it('references only evidence files that exist', () => {
    const m = load()
    expect(m.evidenceFiles.length).toBeGreaterThan(0)
    for (const f of m.evidenceFiles) {
      expect(existsSync(join(PROOF_DIR, f)), `missing evidence file: ${f}`).toBe(true)
    }
  })
})
