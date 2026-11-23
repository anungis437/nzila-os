import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { composeBuildProvenance, runBuildProvenance, resolveHeadSha } from './sage-b005-build-provenance.mjs'

describe('SAGE B-005 build provenance', () => {
  it('never elevates b005Closure from SHA/digest expectation alone', () => {
    const receipt = composeBuildProvenance({
      gitSha: 'a'.repeat(40),
      expectedImageDigest: 'sha256:' + 'b'.repeat(64),
      imageRef: 'nzilaos.azurecr.io/platform-admin:candidate',
    })
    assert.equal(receipt.b005Closure, 'NOT_PROVEN')
    assert.equal(receipt.result, 'EXPECTATION_RECORDED')
    assert.equal(receipt.azureRevision, null)
  })

  it('writes a receipt for the current HEAD', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sage-b005-prov-'))
    const out = join(dir, 'prov.json')
    const sha = resolveHeadSha()
    try {
      const receipt = await runBuildProvenance(['--git-sha', sha, '--out', out])
      assert.equal(receipt.gitSha, sha)
      const disk = JSON.parse(await readFile(out, 'utf8'))
      assert.equal(disk.kind, 'SAGE_B005_BUILD_PROVENANCE')
      assert.equal(disk.b005Closure, 'NOT_PROVEN')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
