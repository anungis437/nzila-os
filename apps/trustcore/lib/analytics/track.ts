/**
 * TrustCore — Lightweight Analytics
 *
 * Thin event tracking layer. No external dependencies.
 *
 * In dev/preview: logs to console.
 * In production: can be swapped for a real backend by replacing the
 * `POST /api/analytics` call or routing through a vendor.
 *
 * All events are fire-and-forget — tracking must never block UX.
 */

export type AnalyticsEvent =
  | 'landing_cta_click'
  | 'landing_sample_trust_center_click'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'upgrade_clicked'
  | 'upgrade_modal_opened'
  | 'upgrade_completed'
  | 'export_attempt_blocked'
  | 'lead_captured'

export type EventPayload = Record<string, string | number | boolean | null | undefined>

/**
 * Fire an analytics event.
 *
 * Safe to call from client components or server actions.
 * Never throws — errors are silently swallowed.
 */
export function trackEvent(event: AnalyticsEvent, payload?: EventPayload): void {
  try {
    const entry = {
      event,
      ts: new Date().toISOString(),
      ...(payload ?? {}),
    }

    // Always log in non-production for visibility during development
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[TrustCore Analytics]', entry)
      return
    }

    // In production — fire-and-forget POST (no await, no error surfacing)
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true,
    }).catch(() => {
      // silently ignore — tracking must never block or error the UI
    })
  } catch {
    // silently ignore
  }
}
