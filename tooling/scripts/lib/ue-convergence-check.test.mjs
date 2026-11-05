import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateRule, validateRegister } from './ue-convergence-check.mjs'

const exists = (...paths) => ({ fileExists: (p) => paths.includes(p), commitExists: (s) => s === 'abc1234' })

const entry = (over = {}) => ({
  id: 'UE-CONV-A-001',
  domain: 'identity',
  capability: 'x',
  workstream: 'A',
  canonicalOwner: 'owner',
  sources: [],
  defect: 'd',
  consumers: [],
  securityImplications: 's',
  requiredImplementation: 'r',
  evidence: [],
  status: 'OPEN',
  retirement: { disposition: 'NONE' },
  ...over,
})
const reg = (...entries) => ({ schemaVersion: 1, entries })
const problems = (r, io = exists()) => validateRegister(r, io).problems

test('a well-formed open entry passes and is counted', () => {
  const r = validateRegister(reg(entry()), exists())
  assert.deepEqual(r.problems, [])
  assert.equal(r.counts.OPEN, 1)
})

test('rejects a bad schema version, an empty register, a malformed or duplicate id', () => {
  assert.ok(problems({ schemaVersion: 2, entries: [entry()] }).some((p) => /schemaVersion/.test(p)))
  assert.ok(problems({ schemaVersion: 1, entries: [] }).some((p) => /non-empty/.test(p)))
  assert.ok(problems(reg(entry({ id: 'BAD-1' }))).some((p) => /id must match/.test(p)))
  assert.ok(problems(reg(entry(), entry())).some((p) => /duplicate id/.test(p)))
})

test('requires every descriptive field and a valid status and workstream', () => {
  const p = problems(reg(entry({ defect: ' ', securityImplications: '', status: 'DONE', workstream: 'Z' })))
  for (const re of [/defect is required/, /securityImplications is required/, /status must be/, /workstream must be/]) assert.ok(p.some((x) => re.test(x)), String(re))
})

test('a CLOSED entry must cite evidence, and that evidence must exist', () => {
  assert.ok(problems(reg(entry({ status: 'CLOSED' }))).some((p) => /CLOSED requires evidence/.test(p)))
  const missing = entry({ status: 'CLOSED', evidence: [{ type: 'test', ref: 'a/b.test.ts' }] })
  assert.ok(problems(reg(missing)).some((p) => /evidence test does not exist/.test(p)))
  assert.deepEqual(problems(reg(missing), exists('a/b.test.ts')), [])
})

test('commit evidence must be a real sha that exists', () => {
  const closed = (ref) => entry({ status: 'CLOSED', evidence: [{ type: 'commit', ref }] })
  assert.ok(problems(reg(closed('not-a-sha'))).some((p) => /not a sha/.test(p)))
  assert.ok(problems(reg(closed('deadbee'))).some((p) => /commit does not exist/.test(p)))
  assert.deepEqual(problems(reg(closed('abc1234'))), [])
})

test('an EXTERNAL_GATE names its owner and exact missing proof, and nothing else may carry a gate', () => {
  assert.ok(problems(reg(entry({ status: 'EXTERNAL_GATE' }))).some((p) => /EXTERNAL_GATE requires/.test(p)))
  assert.deepEqual(problems(reg(entry({ status: 'EXTERNAL_GATE', externalGate: { owner: 'ops', missingProof: 'a log' } }))), [])
  assert.ok(problems(reg(entry({ externalGate: { owner: 'ops', missingProof: 'x' } }))).some((p) => /only valid on an EXTERNAL_GATE/.test(p)))
})

test('referenced source files and consumer paths must exist; tables and symbols are not checked', () => {
  const e = entry({
    sources: [
      { kind: 'file', ref: 'x/y.ts', classification: 'CANONICAL' },
      { kind: 'table', ref: 'some_table', classification: 'SUPPORTED_PROJECTION' },
    ],
    consumers: ['x/consumer.ts', 'a free-text consumer'],
  })
  const p = problems(reg(e))
  assert.ok(p.some((x) => /source file does not exist: x\/y\.ts/.test(x)))
  assert.ok(p.some((x) => /consumer path does not exist: x\/consumer\.ts/.test(x)))
  assert.equal(p.filter((x) => /some_table|free-text/.test(x)).length, 0)
  assert.deepEqual(problems(reg(e), exists('x/y.ts', 'x/consumer.ts')), [])
})

test('classifications are a closed set', () => {
  const p = problems(reg(entry({ sources: [{ kind: 'table', ref: 't', classification: 'WHATEVER' }] })))
  assert.ok(p.some((x) => /classification must be one of/.test(x)))
})

test('REMOVE needs a replacement, a real retirement commit and a CLOSED entry; RETIRE_PENDING needs a replacement', () => {
  const removed = (r, status = 'CLOSED') => entry({ status, evidence: [{ type: 'commit', ref: 'abc1234' }], retirement: r })
  assert.ok(problems(reg(removed({ disposition: 'REMOVE' }))).some((p) => /REMOVE requires/.test(p)))
  assert.ok(problems(reg(removed({ disposition: 'REMOVE', replacement: 'x', commit: 'deadbee' }))).some((p) => /retirement commit does not exist/.test(p)))
  assert.ok(problems(reg(removed({ disposition: 'REMOVE', replacement: 'x', commit: 'abc1234' }, 'OPEN'))).some((p) => /requires a CLOSED entry/.test(p)))
  assert.deepEqual(problems(reg(removed({ disposition: 'REMOVE', replacement: 'x', commit: 'abc1234' }))), [])
  assert.ok(problems(reg(entry({ retirement: { disposition: 'RETIRE_PENDING' } }))).some((p) => /RETIRE_PENDING requires/.test(p)))
  assert.ok(problems(reg(entry({ retirement: { disposition: 'BANANA' } }))).some((p) => /disposition must be/.test(p)))
})

const rule = (over = {}) => ({ id: 'R', description: 'legacy', allowed: [], ...over })

test('ratchet: a new occurrence fails, an allowlisted one passes, a vanished one is stale', () => {
  const r = rule({ allowed: [{ file: 'a.ts', reason: 'legacy' }, { file: 'gone.ts', reason: 'legacy' }] })
  const out = evaluateRule(r, ['a.ts', 'new.ts'])
  assert.deepEqual(out.problems, ['R: unexpected occurrence in new.ts — legacy'])
  assert.deepEqual(out.stale, ['R: allowlisted file no longer matches (remove it): gone.ts'])
})

test('ratchet: an allowlist entry without a reason is rejected', () => {
  assert.ok(evaluateRule(rule({ allowed: [{ file: 'a.ts', reason: ' ' }] }), ['a.ts']).problems.some((p) => /no reason/.test(p)))
})

test('ratchet: a zero rule fails on any occurrence and may not carry an allowlist', () => {
  assert.equal(evaluateRule(rule({ mode: 'zero' }), ['x.ts']).problems.length, 1)
  assert.deepEqual(evaluateRule(rule({ mode: 'zero' }), []).problems, [])
  assert.ok(evaluateRule(rule({ mode: 'zero', allowed: [{ file: 'x.ts', reason: 'r' }] }), []).problems.some((p) => /may not have an allowlist/.test(p)))
})
