'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { readBoundedCaseExport, verifyCaseExport, verifyCasePdf } from '@/lib/cases/case-evidence-export-client'

const copy = {
  en: { title: 'Case evidence export', detail: 'Includes internal case records, notes and the audit trail. Download only for an authorized casework purpose.',
    prepare: 'Download sealed case pack', busy: 'Preparing and checking…', format: 'Export format', pdf: 'PDF with sealed records attached', json: 'JSON structured records',
    verified: 'The server verified the seal and the file checks passed. Check your browser for the download.', denied: 'Your access changed. Reload the case before requesting an export.',
    failed: 'The export could not be verified. Reload the case before trying again. No file is available to download.',
    downloadFailed: 'The file passed verification, but the browser download could not be confirmed. Check downloads before requesting another export.',
    large: 'This case pack exceeds the 20 MB download limit. Ask the case handler for a suitable export.', reload: 'Reload case' },
  fr: { title: 'Exportation des preuves du dossier', detail: 'Comprend les données internes du dossier, les notes et la piste d’audit. Téléchargez-les uniquement pour une fin autorisée.',
    prepare: 'Télécharger le dossier de preuves scellé', busy: 'Préparation et vérification…', format: 'Format d’exportation', pdf: 'PDF avec données scellées en pièce jointe', json: 'Données structurées JSON',
    verified: 'Le serveur a vérifié le sceau et le fichier a passé les contrôles. Consultez les téléchargements de votre navigateur.', denied: 'Votre accès a changé. Rechargez le dossier avant de demander une exportation.',
    failed: 'L’exportation n’a pas pu être vérifiée. Rechargez le dossier avant de réessayer. Aucun fichier n’est disponible au téléchargement.',
    downloadFailed: 'Le fichier a passé les vérifications, mais le téléchargement n’a pas pu être confirmé. Consultez vos téléchargements avant de demander une autre exportation.',
    large: 'Ce dossier dépasse la limite de téléchargement de 20 Mo. Demandez une exportation adaptée au responsable du dossier.', reload: 'Recharger le dossier' },
}

/** The returned kernel capability controls presentation; every export is independently authorized by the server. */
export function CaseEvidenceExport({ caseId, organizationId, actorId, allowed }: { caseId: string; organizationId: string; actorId: string; allowed: boolean }) {
  const locale = useLocale().startsWith('fr') ? 'fr-CA' : 'en-CA'
  const text = copy[locale === 'fr-CA' ? 'fr' : 'en']
  const [format, setFormat] = useState<'pdf' | 'json'>('pdf')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(false)
  const [error, setError] = useState<'denied' | 'failed' | 'large' | 'downloadFailed' | null>(null)
  const active = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const objectUrl = useRef<string | null>(null)
  const revokeTimer = useRef<number | null>(null)
  const releaseDownload = useCallback(() => {
    if (revokeTimer.current !== null) window.clearTimeout(revokeTimer.current)
    revokeTimer.current = null
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = null
  }, [])
  const binding = `${organizationId}:${actorId}:${caseId}:${allowed}:${locale}`
  const current = useRef(binding); current.current = binding
  useEffect(() => {
    active.current?.abort(); releaseDownload()
    inFlight.current = false; setNotice(false); setError(null); setBusy(false); setFormat('pdf')
    return () => { active.current?.abort(); releaseDownload() }
  }, [binding, releaseDownload])

  async function prepare() {
    if (!allowed || inFlight.current || busy || error) return
    inFlight.current = true
    releaseDownload()
    const expected = binding
    const controller = new AbortController(); active.current = controller
    let verified = false
    setBusy(true); setError(null); setNotice(false)
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/export?format=${format}&envelope=true&verify=true&locale=${locale}`, {
        cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: controller.signal,
        headers: { 'x-ue-expected-organization': organizationId },
      })
      if (controller.signal.aborted || current.current !== expected) return
      if ([401, 403, 404].includes(response.status)) { setError('denied'); return }
      if (!response.ok) throw new Error('invalid')
      const bytes = await readBoundedCaseExport(response, controller.signal, format === 'pdf' ? 'application/pdf' : 'application/json')
      if (format === 'pdf') await verifyCasePdf(bytes, response.headers, { caseId, organizationId, actorId, locale })
      else await verifyCaseExport(bytes, { caseId, organizationId, actorId })
      verified = true
      if (controller.signal.aborted || current.current !== expected) return
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: format === 'pdf' ? 'application/pdf' : 'application/json' }))
      objectUrl.current = url
      const link = document.createElement('a')
      link.href = url; link.download = `union-eyes-case-${caseId}.${format}`; link.hidden = true
      document.body.appendChild(link)
      try { link.click() } finally { link.remove() }
      setNotice(true)
      // Every later download needs a fresh server decision. Keep no reusable download link or case bytes in component state.
      revokeTimer.current = window.setTimeout(releaseDownload, 1000)
    } catch (reason) {
      if (!controller.signal.aborted && current.current === expected) {
        releaseDownload()
        setError(verified ? 'downloadFailed' : reason instanceof Error && reason.message === 'oversize' ? 'large' : 'failed')
      }
    } finally { if (!controller.signal.aborted && current.current === expected) { inFlight.current = false; setBusy(false) } }
  }
  if (!allowed) return null
  const button = 'min-h-11 rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50'
  return <section aria-label={text.title} className="mb-6 min-w-0 space-y-3 rounded border p-4" data-testid="case-evidence-export">
    <h4 className="font-semibold">{text.title}</h4>
    <p className="break-words text-sm">{text.detail}</p>
    <label className="block text-sm">{text.format}<select className="mt-1 block min-h-11 w-full min-w-0 rounded border p-2" value={format} disabled={busy || error !== null}
      onChange={event => { setFormat(event.target.value === 'json' ? 'json' : 'pdf'); setNotice(false) }}>
      <option value="pdf">{text.pdf}</option><option value="json">{text.json}</option>
    </select></label>
    {error ? <><p role="alert" className="break-words text-sm">{text[error]}</p><button type="button" className={button} onClick={() => window.location.reload()}>{text.reload}</button></> :
      <><button type="button" className={`${button} whitespace-normal`} disabled={busy} onClick={() => void prepare()}>{busy ? text.busy : `${text.prepare} (${format.toUpperCase()})`}</button>
        {notice && <p role="status" className="break-words text-sm">{text.verified}</p>}</>}
  </section>
}
