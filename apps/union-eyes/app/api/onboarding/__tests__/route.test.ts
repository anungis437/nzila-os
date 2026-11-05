import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/framework', () => ({
  withApi: (_options: unknown, handler: () => Promise<unknown>) => handler,
  ApiError: {
    notImplemented: (message: string) => Object.assign(new Error(message), { status: 501 }),
  },
}))

describe('onboarding route (unsupported pre-signup write)', () => {
  it('fails closed for both methods rather than exposing pending_profiles or pretending to save a submission', async () => {
    const { GET, POST } = await import('../route')
    await expect(GET()).rejects.toMatchObject({ status: 501 })
    await expect(POST()).rejects.toMatchObject({ status: 501 })
  })
})
