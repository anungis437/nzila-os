import { describe, expect, it } from 'vitest'
import { sendNotificationInputSchema } from './service'

const valid = { orgId: 'tenant-a', recipientId: 'user-a', title: 'Policy notice', body: 'Action required', channels: ['in_app'] }

describe('Zod 4 notification ingress compatibility', () => {
  it('preserves dynamic metadata and default priority', () => {
    const parsed = sendNotificationInputSchema.parse({ ...valid, metadata: { policy: { version: 4 }, attempts: 0, enabled: false } })
    expect(parsed.metadata).toEqual({ policy: { version: 4 }, attempts: 0, enabled: false })
    expect(parsed.priority).toBe('normal')
  })
  it('rejects array metadata, empty tenant, and invalid channels', () => {
    expect(sendNotificationInputSchema.safeParse({ ...valid, metadata: [] }).success).toBe(false)
    expect(sendNotificationInputSchema.safeParse({ ...valid, orgId: '' }).success).toBe(false)
    expect(sendNotificationInputSchema.safeParse({ ...valid, channels: ['invalid'] }).success).toBe(false)
  })
})
