/**
 * Data Source Dashboard
 *
 * Platform-level view of all internal and external data sources.
 * Shows record counts, field metadata, sync history and health.
 *
 * @role integration_manager and above (Nzila platform roles)
 * @dashboard_path /dashboard/data-source
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { getAllDataSources } from '@/lib/report-executor';
import {
  Database, Table2, RefreshCw, Clock, CheckCircle2, XCircle,
  AlertTriangle, Users, FileText, Timer, DollarSign, TrendingUp,
  Globe, BarChart3, Percent, Landmark,
} from 'lucide-react';

/* ─── types ─── */
interface TableStats {
  table_name: string;
  row_count: number;
}

interface SyncLogEntry {
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

interface ExternalSourceInfo {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  table: string;
  schedule: string;
  provider: string;
}

/* ─── constants ─── */
const EXTERNAL_SOURCES: ExternalSourceInfo[] = [
  {
    id: 'wages',
    name: 'Wage Benchmarks',
    description: 'Statistics Canada wage data by NOC code and geography',
    icon: <TrendingUp className="h-5 w-5" />,
    table: 'wage_benchmarks',
    schedule: 'Monthly (1st)',
    provider: 'Statistics Canada',
  },
  {
    id: 'unionDensity',
    name: 'Union Density',
    description: 'Union membership and coverage rates by industry',
    icon: <Percent className="h-5 w-5" />,
    table: 'union_density',
    schedule: 'Weekly (Sun)',
    provider: 'Statistics Canada',
  },
  {
    id: 'cola',
    name: 'Cost of Living (CPI)',
    description: 'Consumer price index and inflation rates for COLA calculations',
    icon: <BarChart3 className="h-5 w-5" />,
    table: 'cost_of_living_data',
    schedule: 'Monthly (1st)',
    provider: 'Statistics Canada',
  },
  {
    id: 'contributions',
    name: 'Contribution Rates',
    description: 'EI and CPP contribution rates and limits',
    icon: <Landmark className="h-5 w-5" />,
    table: 'contribution_rates',
    schedule: 'Weekly (Sun)',
    provider: 'Canada Revenue Agency',
  },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  claims: <FileText className="h-5 w-5" />,
  organization_members: <Users className="h-5 w-5" />,
  claim_deadlines: <Timer className="h-5 w-5" />,
  dues_assignments: <DollarSign className="h-5 w-5" />,
};

/* ─── helpers ─── */
function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
    case 'failed':
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    case 'running':
      return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-CA');
}

/* ─── page ─── */
export default async function DataSourcePage() {
  await requireUser();
  const canAccess = await hasMinRole('integration_manager');
  if (!canAccess) redirect('/dashboard');

  // ── Data fetching (all under system context) ──────────────────────────────
  const {
    internalCounts,
    externalCounts,
    syncLogs,
    totalExternalRecords,
  } = await withSystemContext(async () => {
    // Safe row count: returns 0 if table doesn't exist
    const KNOWN_TABLES: Record<string, ReturnType<typeof sql>> = {
      claims: sql`SELECT COUNT(*)::int AS c FROM claims`,
      organization_members: sql`SELECT COUNT(*)::int AS c FROM organization_members`,
      claim_deadlines: sql`SELECT COUNT(*)::int AS c FROM claim_deadlines`,
      dues_assignments: sql`SELECT COUNT(*)::int AS c FROM dues_assignments`,
      wage_benchmarks: sql`SELECT COUNT(*)::int AS c FROM wage_benchmarks`,
      union_density: sql`SELECT COUNT(*)::int AS c FROM union_density`,
      cost_of_living_data: sql`SELECT COUNT(*)::int AS c FROM cost_of_living_data`,
      contribution_rates: sql`SELECT COUNT(*)::int AS c FROM contribution_rates`,
    };

    async function safeCount(table: string): Promise<number> {
      try {
        const exists = await db.execute(sql`
          SELECT 1 FROM pg_tables
          WHERE schemaname = 'public' AND tablename = ${table}
        `);
        if (Array.from(exists).length === 0) return 0;
        const query = KNOWN_TABLES[table];
        if (!query) return 0;
        const rows = await db.execute(query);
        return Number((Array.from(rows)[0] as Record<string, unknown>)?.c ?? 0);
      } catch {
        return 0;
      }
    }

    // Internal data source row counts
    const internalTables = ['claims', 'organization_members', 'claim_deadlines', 'dues_assignments'];
    const internalMap: Record<string, number> = {};
    for (const t of internalTables) {
      internalMap[t] = await safeCount(t);
    }

    // External data source row counts
    const externalTables = ['wage_benchmarks', 'union_density', 'cost_of_living_data', 'contribution_rates'];
    const externalMap: Record<string, number> = {};
    let extTotal = 0;
    for (const t of externalTables) {
      const count = await safeCount(t);
      externalMap[t] = count;
      extTotal += count;
    }

    // Recent sync logs (last 20) — table may not exist yet
    let logs: SyncLogEntry[] = [];
    try {
      const syncTableExists = await db.execute(sql`
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'external_data_sync_log'
      `);
      if (Array.from(syncTableExists).length > 0) {
        const rawLogs = await db.execute(sql`
          SELECT id, source, source_type, sync_id,
                 started_at, completed_at, status,
                 records_processed, records_inserted,
                 records_updated, records_failed,
                 error_message, sync_type
          FROM external_data_sync_log
          ORDER BY started_at DESC
          LIMIT 20
        `) as unknown as SyncLogEntry[];
        logs = Array.from(rawLogs);
      }
    } catch {
      // Table doesn't exist yet — no sync history
    }

    return {
      internalCounts: internalMap,
      externalCounts: externalMap,
      syncLogs: logs,
      totalExternalRecords: extTotal,
    };
  });

  const internalSources = getAllDataSources();
  const totalInternalRecords = Object.values(internalCounts).reduce((a, b) => a + b, 0);
  const totalSources = internalSources.length + EXTERNAL_SOURCES.length;

  // Latest sync per external source
  const latestSyncs: Record<string, SyncLogEntry> = {};
  for (const log of syncLogs) {
    if (!latestSyncs[log.source]) {
      latestSyncs[log.source] = log;
    }
  }

  return (
    <main className="p-6 md:p-10 space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          Data Sources
        </h1>
        <p className="text-muted-foreground mt-1">
          Internal and external data connections powering analytics, reports, and CBA enrichment
        </p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sources</CardDescription>
            <CardTitle className="text-3xl">{totalSources}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {internalSources.length} internal · {EXTERNAL_SOURCES.length} external
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Internal Records</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(totalInternalRecords)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across {internalSources.length} tables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>External Records</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(totalExternalRecords)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              StatCan & CRA benchmarks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sync History</CardDescription>
            <CardTitle className="text-3xl">{syncLogs.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Recent sync operations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="internal" className="space-y-6">
        <TabsList>
          <TabsTrigger value="internal" className="gap-2">
            <Table2 className="h-4 w-4" /> Internal ({internalSources.length})
          </TabsTrigger>
          <TabsTrigger value="external" className="gap-2">
            <Globe className="h-4 w-4" /> External ({EXTERNAL_SOURCES.length})
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Sync Log
          </TabsTrigger>
        </TabsList>

        {/* ── Internal sources ── */}
        <TabsContent value="internal" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {internalSources.map((ds) => {
              const count = internalCounts[ds.table] ?? 0;
              return (
                <Card key={ds.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                          {ICON_MAP[ds.id] ?? <Table2 className="h-5 w-5" />}
                        </div>
                        <div>
                          <CardTitle className="text-base">{ds.name}</CardTitle>
                          <CardDescription className="text-xs font-mono">{ds.table}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-sm font-mono">
                        {formatNumber(count)} rows
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">
                        {ds.fields.length} fields · {ds.joinable?.length ?? 0} joinable tables
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {ds.fields.slice(0, 6).map((f) => (
                          <Badge key={f.id} variant="secondary" className="text-[10px] font-mono">
                            {f.name}
                          </Badge>
                        ))}
                        {ds.fields.length > 6 && (
                          <Badge variant="secondary" className="text-[10px]">
                            +{ds.fields.length - 6} more
                          </Badge>
                        )}
                      </div>
                      {ds.joinable && ds.joinable.length > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          Joins: {ds.joinable.join(', ')}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── External sources ── */}
        <TabsContent value="external" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EXTERNAL_SOURCES.map((src) => {
              const count = externalCounts[src.table] ?? 0;
              const latestSync = latestSyncs[src.id] ?? latestSyncs[`statcan_${src.id}`];
              return (
                <Card key={src.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                          {src.icon}
                        </div>
                        <div>
                          <CardTitle className="text-base">{src.name}</CardTitle>
                          <CardDescription className="text-xs">{src.provider}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-sm font-mono">
                        {formatNumber(count)} rows
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{src.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" /> Schedule: {src.schedule}
                      </span>
                      <span className="font-mono text-muted-foreground">{src.table}</span>
                    </div>
                    {latestSync && (
                      <div className="flex items-center justify-between text-xs border-t pt-2">
                        <span className="text-muted-foreground">
                          Last sync: {timeAgo(latestSync.started_at)}
                        </span>
                        {statusBadge(latestSync.status)}
                      </div>
                    )}
                    {!latestSync && (
                      <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 border-t pt-2">
                        <AlertTriangle className="h-3 w-3" />
                        No sync history
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Sync log ── */}
        <TabsContent value="sync" className="space-y-4">
          {syncLogs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">No sync operations recorded yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  External data syncs run on a scheduled cron job.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Sync Operations</CardTitle>
                <CardDescription>Last {syncLogs.length} sync runs across all external sources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-4">Source</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4 text-right">Processed</th>
                        <th className="pb-2 pr-4 text-right">Inserted</th>
                        <th className="pb-2 pr-4 text-right">Failed</th>
                        <th className="pb-2">Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncLogs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2 pr-4 font-medium">{log.source}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{log.sync_type}</td>
                          <td className="py-2 pr-4">{statusBadge(log.status)}</td>
                          <td className="py-2 pr-4 text-right font-mono">{formatNumber(log.records_processed)}</td>
                          <td className="py-2 pr-4 text-right font-mono">{formatNumber(log.records_inserted)}</td>
                          <td className="py-2 pr-4 text-right font-mono">
                            {log.records_failed > 0 ? (
                              <span className="text-destructive">{log.records_failed}</span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className="py-2 text-muted-foreground">{timeAgo(log.started_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
} 
