/**
 * What the platform data-source dashboard reads: record counts of the internal and external data sources and the recent sync history.
 *
 * This is a platform view: the counts are over every organization (claims, members, deadlines and dues assignments of all of them), so it is read as
 * the system role, and only after the page has checked platform authority (isSystemAdmin). Nothing here is swallowed: a table the system role may not
 * read, or one that does not exist, rejects and the caller shows the error state; the page used to turn each such failure into a zero and an empty
 * sync history, which is how a missing grant looked like "no data".
 */
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export interface SyncLogEntry {
  id: string;
  source: string;
  source_type: string;
  sync_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  records_processed: number;
  records_inserted: number;
  records_updated: number;
  records_failed: number;
  error_message: string | null;
  sync_type: string;
}

export interface DataSourceOverview {
  internalCounts: Record<string, number>;
  externalCounts: Record<string, number>;
  syncLogs: SyncLogEntry[];
  totalExternalRecords: number;
}

type Row = Record<string, unknown>;

// The tables named here are a fixed list, never a value from a request.
const INTERNAL_COUNTS = {
  claims: sql`SELECT COUNT(*)::int AS c FROM claims`,
  organization_members: sql`SELECT COUNT(*)::int AS c FROM organization_members`,
  claim_deadlines: sql`SELECT COUNT(*)::int AS c FROM claim_deadlines`,
  dues_assignments: sql`SELECT COUNT(*)::int AS c FROM dues_assignments`,
} as const;

const EXTERNAL_COUNTS = {
  wage_benchmarks: sql`SELECT COUNT(*)::int AS c FROM wage_benchmarks`,
  union_density: sql`SELECT COUNT(*)::int AS c FROM union_density`,
  cost_of_living_data: sql`SELECT COUNT(*)::int AS c FROM cost_of_living_data`,
  contribution_rates: sql`SELECT COUNT(*)::int AS c FROM contribution_rates`,
} as const;

export function loadDataSourceOverview(): Promise<DataSourceOverview> {
  return withSystemContext(async (tx) => {
    const count = async (query: ReturnType<typeof sql>): Promise<number> => {
      const rows = Array.from((await tx.execute(query)) as Iterable<Row>);
      return Number(rows[0]?.c ?? 0);
    };

    const internalCounts: Record<string, number> = {};
    for (const [table, query] of Object.entries(INTERNAL_COUNTS)) internalCounts[table] = await count(query);

    const externalCounts: Record<string, number> = {};
    let totalExternalRecords = 0;
    for (const [table, query] of Object.entries(EXTERNAL_COUNTS)) {
      externalCounts[table] = await count(query);
      totalExternalRecords += externalCounts[table];
    }

    // Recent sync logs (last 20)
    const syncLogs = Array.from(
      (await tx.execute(sql`
        SELECT id, source, source_type, sync_id,
               started_at, completed_at, status,
               records_processed, records_inserted,
               records_updated, records_failed,
               error_message, sync_type
        FROM external_data_sync_log
        ORDER BY started_at DESC
        LIMIT 20
      `)) as Iterable<Row>,
    ) as unknown as SyncLogEntry[];

    return { internalCounts, externalCounts, syncLogs, totalExternalRecords };
  });
}
