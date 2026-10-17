import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import express, { type ErrorRequestHandler } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedOrgBinding } from '@nzila/platform-auth/org-binding'

const state = vi.hoisted(() => ({
  bind: vi.fn(),
  log: { error: vi.fn(), warn: vi.fn() },
}))
vi.mock('@nzila/platform-auth/org-binding', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nzila/platform-auth/org-binding')>()),
  withBearerOrgBinding: state.bind,
}))
vi.mock('@/lib/logger', () => ({ logger: state.log }))

import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding'
import {
  authenticate,
  requireFinancialSystemAdministrator,
  type FinancialRequest,
} from '../../services/financial-service/src/middleware/authentication'
import { parseFinancialRequestBody } from '../../services/financial-service/src/middleware/request-body'
import { requireIdempotencyKey } from '../../services/financial-service/src/middleware/idempotency'

describe('financial HTTP boundaries (unit authority; actual owned HTTP transport)', () => {
  let server: Server
  let url: string
  const organizationId = '11111111-1111-4111-8111-111111111111'
  const binding: AuthenticatedOrgBinding = {
    userId: 'canonical-user',
    organizationId,
    role: 'member',
    isSystemAdmin: false,
    sessionToken: 'synthetic-bearer',
    expiresAt: new Date(Date.now() + 30000),
    authority: 'pg-session',
  }
  let bridgeLive: boolean
  let bridgeRevoked: boolean

  beforeEach(async () => {
    vi.clearAllMocks()
    bridgeLive = false
    bridgeRevoked = false
    state.bind.mockImplementation(
      async (
        _token: string,
        _options: unknown,
        callback: (actor: AuthenticatedOrgBinding) => Promise<unknown>,
      ) => {
        bridgeLive = true
        try {
          return await callback(binding)
        } finally {
          bridgeLive = false
          bridgeRevoked = true
        }
      },
    )
    const app = express()
    app.use(parseFinancialRequestBody)
    app.use('/api/', requireIdempotencyKey)
    app.get('/actor', authenticate, (req: FinancialRequest, res) => {
      setImmediate(() => res.json({ actor: req.user, bridgeLive }))
    })
    app.post('/admin', authenticate, requireFinancialSystemAdministrator, (_req, res) => {
      res.json({ allowed: true })
    })
    app.post('/api/ordinary', (req, res) => res.json({ body: req.body }))
    for (const endpoint of ['/api/payments/webhook/stripe', '/api/donations/webhooks/stripe']) {
      app.post(endpoint, express.raw({ type: 'application/json' }), (req, res) => {
        res.json({ raw: Buffer.isBuffer(req.body), text: req.body.toString('utf8') })
      })
    }
    const errorHandler: ErrorRequestHandler = (_error, _req, res, _next) => {
      res.status(400).json({ error: 'Rejected malformed request' })
    }
    app.use(errorHandler)
    server = createServer(app)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Owned HTTP listener missing')
    url = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
    expect(server.listening).toBe(false)
  })

  it('rejects development-header impersonation without invoking authority', async () => {
    const response = await fetch(`${url}/actor`, { headers: { 'x-test-user': 'admin' } })
    expect(response.status).toBe(401)
    expect(state.bind).not.toHaveBeenCalled()
  })

  it('binds canonical actor aliases and keeps authority alive through async response', async () => {
    const response = await fetch(`${url}/actor`, {
      headers: { authorization: 'Bearer opaque', 'x-organization-id': organizationId },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      actor: {
        id: 'canonical-user',
        userId: 'canonical-user',
        tenantId: organizationId,
        organizationId,
        role: 'member',
        isSystemAdmin: false,
      },
      bridgeLive: true,
    })
    await vi.waitFor(() => expect(bridgeRevoked).toBe(true))
    expect(state.bind).toHaveBeenCalledWith('opaque', { organizationId }, expect.any(Function))
  })

  it.each([
    ['UNAUTHENTICATED', 401],
    ['SESSION_AUTHORITY_REQUIRED', 401],
    ['MEMBERSHIP_REQUIRED', 403],
    ['INVALID_ORGANIZATION', 403],
  ] as const)('exposes explicit %s denial with HTTP %i', async (code, status) => {
    state.bind.mockRejectedValue(new AuthOrgBindingError(code))
    const response = await fetch(`${url}/actor`, { headers: { authorization: 'Bearer opaque' } })
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ success: false, error: code })
  })

  it('does not turn unavailable authentication authority into an empty actor', async () => {
    state.bind.mockRejectedValue(new Error('Synthetic database authority failure'))
    const response = await fetch(`${url}/actor`, { headers: { authorization: 'Bearer opaque' } })
    expect(response.status).toBe(503)
    expect(state.log.error).toHaveBeenCalledOnce()
  })

  it('denies global reconciliation authority to an ordinary member', async () => {
    const response = await fetch(`${url}/admin`, {
      method: 'POST',
      headers: { authorization: 'Bearer opaque' },
    })
    expect(response.status).toBe(403)
  })

  it.each([
    '/api/payments/webhook/stripe',
    '/api/donations/webhooks/stripe',
    '/api/payments/webhook/stripe?delivery=synthetic',
    '/api/donations/webhooks/stripe?delivery=synthetic',
  ])('preserves exact signed webhook bytes at %s', async (endpoint) => {
    const text = '{ "event": "synthetic", "spacing":  true }\n'
    const response = await fetch(`${url}${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: text,
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ raw: true, text })
  })

  it('retains mandatory idempotency on ordinary mutations', async () => {
    const response = await fetch(`${url}/api/ordinary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"value":1}',
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' })
  })

  it('parses ordinary JSON after idempotency requirements are met', async () => {
    const response = await fetch(`${url}/api/ordinary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'synthetic-unique' },
      body: '{"value":1}',
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ body: { value: 1 } })
  })

  it('rejects malformed ordinary JSON explicitly', async () => {
    const response = await fetch(`${url}/api/ordinary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    expect(response.status).toBe(400)
  })
})
