import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  B005_REQUIRED_TAIL,
  listSageMigrationFiles,
  verifySageMigrationChain,
} from './lib/sage-migration-chain.mjs'
import { runMigrationPreflight } from './sage-b005-migration-preflight.mjs'

describe('SAGE B-005 migration chain', () => {
  it('lists SAGE migrations including institutional 0050–0052', () => {
    const files = listSageMigrationFiles()
    assert.ok(files.length >= 15)
    assert.equal(files[0].startsWith('0032_'), true)
    for (const f of B005_REQUIRED_TAIL) {
      assert.ok(files.includes(f), `missing ${f}`)
    }
    // Union Eyes root migrations are not sage_* and must not appear.
    assert.equal(files.some((f) => f.includes('union') || /^004[5-9]_/.test(f) && !f.includes('_sage_')), false)
  })

  it('verifies on-disk chain against the immutability manifest', () => {
    const result = verifySageMigrationChain()
    assert.equal(result.result, 'CHAIN_OK')
    assert.equal(result.problems.length, 0)
    assert.equal(result.lockedThroughMeetsB005, true)
    assert.equal(result.b005Closure, 'NOT_PROVEN')
  })

  it('verify CLI emits receipt with NOT_PROVEN closure', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sage-b005-mig-'))
    const out = join(dir, 'receipt.json')
    try {
      const receipt = await runMigrationPreflight(['verify', '--out', out])
      assert.equal(receipt.result, 'CHAIN_OK')
      assert.equal(receipt.b005Closure, 'NOT_PROVEN')
      const body = JSON.parse(await (await import('node:fs/promises')).readFile(out, 'utf8'))
      assert.equal(body.kind, 'SAGE_B005_MIGRATION_PREFLIGHT')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('refuses apply without a database URL', async () => {
    const prev = process.env.SAGE_PG_TEST_URL
    const prevDb = process.env.DATABASE_URL
    delete process.env.SAGE_PG_TEST_URL
    delete process.env.DATABASE_URL
    try {
      await assert.rejects(
        () => runMigrationPreflight(['apply']),
        /DATABASE_URL_REQUIRED/,
      )
    } finally {
      if (prev !== undefined) process.env.SAGE_PG_TEST_URL = prev
      if (prevDb !== undefined) process.env.DATABASE_URL = prevDb
    }
  })
})
