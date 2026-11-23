import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assertStagingBase,
  credentialsPresent,
  readCredentialEnv,
  runAuthenticatedSmoke,
  runAuthSmokeCli,
} from './sage-b005-authenticated-http-smoke.mjs'

describe('SAGE B-005 authenticated HTTP smoke', () => {
  it('refuses non-staging origins', () => {
    assert.throws(() => assertStagingBase('https://admin.nzilaventures.com/'), /NON_STAGING/)
    assert.throws(() => assertStagingBase('http://staging-admin.nzilaventures.com/'), /NON_STAGING/)
    assert.equal(
      assertStagingBase('https://staging-admin.nzilaventures.com/'),
      'https://staging-admin.nzilaventures.com',
    )
  })

  it('fail-closed when credentials absent', async () => {
    const receipt = await runAuthenticatedSmoke({
      creds: { base: null, cookie: null, expectedSha: null },
    })
    assert.equal(receipt.result, 'CREDENTIALS_ABSENT')
    assert.equal(receipt.b005Closure, 'NOT_PROVEN')
  })

  it('credentialsPresent requires full staging triple', () => {
    assert.equal(credentialsPresent(readCredentialEnv({})), false)
    assert.equal(
      credentialsPresent({
        base: 'https://staging-admin.nzilaventures.com/',
        cookie: 'session=abcdefghijklmnopqrstuvwxyz',
        expectedSha: 'a'.repeat(40),
      }),
      true,
    )
  })

  it('dry-run with credentials writes DRY_RUN_READY without claiming closure', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sage-b005-auth-'))
    const out = join(dir, 'smoke.json')
    const prev = {
      base: process.env.SAGE_B005_BASE_URL,
      cookie: process.env.SAGE_B005_SESSION_COOKIE,
      sha: process.env.SAGE_B005_EXPECTED_SHA,
    }
    process.env.SAGE_B005_BASE_URL = 'https://staging-admin.nzilaventures.com/'
    process.env.SAGE_B005_SESSION_COOKIE = 'session=test-cookie-value-xx'
    process.env.SAGE_B005_EXPECTED_SHA = 'b'.repeat(40)
    try {
      const receipt = await runAuthSmokeCli(['--dry-run', '--receipt', out])
      assert.equal(receipt.result, 'DRY_RUN_READY')
      assert.equal(receipt.b005Closure, 'NOT_PROVEN')
      const disk = JSON.parse(await readFile(out, 'utf8'))
      assert.equal(disk.kind, 'SAGE_B005_AUTHENTICATED_HTTP_SMOKE')
    } finally {
      if (prev.base === undefined) delete process.env.SAGE_B005_BASE_URL
      else process.env.SAGE_B005_BASE_URL = prev.base
      if (prev.cookie === undefined) delete process.env.SAGE_B005_SESSION_COOKIE
      else process.env.SAGE_B005_SESSION_COOKIE = prev.cookie
      if (prev.sha === undefined) delete process.env.SAGE_B005_EXPECTED_SHA
      else process.env.SAGE_B005_EXPECTED_SHA = prev.sha
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('passes when health SHA matches and routes return 200', async () => {
    const sha = 'c'.repeat(40)
    const fetchImpl = async (url) => {
      if (String(url).endsWith('/api/health')) {
        return {
          status: 200,
          json: async () => ({ status: 'ok', buildInfo: { commit: sha } }),
        }
      }
      return { status: 200 }
    }
    const receipt = await runAuthenticatedSmoke({
      creds: {
        base: 'https://staging-admin.nzilaventures.com/',
        cookie: 'session=abcdefghijklmnopqrstuvwxyz',
        expectedSha: sha,
      },
      fetchImpl,
    })
    assert.equal(receipt.result, 'AUTHENTICATED_SMOKE_PASS')
    assert.equal(receipt.b005Closure, 'NOT_PROVEN')
  })
})
