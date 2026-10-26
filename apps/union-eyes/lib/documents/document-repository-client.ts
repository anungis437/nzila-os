import {
  CANONICAL_DOCUMENT_COLLECTION_PATH,
  authorizedDownloadUrl,
  canonicalDownloadPath,
  bulkReportFrom,
  denialFromStatus,
  isDocumentId,
  mutationDenialFromStatus,
  BULK_DOWNLOAD_LIMIT,
  type BulkDownloadReport,
  mutationAccepted,
  repositoryRows,
  type JourneyDenial,
} from '@/lib/documents/canonical-journey';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type DownloadResult = {
  downloadUrl: string | null;
  denial: JourneyDenial | null;
};

export type MutationResult = {
  accepted: boolean;
  denial: JourneyDenial | null;
};

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function requestAuthorizedDownload(
  documentId: string,
  fetchImpl: FetchLike = fetch,
): Promise<DownloadResult> {
  if (!isDocumentId(documentId)) {
    return { downloadUrl: null, denial: 'malformed_id' };
  }

  const response = await fetchImpl(canonicalDownloadPath(documentId), { method: 'GET' });
  const body = await readBody(response);
  const downloadUrl = authorizedDownloadUrl(response.status, body);
  if (!downloadUrl) {
    return { downloadUrl: null, denial: denialFromStatus(response.status) };
  }
  return { downloadUrl, denial: null };
}

export async function submitRepositoryDocument(
  payload: Record<string, unknown>,
  fetchImpl: FetchLike = fetch,
): Promise<MutationResult> {
  const response = await fetchImpl(CANONICAL_DOCUMENT_COLLECTION_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!mutationAccepted(response.status)) {
    return { accepted: false, denial: mutationDenialFromStatus(response.status) };
  }
  return { accepted: true, denial: null };
}

export async function submitDocumentVersion(
  documentId: string,
  payload: { fileUrl: string; contentHash?: string; expectedVersionNo?: number },
  fetchImpl: FetchLike = fetch,
): Promise<MutationResult> {
  if (!isDocumentId(documentId)) {
    return { accepted: false, denial: 'malformed_id' };
  }
  const response = await fetchImpl(`/api/documents/repository/${documentId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!mutationAccepted(response.status)) {
    return { accepted: false, denial: mutationDenialFromStatus(response.status) };
  }
  return { accepted: true, denial: null };
}

export type BulkDownloadResult = {
  report: BulkDownloadReport | null;
  denial: JourneyDenial | null;
};

/**
 * One request, per-document outcomes. A report with failures is still a report: the links already issued are real, so
 * the caller must use them and show which documents were refused, not treat the batch as failed or as succeeded.
 */
export async function requestBulkDownload(
  documentIds: string[],
  fetchImpl: FetchLike = fetch,
): Promise<BulkDownloadResult> {
  if (documentIds.length === 0) return { report: null, denial: 'none_selected' };
  if (documentIds.length > BULK_DOWNLOAD_LIMIT) return { report: null, denial: 'bulk_limit' };
  if (!documentIds.every(isDocumentId)) return { report: null, denial: 'malformed_id' };

  let response: Response;
  try {
    response = await fetchImpl('/api/documents/repository/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentIds }),
    });
  } catch {
    return { report: null, denial: 'bulk_unavailable' };
  }
  const report = bulkReportFrom(response.status, await readBody(response));
  if (!report) {
    return { report: null, denial: response.status === 401 || response.status === 403 ? 'unauthorized' : 'bulk_unavailable' };
  }
  return { report, denial: null };
}

export function listDenied(status: number, body: unknown): JourneyDenial | null {
  if (!mutationAccepted(status)) {
    return status === 401 || status === 403 ? 'unauthorized' : 'list_unavailable';
  }
  if (!body || typeof body !== 'object' || !Array.isArray((body as { data?: unknown }).data)) {
    return 'list_unavailable';
  }
  return null;
}

export { repositoryRows };
