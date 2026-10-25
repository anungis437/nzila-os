/**
 * Governed transcription: machine extraction, human review and evidence publication.
 *
 * The original document (documents, document_versions) is never altered. A machine extraction is revision 1 of a
 * transcript of one version; a human draft or a human-reviewed text is each a new, immutable revision whose parent is
 * the one before it. Publication as evidence is a separate act on the head reviewed revision.
 *
 * Every write runs on the caller's tenant transaction and commits with its audit record (persistAtomicAudit): a
 * failed audit rolls the write back, so there is no transcript without its record and no record of a lost write. The
 * audit carries hashes and lengths, never the text. Concurrent writers are serialized by a lock on the version row and
 * judged by expectedRevisionNo, so a stale edit is refused rather than silently winning.
 *
 * Authority is not decided here. Read, write and publish decisions are made by decideTranscriptAccess from the kernel
 * and the document tables (lib/documents/ocr-authority.ts loads the facts); they are separate capabilities, none of
 * which follows from another.
 */
import { createHash } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import {
  documents,
  documentTranscriptPublications,
  documentTranscriptRevisions,
  documentVersions,
  type DocumentTranscriptRevision,
} from '@/db/schema/documents-schema';
import { isDocumentVisibleByPolicy, type GovernancePrivacyLabel } from '@/lib/services/document-governance-service';
import { hasDocumentContextAccess } from '@/lib/services/document-member-scope';
import type { DocumentAuthorityContext } from '@/lib/documents/ocr-authority';

export const TRANSCRIPT_MAX_CHARS = 200_000;

const LABELS: readonly string[] = ['public_internal', 'team_confidential', 'lro_confidential', 'privileged', 'case_restricted', 'highly_sensitive'];

export const sha256Text = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

export interface TranscriptAccess {
  canRead: boolean;
  canWrite: boolean;
  canPublish: boolean;
}

/**
 * Three decisions, none implying another:
 *  - read: the document is visible to the principal under the classification policy and the document context rule
 *    (role seniority is not an input);
 *  - write (draft or review): linked, the kernel's case:modify_document on a live case relationship; unlinked, the
 *    document's own uploader;
 *  - publish as evidence: the kernel's case:upload_evidence on the linked case; an unlinked document has no case to
 *    carry evidence and cannot be published.
 */
export function decideTranscriptAccess(ctx: DocumentAuthorityContext, userId: string): TranscriptAccess {
  if (!ctx.privacyLabel || !LABELS.includes(ctx.privacyLabel)) return { canRead: false, canWrite: false, canPublish: false };
  const label = ctx.privacyLabel as GovernancePrivacyLabel;
  const kernel = ctx.kernel;
  const visible =
    isDocumentVisibleByPolicy(label, {
      isOrgMember: true,
      isPrimaryOwner: kernel?.isPrimaryOwner === true,
      hasCaseAccess: hasDocumentContextAccess({
        isStaff: false,
        canViewCase: kernel?.canViewCase === true,
        hasExplicitGrant: ctx.grant !== null,
        linkedEntityId: ctx.linkedCaseId ?? (ctx.linkedEntityType ? 'linked-other' : null),
        privacyLabel: ctx.privacyLabel,
        uploadedBy: ctx.uploadedBy,
        userId,
      }),
      canViewPrivateDocuments: kernel?.canViewPrivateDocuments === true,
      hasExplicitDocumentGrant: ctx.grant !== null,
    });
  if (!visible) return { canRead: false, canWrite: false, canPublish: false };
  if (ctx.linkedCaseId) {
    const live = kernel?.canViewCase === true;
    return { canRead: true, canWrite: live && kernel?.canModifyDocuments === true, canPublish: live && kernel?.canUploadDocuments === true };
  }
  return { canRead: true, canWrite: ctx.uploadedBy === userId, canPublish: false };
}

type Failure<K extends string> = { ok: false; kind: K } & Record<string, unknown>;
const fail = <K extends string>(kind: K, extra: Record<string, unknown> = {}): Failure<K> => ({ ok: false, kind, ...extra });

export type TranscriptRevisionView = Omit<DocumentTranscriptRevision, 'text'> & { text?: string };

/**
 * The latest version of a live document, with the document row locked for the duration of the transaction. The lock is
 * on the document (the runtime role holds UPDATE there; document_versions is append-only and cannot be row-locked) and
 * is the same lock a version append takes, so a transcript write and a new version serialise against each other.
 */
async function lockLatestVersion(tx: RLSTx, organizationId: string, documentId: string) {
  const [lockedDocument] = await tx
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)))
    .for('update');
  if (!lockedDocument) return null;
  const [latest] = await tx
    .select({ id: documentVersions.id, versionNo: documentVersions.versionNo, contentHash: documentVersions.contentHash, storageKey: documentVersions.storageKey })
    .from(documentVersions)
    .where(and(eq(documentVersions.organizationId, organizationId), eq(documentVersions.documentId, documentId)))
    .orderBy(desc(documentVersions.versionNo))
    .limit(1);
  return latest ?? null;
}

const headRevision = async (tx: RLSTx, documentId: string, versionId: string) =>
  (
    await tx
      .select()
      .from(documentTranscriptRevisions)
      .where(and(eq(documentTranscriptRevisions.documentId, documentId), eq(documentTranscriptRevisions.versionId, versionId)))
      .orderBy(desc(documentTranscriptRevisions.revisionNo))
      .limit(1)
  )[0] ?? null;

export interface MachineExtractionInput {
  organizationId: string;
  userId: string;
  documentId: string;
  classification: string;
  text: string;
  engine: string;
  engineVersion: string;
  language: string;
  confidence: number;
  /** Called with the version the extraction will attach to, before it is written; lets the caller verify the bytes. */
  verifySource?: (version: { storageKey: string; contentHash: string }) => Promise<boolean>;
}

/**
 * Records a machine extraction as revision 1 of the latest version. Idempotent per version: a second extraction of the
 * same version returns the one already recorded. The extraction must have been read from the bytes whose hash the
 * version records (verifySource), otherwise it is refused.
 */
export async function recordMachineExtraction(tx: RLSTx, input: MachineExtractionInput) {
  if (input.text.length > TRANSCRIPT_MAX_CHARS) return fail('too_large');
  const version = await lockLatestVersion(tx, input.organizationId, input.documentId);
  if (!version) return fail('no_version');
  if (input.verifySource && !(await input.verifySource({ storageKey: version.storageKey, contentHash: version.contentHash }))) {
    return fail('source_integrity');
  }
  const existing = await headRevision(tx, input.documentId, version.id);
  if (existing) {
    return { ok: true as const, created: false as const, versionId: version.id, revision: existing };
  }
  const [revision] = await tx
    .insert(documentTranscriptRevisions)
    .values({
      organizationId: input.organizationId,
      documentId: input.documentId,
      versionId: version.id,
      revisionNo: 1,
      baseRevisionNo: null,
      state: 'machine_extraction',
      text: input.text,
      textHash: sha256Text(input.text),
      sourceContentHash: version.contentHash,
      classification: input.classification,
      engine: input.engine,
      engineVersion: input.engineVersion,
      language: input.language,
      confidence: input.confidence.toFixed(2),
      authoredBy: input.userId,
    })
    .returning();
  await persistAtomicAudit(tx, {
    organizationId: input.organizationId,
    userId: input.userId,
    action: 'document.ocr.extract',
    resourceType: 'documents',
    resourceId: input.documentId,
    details: {
      versionId: version.id,
      revisionNo: 1,
      textHash: revision.textHash,
      sourceContentHash: version.contentHash,
      length: input.text.length,
      engine: input.engine,
      engineVersion: input.engineVersion,
      classification: input.classification,
      authoritative: false,
    },
  });
  return { ok: true as const, created: true as const, versionId: version.id, revision };
}

export interface HumanRevisionInput {
  organizationId: string;
  userId: string;
  documentId: string;
  classification: string;
  /** The head revision the caller edited from. A different head means someone else wrote first. */
  expectedRevisionNo: number;
  text: string;
  changeNote?: string;
  review: boolean;
}

/** Writes a human draft, or a human-reviewed text, as the next revision. */
export async function saveHumanRevision(tx: RLSTx, input: HumanRevisionInput) {
  if (input.text.length === 0 || input.text.length > TRANSCRIPT_MAX_CHARS) return fail('invalid_text');
  const version = await lockLatestVersion(tx, input.organizationId, input.documentId);
  if (!version) return fail('no_version');
  const head = await headRevision(tx, input.documentId, version.id);
  if (!head) return fail('no_extraction');
  if (head.revisionNo !== input.expectedRevisionNo) return fail('stale', { currentRevisionNo: head.revisionNo });
  if (head.classification !== input.classification) return fail('classification_changed', { currentRevisionNo: head.revisionNo });
  // Review is independent: the person who wrote the draft under review is not its reviewer.
  if (input.review && head.state === 'human_draft' && head.authoredBy === input.userId) return fail('self_review');
  if (input.review && head.state === 'human_reviewed' && head.text === input.text) return fail('already_reviewed', { currentRevisionNo: head.revisionNo });

  const revisionNo = head.revisionNo + 1;
  const [revision] = await tx
    .insert(documentTranscriptRevisions)
    .values({
      organizationId: input.organizationId,
      documentId: input.documentId,
      versionId: version.id,
      revisionNo,
      baseRevisionNo: head.revisionNo,
      state: input.review ? 'human_reviewed' : 'human_draft',
      text: input.text,
      textHash: sha256Text(input.text),
      sourceContentHash: version.contentHash,
      classification: input.classification,
      authoredBy: input.userId,
      reviewedBy: input.review ? input.userId : null,
      reviewedAt: input.review ? new Date() : null,
      changeNote: input.changeNote ?? null,
    })
    .returning();
  await persistAtomicAudit(tx, {
    organizationId: input.organizationId,
    userId: input.userId,
    action: input.review ? 'document.transcript.review' : 'document.transcript.draft',
    resourceType: 'documents',
    resourceId: input.documentId,
    details: {
      versionId: version.id,
      revisionNo,
      baseRevisionNo: head.revisionNo,
      baseTextHash: head.textHash,
      textHash: revision.textHash,
      length: input.text.length,
      classification: input.classification,
    },
  });
  return { ok: true as const, versionId: version.id, revision };
}

export interface PublishInput {
  organizationId: string;
  userId: string;
  documentId: string;
  linkedCaseId: string;
  revisionNo: number;
  purpose: string;
}

/** Publishes the head, human-reviewed revision as evidence. A separate act from review; once per revision. */
export async function publishTranscriptAsEvidence(tx: RLSTx, input: PublishInput) {
  const version = await lockLatestVersion(tx, input.organizationId, input.documentId);
  if (!version) return fail('no_version');
  const head = await headRevision(tx, input.documentId, version.id);
  if (!head) return fail('no_extraction');
  if (head.revisionNo !== input.revisionNo) return fail('stale', { currentRevisionNo: head.revisionNo });
  if (head.state !== 'human_reviewed') return fail('not_reviewed');
  const [already] = await tx
    .select({ id: documentTranscriptPublications.id })
    .from(documentTranscriptPublications)
    .where(
      and(
        eq(documentTranscriptPublications.documentId, input.documentId),
        eq(documentTranscriptPublications.versionId, version.id),
        eq(documentTranscriptPublications.revisionNo, head.revisionNo),
      ),
    )
    .limit(1);
  if (already) return fail('already_published');

  const [publication] = await tx
    .insert(documentTranscriptPublications)
    .values({
      organizationId: input.organizationId,
      documentId: input.documentId,
      versionId: version.id,
      revisionNo: head.revisionNo,
      textHash: head.textHash,
      linkedCaseId: input.linkedCaseId,
      publishedBy: input.userId,
      purpose: input.purpose,
    })
    .returning();
  await persistAtomicAudit(tx, {
    organizationId: input.organizationId,
    userId: input.userId,
    action: 'document.transcript.publish_as_evidence',
    resourceType: 'documents',
    resourceId: input.documentId,
    details: {
      versionId: version.id,
      revisionNo: head.revisionNo,
      textHash: head.textHash,
      linkedCaseId: input.linkedCaseId,
      reviewedBy: head.reviewedBy,
      purpose: input.purpose,
    },
  });
  return { ok: true as const, versionId: version.id, publication };
}

/** The transcript of the latest version: head text, history without text, and whether the head is published. */
export async function readTranscript(tx: RLSTx, input: { organizationId: string; documentId: string }) {
  const [latest] = await tx
    .select({ id: documentVersions.id, versionNo: documentVersions.versionNo })
    .from(documentVersions)
    .where(and(eq(documentVersions.organizationId, input.organizationId), eq(documentVersions.documentId, input.documentId)))
    .orderBy(desc(documentVersions.versionNo))
    .limit(1);
  if (!latest) return null;
  const revisions = await tx
    .select()
    .from(documentTranscriptRevisions)
    .where(and(eq(documentTranscriptRevisions.documentId, input.documentId), eq(documentTranscriptRevisions.versionId, latest.id)))
    .orderBy(desc(documentTranscriptRevisions.revisionNo));
  if (revisions.length === 0) return null;
  const head = revisions[0];
  const [published] = await tx
    .select({ publishedAt: documentTranscriptPublications.publishedAt, publishedBy: documentTranscriptPublications.publishedBy })
    .from(documentTranscriptPublications)
    .where(
      and(
        eq(documentTranscriptPublications.documentId, input.documentId),
        eq(documentTranscriptPublications.versionId, latest.id),
        sql`${documentTranscriptPublications.revisionNo} = ${head.revisionNo}`,
      ),
    )
    .limit(1);
  return {
    versionId: latest.id,
    versionNo: latest.versionNo,
    head,
    history: revisions.map(({ text: _text, ...rest }) => rest) as TranscriptRevisionView[],
    publishedAsEvidence: published ?? null,
  };
}
