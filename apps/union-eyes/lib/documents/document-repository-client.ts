import {
  CANONICAL_DOCUMENT_COLLECTION_PATH,
  authorizedDownloadUrl,
  canonicalDownloadPath,
  denialFromStatus,
  isDocumentId,
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
    return { accepted: false, denial: denialFromStatus(response.status) };
  }
  return { accepted: true, denial: null };
}

export async function submitDocumentVersion(
  documentId: string,
  payload: { fileUrl: string; contentHash: string },
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
    return { accepted: false, denial: denialFromStatus(response.status) };
  }
  return { accepted: true, denial: null };
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
