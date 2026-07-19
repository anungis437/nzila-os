/**
 * Contract Test — SAGE Proof-Run 004 Consistency
 *
 * Guards the internal consistency and governance integrity of the SAGE final
 * implementation proof (proof-run 004). Fails when:
 *   - the gate count is not exactly 15;
 *   - the summary counts do not equal the detailed gate statuses;
 *   - an authorized GO coexists with a FAIL/NOT_PROVEN critical gate;
 *   - a NO_GO decision is described as GO / production-ready / externally authorized;
 *   - the manifest references a missing evidence file;
 *   - the proof commit is missing.
 *
 * @invariant SAGE-PROOF-004-1: 15 gates; summary equals detail
 * @invariant SAGE-PROOF-004-2: NO_GO decision cannot claim external authorization
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
  '004-sage-final-implementation-proof',
)
const MANIFEST = join(PROOF_DIR, 'evidence-manifest.json')

type Manifest = {
  proofCommit?: string
  baseCommit?: string
  gateStatuses: Record<string, string>
  gateSummary: { PASS: number; PASS_WITH_CONDITIONS: number; NOT_PROVEN: number; FAIL: number; total: number }
  positiveFlowStatus: string
  blockerCount: number
  highCount: number
  recommendedDecision: string
  authorizedDecision: string
  authorizedApprover: string
  externalProductionAuthorized: boolean
  evidenceFiles: string[]
}

const VALID_STATUSES = new Set(['PASS', 'PASS_WITH_CONDITIONS', 'NOT_PROVEN', 'FAIL'])
const VALID_DECISIONS = new Set(['GO', 'CONDITIONAL_GO', 'NO_GO', 'PENDING'])
// Gates whose FAIL/NOT_PROVEN mandates NO_GO under the launch rules.
const CRITICAL_GATES = ['G2', 'G9', 'G10', 'G12', 'G13']

function load(): Manifest {
  expect(existsSync(MANIFEST), 'evidence-manifest.json must exist').toBe(true)
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest
}

describe('SAGE proof-run 004 consistency', () => {
  it('has exactly 15 gates with valid statuses', () => {
    const m = load()
    const gates = Object.keys(m.gateStatuses)
    expect(gates).toHaveLength(15)
    for (const [g, s] of Object.entries(m.gateStatuses)) {
      expect(VALID_STATUSES.has(s), `gate ${g} has invalid status ${s}`).toBe(true)
    }
  })

  it('summary counts exactly equal the detailed gate statuses', () => {
    const m = load()
    const tally = { PASS: 0, PASS_WITH_CONDITIONS: 0, NOT_PROVEN: 0, FAIL: 0 }
    for (const s of Object.values(m.gateStatuses)) tally[s as keyof typeof tally] += 1
    expect(m.gateSummary.PASS).toBe(tally.PASS)
    expect(m.gateSummary.PASS_WITH_CONDITIONS).toBe(tally.PASS_WITH_CONDITIONS)
    expect(m.gateSummary.NOT_PROVEN).toBe(tally.NOT_PROVEN)
    expect(m.gateSummary.FAIL).toBe(tally.FAIL)
    expect(m.gateSummary.total).toBe(15)
    expect(tally.PASS + tally.PASS_WITH_CONDITIONS + tally.NOT_PROVEN + tally.FAIL).toBe(15)
  })

  it('records a valid recommended and authorized decision with a named approver', () => {
    const m = load()
    expect(VALID_DECISIONS.has(m.recommendedDecision)).toBe(true)
    expect(VALID_DECISIONS.has(m.authorizedDecision)).toBe(true)
    expect(m.authorizedApprover.trim().length).toBeGreaterThan(0)
  })

  it('does not allow an authorized GO while any critical gate is FAIL/NOT_PROVEN', () => {
    const m = load()
    const criticalUnproven = CRITICAL_GATES.filter(
      (g) => m.gateStatuses[g] === 'FAIL' || m.gateStatuses[g] === 'NOT_PROVEN',
    )
    if (m.authorizedDecision === 'GO') {
      expect(criticalUnproven, `GO not permitted with unproven critical gates: ${criticalUnproven.join(',')}`).toEqual([])
    }
    // Symmetric: if a critical gate is unproven, the decision must not be GO.
    if (criticalUnproven.length > 0) {
      expect(m.authorizedDecision).not.toBe('GO')
    }
  })

  it('a NO_GO decision cannot claim external production authorization', () => {
    const m = load()
    if (m.authorizedDecision === 'NO_GO') {
      expect(m.externalProductionAuthorized).toBe(false)
    }
    const decisionDoc = readFileSync(join(PROOF_DIR, '15-launch-governance-decision.md'), 'utf8')
    expect(decisionDoc).toMatch(/NO_GO/)
    expect(decisionDoc.toLowerCase()).toContain('not authorized for external production use')
    // Must not make a naked production-ready / public-availability claim.
    expect(/\bproduction[- ]ready\b/i.test(decisionDoc)).toBe(false)
  })

  it('the positive-flow status is not an unconditional PASS', () => {
    const m = load()
    expect(m.positiveFlowStatus).not.toBe('PASS')
    expect(['PASS_WITH_CONDITIONS', 'PARTIALLY_PROVEN', 'NOT_PROVEN']).toContain(m.positiveFlowStatus)
  })

  it('does not report zero BLOCKER/HIGH while critical gates are unproven', () => {
    const m = load()
    const criticalUnproven = CRITICAL_GATES.filter(
      (g) => m.gateStatuses[g] === 'FAIL' || m.gateStatuses[g] === 'NOT_PROVEN',
    )
    if (criticalUnproven.length > 0) {
      expect(m.blockerCount + m.highCount).toBeGreaterThan(0)
    }
  })

  it('references a proof commit and only existing evidence files', () => {
    const m = load()
    expect((m.proofCommit ?? m.baseCommit ?? '').trim().length).toBeGreaterThan(0)
    expect(m.evidenceFiles.length).toBeGreaterThanOrEqual(16)
    for (const f of m.evidenceFiles) {
      expect(existsSync(join(PROOF_DIR, f)), `missing evidence file ${f}`).toBe(true)
    }
  })
})
