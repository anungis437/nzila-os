/**
 * Field-level disclosure authority for ad-hoc reports.
 *
 * The officer role title opens aggregate reporting, not every column of the reporting model. Each (table, column) of the registry carries
 * an information class, and what a caller may do with a column depends on that class and on the authority behind the request, the same
 * way the authority kernel decides a document read from its information class (lib/authority/document-class.ts).
 *
 *   identifier        names a person or a matter (member id, name, e-mail, claim number, assignee). Only an administrator may select,
 *                     group by, filter on, sort by or reference it other than as a plain count: a filter on an identifier is a search
 *                     oracle, and min/max/sum of one releases it.
 *   financial         dues amounts, frequency and dates.
 *   matter            claim and deadline status, type, outcome and dates.
 *   member_attribute  role and hire date.
 *   operational       counts and dates of the organization's own records that identify nobody.
 *
 * Non-identifier classes may appear as an aggregate or as a grouping dimension whose cells are large enough to be anonymous. Listing them
 * row by row is a disclosure of member or matter data and needs an administrator; only `operational` columns may be listed by an officer.
 *
 * PROVISIONAL: which offices may reproduce which classes is an INSTITUTIONAL decision. This mapping is deliberately conservative and
 * carries `approvedBy: null`; an unknown column is an identifier. The server never activates a looser policy on its own authority.
 */
import { createHash } from 'node:crypto';
import { getDataSource, type ReportConfig } from '@/lib/report-executor';

export type ReportFieldClass = 'identifier' | 'financial' | 'matter' | 'member_attribute' | 'operational';

export const REPORT_FIELD_POLICY = { version: 'ue-report-field-class/provisional-1', approvedBy: null as string | null } as const;

const SEVERITY: Record<ReportFieldClass, number> = { operational: 0, member_attribute: 1, matter: 2, financial: 3, identifier: 4 };

const FIELD_CLASS: Record<string, Record<string, ReportFieldClass>> = {
  organization_members: {
    id: 'identifier', name: 'identifier', email: 'identifier',
    hire_date: 'member_attribute', role: 'member_attribute', status: 'operational', created_at: 'operational',
  },
  claims: {
    id: 'identifier', claim_number: 'identifier', member_id: 'identifier', assigned_to: 'identifier',
    status: 'matter', priority: 'matter', claim_type: 'matter', created_at: 'matter', resolved_at: 'matter', resolution_outcome: 'matter',
  },
  claim_deadlines: {
    id: 'identifier', claim_id: 'identifier',
    deadline_type: 'matter', due_date: 'matter', status: 'matter', priority: 'matter', completed_at: 'matter',
  },
  dues_assignments: {
    id: 'identifier', member_id: 'identifier',
    amount: 'financial', frequency: 'financial', status: 'financial', effective_date: 'financial', end_date: 'financial',
  },
};

/** The column that identifies the person a row of a source is about; a cell is anonymous only if enough distinct people stand behind it. */
export const PERSON_KEY_FIELD: Record<string, string> = {
  organization_members: 'id',
  claims: 'member_id',
  claim_deadlines: 'claim_id',
  dues_assignments: 'member_id',
};

export interface ColumnRef {
  table: string;
  column: string;
  class: ReportFieldClass;
}

function classOf(table: string, column: string): ReportFieldClass {
  return FIELD_CLASS[table]?.[column] ?? 'identifier';
}

/**
 * What a reference can mean once it reaches SQL. The executor reads a filter's `fieldName` before its `fieldId` and treats group and sort
 * references as column names, while the route validates field ids, so a reference is judged as every column it could resolve to: its own
 * name, the column of a base-source field of that id, and, when it carries no table, each table of the query that has such a column. An
 * unknown reference is an identifier.
 */
function resolveRef(ref: string, baseTable: string, baseFields: Array<{ id: string; column: string }>, queryTables: string[]): ColumnRef[] {
  const parts = ref.split('.');
  if (parts.length === 2) return [{ table: parts[0], column: parts[1], class: classOf(parts[0], parts[1]) }];
  if (parts.length !== 1) return [{ table: baseTable, column: ref, class: 'identifier' }];
  const columns = new Set<string>([ref]);
  const mapped = baseFields.find((field) => field.id === ref)?.column;
  if (mapped) columns.add(mapped);
  const out: ColumnRef[] = [];
  for (const column of columns) {
    const tables = queryTables.filter((table) => FIELD_CLASS[table] && column in FIELD_CLASS[table]);
    if (tables.length === 0) out.push({ table: baseTable, column, class: 'identifier' });
    for (const table of tables) out.push({ table, column, class: classOf(table, column) });
  }
  return out;
}

export interface ReportDisclosure {
  /** Table.column of everything the configuration touches, by role of use. */
  selected: string[];
  filtered: string[];
  grouped: string[];
  sorted: string[];
  /** Classes of the columns the result carries. */
  classesReturned: ReportFieldClass[];
  /** What an officer may not do with this configuration; empty when the request is within officer authority. */
  restricted: string[];
  aggregated: boolean;
  /** Stable shape of the question asked, without values: the source, what it is grouped and filtered by. */
  shape: string;
}

const COUNTING = new Set(['count', 'count_distinct']);

export function assessReportDisclosure(config: ReportConfig): ReportDisclosure {
  const source = getDataSource(config.dataSourceId);
  const baseTable = source?.table ?? config.dataSourceId;
  const baseFields = source?.fields.map((field) => ({ id: field.id, column: field.column })) ?? [];
  const joins = Array.isArray(config.joins) ? config.joins : [];
  const queryTables = [baseTable, ...joins.map((join) => join?.table).filter((table): table is string => typeof table === 'string')];
  const fields = Array.isArray(config.fields) ? config.fields.filter(Boolean) : [];
  const grouped = Array.isArray(config.groupBy) && config.groupBy.length > 0;
  const aggregated = fields.some((field) => Boolean(field.aggregation));

  const restricted = new Set<string>();
  const label = (ref: ColumnRef) => `${ref.table}.${ref.column}`;
  const returned: ReportFieldClass[] = [];
  const selected: string[] = [];

  for (const field of fields) {
    const table = field.table ?? baseTable;
    const column = baseFields.find((candidate) => candidate.id === field.fieldId)?.column ?? field.fieldId;
    const ref: ColumnRef = { table, column, class: classOf(table, column) };
    selected.push(label(ref));
    if (field.aggregation) {
      if (!COUNTING.has(field.aggregation) && ref.class === 'identifier') restricted.add(`${label(ref)} (${field.aggregation})`);
      else if (!COUNTING.has(field.aggregation)) returned.push(ref.class);
      continue;
    }
    returned.push(ref.class);
    if (ref.class === 'identifier') restricted.add(label(ref));
    // Without grouping or aggregation a plain field lists rows; only a column that identifies nobody may be listed.
    else if (!grouped && !aggregated && ref.class !== 'operational') restricted.add(`${label(ref)} (row listing)`);
  }

  const refsOf = (refs: string[]): { names: string[]; resolved: ColumnRef[] } => {
    const resolved = refs.flatMap((ref) => resolveRef(ref, baseTable, baseFields, queryTables));
    return { names: [...new Set(resolved.map(label))], resolved };
  };
  const flag = (resolved: ColumnRef[]) => {
    for (const ref of resolved) if (ref.class === 'identifier') restricted.add(label(ref));
  };

  const filterRefs = [...(config.filters ?? []), ...(config.having ?? [])].flatMap((filter) =>
    filter ? [filter.fieldId, ...(filter.fieldName && filter.fieldName !== filter.fieldId ? [filter.fieldName] : [])] : [],
  );
  const filtered = refsOf(filterRefs);
  const groupedBy = refsOf(Array.isArray(config.groupBy) ? config.groupBy : []);
  const sorted = refsOf((config.sortBy ?? []).map((rule) => rule?.fieldId).filter((id): id is string => typeof id === 'string'));
  flag(filtered.resolved);
  flag(groupedBy.resolved);
  flag(sorted.resolved);

  const shape = createHash('sha256')
    .update(
      JSON.stringify([
        config.dataSourceId,
        [...groupedBy.names].sort(),
        [...new Set((config.filters ?? []).map((filter) => `${filter?.fieldName || filter?.fieldId}:${filter?.operator}`))].sort(),
        queryTables.slice(1).sort(),
      ]),
    )
    .digest('hex')
    .slice(0, 16);

  return {
    selected,
    filtered: filtered.names,
    grouped: groupedBy.names,
    sorted: sorted.names,
    classesReturned: [...new Set(returned)].sort((a, b) => SEVERITY[a] - SEVERITY[b]),
    restricted: [...restricted],
    aggregated,
    shape,
  };
}
