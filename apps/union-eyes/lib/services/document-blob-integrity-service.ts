import { computeSha256, downloadBuffer, generateSasUrl } from '@/lib/blob-client';

const DOCUMENT_BLOB_CONTAINER = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes';

export interface ResolveStoredBlobInput {
  organizationId: string;
  blobPath?: string;
  fileUrl?: string;
  /** A hash the client claims for the content. It is never trusted: it must equal the hash computed from storage. */
  expectedContentHash?: string;
}

export type StoredBlobErrorCode = 'INVALID_REFERENCE' | 'FOREIGN_TENANT' | 'CONTENT_HASH_MISMATCH' | 'NOT_FOUND';

/** A storage reference the server refuses. The message is safe to show; it never contains the reference. */
export class StoredBlobError extends Error {
  readonly code: StoredBlobErrorCode;
  constructor(code: StoredBlobErrorCode, message: string) {
    super(message);
    this.name = 'StoredBlobError';
    this.code = code;
  }
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

/** The origin (and path prefix, for an emulator) the application's own storage account answers on, or null. */
function configuredStorageEndpoint(): URL | null {
  try {
    const override = process.env.AZURE_STORAGE_BLOB_ENDPOINT;
    if (override) {
      // The emulator endpoint is never honoured in production (packages/blob), so neither is it here.
      if (process.env.NODE_ENV === 'production') return null;
      return new URL(override.replace(/\/+$/, '') + '/');
    }
    const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    return account ? new URL(`https://${account}.blob.core.windows.net/`) : null;
  } catch {
    return null;
  }
}

/** Segments of a blob path that cannot be a plain object name: empty, relative, or carrying a separator. */
function hasUnsafeSegment(segments: string[]): boolean {
  return segments.some((segment) => segment === '' || segment === '.' || segment === '..' || segment.includes('\\') || segment.includes('\0'));
}

/**
 * The blob path a storage URL names, only if the URL points at this application's own storage account and document
 * container. Any other host, scheme, credential, container or relative segment is not a storage reference, and a
 * query string (an old SAS signature) carries no authority and is discarded.
 */
export function parseOwnStorageUrl(fileUrl: string): string | null {
  const endpoint = configuredStorageEndpoint();
  if (!endpoint) return null;
  // The URL parser resolves dot segments before they can be inspected, so a traversal is refused on the raw string.
  if (/(^|[/\\])(\.|%2e){1,2}([/\\]|$)/i.test(fileUrl.split(/[?#]/)[0].replace(/^[a-z]+:\/\/[^/]*/i, ''))) return null;
  let parsed: URL;
  try {
    parsed = new URL(fileUrl);
  } catch {
    return null;
  }
  if (parsed.origin !== endpoint.origin || parsed.username || parsed.password) return null;
  if (!parsed.pathname.startsWith(endpoint.pathname)) return null;

  let segments: string[];
  try {
    segments = parsed.pathname.slice(endpoint.pathname.length).split('/').map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
  const [container, ...blob] = segments;
  if (container !== DOCUMENT_BLOB_CONTAINER || blob.length < 3 || hasUnsafeSegment(blob)) return null;
  return blob.join('/');
}

function validateOwnedBlobPath(blobPath: string, organizationId: string): void {
  if (hasUnsafeSegment(blobPath.split('/'))) {
    throw new StoredBlobError('INVALID_REFERENCE', 'The storage reference is not valid');
  }
  // Uploaded-but-unattached objects live under the intake prefix and are taken only by accepting their intake.
  if (blobPath.startsWith(`documents/${organizationId}/intake/`)) {
    throw new StoredBlobError('INVALID_REFERENCE', 'Uploaded files are attached through their intake');
  }
  if (!isBlobPathOwnedByOrganization(blobPath, organizationId) || blobPath.split('/').length < 3) {
    throw new StoredBlobError('FOREIGN_TENANT', 'Blob path is not scoped to organization storage');
  }
}

function resolveBlobPath(input: ResolveStoredBlobInput): string {
  if (input.blobPath) {
    return input.blobPath;
  }

  if (input.fileUrl) {
    const own = parseOwnStorageUrl(input.fileUrl);
    if (own) return own;
    throw new StoredBlobError('INVALID_REFERENCE', 'The file URL does not point at the organization document storage');
  }

  throw new StoredBlobError('INVALID_REFERENCE', 'A valid blobPath or fileUrl is required');
}

/**
 * A legacy document row carries only a stored file URL. It is honoured only as a pointer into this organization's own
 * storage: the URL is validated as a reference and then re-signed from the verified blob path. The stored URL itself
 * (which may be external, foreign, or carry an expired or over-broad signature) is never handed to a caller.
 */
export function verifiedLegacyBlobPath(fileUrl: string | null | undefined, organizationId: string): string | null {
  if (!fileUrl) return null;
  const blobPath = parseOwnStorageUrl(fileUrl);
  if (!blobPath || !isBlobPathOwnedByOrganization(blobPath, organizationId)) return null;
  return blobPath;
}

export async function resolveStoredBlob(input: ResolveStoredBlobInput): Promise<ResolvedStoredBlob> {
  const blobPath = resolveBlobPath(input);
  validateOwnedBlobPath(blobPath, input.organizationId);

  let buffer: Buffer;
  try {
    buffer = await downloadBuffer(DOCUMENT_BLOB_CONTAINER, blobPath);
  } catch {
    throw new StoredBlobError('NOT_FOUND', 'The stored file could not be read');
  }
  const contentHash = computeSha256(buffer);
  if (input.expectedContentHash !== undefined && input.expectedContentHash.toLowerCase() !== contentHash) {
    throw new StoredBlobError('CONTENT_HASH_MISMATCH', 'The content hash does not match the stored file');
  }
  const fileUrl = await generateSasUrl(DOCUMENT_BLOB_CONTAINER, blobPath);

  return {
    blobPath,
    fileUrl,
    contentHash,
  };
}

/** The response a route returns for a refused storage reference or content hash. Never echoes the reference. */
export function storedBlobFailure(error: unknown): { status: 'validation' | 'conflict'; message: string } {
  if (error instanceof StoredBlobError) {
    if (error.code === 'CONTENT_HASH_MISMATCH') return { status: 'conflict', message: error.message };
    return { status: 'validation', message: error.message };
  }
  return { status: 'validation', message: error instanceof Error ? error.message : 'Invalid storage payload' };
}
