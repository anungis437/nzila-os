/**
 * A decision as the precedents console lists, views and compares it.
 *
 * The list is GET /api/precedents, the route that filters. It answers { precedents, total, page, limit } as it is, with no envelope, and
 * lists public decisions only, through an explicit public projection (lib/precedents/public-decision-view.ts: no grievor, remedy, full
 * text, embedding or provenance). The item is GET /api/arbitration/precedents/:id, which answers with the same projection plus the
 * decision's reasoning, facts and dates, wrapped twice: the crud factory returns { data }, and withApi wraps that again as
 * { success, data: { data } } (see lib/client/api-envelope.ts). A response that is not one of those shapes is an error, never an empty
 * list or a blank record.
 *
 * The record carries the stored columns under their own names, and only the ones the screens show: it is picked field by field, so a
 * column a route should not serve (the grievor, the remedy) cannot reach a screen even if a route started to serve it.
 *
 * view_count and citation_count are the exception to "as stored": they default to 0 and nothing in the application or the backend
 * increments them for a decision, so a stored zero records no measurement. It is left out (see recordedCount) instead of being shown as
 * "0 views, 0 citations"; a positive count, which can only have been supplied with the decision, is kept.
 */
import { ApiShapeError, envelopeRow, isRecord } from '@/lib/client/api-envelope';

export interface LegalCitation {
  citation: string;
  type?: string;
  relevance?: string;
}

export interface PrecedentRecord {
  id: string;
  caseNumber?: string;
  caseTitle?: string;
  tribunal?: string;
  decisionType?: string;
  decisionDate?: string;
  filingDate?: string;
  hearingDate?: string;
  arbitrator?: string;
  union?: string;
  employer?: string;
  outcome?: string;
  precedentValue?: string;
  issueTypes?: string[];
  /** The key findings, one statement to a line. */
  keyFindings?: string;
  legalCitations?: LegalCitation[];
  summary?: string;
  headnote?: string;
  precedentSummary?: string;
  reasoning?: string;
  keyFacts?: string;
  sector?: string;
  jurisdiction?: string;
  language?: string;
  viewCount?: number;
  citationCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);
const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : undefined;

/** A view or citation count that records something: a positive number. A zero (the column default) or a missing value is "not recorded". */
export const recordedCount = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

function legalCitations(value: unknown): LegalCitation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const citations = value.flatMap((item): LegalCitation[] => {
    if (!isRecord(item)) return [];
    const citation = text(item.citation);
    return citation ? [{ citation, type: text(item.type), relevance: text(item.relevance) }] : [];
  });
  return citations.length > 0 ? citations : undefined;
}

export function toPrecedentRecord(row: Record<string, unknown>): PrecedentRecord {
  const id = text(row.id);
  if (!id) throw new ApiShapeError('a precedent without an id');
  const issueTypes = strings(row.issueTypes);
  const findings = strings(row.keyFindings);
  return {
    id,
    caseNumber: text(row.caseNumber),
    caseTitle: text(row.caseTitle),
    tribunal: text(row.tribunal),
    decisionType: text(row.decisionType),
    decisionDate: text(row.decisionDate),
    filingDate: text(row.filingDate),
    hearingDate: text(row.hearingDate),
    arbitrator: text(row.arbitrator),
    union: text(row.union),
    employer: text(row.employer),
    outcome: text(row.outcome),
    precedentValue: text(row.precedentValue),
    issueTypes: issueTypes && issueTypes.length > 0 ? issueTypes : undefined,
    keyFindings: findings && findings.length > 0 ? findings.join('\n') : undefined,
    legalCitations: legalCitations(row.legalCitations),
    summary: text(row.summary),
    headnote: text(row.headnote),
    precedentSummary: text(row.precedentSummary),
    reasoning: text(row.reasoning),
    keyFacts: text(row.keyFacts),
    sector: text(row.sector),
    jurisdiction: text(row.jurisdiction),
    language: text(row.language),
    viewCount: recordedCount(row.viewCount),
    citationCount: recordedCount(row.citationCount),
    createdAt: text(row.createdAt),
    updatedAt: text(row.updatedAt),
  };
}

/** The decision an item route answered with. */
export function readPrecedent(body: unknown): PrecedentRecord {
  return toPrecedentRecord(envelopeRow(body));
}

/** The decisions GET /api/precedents answered with, and how many pages there are. */
export function readPrecedentList(body: unknown): { precedents: PrecedentRecord[]; totalPages: number } {
  if (!isRecord(body) || !Array.isArray(body.precedents)) throw new ApiShapeError('no list');
  const { total, limit } = body;
  if (typeof total !== 'number' || typeof limit !== 'number' || limit <= 0) throw new ApiShapeError('no pagination');
  const precedents = body.precedents.map((row: unknown) => {
    if (!isRecord(row)) throw new ApiShapeError('a precedent that is not a record');
    return toPrecedentRecord(row);
  });
  return { precedents, totalPages: Math.ceil(total / limit) };
}
