/**
 * Limits on what a non-administrator report may release: a bounded page, and no cell small enough to identify the people in it.
 *
 * A cell (a group of a grouped report, or the single row of an ungrouped aggregate) is released only if at least SMALL_GROUP_MIN rows and at
 * least SMALL_GROUP_MIN distinct people stand behind it. Both counts are measured by the server with columns it adds itself, never taken
 * from anything the caller chose, and are removed before the rows leave. When exactly one cell of a grouped report is withheld, the smallest
 * released cell is withheld with it: a withheld cell next to released ones and a known total would otherwise be a subtraction.
 *
 * This bounds one report. A caller who varies the question can still compare answers; that is bounded separately by the per-shape budget in
 * the route and recorded in the audit trail, and is not claimed to be impossible.
 */
import { getDataSource, type ReportConfig, type SelectedField } from '@/lib/report-executor';
import { PERSON_KEY_FIELD } from './report-field-authority';

export const OFFICER_REPORT_ROW_CAP = 500;
export const SMALL_GROUP_MIN = 5;
export const GROUP_SIZE_ALIAS = 'ue_group_size';
export const GROUP_PEOPLE_ALIAS = 'ue_group_people';

/** Whether the report returns cells (a grouping, or an aggregate over the whole population) rather than a listing of rows. */
export function isCellReport(config: ReportConfig): boolean {
  const grouped = Array.isArray(config.groupBy) && config.groupBy.length > 0;
  return grouped || (Array.isArray(config.fields) && config.fields.some((field) => Boolean(field?.aggregation)));
}

export function withGroupSizeField(config: ReportConfig): ReportConfig {
  if (!isCellReport(config)) return config;
  const source = getDataSource(config.dataSourceId);
  if (!source) return config;
  const person = PERSON_KEY_FIELD[source.table] ?? 'id';
  const measured: SelectedField[] = [
    { fieldId: person, fieldName: 'People', table: source.table, aggregation: 'count_distinct', alias: GROUP_PEOPLE_ALIAS },
    { fieldId: 'id', fieldName: 'Group size', table: source.table, aggregation: 'count_distinct', alias: GROUP_SIZE_ALIAS },
  ];
  return { ...config, fields: [...config.fields, ...measured] };
}

type Measured = Record<string, unknown>;

export function suppressSmallGroups<T extends Measured>(rows: T[]): { rows: Array<Omit<T, 'ue_group_size' | 'ue_group_people'>>; suppressed: number; complementary: number } {
  const strip = (row: T) => {
    const { [GROUP_SIZE_ALIAS]: _size, [GROUP_PEOPLE_ALIAS]: _people, ...rest } = row as Measured;
    return rest as Omit<T, 'ue_group_size' | 'ue_group_people'>;
  };
  const enough = (value: unknown) => Number.isFinite(Number(value)) && Number(value) >= SMALL_GROUP_MIN;

  let suppressed = 0;
  const kept: Array<{ row: T; people: number }> = [];
  for (const row of rows) {
    if (enough(row[GROUP_SIZE_ALIAS]) && enough(row[GROUP_PEOPLE_ALIAS])) kept.push({ row, people: Number(row[GROUP_PEOPLE_ALIAS]) });
    else suppressed += 1;
  }

  let complementary = 0;
  if (suppressed === 1 && kept.length > 0) {
    let smallest = 0;
    kept.forEach((entry, index) => {
      if (entry.people < kept[smallest].people) smallest = index;
    });
    kept.splice(smallest, 1);
    complementary = 1;
  }
  return { rows: kept.map((entry) => strip(entry.row)), suppressed, complementary };
}
