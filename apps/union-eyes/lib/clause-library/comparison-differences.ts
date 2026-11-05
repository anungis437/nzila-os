/**
 * What differs between the clauses of a comparison.
 *
 * For each attribute of a clause (its type, sector, province, sharing level) the distinct values the compared clauses take, sorted; a screen shows an attribute
 * as a difference when it takes more than one. The dates are the span the clauses cover: from the earliest effective date to the latest expiry date. Nothing
 * is judged here and nothing is invented: an attribute no clause has is an empty list, and clauses without dates have no date range.
 */
export interface ComparedClause {
  clauseType: string
  sector: string | null
  province: string | null
  /** A calendar date as the database holds it (`YYYY-MM-DD`), which sorts as it reads. */
  effectiveDate: string | null
  expiryDate: string | null
  sharingLevel: string
}

export interface ClauseDifferences {
  clauseTypes: string[]
  sectors: string[]
  provinces: string[]
  /** `YYYY-MM-DD – YYYY-MM-DD`; `from …` or `until …` when only one end is known; empty when no clause has a date. */
  dateRanges: string
  sharingLevels: string[]
}

const distinct = (values: ReadonlyArray<string | null | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b))

export function clauseDifferences(clauses: ReadonlyArray<ComparedClause>): ClauseDifferences {
  const from = distinct(clauses.map((clause) => clause.effectiveDate))[0]
  const expiries = distinct(clauses.map((clause) => clause.expiryDate))
  const until = expiries[expiries.length - 1]
  return {
    clauseTypes: distinct(clauses.map((clause) => clause.clauseType)),
    sectors: distinct(clauses.map((clause) => clause.sector)),
    provinces: distinct(clauses.map((clause) => clause.province)),
    dateRanges: from && until ? `${from} – ${until}` : from ? `from ${from}` : until ? `until ${until}` : '',
    sharingLevels: distinct(clauses.map((clause) => clause.sharingLevel)),
  }
}
