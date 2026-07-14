import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => null }))

const executeRoute = await import('../../../app/api/internal/sage/destruction/[requestId]/execute/route')

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/internal/sage/destruction/req-1/execute', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ orgId: 'org-1', workspaceId: 'ws-1' }),
  })
}

const params = Promise.resolve({ requestId: 'req-1' })

describe('SAGE internal destruction execution endpoint', () => {
  beforeEach(() => {
    process.env.SAGE_CRON_SECRET = 'internal-scheduler-secret'
  })

  it('denies an unauthenticated caller', async () => {
    await expect(executeRoute.POST(request(), { params })).resolves.toMatchObject({ status: 401 })
  })

  it('denies an ordinary platform user session without service authority', async () => {
    const userSession = { Cookie: 'next-auth.session-token=ordinary-user', Authorization: 'Bearer user-token' }
    await expect(executeRoute.POST(request(userSession), { params })).resolves.toMatchObject({ status: 401 })
  })

  it('denies a recipient session without the internal scheduler secret', async () => {
    const recipientSession = { Cookie: 'sage_recipient_session=recipient-session', 'x-sage-recipient-session': 'recipient-session' }
    await expect(executeRoute.POST(request(recipientSession), { params })).resolves.toMatchObject({ status: 401 })
  })

  it('denies a caller presenting the wrong internal token', async () => {
    await expect(executeRoute.POST(request({ 'x-sage-internal-token': 'wrong' }), { params })).resolves.toMatchObject({ status: 401 })
  })
})
