import { describe, expect, it } from 'vitest'
import {
  buildTerminalClosure,
  generateTerminalClosure,
  outputs,
  validateTerminalDisposition,
} from './close-w5-terminal-static'
import { read } from './w4-physical-producers'
import {
  replayHash,
  replayObject,
} from '../../apps/union-eyes/scripts/provisioning/post-w4p-replay'

const model = buildTerminalClosure()
describe('accepted W5 terminal governance closure, not renewed engineering', () => {
  it('validates the exact accepted terminal schema and scoped closure', () => {
    expect(() => validateTerminalDisposition(model.disposition)).not.toThrow()
    expect(model.disposition.SCOPE).toBe('W5_STATIC_BOOTSTRAP_REPLAY_QUALIFICATION_ONLY')
    expect(model.disposition.COMMAND).toBe('RELEASED_TO_NORMAL_NZILA_OS_DELIVERY_OPERATIONS')
  })
  it.each([
    'UNION_EYES_W5_STATIC_REMEDIATION',
    'PHASE_1B_3C_A1I_W5B',
    'W5',
    'W5_RUNTIME_EXECUTION',
    'W6',
    'CANONICAL_CONTRACT_VERSION',
    'STATIC_W5_REMEDIATION',
    'W5_REOPEN_REQUIRES',
    'COMMAND',
  ])('rejects missing or changed terminal field %s', (key) => {
    const changed = replayObject(structuredClone(model.disposition))
    changed[key] = 'PASS'
    expect(() => validateTerminalDisposition(changed)).toThrow()
    delete changed[key]
    expect(() => validateTerminalDisposition(changed)).toThrow()
  })
  it.each([
    'MEMBERSHIP_DECISION',
    'QUALIFICATION_CEILING',
    'PROOF_BOUNDARIES',
    'W4P_CENSUS',
    'RECORDED_VALIDATION',
    'FROZEN_DENOMINATORS',
  ])('rejects changed proof/accounting group %s', (key) => {
    const changed = replayObject(structuredClone(model.disposition))
    const group = replayObject(changed[key])
    const field = Object.keys(group)[0]
    group[field] = 'FABRICATED_PASS'
    expect(() => validateTerminalDisposition(changed)).toThrow()
  })
  it('preserves exactly three blockers, seven operand sets, census and actual first denial', () => {
    expect(model.disposition.BLOCKERS.INDEPENDENT_CONTRADICTIONS).toHaveLength(3)
    expect(model.disposition.BLOCKERS.UNRESOLVED_OPERAND_SETS).toHaveLength(7)
    const changed = structuredClone(model.disposition)
    changed.BLOCKERS.UNRESOLVED_OPERAND_SETS.pop()
    expect(() => validateTerminalDisposition(changed)).toThrow()
    expect(model.disposition.W4P_CENSUS).toMatchObject({
      TOTAL_W4P_PAYLOADS: 162,
      ABSENT: 114,
      MATCHING: 38,
      DRIFTED: 3,
      MISSING_PRECONDITIONS: 7,
    })
  })
  it('binds all prior evidence and exact E048 byte range without source edits', () => {
    for (const [file, hash] of Object.entries(model.preservation.SHA256))
      expect(replayHash(read(file))).toBe(hash)
    expect(model.disposition.E048.SOURCE_SHA256).toBe(
      '32f8b632fb11db40437bd9d9f063e30a7ff54fe7ecdeb938736697e685d6775b',
    )
    expect(model.disposition.E048.EXACT_SOURCE_BYTE_RANGE).toEqual([10097, 11905])
    expect(model.disposition.E048.LEDGER_EFFECT_PRESENT).toBe(true)
    expect(model.disposition.FROZEN_DENOMINATORS).toMatchObject({
      NODES: 107,
      EDGES: 231,
      COMPATIBILITY_RECORDS: 127,
      HANDOFF_RECORDS: 86,
      DEFERRED_CONSTRAINTS: 7,
      UNRESOLVED_DOWNSTREAM_OPERANDS: 9,
    })
  })
  it('preserves the active historical failure rather than requiring it to turn green', () => {
    expect(model.disposition.RECORDED_VALIDATION.HISTORICAL_CANONICAL_TEXT_ACCEPTANCE).toBe(
      'FAIL_EXPECTED_PRESERVED_CONTRADICTION',
    )
    expect(model.disposition.RECORDED_VALIDATION.SKIPPED_TESTS_IN_FINAL_RECORDED_RUNS).toBe(0)
    expect(model.preservation.SHA256).toHaveProperty(
      'apps/union-eyes/scripts/provisioning/replay-fake-full-qualification.test.ts',
    )
  })
  it('deterministically checks all persisted closure outputs', async () => {
    const first = await generateTerminalClosure()
    expect(await generateTerminalClosure()).toEqual(first)
    expect(Object.keys(first).sort()).toEqual(Object.values(outputs).sort())
    for (const [file, bytes] of Object.entries(first)) expect(read(file)).toBe(bytes)
  })
})
