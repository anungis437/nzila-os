import { arbitrationPrecedents } from '@/db/schema/arbitration-precedents-schema';

export type PrecedentRow = typeof arbitrationPrecedents.$inferSelect;

/**
 * What an organization other than the owner sees of a shared precedent.
 *
 * Reading a precedent never implies seeing the owner's working material: the stored (unredacted) document location,
 * the explicit grant list and the author stay with the owner, and parties named in an anonymized precedent are not
 * disclosed to readers.
 */
export function toReaderView(row: PrecedentRow, callerOrganizationId: string) {
  if (row.sourceOrganizationId === callerOrganizationId) return { ...row, isOwner: true as const };

  const {
    sharedWithOrgIds: _grants,
    createdBy: _author,
    documentUrl: _documentUrl,
    documentPath: _documentPath,
    unionName,
    employerName,
    ...rest
  } = row;
  const anonymized = Boolean(row.isPartiesAnonymized);
  return {
    ...rest,
    unionName: anonymized ? null : unionName,
    employerName: anonymized ? null : employerName,
    // Only the redacted copy is offered when one exists; otherwise no document location is given to a reader.
    redactedDocumentUrl: row.hasRedactedVersion ? row.redactedDocumentUrl : null,
    redactedDocumentPath: row.hasRedactedVersion ? row.redactedDocumentPath : null,
    isOwner: false as const,
  };
}

/** Fields the owning organization may change. Ownership, identity, counters and audit columns are never writable. */
export const PRECEDENT_EDITABLE_FIELDS = [
  'caseNumber',
  'caseTitle',
  'decisionDate',
  'isPartiesAnonymized',
  'unionName',
  'employerName',
  'arbitratorName',
  'jurisdiction',
  'grievanceType',
  'issueSummary',
  'unionPosition',
  'employerPosition',
  'outcome',
  'decisionSummary',
  'reasoning',
  'precedentialValue',
  'keyPrinciples',
  'relatedLegislation',
  'sector',
  'province',
  'sharingLevel',
  'sharedWithOrgIds',
] as const;
