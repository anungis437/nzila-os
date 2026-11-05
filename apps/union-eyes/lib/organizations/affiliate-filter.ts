/**
 * Which of an organization's affiliates a filter keeps, for the federation affiliates page. Pure, so the page filters by the address
 * (?q=&type=&status=) and the rule is tested without a database.
 */
import type { AffiliateRow } from './affiliates';

export interface AffiliateFilter {
  q: string;
  type: string;
  status: string;
}

/** The text is looked for in the name, CLC code and e-mail (any case); type and status must match exactly. An empty field filters nothing. */
export function filterAffiliates(rows: readonly AffiliateRow[], filter: AffiliateFilter): AffiliateRow[] {
  const text = filter.q.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (text === '' || [row.name, row.clcAffiliateCode, row.email].some((value) => value?.toLowerCase().includes(text))) &&
      (filter.type === '' || row.organizationType === filter.type) &&
      (filter.status === '' || row.status === filter.status),
  );
}
