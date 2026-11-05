/**
 * What GET /api/clause-library/{id} answers with: one clause of the shared library as the caller may read it. The route builds it here, and the screens that show a clause take their
 * type from here, so a field a screen reads is a field the route sends (scripts/__tests__/response-shape-census.test.ts holds the two together).
 *
 * What a reader other than the owner never gets is left out, not blanked: the explicit-share list and the creator are the owner's, and an anonymized clause hides the employer and its
 * source organization (see source-projection.ts).
 */
import type { InferSelectModel } from 'drizzle-orm';
import type { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';
import type { Wire } from '@/lib/client/wire';
import { clauseSourceProjection } from './source-projection';

/** The columns of a shared clause the answer is made from. */
export type ClauseDetailRow = Pick<
  InferSelectModel<typeof sharedClauseLibrary>,
  | 'id'
  | 'clauseNumber'
  | 'clauseTitle'
  | 'clauseText'
  | 'clauseType'
  | 'sharingLevel'
  | 'sharedWithOrgIds'
  | 'isAnonymized'
  | 'originalEmployerName'
  | 'anonymizedEmployerName'
  | 'sector'
  | 'province'
  | 'effectiveDate'
  | 'expiryDate'
  | 'viewCount'
  | 'comparisonCount'
  | 'version'
  | 'sourceOrganizationId'
  | 'createdBy'
  | 'createdAt'
  | 'updatedAt'
>;

export function formatClause(
  r: ClauseDetailRow,
  callerOrgId: string | null,
  tags: { id: string; tagName: string }[],
  sourceName: string | null,
) {
  const isOwner = callerOrgId ? r.sourceOrganizationId === callerOrgId : false;
  return {
    id: r.id,
    clauseNumber: r.clauseNumber,
    clauseTitle: r.clauseTitle,
    clauseText: r.clauseText,
    clauseType: r.clauseType,
    sharingLevel: r.sharingLevel,
    // owner-internal sharing configuration — never exposed to a non-owner
    // reader, even one authorized to read the clause content itself.
    sharedWithOrgIds: isOwner ? r.sharedWithOrgIds : undefined,
    isAnonymized: r.isAnonymized,
    originalEmployerName: isOwner || r.isAnonymized === false ? r.originalEmployerName : undefined,
    anonymizedEmployerName: r.anonymizedEmployerName,
    sector: r.sector,
    province: r.province,
    effectiveDate: r.effectiveDate,
    expiryDate: r.expiryDate,
    viewCount: r.viewCount,
    comparisonCount: r.comparisonCount,
    version: r.version,
    sourceOrganization: clauseSourceProjection({ ...r, organizationName: sourceName }, callerOrgId ?? ''),
    createdBy: isOwner ? r.createdBy : undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    tags: tags.map((t) => ({ id: t.id, tagName: t.tagName })),
    isOwner,
  };
}

export type ClauseDetail = ReturnType<typeof formatClause>;

/** The clause as a screen receives it: dates are the text a route sends. */
export type ClauseDetailWire = Wire<ClauseDetail>;
