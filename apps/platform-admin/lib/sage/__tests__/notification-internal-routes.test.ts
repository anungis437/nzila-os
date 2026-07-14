import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => null }))

const dispatchRoute = await import('../../../app/api/internal/sage/notifications/dispatch/route')
const readinessRoute = await import('../../../app/api/internal/sage/notifications/readiness/route')

function request(method: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/internal/sage/notifications', { method, headers })
}

describe('SAGE internal notification endpoints', () => {
  beforeEach(() => {
    process.env.SAGE_CRON_SECRET = 'internal-scheduler-secret'
  })

  it('denies an unauthenticated caller', async () => {
    await expect(dispatchRoute.POST(request('POST'))).resolves.toMatchObject({ status: 401 })
    await expect(readinessRoute.GET(request('GET'))).resolves.toMatchObject({ status: 401 })
  })

  it('denies an ordinary platform user session without service authority', async () => {
    const userSession = { Cookie: 'next-auth.session-token=ordinary-user', Authorization: 'Bearer user-token' }
    await expect(dispatchRoute.POST(request('POST', userSession))).resolves.toMatchObject({ status: 401 })
    await expect(readinessRoute.GET(request('GET', userSession))).resolves.toMatchObject({ status: 401 })
  })

  it('denies a recipient session without the internal scheduler secret', async () => {
    const recipientSession = { Cookie: 'sage_recipient_session=recipient-session', 'x-sage-recipient-session': 'recipient-session' }
    await expect(dispatchRoute.POST(request('POST', recipientSession))).resolves.toMatchObject({ status: 401 })
    await expect(readinessRoute.GET(request('GET', recipientSession))).resolves.toMatchObject({ status: 401 })
  })
})
