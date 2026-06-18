import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockUseLocale,
  mockGetOrdersForProfitability,
  mockGetMandateProfitability,
} = vi.hoisted(() => ({
  mockUseLocale: vi.fn(() => 'en-CA'),
  mockGetOrdersForProfitability: vi.fn(),
  mockGetMandateProfitability: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useLocale: mockUseLocale,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('@/app/actions/profitability', () => ({
  getOrdersForProfitabilityAction: mockGetOrdersForProfitability,
  getMandateProfitabilityAction: mockGetMandateProfitability,
}))

describe('analytics profitability page slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOrdersForProfitability.mockResolvedValue({
      ok: true,
      orders: [
        { id: 'ord-1', ref: 'ORD-1', total: '1000', status: 'closed', createdAt: '2026-06-01T00:00:00.000Z' },
      ],
    })
    mockGetMandateProfitability.mockResolvedValue({ ok: false, error: 'No data' })
  })

  it('renders initial profitability shell with selector and disabled analyze button', async () => {
    const { default: ProfitabilityReportPage } = await import('@/app/(dashboard)/analytics/profitability/page')
    const markup = renderToStaticMarkup(React.createElement(ProfitabilityReportPage))

    expect(markup).toContain('Rentabilité historique')
    expect(markup).toContain('Sélectionner un mandat')
    expect(markup).toContain('— Choisir un mandat —')
    expect(markup).toContain('Analyser la rentabilité')
    expect(markup).toContain('disabled')
    expect(markup).toContain('/en-CA/dashboard/analytics')
  })

  it('renders the report branch when hook state contains profitability data', async () => {
    vi.resetModules()

    const report = {
      orderRef: 'ORD-42',
      revenue: 1500,
      totalCost: 1200,
      grossMarginDollars: 300,
      grossMarginPercent: 20,
      status: 'profitable',
      costs: [
        { source: 'purchase_order', reference: 'PO-1', date: '2026-06-01T00:00:00.000Z', amount: 900 },
        { source: 'product_costs', reference: 'EST-1', date: '2026-06-02T00:00:00.000Z', amount: 300 },
      ],
    }

    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      let call = 0
      return {
        ...actual,
        useEffect: (fn: () => void) => fn(),
        useTransition: () => [false, (cb: () => void) => cb()] as const,
        useState: (initial: unknown) => {
          call += 1
          if (call === 1) return [[{ id: 'ord-1', ref: 'ORD-1', total: '1000', status: 'closed', createdAt: '2026-06-01T00:00:00.000Z' }], vi.fn()] as never
          if (call === 2) return ['ord-1', vi.fn()] as never
          if (call === 3) return [report, vi.fn()] as never
          if (call === 4) return ['', vi.fn()] as never
          return [initial, vi.fn()] as never
        },
      }
    })

    const { default: ProfitabilityReportPage } = await import('@/app/(dashboard)/analytics/profitability/page')
    const markup = renderToStaticMarkup(React.createElement(ProfitabilityReportPage))

    expect(markup).toContain('Revenus')
    expect(markup).toContain('Coûts totaux')
    expect(markup).toContain('Profit brut')
    expect(markup).toContain('Sources de coûts')
    expect(markup).toContain('ORD-42')
    expect(markup).toContain('Rentable')

    vi.doUnmock('react')
  })

  it('renders pending + error states and loss styling variants', async () => {
    vi.resetModules()

    const lossReport = {
      orderRef: 'ORD-LOSS',
      revenue: 500,
      totalCost: 900,
      grossMarginDollars: -400,
      grossMarginPercent: -80,
      status: 'loss',
      costs: [
        { source: 'other_cost', reference: 'OTH-1', date: '2026-06-03T00:00:00.000Z', amount: 900 },
      ],
    }

    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      let call = 0
      return {
        ...actual,
        useEffect: (fn: () => void) => fn(),
        useTransition: () => [true, (cb: () => void) => cb()] as const,
        useState: (initial: unknown) => {
          call += 1
          if (call === 1) return [[{ id: 'ord-2', ref: 'ORD-2', total: '100', status: 'closed', createdAt: '2026-06-01T00:00:00.000Z' }], vi.fn()] as never
          if (call === 2) return ['ord-2', vi.fn()] as never
          if (call === 3) return [lossReport, vi.fn()] as never
          if (call === 4) return ['Impossible de calculer', vi.fn()] as never
          return [initial, vi.fn()] as never
        },
      }
    })

    const { default: ProfitabilityReportPage } = await import('@/app/(dashboard)/analytics/profitability/page')
    const markup = renderToStaticMarkup(React.createElement(ProfitabilityReportPage))

    expect(markup).toContain('Analyse en cours...')
    expect(markup).toContain('Impossible de calculer')
    expect(markup).toContain('Perte')
    expect(markup).toContain('text-red-600')
    expect(markup).toContain('bg-red-50 border-red-200')
    expect(markup).toContain('other_cost')

    vi.doUnmock('react')
  })

  it('renders break-even status branches and product cost label', async () => {
    vi.resetModules()

    const breakEvenReport = {
      orderRef: 'ORD-BE',
      revenue: 1000,
      totalCost: 1000,
      grossMarginDollars: 0,
      grossMarginPercent: 0,
      status: 'break_even',
      costs: [
        { source: 'product_costs', reference: 'EST-2', date: '2026-06-04T00:00:00.000Z', amount: 1000 },
      ],
    }

    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      let call = 0
      return {
        ...actual,
        useEffect: (fn: () => void) => fn(),
        useTransition: () => [false, (cb: () => void) => cb()] as const,
        useState: (initial: unknown) => {
          call += 1
          if (call === 1) return [[{ id: 'ord-3', ref: 'ORD-3', total: '1000', status: 'closed', createdAt: '2026-06-01T00:00:00.000Z' }], vi.fn()] as never
          if (call === 2) return ['ord-3', vi.fn()] as never
          if (call === 3) return [breakEvenReport, vi.fn()] as never
          if (call === 4) return ['', vi.fn()] as never
          return [initial, vi.fn()] as never
        },
      }
    })

    const { default: ProfitabilityReportPage } = await import('@/app/(dashboard)/analytics/profitability/page')
    const markup = renderToStaticMarkup(React.createElement(ProfitabilityReportPage))

    expect(markup).toContain('Seuil')
    expect(markup).toContain('Seuil de rentabilité')
    expect(markup).toContain('text-amber-600')
    expect(markup).toContain('bg-amber-50 border-amber-200')
    expect(markup).toContain('Coûts produits (est.)')

    vi.doUnmock('react')
  })

  it('executes analyze handler branches (empty selection and failed analysis fallback)', async () => {
    vi.resetModules()

    const captured: { onClick?: () => unknown } = {}
    const setError = vi.fn()
    const setReport = vi.fn()

    mockGetOrdersForProfitability.mockResolvedValueOnce({ ok: false, orders: undefined })
    mockGetMandateProfitability.mockResolvedValueOnce({ ok: false, profitability: undefined, error: undefined })

    vi.doMock('react/jsx-dev-runtime', async () => {
      const actual = await vi.importActual<typeof import('react/jsx-dev-runtime')>('react/jsx-dev-runtime')
      return {
        ...actual,
        jsxDEV: (...args: unknown[]) => {
          const [type, props] = args as [unknown, Record<string, unknown> | null]
          if (type === 'button' && props && typeof props.onClick === 'function') {
            captured.onClick = props.onClick as () => unknown
          }
          return (actual.jsxDEV as (...innerArgs: unknown[]) => unknown)(...args)
        },
      }
    })

    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      let call = 0
      return {
        ...actual,
        useEffect: (fn: () => void) => fn(),
        useTransition: () => [false, (cb: () => Promise<void>) => cb()] as const,
        useState: (initial: unknown) => {
          call += 1
          if (call === 1) return [[], vi.fn()] as never
          if (call === 2) return ['', vi.fn()] as never
          if (call === 3) return [null, setReport] as never
          if (call === 4) return ['', setError] as never
          return [initial, vi.fn()] as never
        },
      }
    })

    const { default: ProfitabilityReportPage } = await import('@/app/(dashboard)/analytics/profitability/page')
    renderToStaticMarkup(React.createElement(ProfitabilityReportPage))
    expect(captured.onClick).toBeTypeOf('function')

    captured.onClick?.()
    expect(setError).not.toHaveBeenCalledWith('')

    vi.resetModules()
    captured.onClick = undefined

    vi.doMock('react/jsx-dev-runtime', async () => {
      const actual = await vi.importActual<typeof import('react/jsx-dev-runtime')>('react/jsx-dev-runtime')
      return {
        ...actual,
        jsxDEV: (...args: unknown[]) => {
          const [type, props] = args as [unknown, Record<string, unknown> | null]
          if (type === 'button' && props && typeof props.onClick === 'function') {
            captured.onClick = props.onClick as () => unknown
          }
          return (actual.jsxDEV as (...innerArgs: unknown[]) => unknown)(...args)
        },
      }
    })

    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      let call = 0
      return {
        ...actual,
        useEffect: (fn: () => void) => fn(),
        useTransition: () => [false, (cb: () => Promise<void>) => cb()] as const,
        useState: (initial: unknown) => {
          call += 1
          if (call === 1) return [[], vi.fn()] as never
          if (call === 2) return ['ord-99', vi.fn()] as never
          if (call === 3) return [null, setReport] as never
          if (call === 4) return ['', setError] as never
          return [initial, vi.fn()] as never
        },
      }
    })

    const { default: ProfitabilityReportPage2 } = await import('@/app/(dashboard)/analytics/profitability/page')
    renderToStaticMarkup(React.createElement(ProfitabilityReportPage2))
    expect(captured.onClick).toBeTypeOf('function')

    const clickHandler = captured.onClick as (() => Promise<void> | void) | undefined
    if (clickHandler) {
      await clickHandler()
    }
    await Promise.resolve()

    expect(setError).toHaveBeenCalledWith('')
    expect(setReport).toHaveBeenCalledWith(null)
    expect(setError).toHaveBeenCalledWith('Analysis failed')

    vi.doUnmock('react')
    vi.doUnmock('react/jsx-dev-runtime')
  })

  it('sets report when analyze succeeds', async () => {
    vi.resetModules()

    const captured: { onClick?: () => unknown } = {}
    const profitability = {
      orderRef: 'ORD-OK',
      revenue: 1200,
      totalCost: 800,
      grossMarginDollars: 400,
      grossMarginPercent: 33.3,
      status: 'profitable',
      costs: [],
    }
    const setReport = vi.fn()
    const setError = vi.fn()

    mockGetMandateProfitability.mockResolvedValueOnce({ ok: true, profitability })

    vi.doMock('react/jsx-dev-runtime', async () => {
      const actual = await vi.importActual<typeof import('react/jsx-dev-runtime')>('react/jsx-dev-runtime')
      return {
        ...actual,
        jsxDEV: (...args: unknown[]) => {
          const [type, props] = args as [unknown, Record<string, unknown> | null]
          if (type === 'button' && props && typeof props.onClick === 'function') {
            captured.onClick = props.onClick as () => unknown
          }
          return (actual.jsxDEV as (...innerArgs: unknown[]) => unknown)(...args)
        },
      }
    })

    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      let call = 0
      return {
        ...actual,
        useEffect: (fn: () => void) => fn(),
        useTransition: () => [false, (cb: () => Promise<void>) => cb()] as const,
        useState: (initial: unknown) => {
          call += 1
          if (call === 1) return [[], vi.fn()] as never
          if (call === 2) return ['ord-100', vi.fn()] as never
          if (call === 3) return [null, setReport] as never
          if (call === 4) return ['', setError] as never
          return [initial, vi.fn()] as never
        },
      }
    })

    const { default: ProfitabilityReportPage } = await import('@/app/(dashboard)/analytics/profitability/page')
    renderToStaticMarkup(React.createElement(ProfitabilityReportPage))
    expect(captured.onClick).toBeTypeOf('function')

    await captured.onClick?.()
    await Promise.resolve()

    expect(mockGetMandateProfitability).toHaveBeenCalledWith('ord-100')
    expect(setReport).toHaveBeenCalledWith(profitability)

    vi.doUnmock('react')
    vi.doUnmock('react/jsx-dev-runtime')
  })
})
