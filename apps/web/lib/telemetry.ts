export type TelemetryProperties = Record<string, string | number | boolean>

type TelemetryEvent = {
  event: string
  properties?: TelemetryProperties
  ts: string
  page: string
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
  }
}

const TELEMETRY_ENDPOINT = process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT ?? '/api/telemetry/events'

export function trackEvent(event: string, properties?: TelemetryProperties): void {
  if (typeof window === 'undefined') {
    return
  }

  const payload: TelemetryEvent = {
    event,
    properties,
    ts: new Date().toISOString(),
    page: window.location.pathname,
  }

  // Keep the browser-level event stream available for GTM/Tag Manager style integrations.
  window.dispatchEvent(new CustomEvent('nzila:telemetry', { detail: payload }))

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ ...payload, event: `nzila_${event}` })
  }

  const body = JSON.stringify(payload)
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon(TELEMETRY_ENDPOINT, blob)
    return
  }

  void fetch(TELEMETRY_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  })
}
