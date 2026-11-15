'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CaseDeadlineWire } from '@/lib/cases/case-deadline-contract'

type Answer = { deadlines: CaseDeadlineWire[]; canManage: boolean; timeZone: string; remindersAvailable: boolean; truncated: boolean }
const inputClass = 'min-h-11 min-w-0 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm'
const buttonClass = 'min-h-11 rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50'

/** A fresh server decision controls each operation; the client only presents the returned capability. */
export function CaseDeadlines({ caseId }: { caseId: string }) {
  const t = useTranslations('caseDeadlines')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [edit, setEdit] = useState<{ id: string; day: string } | null>(null)
  const [notice, setNotice] = useState(false)
  const createId = useRef<string | null>(null)
  const endpoint = `/api/cases/${encodeURIComponent(caseId)}/deadlines`
  const currentEndpoint = useRef(endpoint)
  currentEndpoint.current = endpoint
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error('load')
    const value: Answer = await response.json()
    if (!Array.isArray(value.deadlines) || typeof value.canManage !== 'boolean') throw new Error('load')
    if (!signal?.aborted && currentEndpoint.current === endpoint) setAnswer(value)
  }, [endpoint])
  useEffect(() => {
    const controller = new AbortController()
    setAnswer(null); setError(null); setEdit(null); setNotice(false); setBusy(false); setTitle(''); setDueDay(''); createId.current = null
    void load(controller.signal).catch(() => { if (!controller.signal.aborted) setError('loadFailed') })
    return () => controller.abort()
  }, [load])

  async function save(method: 'POST' | 'PATCH', body: object) {
    setBusy(true); setError(null); setNotice(false)
    try {
      const response = await fetch(endpoint, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (currentEndpoint.current !== endpoint) return false
      if (!response.ok) {
        if (response.status === 409) { await load(); if (currentEndpoint.current === endpoint) { setEdit(null); setError('conflict') }; return false }
        if ([401, 403, 404].includes(response.status)) { setAnswer(null); setError('accessChanged'); return false }
        throw new Error('save')
      }
      setNotice(true)
      // A committed write and an unavailable refresh must never present old rows as current.
      setAnswer(null)
      try { await load() } catch { if (currentEndpoint.current === endpoint) setError('savedRefreshFailed') }
      if (currentEndpoint.current !== endpoint) return false
      setEdit(null)
      return true
    } catch { if (currentEndpoint.current === endpoint) setError('saveFailed'); return false } finally { if (currentEndpoint.current === endpoint) setBusy(false) }
  }
  async function create(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    createId.current ??= crypto.randomUUID()
    if (await save('POST', { id: createId.current, title: title.trim(), dueDay })) {
      createId.current = null; setTitle(''); setDueDay('')
    }
  }
  async function change(row: CaseDeadlineWire, action: 'complete' | 'cancel' | 'reschedule', day?: string) {
    if (busy) return
    await save('PATCH', { id: row.id, version: row.version, action, ...(day ? { dueDay: day } : {}) })
  }
  return (
    <Card data-testid="case-deadlines" className="min-w-0">
      <CardHeader><CardTitle className="text-base">{t('title')}</CardTitle></CardHeader>
      <CardContent className="min-w-0 space-y-4">
        <p className="text-sm text-gray-600">{t('manualDates')}</p>
        {error && <p role="alert" className="break-words text-sm text-red-700">{t(error)}</p>}
        {notice && <p role="status" className="text-sm text-green-700">{t('saved')}</p>}
        {!answer && !error && <p role="status">{t('loading')}</p>}
        {error && <button type="button" className={buttonClass} disabled={busy} onClick={() => { setError(null); void load().catch(() => setError('loadFailed')) }}>{t('retry')}</button>}
        {answer && <>
          <p className="break-words text-sm text-gray-600">{t('timeZone', { zone: answer.timeZone })}</p>
          <p className="text-sm text-gray-600">{t(answer.remindersAvailable ? 'formalReminders' : 'trackedDates')}</p>
          {answer.truncated && <p role="alert" className="text-sm">{t('truncated')}</p>}
          {answer.deadlines.length === 0 && <p className="text-sm text-gray-600">{t('empty')}</p>}
          <ul className="space-y-4">
            {answer.deadlines.map(row => <li key={row.id} className="min-w-0 space-y-2 border-b border-gray-200 pb-3">
              <p className="break-words font-medium">{row.title}</p>
              <p className="text-sm"><time dateTime={row.dueAt}>{row.dueDay}</time> · {t(row.status)}</p>
              {answer.canManage && row.status === 'pending' && <>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={buttonClass} disabled={busy} onClick={() => setEdit({ id: row.id, day: row.dueDay })}>{t('reschedule')}</button>
                  <button type="button" className={buttonClass} disabled={busy} onClick={() => void change(row, 'complete')}>{t('complete')}</button>
                  <button type="button" className={buttonClass} disabled={busy} onClick={() => void change(row, 'cancel')}>{t('cancel')}</button>
                </div>
                {edit?.id === row.id && <form className="space-y-2" onSubmit={event => { event.preventDefault(); void change(row, 'reschedule', edit.day) }}>
                  <label className="block text-sm">{t('newDueDay')}<input type="date" className={inputClass} value={edit.day} onChange={event => setEdit({ id: row.id, day: event.target.value })} required disabled={busy} /></label>
                  <button className={buttonClass} disabled={busy} type="submit">{t('saveDate')}</button>
                </form>}
              </>}
            </li>)}
          </ul>
          {answer.canManage && <form className="space-y-3" onSubmit={create}>
            <h3 className="font-medium">{t('create')}</h3>
            <label className="block text-sm">{t('name')}<input className={inputClass} value={title} onChange={event => { createId.current = null; setTitle(event.target.value) }} maxLength={200} required disabled={busy} /></label>
            <label className="block text-sm">{t('dueDay')}<input type="date" className={inputClass} value={dueDay} onChange={event => { createId.current = null; setDueDay(event.target.value) }} required disabled={busy} /></label>
            <button className={buttonClass} type="submit" disabled={busy || !title.trim() || !dueDay}>{busy ? t('saving') : t('create')}</button>
          </form>}
        </>}
      </CardContent>
    </Card>
  )
}
