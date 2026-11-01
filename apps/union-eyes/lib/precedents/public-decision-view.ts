/**
 * Explicit public arbitration-decision projection for list, search and ranking endpoints.
 *
 * A public decision may be discoverable without disclosing every stored column. The
 * shared database includes a grievor, monetary remedy, internal CBA references,
 * embedding, import provenance, unrestricted full text and access-control metadata.
 * Adding a database column must never automatically add it to an API response.
 * The service must ALSO filter isPublic and accessRestrictions in SQL.
 */
import type { ArbitrationDecision } from '@/lib/services/precedent-service';

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
