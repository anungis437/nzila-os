import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackEvent } from './telemetry'

describe('telemetry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('pushes tracked events to dataLayer when available', () => {
    const dataLayer: Array<Record<string, unknown>> = []
    const sendBeacon = vi.fn(() => true)

    vi.stubGlobal('window', {
      location: { pathname: '/portfolio' },
      dataLayer,
      dispatchEvent: vi.fn(),
    })

    vi.stubGlobal('navigator', {
      sendBeacon,
    })

    trackEvent('cta_portfolio', { source: 'home_hero' })

    expect(sendBeacon).toHaveBeenCalledOnce()
    expect(dataLayer).toHaveLength(1)
    expect(dataLayer[0]).toMatchObject({
      event: 'nzila_cta_portfolio',
      page: '/portfolio',
    })
  })
})
