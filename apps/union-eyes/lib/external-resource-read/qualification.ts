/** An exact review payload is evidence input, never authority by itself. The
 * database constructor additionally requires real member consent and the
 * current primary case-handler disclosure source on its own transaction. */
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { canonicalPythonJson } from '../audit/canonical-audit-chain'
import { isPrincipalId } from '../authority/store/executor'

export const EXTERNAL_READ_QUALIFICATION = 'external_read_qualification_v1'
/** These strings confer nothing until an institution adopts an exact power in
 * an executive-office issuance rule and issues/accepts a finite case mandate.
 * The suffix is the DISCLOSURE action's approved risk/quorum, not the separate
 * number of votes required to issue that office. Default templates are unchanged. */
export const EXTERNAL_READ_AUTHORIZATION = 'external_read_authorization_v1'
export const EXTERNAL_READ_POWER = 'external_read.authorize'
const uuid = z.string().uuid(), principal = z.string().refine(isPrincipalId), digest = z.string().regex(/^[a-f0-9]{64}$/)
const instant = z.string().datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value)))
const citation = z.string().min(1).max(2000).refine(value => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value))
const permissions = z.object({ view: z.boolean(), viewDocuments: z.boolean(), downloadDocuments: z.boolean() }).strict()
const schema = z.object({
  operation: z.literal(EXTERNAL_READ_QUALIFICATION), qualificationId: uuid, institutionalApprovalId: uuid, organizationId: uuid,
  representativeUserId: principal, representativeOrganizationId: uuid, representedMemberUserId: principal, issuerUserId: principal,
  authority: z.object({ id: uuid, representedPersonId: uuid, createdBy: principal, source: citation,
    scope: z.array(citation).min(1), evidenceDocumentId: uuid.nullable(), effectiveAt: instant, expiresAt: instant }).strict(),
  matter: z.object({ type: z.literal('grievance'), id: uuid, grantId: uuid, grantedBy: principal, grantedAt: instant,
    expiresAt: instant, permissions }).strict(),
  document: z.object({ id: uuid, grantId: uuid, grantedBy: principal, grantedAt: instant, expiresAt: instant,
    canView: z.boolean(), canDownload: z.boolean(), versionId: uuid, versionNo: z.number().int().min(1),
    checksumSha256: digest, sizeBytes: z.number().int().min(0).max(50 * 1024 * 1024), storageKeySha256: digest,
    privacyLabel: citation }).strict().nullable(),
  sourceInstrument: z.object({ reference: citation, sha256: digest }).strict(), effectiveAt: instant, expiresAt: instant,
}).strict().superRefine((p, c) => {
  const effective = Date.parse(p.effectiveAt), expires = Date.parse(p.expiresAt)
  if (effective >= expires || p.organizationId === p.representativeOrganizationId
    || p.representativeUserId === p.representedMemberUserId)
    c.addIssue({ code: 'custom', message: 'Distinct external recipient and finite ordered term required' })
  if (p.issuerUserId === p.representativeUserId || p.authority.createdBy === p.representativeUserId
    || p.matter.grantedBy === p.representativeUserId || p.document?.grantedBy === p.representativeUserId)
    c.addIssue({ code: 'custom', message: 'An external recipient cannot issue their own institutional grant' })
  if (new Set(p.authority.scope).size !== p.authority.scope.length)
    c.addIssue({ code: 'custom', message: 'Ambiguous authority scope' })
  for (const end of [p.authority.expiresAt, p.matter.expiresAt, p.document?.expiresAt])
    if (end && Date.parse(end) < expires) c.addIssue({ code: 'custom', message: 'Qualification exceeds source term' })
  for (const start of [p.authority.effectiveAt, p.matter.grantedAt, p.document?.grantedAt])
    if (start && Date.parse(start) > effective) c.addIssue({ code: 'custom', message: 'Qualification predates source' })
  if (!p.document && (p.matter.permissions.viewDocuments || p.matter.permissions.downloadDocuments))
    c.addIssue({ code: 'custom', message: 'Document rights require an exact reviewed artifact' })
  if (p.document && (p.document.canDownload && !p.matter.permissions.downloadDocuments
    || p.document.canView && !p.matter.permissions.viewDocuments))
    c.addIssue({ code: 'custom', message: 'Document rights exceed matter grant' })
})
export type ExternalReadQualification = z.infer<typeof schema>
export function parseExternalReadQualification(value: unknown): ExternalReadQualification { return schema.parse(value) }
export function externalReadQualificationHash(value: unknown): string {
  return createHash('sha256').update(canonicalPythonJson(schema.parse(value)), 'utf8').digest('hex')
}
