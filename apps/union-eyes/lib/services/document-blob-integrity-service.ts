import { computeSha256, downloadBuffer, generateSasUrl } from '@/lib/blob-client';

const DOCUMENT_BLOB_CONTAINER = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes';

export interface ResolveStoredBlobInput {
  organizationId: string;
  blobPath?: string;
  fileUrl?: string;
}

export interface ResolvedStoredBlob {
  blobPath: string;
  fileUrl: string;
  contentHash: string;
}

export function extractBlobPathFromUrl(fileUrl: string): string | null {
  try {
    const parsed = new URL(fileUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const docsIndex = segments.findIndex((segment) => segment === 'documents');
    if (docsIndex === -1) {
      return null;
    }
    return segments.slice(docsIndex).join('/');
  } catch {
    return null;
  }
}

export function isBlobPathOwnedByOrganization(blobPath: string, organizationId: string): boolean {
  return blobPath.startsWith(`documents/${organizationId}/`);
}

function resolveBlobPath(input: ResolveStoredBlobInput): string {
  if (input.blobPath) {
    return input.blobPath;
  }

  if (input.fileUrl) {
    const extracted = extractBlobPathFromUrl(input.fileUrl);
    if (extracted) {
      return extracted;
    }
  }

  throw new Error('A valid blobPath or fileUrl is required');
}

export async function resolveStoredBlob(input: ResolveStoredBlobInput): Promise<ResolvedStoredBlob> {
  const blobPath = resolveBlobPath(input);

  if (!isBlobPathOwnedByOrganization(blobPath, input.organizationId)) {
    throw new Error('Blob path is not scoped to organization storage');
  }

  const buffer = await downloadBuffer(DOCUMENT_BLOB_CONTAINER, blobPath);
  const contentHash = computeSha256(buffer);
  const fileUrl = await generateSasUrl(DOCUMENT_BLOB_CONTAINER, blobPath);

  return {
    blobPath,
    fileUrl,
    contentHash,
  };
}
