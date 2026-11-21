import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../rewards/cron/route'
import scheduled from '@/lib/operations/scheduled-jobs.json'
beforeEach(() => {
  process.env.CRON_SECRET_KEY = 'synthetic-rewards-cron-key'
})
afterEach(() => {
  delete process.env.CRON_SECRET_KEY
})
const request = (key?: string, task = 'all') =>
  new NextRequest(`http://localhost/api/rewards/cron?task=${task}`, {
    method: 'POST',
    headers: key ? { 'x-cron-secret': key } : {},
  })
describe('deferred rewards automation callback', () => {
  it('authenticates before reporting unavailable', async () => {
    expect((await POST(request())).status).toBe(401)
    expect((await POST(request('wrong'))).status).toBe(401)
    const response = await POST(request('synthetic-rewards-cron-key'))
    expect(response.status).toBe(501)
    expect(JSON.stringify(await response.json())).toContain('NOT_IMPLEMENTED')
  })
  it('retains input validation after authentication', async () => {
    expect((await POST(request('synthetic-rewards-cron-key', 'invented'))).status).toBe(400)
  })
  it('has no active job while credit automation is deferred', () => {
    expect(scheduled.jobs.some((job) => job.path.startsWith('/api/rewards/cron'))).toBe(false)
  })
})
