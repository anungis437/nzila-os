import { describe, expect, it } from 'vitest'

describe('Flow command module wrappers', () => {
  it('loads all command modules', async () => {
    const modules = await Promise.all([
      import('@/lib/commands/accept-quote'),
      import('@/lib/commands/complete-production'),
      import('@/lib/commands/confirm-order'),
      import('@/lib/commands/confirm-payment'),
      import('@/lib/commands/confirm-purchase-order'),
      import('@/lib/commands/convert-quote-to-order'),
      import('@/lib/commands/create-purchase-order'),
      import('@/lib/commands/create-quote'),
      import('@/lib/commands/create-shipment'),
      import('@/lib/commands/mark-shipment-delivered'),
      import('@/lib/commands/mark-shipment-shipped'),
      import('@/lib/commands/record-payment'),
      import('@/lib/commands/request-quote-revision'),
      import('@/lib/commands/require-deposit'),
      import('@/lib/commands/send-purchase-order'),
      import('@/lib/commands/send-quote'),
      import('@/lib/commands/start-production'),
    ])

    expect(modules).toHaveLength(17)
  })
})
