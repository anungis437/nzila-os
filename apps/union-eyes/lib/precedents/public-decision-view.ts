/**
 * Explicit public arbitration-decision projection for list, search and ranking endpoints.
 *
 * A public decision may be discoverable without disclosing every stored column. The
 * shared database includes a grievor, monetary remedy, internal CBA references,
 * embedding, import provenance, unrestricted full text and access-control metadata.
 * Adding a database column must never automatically add it to an API response.
 * The service must ALSO filter isPublic and accessRestrictions in SQL.
 *
 * Every column of arbitration_decisions is classified exactly once below, and a test holds the classification
 * to the table: a column added without a decision here fails it instead of being served by default. The generic
 * CRUD routes (/api/arbitration/precedents and /:id) take their `omitFromResponse` from the same lists, so they
 * serve what /api/precedents serves and nothing more.
 */
import type { ArbitrationDecision } from '@/lib/services/precedent-service';

/** The columns the list projection (toPublicPrecedentSummary) serves. */
export const PUBLIC_SUMMARY_COLUMNS = [
  'id',
  'caseNumber',
  'caseTitle',
  'tribunal',
  'decisionType',
  'decisionDate',
  'arbitrator',
  'union',
  'employer',
  'outcome',
  'precedentValue',
  'keyFindings',
  'issueTypes',
  'legalCitations',
  'summary',
  'headnote',
  'precedentSummary',
  'sector',
  'jurisdiction',
  'language',
  'citationCount',
  'viewCount',
  'createdAt',
] as const;

/** Added when one decision is read (the item route), not in a list: its reasoning and facts, its filing and hearing dates, when it was last changed. */
export const PUBLIC_DETAIL_COLUMNS = ['reasoning', 'keyFacts', 'filingDate', 'hearingDate', 'updatedAt'] as const;

/**
 * Never served by a generic read: the grievor, the monetary remedy, the panel, references to other and internal records, the full text, the
 * embedding, import provenance, the supplying organization and the access-control metadata (is_public and access_restrictions decide whether a
 * decision is served at all, in SQL, so a served decision needs neither).
 */
export const WITHHELD_DECISION_COLUMNS = [
  'grievor',
  'remedy',
  'panelMembers',
  'relatedDecisions',
  'cbaReferences',
  'fullText',
  'embedding',
  'importedFrom',
  'sourceOrganizationId',
  'isPublic',
  'accessRestrictions',
] as const;

export function toPublicPrecedentSummary(row: ArbitrationDecision) {
  return {
    id: row.id,
    caseNumber: row.caseNumber,
    caseTitle: row.caseTitle,
    tribunal: row.tribunal,
    decisionType: row.decisionType,
    decisionDate: row.decisionDate,
    arbitrator: row.arbitrator,
    union: row.union,
    employer: row.employer,
    outcome: row.outcome,
    precedentValue: row.precedentValue,
    keyFindings: row.keyFindings,
    issueTypes: row.issueTypes,
    legalCitations: row.legalCitations,
    summary: row.summary,
    headnote: row.headnote,
    precedentSummary: row.precedentSummary,
    sector: row.sector,
    jurisdiction: row.jurisdiction,
    language: row.language,
    citationCount: row.citationCount,
    viewCount: row.viewCount,
    createdAt: row.createdAt,
  };
}
