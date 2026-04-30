import { createNotification } from '@/lib/maestria-persistence'

export interface NotificationRequest {
  channel: 'email' | 'in_app' | 'webhook'
  recipient: string
  subject: string
  body: string
  metadata?: Record<string, unknown>
}

function resolveDeliveryStatus(channel: NotificationRequest['channel']) {
  if (channel === 'in_app') return 'delivered' as const
  return 'queued' as const
}

export function deliverNotification(input: NotificationRequest) {
  const status = resolveDeliveryStatus(input.channel)
  const deliveredAt = status === 'delivered' ? new Date().toISOString() : null

  return createNotification({
    channel: input.channel,
    recipient: input.recipient,
    subject: input.subject,
    body: input.body,
    status,
    deliveredAt,
    metadata: {
      provider: input.channel === 'email' ? 'smtp-configurable' : input.channel === 'webhook' ? 'http-dispatcher' : 'internal-stream',
      ...(input.metadata ?? {}),
    },
  })
}
