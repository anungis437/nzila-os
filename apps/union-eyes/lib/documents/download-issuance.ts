/**
 * Document download authorization, artifact selection and audited application-link issuance.
 *
 * Used by the single-document route and by the bulk route, so a bulk download is exactly N single downloads: each
 * document is authorized on its own, each issued link has its own canonical access record, and a failure on one
 * document says nothing about the others.
 *
 * Contract:
 *  - A link is issued only after the access record has been written. persistAtomicAudit either records the access or
 *    throws; it has no "skipped" result, so no link can be issued on an unrecorded access (canonical V2 on or off).
 *  - The location is the latest version's storage key or a verified legacy reference into this organization's storage.
 *    An actor-bound application lease pins that artifact. The byte route rechecks live authority and audits release.
 *  - Denials, missing documents and storage failures write no access record.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import {
  documentAccessGrants,
  documents,
  documentVersions,
} from '@/db/schema/documents-schema';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import { isDocumentVisibleByPolicy, toGovernanceLabel } from '@/lib/services/document-governance-service';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { logger } from '@/lib/logger';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { hasDocumentContextAccess } from '@/lib/services/document-member-scope';
import { resolveDocumentCaseId } from '@/lib/documents/document-link-authority';
import {
  isBlobPathOwnedByOrganization,
  verifiedLegacyBlobPath,
} from '@/lib/services/document-blob-integrity-service';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { allDocumentLinksWellFormed, readDocumentLinks } from '@/lib/documents/document-links';
import { issueDocumentDownloadLease } from '@/lib/documents/download-lease';

export const DOCUMENT_DOWNLOAD_MAX_BYTES = 50 * 1024 * 1024;

export type DownloadOutcome =
  | { kind: 'issued'; id: string; title: string | null; mimeType: string | null; downloadUrl: string }
  | { kind: 'invalid_id' }
  | { kind: 'not_found' }
  | { kind: 'denied'; reason: 'policy' | 'download_not_granted' }
  | { kind: 'storage_unavailable' }
  | { kind: 'storage_unverified' }
  | { kind: 'audit_failed' };

export interface DownloadIssuanceInput {
  organizationId: string;
  userId: string;
  documentId: string;
  /** Representative-level role (steward or above), resolved by the caller once, before it opens the transaction. */
  isStaff: boolean;
  /** The route that asked, recorded on the access record. */
  route: string;
}

export interface DocumentDownloadLocation {
  kind: 'located';
  id: string;
  title: string | null;
  filename: string | null;
  mimeType: string | null;
  privacyLabel: string | null;
  versionId: string | null;
  versionNo: number | null;
  blobPath: string;
  contentHash: string | null;
  sizeBytes: number | null;
  fingerprint: string;
  integrityBasis: 'stored_version_hash' | 'stored_document_hash' | 'verified_legacy_storage_reference';
}

type LocationOutcome = DocumentDownloadLocation | Exclude<DownloadOutcome, { kind: 'issued' }>;

function recordedSize(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('DOCUMENT_DOWNLOAD_SIZE_INVALID');
  return value;
}

/**
 * `tx` is the caller's own transaction for `input.organizationId`: the reads, the access record and (through it) the
 * decision to issue a link are one unit, and a bulk caller opens one transaction per document so that a failure on
 * one document cannot poison the others.
 */
export async function locateDocumentDownload(
  tx: RLSTx,
  input: DownloadIssuanceInput,
  options: { versionId?: string | null; lock?: boolean } = {},
): Promise<LocationOutcome> {
  const { organizationId, userId, documentId, isStaff } = input;
  if (!isDocumentId(documentId)) return { kind: 'invalid_id' };

  if (options.lock) {
    // Lock the mutable parent, as version append does. Child links/versions
    // are append-only and grants read-only to runtime; row-locking them would
    // require forbidden UPDATE rights. The kernel locks its authority read set.
    await tx.execute(sql`SELECT id FROM public.documents
      WHERE organization_id=${organizationId}::uuid AND id=${documentId}::uuid FOR SHARE`);
  }

  const row = (
    await tx
      .select({
        id: documents.id,
        title: documents.title,
        name: documents.name,
        filename: documents.filename,
        fileUrl: documents.fileUrl,
        mimeType: documents.mimeType,
        privacyLabel: documents.privacyLabel,
        uploadedBy: documents.uploadedBy,
        sizeBytes: documents.sizeBytes,
        fileSize: documents.fileSize,
        sha256: documents.sha256,
        checksum: documents.checksum,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId),
          sql`${documents.deletedAt} IS NULL`,
        ),
      )
      .limit(1)
  )[0];

  if (!row) return { kind: 'not_found' };

  // A document attached to several cases is decided on all of them, never on whichever row a join returned first.
  const links = await readDocumentLinks(tx, organizationId, row.id);
  if (!allDocumentLinksWellFormed(links)) return { kind: 'denied', reason: 'policy' };

  const explicitGrant = (
    await tx
      .select({
        id: documentAccessGrants.id,
        canDownload: documentAccessGrants.canDownload,
      })
      .from(documentAccessGrants)
      .where(
        and(
          eq(documentAccessGrants.organizationId, organizationId),
          eq(documentAccessGrants.documentId, row.id),
          eq(documentAccessGrants.userId, userId),
          eq(documentAccessGrants.status, 'active'),
          eq(documentAccessGrants.canView, true),
          sql`${documentAccessGrants.revokedAt} IS NULL`,
          sql`(${documentAccessGrants.expiresAt} IS NULL OR ${documentAccessGrants.expiresAt} > NOW())`,
        ),
      )
      .limit(1)
  )[0];

  // Representative-level role: eligibility for organization-level (unlinked) documents only, never case content.
  // The document is readable when its policy admits the actor through any one of its links; the decision does not depend on link order.
  let allowed = false;
  for (const link of links) {
    const linkedCaseId = await resolveDocumentCaseId(tx, { organizationId, linkedEntityType: link.linkedEntityType, linkedEntityId: link.linkedEntityId });
    let caseAccess = {
      isPrimaryOwner: false,
      canViewCase: false,
      canViewPrivateDocuments: false,
    };
    if (linkedCaseId) {
      const effective = await getEffectiveCaseAccess({
        organizationId,
        grievanceId: linkedCaseId,
        userId,
      });
      caseAccess = {
        isPrimaryOwner: effective.isPrimaryOwner,
        canViewCase: effective.canViewCase,
        canViewPrivateDocuments: effective.canViewPrivateDocuments,
      };
    }

    allowed = isDocumentVisibleByPolicy(
      toGovernanceLabel({ privacyLabel: row.privacyLabel ?? undefined }),
      {
        isOrgMember: true,
        isPrimaryOwner: caseAccess.isPrimaryOwner,
        hasCaseAccess: hasDocumentContextAccess({
          isStaff,
          canViewCase: caseAccess.canViewCase,
          hasExplicitGrant: Boolean(explicitGrant),
          linkedEntityType: linkedCaseId ? 'case' : link.linkedEntityType,
          linkedEntityId: linkedCaseId ?? link.linkedEntityId,
          privacyLabel: row.privacyLabel,
          uploadedBy: row.uploadedBy,
          userId,
        }),
        canViewPrivateDocuments: caseAccess.canViewPrivateDocuments,
        hasExplicitDocumentGrant: Boolean(explicitGrant),
      },
    );
    if (allowed) break;
  }

  if (!allowed) return { kind: 'denied', reason: 'policy' };
  if (explicitGrant && !explicitGrant.canDownload) return { kind: 'denied', reason: 'download_not_granted' };

  const latestVersion = (
    await tx
      .select({ id: documentVersions.id, versionNo: documentVersions.versionNo,
        storageKey: documentVersions.storageKey, contentHash: documentVersions.contentHash,
        metadata: documentVersions.metadata })
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.organizationId, organizationId),
          eq(documentVersions.documentId, row.id),
          ...(typeof options.versionId === 'string' ? [eq(documentVersions.id, options.versionId)] : []),
        ),
      )
      .orderBy(desc(documentVersions.versionNo))
      .limit(1)
  )[0];
  if (typeof options.versionId === 'string' && !latestVersion) return { kind: 'not_found' };


  // The location is derived, never echoed: a version's key must lie in this organization's storage, and a legacy URL
  // must validate as a reference into it. Anything else is not a location the server can vouch for.
  const blobPath = latestVersion?.storageKey
    ? isBlobPathOwnedByOrganization(latestVersion.storageKey, organizationId)
      ? latestVersion.storageKey
      : null
    : verifiedLegacyBlobPath(row.fileUrl, organizationId);
  if (!blobPath) return { kind: 'storage_unverified' };

  let contentHash: string | null;
  let sizeBytes: number | null;
  try {
    contentHash = latestVersion ? latestVersion.contentHash : row.sha256 ?? row.checksum ?? null;
    if (contentHash !== null && !/^[a-f0-9]{64}$/.test(contentHash)) return { kind: 'storage_unverified' };
    if (latestVersion && contentHash === null) return { kind: 'storage_unverified' };
    const metadata = latestVersion?.metadata;
    sizeBytes = latestVersion
      ? metadata && typeof metadata === 'object' && 'sizeBytes' in metadata
        ? recordedSize(metadata.sizeBytes) : null
      : recordedSize(row.sizeBytes ?? row.fileSize);
  } catch {
    return { kind: 'storage_unverified' };
  }

  const snapshot = {
    documentId, organizationId, privacyLabel: row.privacyLabel,
    links: links.map((link) => [link.linkedEntityType, link.linkedEntityId]),
    versionId: latestVersion?.id ?? null, versionNo: latestVersion?.versionNo ?? null,
    blobPath, contentHash, sizeBytes,
    // A versioned link keeps its reviewed artifact when a newer version is
    // appended. Legacy references have no version, so any row change refuses.
    legacyUpdatedAt: latestVersion ? null : row.updatedAt,
  };
  return {
    kind: 'located', id: row.id, title: row.title ?? row.filename ?? row.name ?? null,
    filename: row.filename ?? row.title ?? row.name ?? null, mimeType: row.mimeType ?? null,
    privacyLabel: row.privacyLabel ?? null,
    versionId: latestVersion?.id ?? null, versionNo: latestVersion?.versionNo ?? null,
    blobPath, contentHash, sizeBytes,
    fingerprint: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),
    integrityBasis: latestVersion ? 'stored_version_hash' : contentHash ? 'stored_document_hash' : 'verified_legacy_storage_reference',
  };
}

/** Issue an actor-bound application link. Private storage locations never leave this service. */
export async function issueDocumentDownload(tx: RLSTx, input: DownloadIssuanceInput): Promise<DownloadOutcome> {
  const located = await locateDocumentDownload(tx, input);
  if (located.kind !== 'located') return located;
  const { organizationId, userId, route } = input;
  let downloadUrl: string;
  try {
    const lease = issueDocumentDownloadLease({ organizationId, userId, documentId: located.id,
      versionId: located.versionId, fingerprint: located.fingerprint });
    downloadUrl = `/api/documents/${located.id}/content?lease=${encodeURIComponent(lease.token)}`;
  } catch {
    return { kind: 'storage_unavailable' };
  }

  try {
    await persistAtomicAudit(tx, {
      organizationId,
      action: 'document.download',
      resourceType: 'documents',
      resourceId: located.id,
      userId,
      details: { route, privacyLabel: located.privacyLabel, delivery: 'application_link_issued',
        versionId: located.versionId, versionNo: located.versionNo },
    });
  } catch (error) {
    logger.error('Document download access record could not be written', { documentId: located.id, error: error instanceof Error ? error.message : String(error) });
    return { kind: 'audit_failed' };
  }

  return {
    kind: 'issued',
    id: located.id,
    title: located.title,
    mimeType: located.mimeType,
    downloadUrl,
  };
}
