import { getDataSource, DATA_SOURCES, type ReportConfig } from '@/lib/report-executor';

/**
 * SECURITY: the data sources and columns a report may use are those of the executor's registry (the same ones /api/reports/datasources
 * advertises); the executor refuses anything else, so this route keeps no second, different list.
 */
const ALLOWED_AGGREGATIONS = ['count', 'sum', 'avg', 'min', 'max', 'distinct'];
// The executor's own vocabulary. The names this route used to accept (equals, contains, ...) were not the executor's, and the executor skipped
// a filter whose operator it did not know, so such a filter was dropped and every row came back. The earlier names are translated, and
// anything else is refused.
const ALLOWED_OPERATORS = ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike', 'in', 'not_in', 'is_null', 'is_not_null', 'between'];
const LEGACY_OPERATORS: Record<string, string> = { equals: 'eq', not_equals: 'ne', contains: 'ilike', greater_than: 'gt', less_than: 'lt' };
const ALLOWED_SORT_DIRECTIONS = ['asc', 'desc'];

/**
 * SECURITY: Validate report configuration against allowlists
 */
export function validateReportConfig(config: ReportConfig): string | null {
  const source = getDataSource(config.dataSourceId);
  if (!source) {
    return `Invalid data source: ${config.dataSourceId}`;
  }

  const allowedColumns = source.fields.map((field) => field.id);

  // SECURITY: Block custom formulas (P0 protection)
  for (const field of config.fields) {
    if (field && typeof field === 'object' && 'formula' in field) {
      return 'Custom formulas are not supported for security reasons';
    }
  }

  // Validate all field IDs
  for (const field of config.fields) {
    if (!allowedColumns.includes(field.fieldId)) {
      return `Invalid field: ${field.fieldId}`;
    }
    if (field.aggregation && !ALLOWED_AGGREGATIONS.includes(field.aggregation)) {
      return `Invalid aggregation: ${field.aggregation}`;
    }
    if (field.alias && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.alias)) {
      return `Invalid alias format: ${field.alias}`;
    }
  }

  // Validate filters
  if (config.filters) {
    for (const filter of config.filters) {
      if (!allowedColumns.includes(filter.fieldId)) {
        return `Invalid filter field: ${filter.fieldId}`;
      }
      const translated = LEGACY_OPERATORS[filter.operator as string];
      if (translated) (filter as { operator: string }).operator = translated;
      if (!ALLOWED_OPERATORS.includes(filter.operator)) {
        return `Invalid operator: ${filter.operator}`;
      }
      const needsList = filter.operator === 'in' || filter.operator === 'not_in';
      const values = (filter as { values?: unknown }).values;
      if ((needsList || filter.operator === 'between') && (!Array.isArray(values) || values.length === 0 || (filter.operator === 'between' && values.length !== 2) || values.length > 100)) {
        return `Operator ${filter.operator} needs ${filter.operator === 'between' ? 'exactly two' : 'a bounded list of'} values`;
      }
    }
  }

  // Validate groupBy
  if (config.groupBy) {
    for (const field of config.groupBy) {
      if (!allowedColumns.includes(field)) {
        return `Invalid group by field: ${field}`;
      }
    }
  }

  // Validate sortBy
  if (config.sortBy) {
    for (const sort of config.sortBy) {
      if (!allowedColumns.includes(sort.fieldId)) {
        return `Invalid sort field: ${sort.fieldId}`;
      }
      if (!ALLOWED_SORT_DIRECTIONS.includes(sort.direction)) {
        return `Invalid sort direction: ${sort.direction}`;
      }
    }
  }

  return null;
}

export const MAX_STORED_CONFIG_BYTES = 32 * 1024;
const MAX_FIELDS = 100;
const MAX_LIST = 100;
const MAX_DEPTH = 6;

function depthOf(value: unknown, depth = 0): number {
  if (value === null || typeof value !== 'object') return depth;
  if (depth > MAX_DEPTH) return depth;
  let deepest = depth + 1;
  for (const child of Object.values(value as Record<string, unknown>)) deepest = Math.max(deepest, depthOf(child, depth + 1));
  return deepest;
}

/**
 * Save-time check of a stored report definition: the same contract the executor applies at run time, so a definition that names an
 * unknown source, field, operator or join is refused when it is written rather than stored as a success and failing later. Returns
 * the reason, or null when the definition is acceptable. The config is stored as an object of bounded size and depth.
 */
export function validateStoredReportConfig(config: unknown): string | null {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) return 'config must be an object';
  const serialized = JSON.stringify(config);
  if (serialized.length > MAX_STORED_CONFIG_BYTES) return 'config is too large';
  if (depthOf(config) > MAX_DEPTH) return 'config is nested too deeply';

  const candidate = config as Record<string, unknown>;
  if (typeof candidate.dataSourceId !== 'string' || !Array.isArray(candidate.fields) || candidate.fields.length === 0) {
    return 'config needs a dataSourceId and at least one field';
  }
  if (candidate.fields.length > MAX_FIELDS) return 'config selects too many fields';
  for (const key of ['filters', 'having', 'groupBy', 'sortBy', 'joins'] as const) {
    const value = candidate[key];
    if (value !== undefined && (!Array.isArray(value) || value.length > MAX_LIST)) return `${key} must be a bounded list`;
  }
  for (const field of candidate.fields) {
    if (field === null || typeof field !== 'object' || typeof (field as { fieldId?: unknown }).fieldId !== 'string') return 'every field needs a fieldId';
  }
  for (const filter of [...((candidate.filters as unknown[]) ?? []), ...((candidate.sortBy as unknown[]) ?? [])]) {
    if (filter === null || typeof filter !== 'object' || typeof (filter as { fieldId?: unknown }).fieldId !== 'string') return 'every filter and sort rule needs a fieldId';
  }
  for (const reference of (candidate.groupBy as unknown[]) ?? []) {
    if (typeof reference !== 'string') return 'groupBy must list field ids';
  }
  // A join is stored only to a table of the reporting registry.
  const registryTables = new Set(DATA_SOURCES.map((source) => source.table));
  for (const join of (candidate.joins as Array<{ table?: unknown }>) ?? []) {
    if (join === null || typeof join !== 'object' || typeof join.table !== 'string' || !registryTables.has(join.table)) {
      return 'a join must name a table of the reporting registry';
    }
  }
  return validateReportConfig(candidate as unknown as ReportConfig);
}
