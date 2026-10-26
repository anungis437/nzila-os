'use client'

/**
 * Union-side WorkAid journey. Member consent, document authorisation and revocation call /api/workaid/*.
 * Staff referral calls the same routes for one case. A recorded referral is not delivery to counsel.
 * Consent capture stays disabled until the institution has recorded wording. No counsel route is called.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export const WORKAID_UI_CATEGORIES = ['case_summary', 'case_timeline', 'documents', 'member_identity'] as const

type Audience = 'member' | 'staff'

interface ConsentText {
  version: string
  body: string
  sha256: string
  effectiveAt: string
}

interface DocumentAuth {
  id: string
  documentId: string
  classification: string
  expiresAt: string
  revoked: boolean
}

interface ConsentRow {
  consentId: string
  matterId: string
  caseId: string
  categories: string[]
  purpose: string
  expiresAt: string
  state: 'live' | 'revoked' | 'expired'
  referred: boolean
  referralWithdrawn: boolean
  counselAccepted: boolean
  documentAuthorisations: DocumentAuth[]
}

interface Referable {
  matterId: string
  categories: string[]
  purpose: string
  expiresAt: string
}

async function readJson(response: Response): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: response.ok, status: response.status, data }
}

function asConsents(value: unknown): ConsentRow[] {
  if (!Array.isArray(value)) return []
  return value as ConsentRow[]
}

function asReferable(value: unknown): Referable[] {
  if (!Array.isArray(value)) return []
  return value as Referable[]
}

export function WorkAidJourney({ audience }: { audience: Audience }) {
  const t = useTranslations('workAidPage')
  const [consents, setConsents] = useState<ConsentRow[]>([])
  const [consentText, setConsentText] = useState<ConsentText | null>(null)
  const [textUnavailable, setTextUnavailable] = useState(false)
  const [loading, setLoading] = useState(audience === 'member')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [caseId, setCaseId] = useState('')
  const [purpose, setPurpose] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [selected, setSelected] = useState<string[]>(['case_summary'])
  const [acknowledged, setAcknowledged] = useState(false)
  const [documentId, setDocumentId] = useState('')
  const [matterForDocument, setMatterForDocument] = useState('')
  const [staffCaseId, setStaffCaseId] = useState('')
  const [referable, setReferable] = useState<Referable[]>([])

  const loadMember = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [textRes, listRes] = await Promise.all([
      readJson(await fetch('/api/workaid/consent-text')),
      readJson(await fetch('/api/workaid/consents')),
    ])
    if (textRes.status === 409 && textRes.data.code === 'CONSENT_TEXT_UNAVAILABLE') {
      setConsentText(null)
      setTextUnavailable(true)
    } else if (textRes.ok && textRes.data.consentText && typeof textRes.data.consentText === 'object') {
      setConsentText(textRes.data.consentText as ConsentText)
      setTextUnavailable(false)
    } else if (!textRes.ok) {
      setError(String(textRes.data.code ?? textRes.data.error ?? textRes.status))
    }
    if (listRes.ok) setConsents(asConsents(listRes.data.consents))
    else setError(String(listRes.data.code ?? listRes.data.error ?? listRes.status))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (audience === 'member') void loadMember()
  }, [audience, loadMember])

  async function grantConsent() {
    if (!consentText || !acknowledged) return
    setNotice(null)
    setError(null)
    const result = await readJson(await fetch('/api/workaid/consents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        caseId,
        categories: selected,
        purpose,
        textVersion: consentText.version,
        acknowledgedTextSha256: consentText.sha256,
        expiresAt: new Date(expiresAt).toISOString(),
      }),
    }))
    if (!result.ok || result.data.delivered !== false) {
      setError(String(result.data.code ?? result.data.error ?? result.status))
      return
    }
    setNotice(t('recordedUnionSide'))
    await loadMember()
  }

  async function revokeConsent(consentId: string) {
    setNotice(null)
    const result = await readJson(await fetch(`/api/workaid/consents/${consentId}/revoke`, { method: 'POST' }))
    if (!result.ok) {
      setError(String(result.data.code ?? result.data.error ?? result.status))
      return
    }
    setNotice(t('revoked'))
    await loadMember()
  }

  async function revokeDocument(authorisationId: string) {
    setNotice(null)
    const result = await readJson(await fetch(`/api/workaid/documents/${authorisationId}/revoke`, { method: 'POST' }))
    if (!result.ok) {
      setError(String(result.data.code ?? result.data.error ?? result.status))
      return
    }
    setNotice(t('revoked'))
    await loadMember()
  }

  async function authoriseDocument() {
    setNotice(null)
    const result = await readJson(await fetch('/api/workaid/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ matterId: matterForDocument, documentId }),
    }))
    if (!result.ok || result.data.delivered !== false) {
      setError(String(result.data.code ?? result.data.error ?? result.status))
      return
    }
    setNotice(t('recordedUnionSide'))
    await loadMember()
  }

  async function loadReferable(options: { clearNotice?: boolean } = {}) {
    setError(null)
    if (options.clearNotice) setNotice(null)
    const result = await readJson(await fetch(`/api/workaid/referrals?caseId=${encodeURIComponent(staffCaseId)}`))
    if (!result.ok) {
      setReferable([])
      setError(String(result.data.code ?? result.data.error ?? result.status))
      return
    }
    setReferable(asReferable(result.data.referable))
  }

  async function refer(row: Referable) {
    setNotice(null)
    const result = await readJson(await fetch('/api/workaid/referrals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ matterId: row.matterId, categories: row.categories }),
    }))
    if (!result.ok || result.data.delivered !== false || result.data.counselAcknowledged !== false) {
      setError(String(result.data.code ?? result.data.error ?? result.status))
      return
    }
    setNotice(t('recordedUnionSide'))
    await loadReferable()
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{audience === 'member' ? t('memberTitle') : t('staffTitle')}</h1>
        <p className="text-sm text-muted-foreground">{audience === 'member' ? t('memberSubtitle') : t('staffSubtitle')}</p>
        <p className="rounded-md border p-3 text-sm" data-testid="workaid-boundary">{t('counselBoundary')}</p>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{t('refusal')}: {error}</p> : null}
      {notice ? <p role="status" className="text-sm">{notice}</p> : null}

      {audience === 'member' ? (
        <section className="flex flex-col gap-4">
          {loading ? <p>{t('loading')}</p> : null}
          {textUnavailable ? <p data-testid="consent-text-unavailable">{t('consentTextUnavailable')}</p> : null}
          {consentText ? (
            <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void grantConsent() }}>
              <p className="text-sm whitespace-pre-wrap">{consentText.body}</p>
              <label className="flex flex-col gap-1 text-sm">{t('caseId')}<input className="rounded border p-2" value={caseId} onChange={(event) => setCaseId(event.target.value)} required /></label>
              <fieldset className="flex flex-col gap-1 text-sm">
                <legend>{t('categories')}</legend>
                {WORKAID_UI_CATEGORIES.map((category) => (
                  <label key={category} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(category)}
                      onChange={(event) => setSelected((current) => event.target.checked ? [...current, category] : current.filter((item) => item !== category))}
                    />
                    {t(`category.${category}`)}
                  </label>
                ))}
              </fieldset>
              <label className="flex flex-col gap-1 text-sm">{t('purpose')}<input className="rounded border p-2" value={purpose} onChange={(event) => setPurpose(event.target.value)} required /></label>
              <label className="flex flex-col gap-1 text-sm">{t('expires')}<input className="rounded border p-2" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required /></label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
                {t('acknowledge')}
              </label>
              <Button type="submit" className="w-full sm:w-auto" disabled={!acknowledged}>{t('grantConsent')}</Button>
            </form>
          ) : null}

          {consents.length === 0 && !loading ? <p>{t('emptyConsents')}</p> : null}
          {consents.map((row) => (
            <article key={row.consentId} className="flex flex-col gap-2 rounded-md border p-3" data-testid="consent-row">
              <p className="text-sm">{t('caseId')}: {row.caseId}</p>
              <p className="text-sm">{t('status')}: {t(`state.${row.state}`)}</p>
              <p className="text-sm">{row.referred ? t('referred') : t('notReferred')}{row.referralWithdrawn ? ` · ${t('withdrawn')}` : ''}</p>
              <p className="text-sm">{row.counselAccepted ? t('counselAccepted') : t('counselNotAccepted')}</p>
              <p className="text-sm">{t('requiredIntake')}</p>
              <ul className="flex flex-col gap-2">
                {row.documentAuthorisations.length === 0 ? <li>{t('documentsEmpty')}</li> : row.documentAuthorisations.map((doc) => (
                  <li key={doc.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm">{doc.classification} · {doc.revoked ? t('documentRevoked') : t('documentLive')}</span>
                    {row.state === 'live' && !doc.revoked ? (
                      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void revokeDocument(doc.id)}>{t('revokeDocument')}</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {row.state === 'live' ? (
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void revokeConsent(row.consentId)}>{t('revokeConsent')}</Button>
              ) : null}
            </article>
          ))}

          <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void authoriseDocument() }}>
            <h2 className="text-lg font-medium">{t('documentsTitle')}</h2>
            <label className="flex flex-col gap-1 text-sm">{t('matterId')}<input className="rounded border p-2" value={matterForDocument} onChange={(event) => setMatterForDocument(event.target.value)} required /></label>
            <label className="flex flex-col gap-1 text-sm">{t('documentId')}<input className="rounded border p-2" value={documentId} onChange={(event) => setDocumentId(event.target.value)} required /></label>
            <Button type="submit" className="w-full sm:w-auto">{t('authoriseDocument')}</Button>
          </form>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void loadReferable({ clearNotice: true }) }}>
            <label className="flex flex-col gap-1 text-sm">{t('staffCaseLabel')}<input className="rounded border p-2" value={staffCaseId} onChange={(event) => setStaffCaseId(event.target.value)} required /></label>
            <Button type="submit" className="w-full sm:w-auto">{t('loadReferable')}</Button>
          </form>
          {referable.length === 0 ? <p>{t('referableEmpty')}</p> : null}
          {referable.map((row) => (
            <article key={row.matterId} className="flex flex-col gap-2 rounded-md border p-3">
              <p className="text-sm">{row.purpose}</p>
              <p className="text-sm">{row.categories.join(', ')}</p>
              <Button type="button" className="w-full sm:w-auto" onClick={() => void refer(row)}>{t('refer')}</Button>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
