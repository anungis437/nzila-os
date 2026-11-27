/** COMPONENT-ONLY PROTOTYPE: no production reader/provenance guard is installed.
 * Protected payload contract for a source-reviewed external READ qualification.
 * This module neither creates requests nor confers authority. Only the reserved
 * owner/import path may bind it to the existing canonical approval machinery.
 */
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { canonicalPythonJson } from '@/lib/audit/canonical-audit-chain'
import { isPrincipalId } from '@/lib/authority/store/executor'

export const EXTERNAL_READ_PREQUALIFICATION = 'external_read_prequalification_v1'
const uuid = z.string().uuid()
const principal = z.string().refine(isPrincipalId, 'Canonical principal required')
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const instant = z
  .string()
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)))
const citation = z
  .string()
  .min(1)
  .max(2000)
  .refine((value) => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value))
const permissionBits = z
  .object({
    view: z.boolean(),
    comment: z.boolean(),
    uploadDocuments: z.boolean(),
    viewDocuments: z.boolean(),
    downloadDocuments: z.boolean(),
  })
  .strict()

const schema = z
  .object({
    operation: z.literal(EXTERNAL_READ_PREQUALIFICATION),
    qualificationId: uuid,
    approvalRequestId: uuid,
    organizationId: uuid,
    representativeUserId: principal,
    representativeOrganizationId: uuid,
    representedMemberUserId: principal,
    proposedBy: principal,
    authority: z
      .object({
        id: uuid,
        representedPersonId: uuid,
        createdBy: principal,
        source: citation,
        scope: z.array(citation).min(1),
        evidenceDocumentId: uuid.nullable(),
        effectiveAt: instant,
        expiresAt: instant,
      })
      .strict(),
    matter: z
      .object({
        type: z.literal('grievance'),
        id: uuid,
        grantId: uuid,
        grantedBy: principal,
        grantedAt: instant,
        expiresAt: instant,
        permissions: permissionBits,
      })
      .strict(),
    document: z
      .object({
        id: uuid,
        grantId: uuid,
        grantedBy: principal,
        grantedAt: instant,
        expiresAt: instant,
        canView: z.boolean(),
        canDownload: z.boolean(),
        canShare: z.boolean(),
        versionId: uuid,
        versionNo: z.number().int().min(1).max(2147483647),
        checksumSha256: digest,
        sizeBytes: z
          .number()
          .int()
          .min(0)
          .max(50 * 1024 * 1024),
        storageKeySha256: digest,
        privacyLabel: citation,
      })
      .strict()
      .nullable(),
    sourceInstrument: z.object({ reference: citation, sha256: digest }).strict(),
    reviewedAt: instant,
    effectiveAt: instant,
    expiresAt: instant,
  })
  .strict()
  .superRefine((payload, context) => {
    const reviewed = Date.parse(payload.reviewedAt),
      effective = Date.parse(payload.effectiveAt),
      expires = Date.parse(payload.expiresAt)
    if (reviewed > effective || effective >= expires)
      context.addIssue({ code: 'custom', message: 'Finite ordered review and validity required' })
    if (payload.organizationId === payload.representativeOrganizationId)
      context.addIssue({ code: 'custom', message: 'Foreign representative organization required' })
    for (const end of [
      payload.authority.expiresAt,
      payload.matter.expiresAt,
      payload.document?.expiresAt,
    ])
      if (end && Date.parse(end) < expires)
        context.addIssue({ code: 'custom', message: 'Qualification exceeds a parent grant term' })
    if (
      Date.parse(payload.authority.effectiveAt) > effective ||
      Date.parse(payload.matter.grantedAt) > effective ||
      (payload.document && Date.parse(payload.document.grantedAt) > effective)
    )
      context.addIssue({ code: 'custom', message: 'Qualification predates its stored source' })
    if (new Set(payload.authority.scope).size !== payload.authority.scope.length)
      context.addIssue({ code: 'custom', message: 'Authority scope is contradictory' })
    if (
      payload.authority.createdBy === payload.representativeUserId ||
      payload.matter.grantedBy === payload.representativeUserId ||
      payload.document?.grantedBy === payload.representativeUserId
    )
      context.addIssue({
        code: 'custom',
        message: 'A recipient cannot issue their own stored authority',
      })
  })

export type ExternalReadQualification = z.infer<typeof schema>
export function parseExternalReadQualification(value: unknown): ExternalReadQualification {
  return schema.parse(value)
}
export function externalReadQualificationHash(value: unknown): string {
  return createHash('sha256')
    .update(canonicalPythonJson(schema.parse(value)), 'utf8')
    .digest('hex')
}

/** Actual canonical request/decision rows, not approvedBy metadata or status alone.
 * Existing physical guards establish vote authority at the time each vote is
 * recorded. These immutable rows retain that decision after the request settles.
 */
export interface QualificationApproval {
  id: string
  organizationId: string
  subjectType: string
  subjectId: string
  proposedBy: string
  subjectAuthorId: string | null
  status: string
  riskClass: string
  requiredApprovals: number
  namedApproverIds: readonly string[]
  adverseUserIds: readonly string[]
  decidedAt: Date | null
  decisions: readonly {
    approverUserId: string
    authorityLineUserId: string
    delegationId: string | null
    decision: string
    decidedAt: Date
  }[]
}
export function qualificationApprovalSatisfied(
  binding: ExternalReadQualification,
  approval: QualificationApproval | null,
  now: Date,
): boolean {
  if (
    !Number.isFinite(now.getTime()) ||
    !approval ||
    approval.id !== binding.approvalRequestId ||
    approval.organizationId !== binding.organizationId ||
    approval.subjectType !== EXTERNAL_READ_PREQUALIFICATION ||
    approval.subjectId !== binding.qualificationId ||
    approval.proposedBy !== binding.proposedBy ||
    approval.subjectAuthorId !== binding.authority.createdBy ||
    approval.status !== 'satisfied' ||
    approval.riskClass !== 'high' ||
    !Number.isSafeInteger(approval.requiredApprovals) ||
    approval.requiredApprovals < 2 ||
    !approval.decidedAt ||
    !Number.isFinite(approval.decidedAt.getTime()) ||
    approval.decidedAt > now ||
    approval.namedApproverIds.length < approval.requiredApprovals ||
    new Set(approval.namedApproverIds).size !== approval.namedApproverIds.length
  )
    return false
  const people = new Set<string>(),
    lines = new Set<string>()
  for (const vote of approval.decisions) {
    if (
      !isPrincipalId(vote.approverUserId) ||
      vote.authorityLineUserId !== vote.approverUserId ||
      vote.delegationId !== null ||
      vote.decision !== 'approved' ||
      !Number.isFinite(vote.decidedAt.getTime()) ||
      vote.decidedAt > now ||
      vote.decidedAt > approval.decidedAt ||
      !approval.namedApproverIds.includes(vote.approverUserId) ||
      approval.adverseUserIds.includes(vote.approverUserId) ||
      [
        approval.proposedBy,
        approval.subjectAuthorId,
        binding.representativeUserId,
        binding.representedMemberUserId,
      ].includes(vote.approverUserId) ||
      people.has(vote.approverUserId) ||
      lines.has(vote.authorityLineUserId)
    )
      return false
    people.add(vote.approverUserId)
    lines.add(vote.authorityLineUserId)
  }
  return lines.size >= approval.requiredApprovals
}

/** Identity, provenance, terms and permissions cannot be edited then restored.
 * Once qualified, only irreversible terminal revocation/expiry may change the
 * authority rows. A new review must use new authority/grant identities.
 */
export const EXTERNAL_QUALIFIED_IMMUTABLE_COLUMNS = {
  representation_authorities: [
    'id',
    'organization_id',
    'matter_type',
    'matter_id',
    'represented_person_id',
    'representative_user_id',
    'representative_organization_id',
    'scope',
    'source',
    'effective_at',
    'expires_at',
    'superseded_by_authority_id',
    'evidence_document_id',
    'created_by',
    'created_at',
    'metadata',
  ],
  external_matter_access_grants: [
    'id',
    'authority_id',
    'organization_id',
    'matter_type',
    'matter_id',
    'user_id',
    'representative_organization_id',
    'can_view',
    'can_comment',
    'can_upload_documents',
    'can_view_documents',
    'can_download_documents',
    'expires_at',
    'granted_by',
    'granted_at',
  ],
  external_document_access_grants: [
    'id',
    'authority_id',
    'matter_grant_id',
    'organization_id',
    'matter_type',
    'matter_id',
    'document_id',
    'user_id',
    'representative_organization_id',
    'can_view',
    'can_download',
    'can_share',
    'document_version_no',
    'expires_at',
    'granted_by',
    'granted_at',
  ],
} as const
export function qualifiedLegacyMutationAllowed(
  table: keyof typeof EXTERNAL_QUALIFIED_IMMUTABLE_COLUMNS,
  oldRow: Readonly<Record<string, unknown>>,
  newRow: Readonly<Record<string, unknown>> | null,
): boolean {
  if (
    !newRow ||
    EXTERNAL_QUALIFIED_IMMUTABLE_COLUMNS[table].some(
      (key) => canonicalPythonJson(oldRow[key]) !== canonicalPythonJson(newRow[key]),
    )
  )
    return false
  if (oldRow.status !== 'active' || oldRow.revoked_at !== null || oldRow.revoked_by !== null)
    return canonicalPythonJson(oldRow) === canonicalPythonJson(newRow)
  if (newRow.status === 'active') return newRow.revoked_at === null && newRow.revoked_by === null
  return (
    ['revoked', 'expired'].includes(String(newRow.status)) &&
    typeof newRow.revoked_by === 'string' &&
    isPrincipalId(newRow.revoked_by) &&
    typeof newRow.revoked_at === 'string' &&
    Number.isFinite(Date.parse(newRow.revoked_at))
  )
}
