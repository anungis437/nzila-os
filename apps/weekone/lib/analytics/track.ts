import { WEEKONE_ANALYTICS_EVENTS, type WeekoneAnalyticsEventName } from './events'

interface TrackPayload {
  eventName: WeekoneAnalyticsEventName
  context?: Record<string, unknown>
}

export async function trackClientEvent(payload: TrackPayload): Promise<void> {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Analytics should never block UX.
  }
}

export { WEEKONE_ANALYTICS_EVENTS }
