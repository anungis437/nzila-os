import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}))

const request = (method: string, path: string, body?: unknown) =>
  new NextRequest(`http://localhost/api/emergency/${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })

describe('emergency routes answer 501 and assert nothing (UE-EMERGENCY-DECLARATION)', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['activate', 'POST', { memberId: '11111111-1111-1111-1111-111111111111', emergencyType: 'flood', affectedRegions: ['ON'], expectedDurationDays: 3 }],
    ['recovery', 'POST', { emergencyId: '22222222-2222-2222-2222-222222222222', memberId: '11111111-1111-1111-1111-111111111111' }],
    ['dashboard', 'GET', undefined],
  ])('%s does not declare, activate, purge or report anything', async (name, method, body) => {
    const route = await import(`../emergency/${name}/route`)
    const response = await route[method as 'GET' | 'POST'](request(method, name, body))
    expect(response.status).toBe(501)
    const json = await response.json()
    if (name === 'dashboard') expect(json.success).toBe(false)
    expect(json.error.code).toBe('NOT_IMPLEMENTED')
    const text = JSON.stringify(json)
    for (const claim of ['breakGlassActivated', 'allowedOperations', 'notificationsSent', 'preparednessLevel', 'recovery_in_progress', 'pipedasafe']) {
      expect(text).not.toContain(claim)
    }
  })
})
