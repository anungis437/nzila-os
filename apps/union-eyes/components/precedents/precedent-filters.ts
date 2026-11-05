/**
 * The filters the precedents list can honour, the query string they become, and the labels and colors of the database's own enumerations.
 *
 * GET /api/precedents is the list route that filters. The generic list under /api/arbitration/precedents ignores every parameter but page
 * and limit, so a filter sent to it changes nothing. The route takes a text search over title, case number and summaries; outcome and
 * precedent value, each a comma-separated list of the column's own enum members; one jurisdiction; a sector and an arbitrator (matched as
 * "contains"); and a decision-date range. It cannot filter by grievance type, by sharing level (it lists public decisions only) or by
 * several jurisdictions, so none of those is offered.
 *
 * The words for each member live in the message catalogs (the `precedents` namespace: outcomes, values, jurisdictions, tribunals,
 * decisionTypes, languages, citationTypes), in both languages. A label helper is given the namespace's translator; a value the
 * enumeration does not have is shown as stored rather than hidden or guessed.
 */
import type { decisionTypeEnum, outcomeEnum, precedentValueEnum, tribunalTypeEnum } from '@/db/schema';

export type DecisionOutcome = (typeof outcomeEnum.enumValues)[number];
export type PrecedentValue = (typeof precedentValueEnum.enumValues)[number];
export type Tribunal = (typeof tribunalTypeEnum.enumValues)[number];
export type DecisionType = (typeof decisionTypeEnum.enumValues)[number];

/** The translator of the `precedents` namespace, as the label helpers use it. */
export type Translate = (key: string) => string;

export interface PrecedentFilters {
  query: string;
  outcomes: string[];
  precedentValues: string[];
  /** One jurisdiction code, or '' for any. */
  jurisdiction: string;
  sector: string;
  arbitrator: string;
  /** YYYY-MM-DD, or ''. */
  fromDate: string;
  toDate: string;
}

export const NO_FILTERS: PrecedentFilters = {
  query: '',
  outcomes: [],
  precedentValues: [],
  jurisdiction: '',
  sector: '',
  arbitrator: '',
  fromDate: '',
  toDate: '',
};

// Keyed by the enums, so a member added to the database cannot be left out here at compile time.
export const OUTCOME_COLORS: Record<DecisionOutcome, string> = {
  grievance_upheld: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  grievance_denied: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  partial_success: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  dismissed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  withdrawn: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  settled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

export const PRECEDENT_VALUE_COLORS: Record<PrecedentValue, string> = {
  high: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const TRIBUNAL_MEMBERS: Record<Tribunal, true> = {
  fpslreb: true,
  provincial_labour_board: true,
  private_arbitrator: true,
  court_federal: true,
  court_provincial: true,
  other: true,
};

const DECISION_TYPE_MEMBERS: Record<DecisionType, true> = {
  grievance: true,
  unfair_practice: true,
  certification: true,
  judicial_review: true,
  interpretation: true,
  scope_bargaining: true,
  other: true,
};

// Not enumerations of the database: decision.language is a short code, and a legal citation's type is free text that the data documents as
// one of these three.
const LANGUAGE_MEMBERS = { en: true, fr: true };
const CITATION_TYPE_MEMBERS = { statute: true, regulation: true, case_law: true };

export const OUTCOMES = Object.keys(OUTCOME_COLORS) as DecisionOutcome[];
export const PRECEDENT_VALUES = Object.keys(PRECEDENT_VALUE_COLORS) as PrecedentValue[];
export const TRIBUNALS = Object.keys(TRIBUNAL_MEMBERS) as Tribunal[];
export const DECISION_TYPES = Object.keys(DECISION_TYPE_MEMBERS) as DecisionType[];
export const LANGUAGES = Object.keys(LANGUAGE_MEMBERS);
export const CITATION_TYPES = Object.keys(CITATION_TYPE_MEMBERS);

/** The jurisdictions a decision can be filtered by: federal and the provinces and territories, by the codes the data stores. */
export const JURISDICTION_CODES: readonly string[] = [
  'federal',
  'ON',
  'QC',
  'BC',
  'AB',
  'MB',
  'SK',
  'NS',
  'NB',
  'PE',
  'NL',
  'YT',
  'NT',
  'NU',
];

const isMember = (members: object, value: string): boolean => Object.prototype.hasOwnProperty.call(members, value);

const memberLabel = (group: string, members: object, value: string, t: Translate): string =>
  isMember(members, value) ? t(`${group}.${value}`) : value;

export const outcomeLabel = (value: string, t: Translate): string => memberLabel('outcomes', OUTCOME_COLORS, value, t);

export const precedentValueLabel = (value: string, t: Translate): string => memberLabel('values', PRECEDENT_VALUE_COLORS, value, t);

export const tribunalLabel = (value: string, t: Translate): string => memberLabel('tribunals', TRIBUNAL_MEMBERS, value, t);

export const decisionTypeLabel = (value: string, t: Translate): string => memberLabel('decisionTypes', DECISION_TYPE_MEMBERS, value, t);

export const languageLabel = (value: string, t: Translate): string => memberLabel('languages', LANGUAGE_MEMBERS, value, t);

export const citationTypeLabel = (value: string, t: Translate): string => memberLabel('citationTypes', CITATION_TYPE_MEMBERS, value, t);

export const jurisdictionLabel = (value: string, t: Translate): string =>
  JURISDICTION_CODES.includes(value) ? t(`jurisdictions.${value}`) : value;

/** A stored issue type, which the data documents as snake_case tokens such as "just_cause", written as words; free text stays as it is. */
export const issueTypeLabel = (value: string): string =>
  value
    .split('_')
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** The badge colors of a stored outcome or precedent value; none for a value the maps do not know. */
export const outcomeColor = (value: string): string => (isMember(OUTCOME_COLORS, value) ? OUTCOME_COLORS[value as DecisionOutcome] : '');

export const precedentValueColor = (value: string): string =>
  isMember(PRECEDENT_VALUE_COLORS, value) ? PRECEDENT_VALUE_COLORS[value as PrecedentValue] : '';

/** How many of the filters are set, for the badge on the filters button. */
export function activeFilterCount(filters: PrecedentFilters): number {
  return (
    filters.outcomes.length +
    filters.precedentValues.length +
    [filters.query, filters.jurisdiction, filters.sector, filters.arbitrator, filters.fromDate, filters.toDate].filter((value) => value.trim() !== '').length
  );
}

/** The query string for GET /api/precedents. An unset filter is left out; a text filter is trimmed. */
export function listParams(filters: PrecedentFilters, page: number, limit: number): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const set = (name: string, value: string) => {
    if (value !== '') params.set(name, value);
  };
  set('searchQuery', filters.query.trim());
  set('outcome', filters.outcomes.join(','));
  set('precedentValue', filters.precedentValues.join(','));
  set('jurisdiction', filters.jurisdiction);
  set('sector', filters.sector.trim());
  set('arbitrator', filters.arbitrator.trim());
  set('dateFrom', filters.fromDate);
  // The end date is a day, so the decisions of that day are included.
  set('dateTo', filters.toDate === '' ? '' : `${filters.toDate}T23:59:59.999Z`);
  return params;
}
