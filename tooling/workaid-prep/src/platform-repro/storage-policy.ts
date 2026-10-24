import type { Decision } from '../authorization.ts';

/**
 * Reference reproductions for WA-R3-006, WA-R3-012, WA-INT-001, WA-INT-002,
 * WA-INT-003 (apps/union-eyes/lib/services/document-storage-service.ts @
 * 38a824918). Routed to the platform owner; synthetic only.
 */

export const MAX_DOWNLOAD_URL_TTL_SECONDS = 3600;
/** AWS S3 SigV4 query-string maximum. Anything longer cannot be a valid S3 presign. */
export const AWS_SIGV4_MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
export const LEGACY_UPLOAD_URL_TTL_SECONDS = 365 * 24 * 60 * 60;

export function validateSignedUrlTtl(ttlSeconds: number): { ok: true } | { ok: false; reason: 'NOT_POSITIVE' | 'EXCEEDS_POLICY' | 'EXCEEDS_BACKEND_MAXIMUM' } {
  if (!(ttlSeconds > 0)) return { ok: false, reason: 'NOT_POSITIVE' };
  if (ttlSeconds > AWS_SIGV4_MAX_TTL_SECONDS) return { ok: false, reason: 'EXCEEDS_BACKEND_MAXIMUM' };
  if (ttlSeconds > MAX_DOWNLOAD_URL_TTL_SECONDS) return { ok: false, reason: 'EXCEEDS_POLICY' };
  return { ok: true };
}

/** A URL is minted only after a fresh authorization of the current grant (WA-T082). */
export function mintDownloadUrl(input: { authorization: Decision; ttlSeconds: number; sign: (ttl: number) => string }): { ok: true; url: string } | { ok: false; reason: string } {
  if (!input.authorization.allow) return { ok: false, reason: 'NOT_AUTHORIZED' };
  const ttl = validateSignedUrlTtl(input.ttlSeconds);
  if (!ttl.ok) return { ok: false, reason: ttl.reason };
  return { ok: true, url: input.sign(input.ttlSeconds) };
}

/** Opaque key: organization scope plus random id only. No filename, title or user text. */
export function buildOpaqueObjectKey(organizationId: string, randomHex: string): string {
  if (!/^[0-9a-f]{16,64}$/.test(randomHex)) throw new Error('object id must be 16-64 hex characters');
  return `organization/${organizationId}/${randomHex}`;
}

/** The key construction at 38a824918:169 (`${timestamp}-${random}-${doc.documentName}`). */
export function legacyObjectKey(organizationId: string, timestamp: number, randomHex: string, documentName: string): string {
  return `organization/${organizationId}/${timestamp}-${randomHex}-${documentName}`;
}

export const ALLOWED_OBJECT_METADATA_KEYS: readonly string[] = ['organizationId', 'opaqueDocumentId', 'uploadedAt'];

export interface LeakReport {
  readonly surface: string;
  readonly canary: string;
}

/** Scans every surface that can persist or transmit a name for synthetic canary fragments. */
export function findCanaryLeaks(surfaces: Readonly<Record<string, unknown>>, canaries: readonly string[]): LeakReport[] {
  const leaks: LeakReport[] = [];
  for (const [surface, value] of Object.entries(surfaces)) {
    const text = JSON.stringify(value) ?? '';
    for (const canary of canaries) if (text.includes(canary)) leaks.push({ surface, canary });
  }
  return leaks;
}

export function disallowedMetadataKeys(metadata: Readonly<Record<string, string>>): string[] {
  return Object.keys(metadata).filter((k) => !ALLOWED_OBJECT_METADATA_KEYS.includes(k));
}

/** WA-INT-002: a returned download URL must not be a bare storage URL when the container is private. */
export function isBareStorageUrl(url: string): boolean {
  const u = new URL(url);
  const hasSas = u.searchParams.has('sig') && u.searchParams.has('se');
  const hasSigV4 = u.searchParams.has('X-Amz-Signature');
  return !hasSas && !hasSigV4;
}

export interface StorageAdapters {
  put(key: string): Promise<void>;
  sign(key: string): Promise<string>;
  remove(key: string): Promise<void>;
}

/** Behaviour at 38a824918 (S3/R2 branch): put, then sign; a signing failure leaves the object behind. */
export async function legacyUploadSequence(a: StorageAdapters, key: string): Promise<{ url: string }> {
  await a.put(key);
  return { url: await a.sign(key) };
}

export type CompensatedUpload =
  | { readonly status: 'OK'; readonly key: string }
  | { readonly status: 'FAILED_CLEANED_UP'; readonly reason: string }
  | { readonly status: 'FAILED_ORPHAN_RECORDED'; readonly reason: string; readonly orphanKey: string };

/**
 * Desired behaviour (WA-INT-003): never return an error while leaving an untracked
 * object. On a post-put failure remove the object, or record the orphan for reconciliation.
 * The durable reference is the opaque key; signing is a separate, authorized, later step.
 */
export async function uploadWithCompensation(a: Pick<StorageAdapters, 'put' | 'remove'>, key: string, afterPut: () => Promise<void>): Promise<CompensatedUpload> {
  await a.put(key);
  try {
    await afterPut();
    return { status: 'OK', key };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'unknown';
    try {
      await a.remove(key);
      return { status: 'FAILED_CLEANED_UP', reason };
    } catch {
      return { status: 'FAILED_ORPHAN_RECORDED', reason, orphanKey: key };
    }
  }
}
