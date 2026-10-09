import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHealthServer } from './server.mjs'

describe('synthetic health endpoints', () => {
  let server
  let baseUrl

  before(async () => {
    server = createHealthServer()
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const { port } = server.address()
    baseUrl = `http://127.0.0.1:${port}`
  })

  after(async () => {
    if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  })

  it('returns a non-cacheable healthy response for readiness and liveness', async () => {
    for (const path of ['/health/readiness', '/health/liveness']) {
      const response = await fetch(`${baseUrl}${path}`)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.deepEqual(await response.json(), { status: 'ok' })
    }
  })

  it('returns not found for every other path', async () => {
    for (const path of ['/', '/api/health/readiness', '/api/health/liveness']) {
      const response = await fetch(`${baseUrl}${path}`)
      assert.equal(response.status, 404)
    }
  })

  it('allows only GET requests', async () => {
    const response = await fetch(`${baseUrl}/health/readiness`, { method: 'POST' })
    assert.equal(response.status, 405)
    assert.equal(response.headers.get('allow'), 'GET')
  })
})
