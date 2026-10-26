'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface RemittanceRow {
  id: string
  employerId?: string
  totalAmount?: string
  processingStatus?: string
}

type PanelState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'rows'; rows: RemittanceRow[] }
  | { kind: 'denied'; code: string }

const denialKey = (code: string): 'unissued' | 'duty' | 'segregation' | 'missing' | 'denied' => {
  if (code === 'FINANCIAL_MANDATES_NOT_ISSUED') return 'unissued'
  if (code === 'DUTY_NOT_HELD') return 'duty'
  if (code === 'SEGREGATION_OF_DUTIES') return 'segregation'
  if (code === 'NOT_FOUND') return 'missing'
  return 'denied'
}

export function PrincipalFinancialAuthorityPanel() {
  const t = useTranslations('financialAuthorityPage')
  const [state, setState] = useState<PanelState>({ kind: 'loading' })

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const response = await fetch('/api/dues/remittances')
      const body = (await response.json().catch(() => ({}))) as { data?: RemittanceRow[]; code?: string; details?: { code?: string } }
      if (!response.ok) {
        setState({ kind: 'denied', code: body.details?.code ?? body.code ?? 'denied' })
        return
      }
      const rows = Array.isArray(body.data) ? body.data : []
      setState(rows.length === 0 ? { kind: 'empty' } : { kind: 'rows', rows })
    } catch {
      setState({ kind: 'denied', code: 'denied' })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch('/api/dues/remittances')
        const body = (await response.json().catch(() => ({}))) as { data?: RemittanceRow[]; code?: string; details?: { code?: string } }
        if (cancelled) return
        if (!response.ok) {
          setState({ kind: 'denied', code: body.details?.code ?? body.code ?? 'denied' })
          return
        }
        const rows = Array.isArray(body.data) ? body.data : []
        setState(rows.length === 0 ? { kind: 'empty' } : { kind: 'rows', rows })
      } catch {
        if (!cancelled) setState({ kind: 'denied', code: 'denied' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      {state.kind === 'loading' ? <p>{t('loading')}</p> : null}
      {state.kind === 'empty' ? <p>{t('empty')}</p> : null}
      {state.kind === 'denied' ? (
        <div className="space-y-3">
          <p role="alert">{t(denialKey(state.code))}</p>
          <button type="button" className="rounded border px-3 py-2" onClick={() => void load()}>
            {t('retry')}
          </button>
        </div>
      ) : null}
      {state.kind === 'rows' ? (
        <ul className="divide-y rounded border">
          {state.rows.map((row) => (
            <li key={row.id} className="grid gap-1 p-3 sm:grid-cols-3">
              <span>
                <span className="block text-xs text-muted-foreground">{t('employer')}</span>
                {row.employerId ?? row.id}
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">{t('amount')}</span>
                {row.totalAmount ?? '—'}
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">{t('status')}</span>
                {row.processingStatus ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
