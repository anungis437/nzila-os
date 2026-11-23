import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verifySageMigrationChain } from './lib/sage-migration-chain.mjs'
import {
  composeQualificationReceipt,
  runQualificationReceipt,
  resolveHeadSha,
} from './sage-b005-qualification-receipt.mjs'

describe('SAGE B-005 qualification receipt', () => {
  it('never elevates b005Closure from offline sections alone', () => {
    const chain = verifySageMigrationChain()
    const receipt = composeQualificationReceipt({
      gitSha: 'a'.repeat(40),
      chain,
      migrationReceipt: { apply: { result: 'APPLY_OK' } },
      httpPreflight: { kind: 'SAGE_STAGING_HTTP_PREFLIGHT', result: 'ANONYMOUS_BOUNDARY_PASS' },
      authSmoke: null,
      restoreHarness: null,
      expectedImageDigest: 'sha256:deadbeef',
    })
    assert.equal(receipt.b005Closure, 'NOT_PROVEN')
    assert.equal(receipt.result, 'QUALIFICATION_INCOMPLETE')
    assert.equal(receipt.sections.find((s) => s.id === 'civic.c1').state, 'NO_GO')
  })

  it('writes a receipt file for the current HEAD', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sage-b005-receipt-'))
    const out = join(dir, 'q.json')
    const sha = resolveHeadSha()
    try {
      const receipt = await runQualificationReceipt(['--git-sha', sha, '--out', out])
      assert.equal(receipt.gitSha, sha)
      assert.equal(receipt.kind, 'SAGE_B005_QUALIFICATION_RECEIPT')
      const disk = JSON.parse(await readFile(out, 'utf8'))
      assert.equal(disk.b005Closure, 'NOT_PROVEN')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
