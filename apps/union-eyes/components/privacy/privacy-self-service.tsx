'use client'

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useLocale } from 'next-intl'
import { useOrganizationId } from '@/contexts/organization-context'
import {
  privacyRequestTypes, privacyScopes, privacyRequestViewSchema, privacyRequestSummarySchema, privacyConversationViewSchema,
  type PrivacyRequestType, type PrivacyScope, type PrivacyRequestView, type PrivacyRequestSummary, type PrivacyConversationView,
} from '@/lib/privacy/request-contract'
import { privacyCopy } from './privacy-copy'
import { PrivacyApiError, privacyData, privacyFetch, verifiedPrivacyDownload } from './privacy-api'

const control = 'w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm'
const button = 'min-h-11 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50'
const dsar = '/api/privacy/dsar'
type ResponseAction = 'verify_identity' | 'clarify' | 'respond' | 'refuse'
type Copy = typeof privacyCopy.en | typeof privacyCopy.fr

function ConversationMessages({ messages, copy, locale }: { messages: PrivacyRequestView['messages']; copy: Copy; locale: string }) {
  return <details className="min-w-0 rounded border p-3"><summary className="min-h-11 cursor-pointer text-sm font-medium">{copy.conversation}</summary>
    <ol className="space-y-3">{messages.map(message => <li key={message.id} className="space-y-1 border-t pt-3">
      <p className="text-sm font-medium">{message.fromMe ? copy.fromYou : copy.fromCounterpart} · {new Date(message.createdAt).toLocaleString(locale)}</p>
      <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
    </li>)}</ol>
  </details>
}

function Responses({ responses, copy, locale }: { responses: PrivacyRequestView['responses']; copy: Copy; locale: string }) {
  return <section aria-label={copy.responseHistory} className="space-y-3">
    {responses.map(response => <article key={response.id} className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-semibold">{copy.stages[response.action]} · {new Date(response.createdAt).toLocaleString(locale)}</p>
      <p className="whitespace-pre-wrap break-words text-sm">{response.body}</p>
      {response.coveredScopes.length > 0 && <p className="text-sm">{copy.included}: {response.coveredScopes.map(scope => copy.scopeNames[scope]).join(', ')}</p>}
      {response.exemptions.map(item => <p key={item.scope} className="break-words text-sm">{copy.withheld} — {copy.scopeNames[item.scope]}: {item.reason}</p>)}
    </article>)}
  </section>
}

export function PrivacySelfService({ initialThreadId }: { initialThreadId?: string }) {
  const organizationId = useOrganizationId()
  const locale = useLocale()
  const copy = locale.startsWith('fr') ? privacyCopy.fr : privacyCopy.en
  if (!organizationId) return <p role="status">{copy.selectOrganization}</p>
  // A switch discards every private view, form and downloaded receipt from the old organization.
  return <PrivacyWorkspace key={`${organizationId}:${initialThreadId ?? 'self'}`} organizationId={organizationId} initialThreadId={initialThreadId} locale={locale} copy={copy} />
}

function PrivacyWorkspace({ organizationId, initialThreadId, locale, copy }: {
  organizationId: string; initialThreadId?: string; locale: string; copy: Copy
}) {
  const id = useId()
  const [requests, setRequests] = useState<PrivacyRequestSummary[]>([])
  const [selected, setSelected] = useState<PrivacyRequestView | null>(null)
  const selectedId = useRef<string | null>(null)
  const [conversation, setConversation] = useState<PrivacyConversationView | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [requestType, setRequestType] = useState<PrivacyRequestType>('access')
  const [scopes, setScopes] = useState<PrivacyScope[]>(['account_profile'])
  const [description, setDescription] = useState('')
  const [reply, setReply] = useState('')
  const [action, setAction] = useState<ResponseAction>('verify_identity')
  const [responseBody, setResponseBody] = useState('')
  const [basis, setBasis] = useState<'authenticated_account_reviewed' | 'additional_verification_in_conversation'>('authenticated_account_reviewed')
  const [exemptions, setExemptions] = useState<Partial<Record<PrivacyScope, string>>>({})
  const [downloadReceipt, setDownloadReceipt] = useState<{ requestId: string; responseId: string; sha256: string } | null>(null)
  const alive = useRef(true)
  const mutationPending = useRef(false)
  const loadGeneration = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const nonces = useRef(new Map<string, string>())
  const threadPath = conversation ? `/api/privacy/threads/${conversation.threadId}` : ''

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; controller.current?.abort() }
  }, [])

  const messageFor = useCallback((problem: unknown) => {
    const reason = problem instanceof PrivacyApiError ? problem.reason : 'unavailable'
    return reason in copy.errors ? copy.errors[reason as keyof typeof copy.errors] : copy.errors.unavailable
  }, [copy])

  const refresh = useCallback(async (preferredId?: string) => {
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    const generation = ++loadGeneration.current
    setLoading(true)
    try {
      const data = await privacyData(organizationId, dsar, { signal: abort.signal })
      const current = privacyRequestSummarySchema.array().parse(data.requests)
      const ownThread = current.find(request => request.threadId === initialThreadId)
      const wanted = preferredId ?? selectedId.current ?? ownThread?.id
      let detail: PrivacyRequestView | null = null
      if (wanted && current.some(request => request.id === wanted)) {
        const item = await privacyData(organizationId, `${dsar}/${wanted}`, { signal: abort.signal })
        detail = privacyRequestViewSchema.parse(item.request)
      }
      let assigned: PrivacyConversationView | null = null
      if (initialThreadId && !ownThread) {
        const context = await privacyData(organizationId, `/api/privacy/threads/${encodeURIComponent(initialThreadId)}`, { signal: abort.signal })
        assigned = privacyConversationViewSchema.parse(context.conversation)
      }
      if (!alive.current || generation !== loadGeneration.current) return
      setRequests(current)
      setSelected(detail)
      setConversation(assigned)
      selectedId.current = detail?.id ?? null
      setDownloadReceipt(receipt => receipt && detail?.id === receipt.requestId && detail.latestResponseId === receipt.responseId ? receipt : null)
    } catch (problem) {
      if (!alive.current || abort.signal.aborted || generation !== loadGeneration.current) return
      setRequests([])
      setSelected(null)
      setConversation(null)
      setDownloadReceipt(null)
      setError(messageFor(problem))
    } finally {
      if (alive.current && generation === loadGeneration.current) setLoading(false)
    }
  }, [initialThreadId, organizationId, messageFor])

  useEffect(() => { void refresh() }, [refresh])

  function nonce(payload: unknown) {
    const key = JSON.stringify(payload)
    let value = nonces.current.get(key)
    if (!value) { value = crypto.randomUUID(); nonces.current.set(key, value) }
    return value
  }

  async function mutate(operation: () => Promise<void>) {
    if (mutationPending.current || loading) return
    mutationPending.current = true
    setBusy(true); setError(''); setNotice('')
    try {
      await operation()
      if (alive.current) await refresh()
    } catch (problem) {
      if (alive.current) {
        setError(messageFor(problem))
        if (problem instanceof PrivacyApiError && ['forbidden', 'not_found', 'stale', 'closed'].includes(problem.reason)) {
          setRequests([]); setSelected(null); setConversation(null); setDownloadReceipt(null)
          await refresh()
        }
      }
    } finally {
      mutationPending.current = false
      if (alive.current) setBusy(false)
    }
  }

  function create(event: FormEvent) {
    event.preventDefault()
    const input = { requestType, scopes: [...scopes].sort(), description: description.trim() }
    void mutate(async () => {
      const data = await privacyData(organizationId, dsar, { method: 'POST', body: JSON.stringify({ ...input, clientRequestId: nonce(input) }) })
      const request = privacyRequestViewSchema.parse(data.request)
      if (!alive.current) return
      nonces.current.delete(JSON.stringify(input))
      selectedId.current = request.id; setDescription(''); setNotice(copy.saved)
    })
  }

  function finish(kind: 'cancel' | 'acknowledge') {
    if (!selected || (kind === 'cancel' && !window.confirm(copy.cancelConfirm))) return
    const request = selected
    void mutate(async () => {
      await privacyData(organizationId, `${dsar}/${request.id}`, { method: 'POST', body: JSON.stringify({
        action: kind, expectedResponseId: request.latestResponseId,
        ...(downloadReceipt?.requestId === request.id && downloadReceipt.responseId === request.latestResponseId ? { exportSha256: downloadReceipt.sha256 } : {}),
      }) })
      if (alive.current) { setDownloadReceipt(null); setNotice(copy.updated) }
    })
  }

  function download() {
    if (!selected?.latestResponseId) return
    const request = selected
    const responseId = selected.latestResponseId
    void mutate(async () => {
      const response = await privacyFetch(organizationId, `${dsar}/${request.id}/export`, {
        method: 'POST', body: JSON.stringify({ expectedResponseId: responseId }),
      })
      const blob = await verifiedPrivacyDownload(response)
      if (!alive.current) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `union-eyes-account-data-${request.id}.json`
      document.body.append(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setDownloadReceipt({ requestId: request.id, responseId, sha256: response.headers.get('X-Privacy-Export-Sha256')! })
      setNotice(copy.downloaded)
    })
  }

  function sendReply(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    const input = { threadId: selected.threadId, body: reply.trim() }
    void mutate(async () => {
      await privacyData(organizationId, `/api/privacy/threads/${input.threadId}`, { method: 'PATCH',
        body: JSON.stringify({ body: input.body, clientRequestId: nonce(input) }) })
      if (alive.current) { nonces.current.delete(JSON.stringify(input)); setReply(''); setNotice(copy.updated) }
    })
  }

  function sendResponse(event: FormEvent) {
    event.preventDefault()
    if (!conversation?.canRespond) return
    const input = { action, body: responseBody.trim(), expectedResponseId: conversation.latestResponseId,
      coveredScopes: action === 'respond' ? conversation.scopes.filter(scope => exemptions[scope] === undefined) : [],
      exemptions: action === 'respond' ? conversation.scopes.filter(scope => exemptions[scope] !== undefined).map(scope => ({ scope, reason: exemptions[scope]!.trim() })) : [],
      ...(action === 'verify_identity' ? { verificationBasis: basis } : {}),
    }
    void mutate(async () => {
      await privacyData(organizationId, threadPath, { method: 'POST', body: JSON.stringify({ ...input, clientRequestId: nonce({ threadPath, ...input }) }) })
      if (alive.current) {
        nonces.current.delete(JSON.stringify({ threadPath, ...input })); setResponseBody(''); setExemptions({}); setNotice(copy.responseSaved)
      }
    })
  }

  const locked = busy || loading
  const hasReceipt = selected && downloadReceipt?.requestId === selected.id && downloadReceipt.responseId === selected.latestResponseId
  return <div className="min-w-0 space-y-6" data-testid="privacy-self-service">
    <p className="text-sm">{copy.intro}</p>
    <p className="text-sm text-muted-foreground">{copy.accountScope} {copy.noAutomaticErasure}</p>
    <button type="button" className={button} disabled={locked} onClick={() => { setError(''); void refresh() }}>{copy.refresh}</button>
    {loading && <p role="status">{copy.loading}</p>}
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}

    {conversation && <section aria-labelledby={`${id}-handler`} className="min-w-0 space-y-4 rounded-lg border p-4">
      <h3 id={`${id}-handler`} className="font-semibold">{copy.handlerTitle}</h3>
      <p>{copy.types[conversation.requestType]}</p>
      <p className="text-sm">{conversation.scopes.map(scope => copy.scopeNames[scope]).join(', ')}</p>
      <ConversationMessages messages={conversation.messages} copy={copy} locale={locale} />
      <Responses responses={conversation.responses} copy={copy} locale={locale} />
      {!conversation.canRespond ? <p>{copy.handlerReadOnly}</p> : <form onSubmit={sendResponse}>
        <fieldset disabled={locked} className="min-w-0 space-y-4">
          <legend className="mb-3 text-sm">{copy.handlerInfo}</legend>
          <label className="block text-sm">{copy.responseAction}<select className={control} value={action} onChange={event => setAction(event.target.value as ResponseAction)}>
            {(['verify_identity','clarify','respond','refuse'] as const).map(value => <option key={value} value={value}>{copy.actions[value]}</option>)}
          </select></label>
          {action === 'verify_identity' && <label className="block text-sm">{copy.verificationBasis}<select className={control} value={basis} onChange={event => setBasis(event.target.value as typeof basis)}>
            <option value="authenticated_account_reviewed">{copy.accountReviewed}</option><option value="additional_verification_in_conversation">{copy.additionalVerification}</option>
          </select></label>}
          {action === 'respond' && <fieldset className="min-w-0 space-y-3"><legend>{copy.coverage}</legend>
            {conversation.scopes.map(scope => <div key={scope} className="min-w-0 space-y-2">
              <label className="block text-sm">{copy.scopeNames[scope]}<select className={control} value={exemptions[scope] === undefined ? 'included' : 'withheld'} onChange={event => setExemptions(current => {
                const next = { ...current }; if (event.target.value === 'included') delete next[scope]; else next[scope] = ''; return next
              })}><option value="included">{copy.included}</option><option value="withheld">{copy.withheld}</option></select></label>
              {exemptions[scope] !== undefined && <label className="block text-sm">{copy.exemptionReason}<textarea required minLength={3} maxLength={500} className={control} value={exemptions[scope]} onChange={event => setExemptions(current => ({ ...current, [scope]: event.target.value }))} /></label>}
            </div>)}
          </fieldset>}
          <label className="block text-sm">{copy.responseBody}<textarea className={control} required minLength={3} maxLength={4000} rows={5} value={responseBody} onChange={event => setResponseBody(event.target.value)} /></label>
          <button className={button} disabled={locked || (action === 'respond' && !conversation.identityReviewed)}>{busy ? copy.busy : copy.saveResponse}</button>
        </fieldset>
      </form>}
    </section>}

    <section aria-labelledby={`${id}-mine`} className="space-y-4">
      <h3 id={`${id}-mine`} className="font-semibold">{copy.mine}</h3>
      <p className="text-sm text-muted-foreground">{copy.latest}</p>
      {!loading && !error && requests.length === 0 && <p>{copy.empty}</p>}
      <ul className="space-y-2">{requests.map(request => <li key={request.id}>
        <button type="button" disabled={locked} className={`${button} w-full break-words text-left`} onClick={() => { selectedId.current = request.id; setSelected(null); setReply(''); setNotice(''); void refresh(request.id) }}>
          {copy.types[request.requestType]} · {copy.statuses[request.status]} · {new Date(request.requestedAt).toLocaleDateString(locale)}
        </button>
      </li>)}</ul>
      {selected && <article className="min-w-0 space-y-4 rounded-lg border p-4" data-testid="privacy-request-detail">
        <h4 className="font-semibold">{copy.types[selected.requestType]} · {copy.stages[selected.stage]}</h4>
        <p className="whitespace-pre-wrap break-words text-sm">{selected.description}</p>
        <p className="text-sm">{selected.scopes.map(scope => copy.scopeNames[scope]).join(', ')}</p>
        <p className="text-sm">{copy.submitted}: {new Date(selected.requestedAt).toLocaleString(locale)}<br />{copy.target}: {new Date(selected.responseTargetAt).toLocaleDateString(locale)}</p>
        <p className="text-sm">{selected.handlerAssigned ? copy.assigned : copy.waiting} · {selected.identityReviewed ? copy.identityReviewed : copy.identityPending}</p>
        <ConversationMessages messages={selected.messages} copy={copy} locale={locale} />
        <Responses responses={selected.responses} copy={copy} locale={locale} />
        {selected.canExport && <button type="button" className={button} disabled={locked} onClick={download}>{copy.download}</button>}
        {selected.canAcknowledge && <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{copy.acknowledgementNote}</p>
          <button type="button" className={button} disabled={locked || (selected.requiresExportReceipt && !hasReceipt)} onClick={() => finish('acknowledge')}>{copy.acknowledge}</button>
          {selected.requiresExportReceipt && !selected.canExport && !hasReceipt && <p className="text-sm">{copy.errors.export_expired}</p>}
        </div>}
        {selected.canCancel && <>
          <form onSubmit={sendReply}><fieldset disabled={locked} className="space-y-2">
            <legend>{copy.reply}</legend><label className="block text-sm">{copy.replyBody}<textarea className={control} required minLength={1} maxLength={4000} rows={3} value={reply} onChange={event => setReply(event.target.value)} /></label>
            <button className={button} disabled={locked}>{copy.send}</button>
          </fieldset></form>
          <button type="button" className={button} disabled={locked} onClick={() => finish('cancel')}>{copy.cancel}</button>
        </>}
      </article>}
    </section>

    <form onSubmit={create} className="rounded-lg border p-4" aria-labelledby={`${id}-create`}>
      <h3 id={`${id}-create`} className="mb-4 font-semibold">{copy.create}</h3>
      <fieldset disabled={locked} className="min-w-0 space-y-4">
        <label className="block text-sm">{copy.type}<select className={control} value={requestType} onChange={event => setRequestType(event.target.value as PrivacyRequestType)}>
          {privacyRequestTypes.map(type => <option key={type} value={type}>{copy.types[type]}</option>)}
        </select></label>
        <fieldset className="space-y-2"><legend className="mb-2 text-sm">{copy.scopes}</legend>{privacyScopes.map(scope => <label key={scope} className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={scopes.includes(scope)} onChange={event => setScopes(current => event.target.checked ? [...current, scope] : current.filter(value => value !== scope))} />{copy.scopeNames[scope]}
        </label>)}</fieldset>
        <label className="block text-sm">{copy.description}<textarea className={control} required minLength={5} maxLength={3000} rows={5} value={description} onChange={event => setDescription(event.target.value)} /></label>
        <button className={button} disabled={locked || scopes.length === 0}>{busy ? copy.busy : copy.submit}</button>
      </fieldset>
    </form>
  </div>
}
