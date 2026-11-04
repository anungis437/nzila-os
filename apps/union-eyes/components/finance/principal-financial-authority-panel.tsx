'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiErrorMessage, envelopeRows, isRecord } from '@/lib/client/api-envelope'

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
  | { kind: 'denied'; code: string; message: string | null }
  | { kind: 'failed'; message: string }

const denialKey = (code: string): 'unissued' | 'duty' | 'segregation' | 'missing' | 'denied' => {
  if (code === 'FINANCIAL_MANDATES_NOT_ISSUED') return 'unissued'
  if (code === 'DUTY_NOT_HELD') return 'duty'
  if (code === 'SEGREGATION_OF_DUTIES') return 'segregation'
  if (code === 'NOT_FOUND') return 'missing'
  return 'denied'
}

const KNOWN_DENIALS = new Set(['FINANCIAL_MANDATES_NOT_ISSUED', 'DUTY_NOT_HELD', 'SEGREGATION_OF_DUTIES', 'NOT_FOUND'])

export function PrincipalFinancialAuthorityPanel() {
  const t = useTranslations('financialAuthorityPage')
  const tErrors = useTranslations('errors')
  const [state, setState] = useState<PanelState>({ kind: 'loading' })

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    setState({ kind: 'loading' })
    try {
      const response = await fetch('/api/dues/remittances')
      if (isCancelled()) return
      if (!response.ok) {
        // A refusal names its reason in `details.code` (development) and states it in `message`; the page words the reasons it knows.
        const body: unknown = await response.json().catch(() => null)
        const details = isRecord(body) && isRecord(body.details) ? body.details : null
        const code = typeof details?.code === 'string' ? details.code : isRecord(body) && typeof body.code === 'string' ? body.code : 'denied'
        const message = apiErrorMessage(body, '') || null
        if (!isCancelled()) setState({ kind: 'denied', code, message })
        return
      }
      // The route answers { success, data: { data: rows } }.
      const rows = envelopeRows(await response.json()) as RemittanceRow[]
      if (!isCancelled()) setState(rows.length === 0 ? { kind: 'empty' } : { kind: 'rows', rows })
    } catch (error) {
      if (!isCancelled()) setState({ kind: 'failed', message: error instanceof Error ? error.message : tErrors('loadingError') })
    }
  }, [tErrors])

  useEffect(() => {
    let cancelled = false
    void load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  return (
    <section className="space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      {state.kind === 'loading' ? <p>{t('loading')}</p> : null}
      {state.kind === 'empty' ? <p>{t('empty')}</p> : null}
      {state.kind === 'denied' || state.kind === 'failed' ? (
        <div className="space-y-3">
          <p role="alert">
            {state.kind === 'failed'
              ? state.message
              : KNOWN_DENIALS.has(state.code) || !state.message
                ? t(denialKey(state.code))
                : state.message}
          </p>
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
