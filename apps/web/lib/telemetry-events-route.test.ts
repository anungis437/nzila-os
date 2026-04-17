import { describe, expect, it } from 'vitest'
import { validateEventPayload } from './telemetry-events'

describe('web telemetry events route', () => {
  it('accepts valid telemetry payload', () => {
    const payload = validateEventPayload({
        event: 'cta_portfolio',
        page: '/home',
        ts: new Date().toISOString(),
        properties: { source: 'hero', clicks: 1, engaged: true },
      })

    expect(payload.event).toBe('cta_portfolio')
  })

  it('rejects invalid event names', () => {
    expect(() =>
      validateEventPayload({
        event: 'bad event with spaces',
      }),
    ).toThrow()
  })

  it('rejects large property bags', () => {
    const properties = Object.fromEntries(
      Array.from({ length: 21 }).map((_, idx) => [`key_${idx}`, idx]),
    )

    expect(() =>
      validateEventPayload({
        event: 'cta_portfolio',
        properties,
      }),
    ).toThrow()
  })
})
