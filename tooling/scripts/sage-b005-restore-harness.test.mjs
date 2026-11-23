import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runRestoreHarness, runRestoreHarnessCli } from './sage-b005-restore-harness.mjs'

describe('SAGE B-005 restore harness', () => {
  it('proves local dump/restore non-resurrection without elevating B-005', async () => {
    const receipt = await runRestoreHarness()
    assert.equal(receipt.result, 'RESTORE_HARNESS_PASS')
    assert.equal(receipt.b005Closure, 'NOT_PROVEN')
    assert.ok(receipt.checks.every((c) => c.pass))
  })

  it('writes a receipt file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sage-b005-restore-'))
    const out = join(dir, 'restore.json')
    try {
      const receipt = await runRestoreHarnessCli(['--receipt', out])
      assert.equal(receipt.kind, 'SAGE_B005_RESTORE_HARNESS')
      const disk = JSON.parse(await readFile(out, 'utf8'))
      assert.equal(disk.b005Closure, 'NOT_PROVEN')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
