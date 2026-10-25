/**
 * Document processing (OCR) authority.
 *
 * Extracting text from a document is its own capability. It is not viewing, downloading, modifying or role seniority,
 * and it is never inferred from any of them. This module is the single place the decision is made:
 *
 *   - A case-linked document needs a live case relationship (the kernel's case:read_internal, which already folds in
 *     recusal, adverse party, expiry and revocation) AND processing authority: the kernel's case:process_ocr, or an
 *     explicit, unexpired, unrevoked document grant that names can_process_ocr.
 *   - An unlinked document needs an explicit processing grant, or the uploader's own document under an ADOPTED member
 *     processing policy (default: not adopted, so nothing is opened until the institution adopts it).
 *   - Every document also passes the classification policy (isDocumentVisibleByPolicy). Processing never widens
 *     what a principal may see.
 *   - The old unionRepId column, a steward role and a view or download grant are not inputs.
 *
 * The decision is pure; resolveOcrAuthority loads the facts from the kernel and the document tables.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { documentAccessGrants, documentLinks, documents } from '@/db/schema/documents-schema';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import {
  isDocumentVisibleByPolicy,
  type GovernancePrivacyLabel,
} from '@/lib/services/document-governance-service';

const LABELS: readonly GovernancePrivacyLabel[] = [
  'public_internal',
  'team_confidential',
  'lro_confidential',
  'privileged',
  'case_restricted',
  'highly_sensitive',
];

/** Least to most restricted, for a policy ceiling. */
const LABEL_RANK: Record<GovernancePrivacyLabel, number> = {
  public_internal: 0,
  team_confidential: 1,
  lro_confidential: 2,
  case_restricted: 3,
  privileged: 4,
  highly_sensitive: 5,
};

export type OcrDenial =
  | 'classification'
  | 'no_case_authority'
  | 'no_processing_authority'
  | 'member_policy_not_adopted'
  | 'policy_ceiling';

export type OcrBasis = 'kernel_case_authority' | 'explicit_processing_grant' | 'adopted_member_policy';

export type OcrDecision =
  | { allowed: true; basis: OcrBasis }
  | { allowed: false; reason: OcrDenial };

/**
 * An institution's adopted policy for members processing their own unlinked documents. Until the institution adopts
 * one, none is in force.
 */
export interface OcrMemberPolicy {
  adopted: boolean;
  /** Highest classification a member may process under the policy. */
  ownUploadCeiling?: GovernancePrivacyLabel;
}

export const OCR_MEMBER_POLICY_NOT_ADOPTED: OcrMemberPolicy = { adopted: false };

export interface OcrAuthorityFacts {
  privacyLabel: string | null;
  isUploader: boolean;
  /** The kernel's verdicts for the linked grievance; null for an unlinked document. */
  linkedCase: null | {
    canViewCase: boolean;
    canProcessOcr: boolean;
    canViewPrivateDocuments: boolean;
    isPrimaryOwner: boolean;
  };
  /** An active, unexpired, unrevoked grant to this principal on this document. */
  grant: null | { canView: boolean; canProcessOcr: boolean };
  memberPolicy: OcrMemberPolicy;
}

const asLabel = (value: string | null): GovernancePrivacyLabel | null => LABELS.find((label) => label === value) ?? null;

export function decideOcrProcessing(facts: OcrAuthorityFacts): OcrDecision {
  const label = asLabel(facts.privacyLabel);
  if (!label) return { allowed: false, reason: 'classification' };

  const linked = facts.linkedCase;
  let basis: OcrBasis | null = null;

  if (linked) {
    // A live case relationship is the floor; recusal, revocation and expiry have already removed it.
    if (!linked.canViewCase) return { allowed: false, reason: 'no_case_authority' };
    if (linked.canProcessOcr) basis = 'kernel_case_authority';
    else if (facts.grant?.canProcessOcr === true) basis = 'explicit_processing_grant';
  } else if (facts.grant?.canProcessOcr === true) {
    basis = 'explicit_processing_grant';
  } else if (facts.isUploader) {
    if (!facts.memberPolicy.adopted) return { allowed: false, reason: 'member_policy_not_adopted' };
    const ceiling = facts.memberPolicy.ownUploadCeiling ?? 'team_confidential';
    if (LABEL_RANK[label] > LABEL_RANK[ceiling]) return { allowed: false, reason: 'policy_ceiling' };
    basis = 'adopted_member_policy';
  }
  if (!basis) return { allowed: false, reason: 'no_processing_authority' };

  // Processing never widens what the principal may see: the classification policy still has to pass.
  const visible = isDocumentVisibleByPolicy(label, {
    isOrgMember: true,
    isPrimaryOwner: linked?.isPrimaryOwner === true,
    hasCaseAccess: linked ? linked.canViewCase : true,
    canViewPrivateDocuments: linked?.canViewPrivateDocuments === true,
    hasExplicitDocumentGrant: facts.grant !== null,
  });
  if (!visible) return { allowed: false, reason: 'classification' };
  return { allowed: true, basis };
}

type CaseAccess = Awaited<ReturnType<typeof getEffectiveCaseAccess>>;

/** Everything the document-level decisions (processing, transcript write, evidence publication) are made from. */
export interface DocumentAuthorityContext {
  documentId: string;
  privacyLabel: string | null;
  uploadedBy: string | null;
  linkedEntityType: string | null;
  linkedCaseId: string | null;
  grant: { canView: boolean; canProcessOcr: boolean } | null;
  kernel: CaseAccess | null;
}

/** Loads the facts. Returns null when the document does not exist in this organization. */
export async function loadDocumentAuthorityContext(input: {
  organizationId: string;
  userId: string;
  documentId: string;
}): Promise<DocumentAuthorityContext | null> {
  const { organizationId, userId, documentId } = input;
  const row = (
    await db
      .select({
        id: documents.id,
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
  if (!row) return null;

  const grant = (
    await db
      .select({ canView: documentAccessGrants.canView, canProcessOcr: documentAccessGrants.canProcessOcr })
      .from(documentAccessGrants)
      .where(
        and(
          eq(documentAccessGrants.organizationId, organizationId),
          eq(documentAccessGrants.documentId, row.id),
          eq(documentAccessGrants.userId, userId),
          eq(documentAccessGrants.status, 'active'),
          sql`${documentAccessGrants.revokedAt} IS NULL`,
          sql`(${documentAccessGrants.expiresAt} IS NULL OR ${documentAccessGrants.expiresAt} > NOW())`,
        ),
      )
      .limit(1)
  )[0] ?? null;

  const linkedCaseId = row.linkedEntityType === 'grievance' ? row.linkedEntityId : null;
  // A document linked to anything other than a grievance has no case authority to borrow: it is judged as unlinked.
  const kernel = linkedCaseId
    ? await getEffectiveCaseAccess({ organizationId, grievanceId: linkedCaseId, userId })
    : null;

  return {
    documentId: row.id,
    privacyLabel: row.privacyLabel,
    uploadedBy: row.uploadedBy,
    linkedEntityType: row.linkedEntityType,
    linkedCaseId,
    grant,
    kernel,
  };
}

export interface ResolvedOcrAuthority {
  documentId: string;
  privacyLabel: string | null;
  linkedCaseId: string | null;
  decision: OcrDecision;
}

export function ocrFactsFrom(ctx: DocumentAuthorityContext, userId: string, memberPolicy?: OcrMemberPolicy): OcrAuthorityFacts {
  return {
    privacyLabel: ctx.privacyLabel,
    isUploader: ctx.uploadedBy === userId,
    linkedCase: ctx.kernel
      ? {
          canViewCase: ctx.kernel.canViewCase,
          canProcessOcr: ctx.kernel.canProcessOcr,
          canViewPrivateDocuments: ctx.kernel.canViewPrivateDocuments,
          isPrimaryOwner: ctx.kernel.isPrimaryOwner,
        }
      : null,
    grant: ctx.grant,
    memberPolicy: memberPolicy ?? OCR_MEMBER_POLICY_NOT_ADOPTED,
  };
}

/** Loads the facts and decides. Returns null when the document does not exist in this organization. */
export async function resolveOcrAuthority(input: {
  organizationId: string;
  userId: string;
  documentId: string;
  memberPolicy?: OcrMemberPolicy;
}): Promise<ResolvedOcrAuthority | null> {
  const ctx = await loadDocumentAuthorityContext(input);
  if (!ctx) return null;
  return {
    documentId: ctx.documentId,
    privacyLabel: ctx.privacyLabel,
    linkedCaseId: ctx.linkedCaseId,
    decision: decideOcrProcessing(ocrFactsFrom(ctx, input.userId, input.memberPolicy)),
  };
}
