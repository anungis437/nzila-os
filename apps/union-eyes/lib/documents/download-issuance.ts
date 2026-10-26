/**
 * The one place a document download is authorized, located in storage and audited (UE tranche-1 integration, B1-B3).
 *
 * Used by the single-document route and by the bulk route, so a bulk download is exactly N single downloads: each
 * document is authorized on its own, each issued link has its own canonical access record, and a failure on one
 * document says nothing about the others.
 *
 * Contract:
 *  - A link is issued only after the access record has been written. persistAtomicAudit either records the access or
 *    throws; it has no "skipped" result, so no link can be issued on an unrecorded access (canonical V2 on or off).
 *  - The location is always the server's own: the latest version's storage key, or a legacy file URL that validates as
 *    a reference into this organization's own storage and is re-signed. A stored external or foreign URL is never
 *    returned.
 *  - Denials, missing documents and storage failures write no access record.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { hasMinRole } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import {
  documentAccessGrants,
  documentLinks,
  documents,
  documentVersions,
} from '@/db/schema/documents-schema';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import { isDocumentVisibleByPolicy, toGovernanceLabel } from '@/lib/services/document-governance-service';
import { generateSasUrl } from '@/lib/blob-client';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { hasDocumentContextAccess } from '@/lib/services/document-member-scope';
import {
  isBlobPathOwnedByOrganization,
  verifiedLegacyBlobPath,
} from '@/lib/services/document-blob-integrity-service';
import { isDocumentId } from '@/lib/documents/canonical-journey';

const DOCUMENT_BLOB_CONTAINER = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes';

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
  /** Resolved once by a bulk caller; a single caller leaves it to be resolved here. */
  isStaff?: boolean;
  /** The route that asked, recorded on the access record. */
  route: string;
}

export async function issueDocumentDownload(input: DownloadIssuanceInput): Promise<DownloadOutcome> {
  const { organizationId, userId, documentId, route } = input;
  if (!isDocumentId(documentId)) return { kind: 'invalid_id' };

  const row = (
    await db
      .select({
        id: documents.id,
        title: documents.title,
        name: documents.name,
        filename: documents.filename,
        fileUrl: documents.fileUrl,
        mimeType: documents.mimeType,
        privacyLabel: documents.privacyLabel,
        uploadedBy: documents.uploadedBy,
        linkedEntityType: documentLinks.linkedEntityType,
        linkedEntityId: documentLinks.linkedEntityId,
      })
      .from(documents)
      .leftJoin(documentLinks, eq(documentLinks.documentId, documents.id))
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

  const explicitGrant = (
    await db
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
  const isStaff = input.isStaff ?? (await hasMinRole('steward'));
  let caseAccess = {
    isPrimaryOwner: false,
    canViewCase: false,
    canViewPrivateDocuments: false,
  };

  if (row.linkedEntityType === 'grievance' && row.linkedEntityId) {
    const effective = await getEffectiveCaseAccess({
      organizationId,
      grievanceId: row.linkedEntityId,
      userId,
    });
    caseAccess = {
      isPrimaryOwner: effective.isPrimaryOwner,
      canViewCase: effective.canViewCase,
      canViewPrivateDocuments: effective.canViewPrivateDocuments,
    };
  }

  const allowed = isDocumentVisibleByPolicy(
    toGovernanceLabel({ privacyLabel: row.privacyLabel ?? undefined }),
    {
      isOrgMember: true,
      isPrimaryOwner: caseAccess.isPrimaryOwner,
      hasCaseAccess: hasDocumentContextAccess({
        isStaff,
        canViewCase: caseAccess.canViewCase,
        hasExplicitGrant: Boolean(explicitGrant),
        linkedEntityId: row.linkedEntityId,
        privacyLabel: row.privacyLabel,
        uploadedBy: row.uploadedBy,
        userId,
      }),
      canViewPrivateDocuments: caseAccess.canViewPrivateDocuments,
      hasExplicitDocumentGrant: Boolean(explicitGrant),
    },
  );

  if (!allowed) return { kind: 'denied', reason: 'policy' };
  if (explicitGrant && !explicitGrant.canDownload) return { kind: 'denied', reason: 'download_not_granted' };

  const latestVersion = (
    await db
      .select({ storageKey: documentVersions.storageKey })
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.organizationId, organizationId),
          eq(documentVersions.documentId, row.id),
        ),
      )
      .orderBy(desc(documentVersions.versionNo))
      .limit(1)
  )[0];

  // The location is derived, never echoed: a version's key must lie in this organization's storage, and a legacy URL
  // must validate as a reference into it. Anything else is not a location the server can vouch for.
  const blobPath = latestVersion?.storageKey
    ? isBlobPathOwnedByOrganization(latestVersion.storageKey, organizationId)
      ? latestVersion.storageKey
      : null
    : verifiedLegacyBlobPath(row.fileUrl, organizationId);
  if (!blobPath) return { kind: 'storage_unverified' };

  let downloadUrl: string;
  try {
    downloadUrl = await generateSasUrl(DOCUMENT_BLOB_CONTAINER, blobPath);
  } catch {
    return { kind: 'storage_unavailable' };
  }
  if (!downloadUrl) return { kind: 'storage_unverified' };

  try {
    await persistAtomicAudit(db as unknown as RLSTx, {
      organizationId,
      action: 'document.download',
      resourceType: 'documents',
      resourceId: row.id,
      userId,
      details: { route, privacyLabel: row.privacyLabel ?? null },
    });
  } catch {
    return { kind: 'audit_failed' };
  }

  return {
    kind: 'issued',
    id: row.id,
    title: row.title ?? row.filename ?? row.name ?? null,
    mimeType: row.mimeType ?? null,
    downloadUrl,
  };
}
