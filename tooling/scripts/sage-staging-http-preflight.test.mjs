import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertSageStagingOrigin,
  inspectSageStagingHttp,
  routeIsProtectedButPresent,
} from './sage-staging-http-preflight.mjs'

const BASE = 'https://staging-admin.nzilaventures.com'
const SHA = 'a'.repeat(40)

function mockFetch({
  commit = SHA,
  db = 'ok',
  healthStatus = 200,
  healthBody = true,
  pageStatus = 307,
  apiStatus = 401,
} = {}) {
  return async (url, init) => {
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    if (url === BASE + '/api/health') {
      return new Response(healthBody ? JSON.stringify({
        status: 'ok',
        app: '@nzila/platform-admin',
        checks: { db },
        buildInfo: { commit },
      }) : '<html>Unavailable</html>', {
        status: healthStatus,
        headers: { 'content-type': healthBody ? 'application/json' : 'text/html' },
      })
    }
    if (url === BASE + '/sage') {
      return new Response(null, { status: pageStatus, headers: { location: '/sign-in' } })
    }
    if (url === BASE + '/api/sage/workspaces') {
      return new Response(null, { status: apiStatus })
    }
    throw new Error('unexpected probe URL')
  }
}

describe('SAGE staging HTTP preflight — read-only, no production fallback', () => {
  it('accepts the exact staging hostname only', () => {
    assert.equal(assertSageStagingOrigin(BASE), BASE)
    assert.equal(assertSageStagingOrigin(BASE + '/'), BASE)
    for (const url of [
      'http://staging-admin.nzilaventures.com',
      'https://admin.nzilaventures.com',
      'https://staging-admin.nzilaventures.com.attacker.test',
      'https://staging-admin.nzilaventures.com.evil',
      'https://staging-admin.nzilaventures.com/api/health',
      'https://user:pass@staging-admin.nzilaventures.com',
      'https://staging-admin.nzilaventures.com/?token=secret',
      'https://nzila-canada-prod-rg.azurewebsites.net',
    ]) {
      assert.throws(() => assertSageStagingOrigin(url), /REFUSED/)
    }
  })

  it('accepts only anonymous refusal or a local sign-in redirect as route evidence', () => {
    for (const code of [401, 403]) assert.equal(routeIsProtectedButPresent(code, null), true)
    for (const code of [302, 303, 307, 308]) {
      assert.equal(routeIsProtectedButPresent(code, '/sign-in'), true)
      assert.equal(routeIsProtectedButPresent(code, '/en-CA/sign-in'), true)
      assert.equal(routeIsProtectedButPresent(code, 'https://login.attacker.test'), false)
    }
    for (const code of [200, 404, 500, null]) {
      assert.equal(routeIsProtectedButPresent(code, null), false)
    }
  })

  it('records an exact-SHA and protected-route pass without claiming B-005 GO', async () => {
    const receipt = await inspectSageStagingHttp({
      base: BASE,
      expectedSha: SHA,
      fetchImpl: mockFetch(),
      observedAt: '2026-11-23T00:00:00.000Z',
    })
    assert.equal(receipt.result, 'HTTP_PREFLIGHT_PASS')
    assert.equal(receipt.b005Closure, 'NOT_PROVEN')
    assert.equal(receipt.health.commit, SHA)
    assert.equal(receipt.health.db, 'ok')
    assert.equal(receipt.routes.length, 2)
    assert.ok(receipt.routes.every((r) => r.protected))
    assert.equal(JSON.stringify(receipt).includes('secret'), false)
    assert.equal(receipt.unsupportedClaims.length, 5)
  })

  it('refuses a stale image, missing database or HTML unavailable health', async () => {
    for (const overrides of [
      { commit: 'b'.repeat(40) },
      { db: 'degraded' },
      { healthStatus: 503, healthBody: false },
    ]) {
      const receipt = await inspectSageStagingHttp({
        base: BASE, expectedSha: SHA, fetchImpl: mockFetch(overrides),
      })
      assert.equal(receipt.result, 'HTTP_PREFLIGHT_FAIL')
      assert.equal(receipt.b005Closure, 'NOT_PROVEN')
    }
  })

  it('refuses missing route or anonymous API access even when health is healthy', async () => {
    for (const overrides of [{ pageStatus: 404 }, { apiStatus: 404 }, { apiStatus: 200 }]) {
      const receipt = await inspectSageStagingHttp({
        base: BASE, expectedSha: SHA, fetchImpl: mockFetch(overrides),
      })
      assert.equal(receipt.result, 'HTTP_PREFLIGHT_FAIL')
    }
  })

  it('fails closed on network problems, malformed SHA and production host', async () => {
    const failed = await inspectSageStagingHttp({
      base: BASE, expectedSha: SHA, fetchImpl: async () => { throw Error('offline') },
    })
    assert.equal(failed.result, 'HTTP_PREFLIGHT_FAIL')
    assert.equal(failed.health.code, null)
    await assert.rejects(() => inspectSageStagingHttp({
      base: BASE, expectedSha: 'short', fetchImpl: mockFetch(),
    }), /EXPECTED_FULL_COMMIT_SHA_REQUIRED/)
    await assert.rejects(() => inspectSageStagingHttp({
      base: 'https://admin.nzilaventures.com', expectedSha: SHA, fetchImpl: mockFetch(),
    }), /NON_STAGING_ORIGIN_REFUSED/)
  })
})
