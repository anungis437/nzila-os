import { ApiShapeError, envelopeData, isRecord } from '@/lib/client/api-envelope';

export type TranscriptState = 'machine_extraction' | 'human_draft' | 'human_reviewed';
export interface TranscriptView {
  documentId: string;
  versionId: string;
  head: { revisionNo: number; state: TranscriptState; text: string };
  history: Array<{ revisionNo: number; state: TranscriptState }>;
  published: boolean;
  canWrite: boolean;
  canPublish: boolean;
}

function revision(value: unknown) {
  if (!isRecord(value) || !Number.isSafeInteger(value.revisionNo) || Number(value.revisionNo) < 1 ||
    typeof value.state !== 'string' || !['machine_extraction', 'human_draft', 'human_reviewed'].includes(value.state)) throw new ApiShapeError('transcript revision');
  return { revisionNo: Number(value.revisionNo), state: value.state as TranscriptState };
}

export function readTranscriptView(body: unknown, documentId: string): TranscriptView {
  const data = envelopeData(body);
  if (!isRecord(body) || body.success !== true || data.documentId !== documentId || typeof data.versionId !== 'string' || !data.versionId || !isRecord(data.head) ||
    data.head.documentId !== documentId || data.head.versionId !== data.versionId ||
    typeof data.head.text !== 'string' || data.head.text.length > 200_000 || !Array.isArray(data.history) ||
    !isRecord(data.access) || typeof data.access.canWrite !== 'boolean' || typeof data.access.canPublish !== 'boolean' ||
    !(data.publishedAsEvidence === null || isRecord(data.publishedAsEvidence))) throw new ApiShapeError('transcript');
  const head = { ...revision(data.head), text: data.head.text };
  const history = data.history.map(revision);
  if (history[0]?.revisionNo !== head.revisionNo || history[0]?.state !== head.state || new Set(history.map(row => row.revisionNo)).size !== history.length ||
    history.some(row => row.revisionNo > head.revisionNo)) throw new ApiShapeError('transcript history');
  if (data.publishedAsEvidence !== null && (head.state !== 'human_reviewed' ||
    typeof data.publishedAsEvidence.publishedAt !== 'string' || !Number.isFinite(Date.parse(data.publishedAsEvidence.publishedAt))))
    throw new ApiShapeError('transcript publication');
  return { documentId, versionId: data.versionId, head, history, published: data.publishedAsEvidence !== null,
    canWrite: data.access.canWrite, canPublish: data.access.canPublish };
}

/** A successful write must identify the exact document, version, parent and submitted text. */
export function readSavedTranscript(body: unknown, prior: TranscriptView, text: string, state: TranscriptState): number {
  const data = envelopeData(body);
  if (!isRecord(body) || body.success !== true || data.documentId !== prior.documentId || data.versionId !== prior.versionId || !isRecord(data.revision) ||
    data.revision.text !== text || data.revision.baseRevisionNo !== prior.head.revisionNo) throw new ApiShapeError('saved transcript');
  const saved = revision(data.revision);
  if (saved.revisionNo !== prior.head.revisionNo + 1 || saved.state !== state) throw new ApiShapeError('saved transcript revision');
  return saved.revisionNo;
}

export function readTranscriptPublication(body: unknown, prior: TranscriptView): void {
  const data = envelopeData(body);
  if (!isRecord(body) || body.success !== true || data.documentId !== prior.documentId || data.versionId !== prior.versionId || !isRecord(data.publication) ||
    data.publication.revisionNo !== prior.head.revisionNo) throw new ApiShapeError('published transcript');
}
