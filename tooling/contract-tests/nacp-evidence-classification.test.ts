/**
 * Contract Test — NACP Evidence Classification
 *
 * Structural invariants:
 *   1. evidence-classification.ts defines mandatory/best-effort actions
 *   2. MANDATORY_TARGET_STATUSES includes sealed, exported, closed
 *   3. session-actions.ts imports classifyTransitionEvidence
 *   4. session-actions.ts does NOT swallow errors for mandatory evidence
 *   5. session-actions.ts evidence calls use classifyTransitionEvidence
 *
 * @invariant NACP-EVIDENCE-01: Evidence classification module exists
 * @invariant NACP-EVIDENCE-02: Mandatory statuses are correct
 * @invariant NACP-EVIDENCE-03: session-actions wires classification
 * @invariant NACP-EVIDENCE-04: No blanket .catch on mandatory evidence
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const NACP = join(ROOT, 'apps', 'nacp-exams')

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

// ── NACP-EVIDENCE-01: Classification module ─────────────────────────────────

describe('NACP-EVIDENCE-01 — Evidence classification module exists', () => {
  const classFile = join(NACP, 'lib', 'evidence-classification.ts')

  it('evidence-classification.ts exists', () => {
    expect(existsSync(classFile)).toBe(true)
  })

  it('exports classifyTransitionEvidence', () => {
    const src = readSafe(classFile)
    expect(src).toContain('export function classifyTransitionEvidence')
  })

  it('exports classifyActionEvidence', () => {
    const src = readSafe(classFile)
    expect(src).toContain('export function classifyActionEvidence')
  })

  it('exports EVIDENCE_CLASSIFICATIONS array', () => {
    const src = readSafe(classFile)
    expect(src).toContain('export const EVIDENCE_CLASSIFICATIONS')
  })

  it('exports MANDATORY_TARGET_STATUSES', () => {
    const src = readSafe(classFile)
    expect(src).toContain('export const MANDATORY_TARGET_STATUSES')
  })
})

// ── NACP-EVIDENCE-02: Mandatory statuses ────────────────────────────────────

describe('NACP-EVIDENCE-02 — Mandatory target statuses are correct', () => {
  const classFile = join(NACP, 'lib', 'evidence-classification.ts')

  it('sealed is mandatory', () => {
    const src = readSafe(classFile)
    expect(src).toContain('ExamSessionStatus.SEALED')
  })

  it('exported is mandatory', () => {
    const src = readSafe(classFile)
    expect(src).toContain('ExamSessionStatus.EXPORTED')
  })

  it('closed is mandatory', () => {
    const src = readSafe(classFile)
    expect(src).toContain('ExamSessionStatus.CLOSED')
  })

  it('session.created is classified as best-effort', () => {
    const src = readSafe(classFile)
    // session.created should appear with 'best-effort' classification
    const createdIdx = src.indexOf("action: 'session.created'")
    expect(createdIdx).toBeGreaterThan(-1)
    const snippet = src.slice(createdIdx, createdIdx + 200)
    expect(snippet).toContain("classification: 'best-effort'")
  })
})

// ── NACP-EVIDENCE-03: session-actions wires classification ──────────────────

describe('NACP-EVIDENCE-03 — session-actions uses evidence classification', () => {
  const actions = join(NACP, 'lib', 'actions', 'session-actions.ts')

  it('imports classifyTransitionEvidence', () => {
    const src = readSafe(actions)
    expect(src).toContain('classifyTransitionEvidence')
  })

  it('imports from evidence-classification module', () => {
    const src = readSafe(actions)
    expect(src).toContain('evidence-classification')
  })

  it('calls classifyTransitionEvidence with targetStatus', () => {
    const src = readSafe(actions)
    expect(src).toContain('classifyTransitionEvidence(targetStatus)')
  })
})

// ── NACP-EVIDENCE-04: No blanket catch on mandatory evidence ────────────────

describe('NACP-EVIDENCE-04 — Mandatory evidence is not swallowed', () => {
  const actions = join(NACP, 'lib', 'actions', 'session-actions.ts')

  it('uses conditional evidence handling (mandatory vs best-effort)', () => {
    const src = readSafe(actions)
    // Must have the mandatory branch that awaits without catch
    expect(src).toContain("evidenceClass === 'mandatory'")
    expect(src).toContain('await evidencePromise')
  })

  it('best-effort branch has .catch', () => {
    const src = readSafe(actions)
    expect(src).toContain('evidencePromise.catch')
  })

  it('session.created evidence uses .catch (best-effort)', () => {
    const src = readSafe(actions)
    // session.created block ends with .catch(() => {})
    const createdIdx = src.indexOf("action: 'session.created'")
    expect(createdIdx).toBeGreaterThan(-1)
    const afterCreated = src.slice(createdIdx, createdIdx + 400)
    expect(afterCreated).toContain('.catch')
  })
})
