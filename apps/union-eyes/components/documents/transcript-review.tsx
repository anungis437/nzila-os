'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/client/api-envelope';
import { readSavedTranscript, readTranscriptPublication, readTranscriptView, type TranscriptState, type TranscriptView } from '@/lib/documents/transcript-review-client';

const text = {
  en: {
    title: 'Document transcript', load: 'Read transcript', reload: 'Reload latest transcript', loading: 'Loading…',
    unavailable: 'No readable transcript is available. Process the document first, or check your access.',
    failed: 'The result could not be confirmed. Reload the latest transcript before trying again.',
    denied: 'This action is no longer authorized. Reload the document to check your access.',
    stale: 'The transcript changed. Your edits are kept here. Reload the latest transcript and compare before saving.',
    kept: 'Latest transcript loaded. Your edits were kept; compare them with the saved text before saving.',
    selfReview: 'A draft must be reviewed from a different authorized account than the one that saved it.',
    machine_extraction: 'Machine extraction — not reviewed', human_draft: 'Human draft — not reviewed', human_reviewed: 'Human reviewed',
    original: 'Check the text against the original document before reviewing. A transcript does not replace the original.',
    edit: 'Transcript text', note: 'Change note (optional)', draft: 'Save draft', review: 'Record review',
    checked: 'I checked this text against the original document.', saved: 'Revision saved and read back.',
    readOnly: 'You have read access to this transcript.', history: 'Revision history', latest: 'Latest saved text',
    purpose: 'Purpose of adding this transcript to case evidence', publish: 'Publish reviewed transcript as case evidence',
    published: 'This reviewed revision is published as case evidence.', publishedNow: 'Publication saved and read back.',
    reviewFirst: 'Publication requires the current saved, human-reviewed revision and case evidence permission.',
    revision: 'Revision',
  },
  fr: {
    title: 'Transcription du document', load: 'Lire la transcription', reload: 'Recharger la transcription', loading: 'Chargement…',
    unavailable: 'Aucune transcription lisible n’est disponible. Traitez d’abord le document ou vérifiez votre accès.',
    failed: 'Le résultat n’a pas pu être confirmé. Rechargez la transcription avant de réessayer.',
    denied: 'Cette action n’est plus autorisée. Rechargez le document pour vérifier votre accès.',
    stale: 'La transcription a changé. Vos modifications sont conservées ici. Rechargez la transcription et comparez avant d’enregistrer.',
    kept: 'La transcription a été rechargée. Vos modifications sont conservées; comparez-les au texte enregistré avant d’enregistrer.',
    selfReview: 'Un brouillon doit être révisé depuis un autre compte autorisé que celui qui l’a enregistré.',
    machine_extraction: 'Extraction automatique — non révisée', human_draft: 'Brouillon humain — non révisé', human_reviewed: 'Révision humaine effectuée',
    original: 'Comparez le texte au document original avant de le réviser. Une transcription ne remplace pas l’original.',
    edit: 'Texte de la transcription', note: 'Note de modification (facultative)', draft: 'Enregistrer le brouillon', review: 'Enregistrer la révision',
    checked: 'J’ai comparé ce texte au document original.', saved: 'La version a été enregistrée et relue.',
    readOnly: 'Vous disposez d’un accès en lecture à cette transcription.', history: 'Historique des versions', latest: 'Dernier texte enregistré',
    purpose: 'Motif de l’ajout de cette transcription aux preuves du dossier', publish: 'Publier la transcription révisée comme preuve du dossier',
    published: 'Cette version révisée est publiée comme preuve du dossier.', publishedNow: 'La publication a été enregistrée et relue.',
    reviewFirst: 'La publication exige la version actuelle enregistrée et révisée ainsi que l’autorisation d’ajouter des preuves au dossier.',
    revision: 'Version',
  },
};

export function TranscriptReview({ documentId }: { documentId: string }) {
  const copy = text[useLocale().startsWith('fr') ? 'fr' : 'en'];
  const [view, setView] = useState<TranscriptView | null>(null);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [purpose, setPurpose] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  const fail = (status: number, body: unknown) => {
    if (status === 409) { setStale(true); setNotice(copy.stale); }
    else if (status === 403 && apiErrorMessage(body, '').includes('cannot be reviewed by the person')) setNotice(copy.selfReview);
    else if ([401, 403, 404].includes(status)) {
      setView(null); setDraft(''); setNote(''); setPurpose(''); setChecked(false);
      setNotice(status === 404 ? copy.unavailable : copy.denied);
    } else { setStale(true); setNotice(copy.failed); }
  };

  const read = async (signal: AbortSignal) => {
    const response = await fetch(`/api/documents/${documentId}/transcript`, { signal, cache: 'no-store' });
    const body: unknown = await response.json().catch(() => null);
    if (signal.aborted) return null;
    if (!response.ok) { fail(response.status, body); return null; }
    return readTranscriptView(body, documentId);
  };

  const reload = async () => {
    if (busy) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setNotice(null);
    const keep = view !== null && draft !== view.head.text;
    try {
      const next = await read(controller.signal);
      if (controller.signal.aborted || !next) return;
      setView(next); if (!keep) setDraft(next.head.text);
      setStale(false); setChecked(false); if (keep) setNotice(copy.kept);
    } catch { if (!controller.signal.aborted) { setStale(true); setNotice(copy.failed); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };

  const write = async (action: 'draft' | 'review' | 'publish') => {
    if (!view || busy || stale) return;
    if (action === 'publish' ? !view.canPublish || view.head.state !== 'human_reviewed' || view.published || draft !== view.head.text || purpose.trim().length < 3 :
      !view.canWrite || !draft.length || draft.length > 200_000 || (action === 'review' && !checked)) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setNotice(null);
    const previous = view;
    try {
      const state: TranscriptState = action === 'review' ? 'human_reviewed' : 'human_draft';
      let savedNo: number;
      if (action === 'publish') {
        const response = await fetch(`/api/documents/${documentId}/transcript/publish`, {
          method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revisionNo: previous.head.revisionNo, purpose: purpose.trim() }),
        });
        const body: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok) { fail(response.status, body); return; }
        readTranscriptPublication(body, previous);
        savedNo = previous.head.revisionNo;
      } else {
        const response = await fetch(`/api/documents/${documentId}/transcript`, {
          method: 'PUT', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, expectedRevisionNo: previous.head.revisionNo, text: draft, ...(note.trim() ? { changeNote: note.trim() } : {}) }),
        });
        const body: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok) { fail(response.status, body); return; }
        savedNo = readSavedTranscript(body, previous, draft, state);
      }
      const next = await read(controller.signal);
      if (controller.signal.aborted || !next) return;
      if (next.versionId !== previous.versionId || (action === 'publish' ? next.head.revisionNo !== savedNo || !next.published :
        !next.history.some(row => row.revisionNo === savedNo && row.state === state))) throw new Error('Transcript readback did not confirm the write');
      setView(next); setDraft(next.head.text); setNote(''); setChecked(false); setPurpose(''); setStale(false);
      setNotice(action === 'publish' ? copy.publishedNow : copy.saved);
    } catch { if (!controller.signal.aborted) { setStale(true); setNotice(copy.failed); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };

  return <section className="mt-4 min-w-0 space-y-3 border-t pt-4" aria-label={copy.title}>
    <h4 className="font-semibold">{copy.title}</h4>
    <Button type="button" variant="outline" disabled={busy} onClick={() => void reload()}>{busy ? copy.loading : view ? copy.reload : copy.load}</Button>
    {notice && <p role="status" className="break-words text-sm">{notice}</p>}
    {view && <>
      <p className="text-sm">{copy.revision} {view.head.revisionNo} · {copy[view.head.state]}</p>
      <p className="text-sm">{copy.original}</p>
      {view.canWrite ? <div className="space-y-3">
        <label className="block">{copy.edit}<textarea className="mt-1 block min-h-48 w-full min-w-0 rounded border p-2" value={draft} maxLength={200_000} disabled={busy}
          onChange={event => { setDraft(event.target.value); setChecked(false); }} /></label>
        <label className="block">{copy.note}<input className="mt-1 block w-full min-w-0 rounded border p-2" value={note} maxLength={1000} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={checked} disabled={busy || stale} onChange={event => setChecked(event.target.checked)} />{copy.checked}</label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || stale || !draft.length} onClick={() => void write('draft')}>{copy.draft}</Button>
          <Button type="button" disabled={busy || stale || !checked || !draft.length || (view.head.state === 'human_reviewed' && draft === view.head.text)} onClick={() => void write('review')}>{copy.review}</Button>
        </div>
      </div> : <><p className="text-sm">{copy.readOnly}</p><pre className="whitespace-pre-wrap break-words rounded border p-3">{view.head.text}</pre></>}
      {draft !== view.head.text && <details><summary>{copy.latest}</summary><pre className="whitespace-pre-wrap break-words rounded border p-3">{view.head.text}</pre></details>}
      <details><summary>{copy.history}</summary><ol>{view.history.map(row => <li key={row.revisionNo}>{copy.revision} {row.revisionNo} · {copy[row.state]}</li>)}</ol></details>
      {view.published ? <p role="status">{copy.published}</p> : <>
        <p className="text-sm">{copy.reviewFirst}</p>
        {view.canPublish && view.head.state === 'human_reviewed' && <div className="space-y-2">
          <label className="block">{copy.purpose}<input className="mt-1 block w-full min-w-0 rounded border p-2" value={purpose} minLength={3} maxLength={500} disabled={busy} onChange={event => setPurpose(event.target.value)} /></label>
          <Button type="button" className="h-auto whitespace-normal" disabled={busy || stale || draft !== view.head.text || purpose.trim().length < 3} onClick={() => void write('publish')}>{copy.publish}</Button>
        </div>}
      </>}
    </>}
  </section>;
}
