import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { requireRestartCaseHandoff, resetRestartCaseHandoff } from './ue-runtime-restart-handoff.mjs'

function withState(run) {
  const dir = mkdtempSync(join(tmpdir(), 'ue-restart-handoff-'))
  try { run(join(dir, 'journey-a-state.json')) } finally { rmSync(dir, { recursive: true, force: true }) }
}
const valid = { caseId: '123e4567-e89b-42d3-a456-426614174000', claimNumber: 'QA-2026-001' }

test('missing hand-off fails closed, never interpreted as a successful restart', () => withState((file) => {
  assert.throws(() => requireRestartCaseHandoff(file), /was not written/)
}))

test('stale prior-run hand-off is removed before new filing', () => withState((file) => {
  writeFileSync(file, JSON.stringify(valid))
  resetRestartCaseHandoff(file)
  assert.throws(() => requireRestartCaseHandoff(file), /was not written/)
}))

test('malformed JSON and invalid identifiers fail closed', () => withState((file) => {
  writeFileSync(file, '{')
  assert.throws(() => requireRestartCaseHandoff(file), /not valid JSON/)
  for (const bad of [
    null, {}, { ...valid, caseId: 'not-a-uuid' },
    { ...valid, claimNumber: '  ' }, { ...valid, claimNumber: null },
  ]) {
    writeFileSync(file, JSON.stringify(bad))
    assert.throws(() => requireRestartCaseHandoff(file), /valid case identifier or claim number/)
  }
}))

test('fresh filing hand-off is read without modification', () => withState((file) => {
  const payload = JSON.stringify({ ...valid, title: 'A real filing' })
  writeFileSync(file, payload)
  assert.deepEqual(requireRestartCaseHandoff(file), valid)
  assert.equal(readFileSync(file, 'utf8'), payload)
}))
