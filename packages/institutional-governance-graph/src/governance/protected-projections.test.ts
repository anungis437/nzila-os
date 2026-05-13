/**
 * Phase 4 #5 — Projection-level protected fence.
 *
 * Validates `assertNoProtectedKindsInProjections` and
 * `redactProtectedFromProjections` (additive, read-only).
 */
import { describe, expect, it } from 'vitest'
import { IggEventKinds } from '../ontology/kinds.js'
import {
  IGG_PROTECTED_DECISION_CATEGORIES,
  IGG_PROTECTED_EVENT_KINDS,
  assertNoProtectedKindsInProjections,
  redactProtectedFromProjections,
} from './protected.js'

describe('Phase 4 — assertNoProtectedKindsInProjections', () => {
  it('passes on empty input', () => {
    expect(() => assertNoProtectedKindsInProjections([])).not.toThrow()
  })

  it('passes on clean projection entries', () => {
    const entries = [
      { category: 'motion_outcome', kind: IggEventKinds.MOTION_OUTCOME, summary: 'AGM motion' },
      { category: 'cba_ratified', kind: IggEventKinds.CBA_RATIFIED, summary: 'CBA signed' },
    ]
    expect(() => assertNoProtectedKindsInProjections(entries)).not.toThrow()
  })

  it('throws when entry.category is a protected decision category', () => {
    const entries = [{ category: IGG_PROTECTED_DECISION_CATEGORIES[0]! }]
    expect(() =>
      assertNoProtectedKindsInProjections(entries, 'timeline'),
    ).toThrowError(/timeline\[0\]\.category=class_b_veto/)
  })

  it('throws when entry.category is a protected event kind', () => {
    const entries = [{ category: IggEventKinds.CLASS_B_VETO }]
    expect(() => assertNoProtectedKindsInProjections(entries)).toThrowError(
      /Protected governance semantics leaked into projection entries/,
    )
  })

  it('throws when entry.kind is a protected event kind', () => {
    const entries = [{ kind: IggEventKinds.RESERVED_MATTER_RAISED }]
    expect(() =>
      assertNoProtectedKindsInProjections(entries, 'evidence'),
    ).toThrowError(/evidence\[0\]\.kind=igg:reserved_matter_raised/)
  })

  it('throws when summary substring references a protected event kind', () => {
    const entries = [
      { category: 'motion_outcome', summary: `Note: ${IggEventKinds.CLASS_B_VETO} occurred` },
    ]
    expect(() =>
      assertNoProtectedKindsInProjections(entries, 'continuity'),
    ).toThrowError(/continuity\[0\]\.summary references igg:class_b_veto/)
  })

  it('throws when summary substring references a protected decision category', () => {
    const entries = [{ summary: 'reserved_matter_vote tallied' }]
    expect(() => assertNoProtectedKindsInProjections(entries)).toThrowError(
      /summary references reserved_matter_vote/,
    )
  })

  it('aggregates multiple leaks into a single error message', () => {
    const entries = [
      { category: IggEventKinds.CLASS_B_VETO },
      { kind: IggEventKinds.RESERVED_MATTER_RAISED },
    ]
    expect(() => assertNoProtectedKindsInProjections(entries)).toThrowError(
      /\[0\]\.category=.*\[1\]\.kind=/,
    )
  })

  it('tolerates undefined / sparse entries', () => {
    const entries = [{}, { category: undefined, kind: undefined, summary: undefined }]
    expect(() => assertNoProtectedKindsInProjections(entries)).not.toThrow()
  })
})

describe('Phase 4 — redactProtectedFromProjections', () => {
  it('returns empty for empty input', () => {
    expect(redactProtectedFromProjections([])).toEqual([])
  })

  it('preserves order and identity of clean entries', () => {
    const entries = [
      { category: 'motion_outcome', summary: 'a' },
      { category: 'cba_ratified', summary: 'b' },
    ]
    const out = redactProtectedFromProjections(entries)
    expect(out).toHaveLength(2)
    expect(out[0]).toBe(entries[0])
    expect(out[1]).toBe(entries[1])
  })

  it('drops entries whose category is protected', () => {
    const entries = [
      { category: 'motion_outcome', summary: 'a' },
      { category: IGG_PROTECTED_DECISION_CATEGORIES[0]!, summary: 'b' },
      { category: IggEventKinds.CLASS_B_VETO, summary: 'c' },
    ]
    const out = redactProtectedFromProjections(entries)
    expect(out.map((e) => e.summary)).toEqual(['a'])
  })

  it('drops entries whose kind is protected', () => {
    const entries = [
      { kind: IggEventKinds.MOTION_OUTCOME, summary: 'keep' },
      { kind: IGG_PROTECTED_EVENT_KINDS[0]!, summary: 'drop' },
    ]
    const out = redactProtectedFromProjections(entries)
    expect(out.map((e) => e.summary)).toEqual(['keep'])
  })

  it('drops entries whose summary references a protected token', () => {
    const entries = [
      { summary: 'plain summary' },
      { summary: `leak ${IggEventKinds.RESERVED_MATTER_RAISED}` },
      { summary: 'class_b_veto reference' },
    ]
    const out = redactProtectedFromProjections(entries)
    expect(out).toHaveLength(1)
    expect(out[0]!.summary).toBe('plain summary')
  })

  it('does not mutate the input array', () => {
    const entries = [
      { category: 'motion_outcome' },
      { category: IggEventKinds.CLASS_B_VETO },
    ]
    const before = [...entries]
    redactProtectedFromProjections(entries)
    expect(entries).toEqual(before)
  })
})
