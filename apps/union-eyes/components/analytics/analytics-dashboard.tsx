'use client';

/**
 * Analytics Dashboard
 * Q1 2025 - Advanced Analytics
 *
 * The organization's stored metrics, KPIs, insights and trend analyses. Every section is read on its own: a section that cannot be read
 * says so (with the server's reason) and offers a retry, and a figure nothing has recorded is a dash, never zero.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';
import { useToast } from '@/components/ui/use-toast';
import { ApiShapeError, envelopeData, isRecord, readApiError } from '@/lib/client/api-envelope';
import { requiredCount } from '@/lib/client/row-fields';
import { MetricCard } from './metric-card';
import { TrendChart } from './trend-chart';
import { InsightsPanel } from './insights-panel';
import { KPIGrid, type KpiView } from './kpi-grid';
import { KPIBuilderDialog } from './kpi-builder-dialog';
import {
  readInsight,
  readKpi,
  readMetrics,
  readTrendAnalysis,
  type Insight,
  type MetricPoint,
  type TrendAnalysis,
} from './analytics-readers';

interface AnalyticsDashboardProps {
  organizationId: string;
}

type Section<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'failed'; message: string };

interface CardMetrics {
  claims: MetricPoint[];
  resolution: MetricPoint[];
  members: MetricPoint[];
}

interface InsightList {
  rows: Insight[];
  total: number;
}

/** A failure the server explained: its words are shown as they came. */
class ServerMessage extends Error {}

const SERIES_LIMIT = 30;
const DASH = '—';

async function getJson(url: string, fallback: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new ServerMessage(await readApiError(response, fallback));
  return response.json();
}

async function fetchMetrics(metricType: string, limit: number, fallback: string): Promise<MetricPoint[]> {
  return readMetrics(await getJson(`/api/analytics/metrics?metricType=${encodeURIComponent(metricType)}&limit=${limit}`, fallback));
}

async function fetchCardMetrics(fallback: string): Promise<CardMetrics> {
  const [claims, resolution, members] = await Promise.all([
    fetchMetrics('claims_volume', SERIES_LIMIT, fallback),
    fetchMetrics('resolution_time', SERIES_LIMIT, fallback),
    fetchMetrics('member_growth', SERIES_LIMIT, fallback),
  ]);
  return { claims, resolution, members };
}

/** A KPI's current value is the latest stored metric of its metric type. */
async function fetchKpis(fallback: string): Promise<KpiView[]> {
  const payload = envelopeData(await getJson('/api/analytics/kpis?limit=100', fallback));
  if (!Array.isArray(payload.data)) throw new ApiShapeError('no list');
  const kpis = payload.data.map(readKpi).filter((kpi) => kpi.isActive);
  const types = [...new Set(kpis.map((kpi) => kpi.metricType))];
  const latest = new Map(
    await Promise.all(types.map(async (type) => [type, (await fetchMetrics(type, 1, fallback))[0]?.value ?? null] as const)),
  );
  return kpis.map((kpi) => ({ ...kpi, currentValue: latest.get(kpi.metricType) ?? null }));
}

async function fetchInsights(fallback: string): Promise<InsightList> {
  const payload = envelopeData(await getJson('/api/analytics/insights?status=new&limit=20', fallback));
  if (!Array.isArray(payload.data) || !isRecord(payload.pagination)) throw new ApiShapeError('no list');
  return {
    rows: payload.data.map(readInsight),
    total: requiredCount(payload.pagination, 'total'),
  };
}

async function fetchTrends(fallback: string): Promise<TrendAnalysis[]> {
  const payload = envelopeData(await getJson('/api/analytics/trends?limit=5', fallback));
  if (!Array.isArray(payload.data)) throw new ApiShapeError('no list');
  return payload.data.map(readTrendAnalysis);
}

function failure(error: unknown, fallback: string): Section<never> {
  return { state: 'failed', message: error instanceof ServerMessage ? error.message : fallback };
}

const formatNumber = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

/** The chart's rows: the latest period type only (periods of different lengths do not share an axis), oldest first. */
function seriesOf(points: MetricPoint[]) {
  const periodType = points[0]?.periodType;
  return points
    .filter((point) => point.periodType === periodType)
    .map((point) => ({ date: point.periodStart, value: point.value }))
    .reverse();
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations();
  return (
    <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <span>{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}

export function AnalyticsDashboard(_props: AnalyticsDashboardProps) {
  const t = useTranslations('analyticsDashboard');
  const locale = useLocale();
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<Section<CardMetrics>>({ state: 'loading' });
  const [kpis, setKpis] = useState<Section<KpiView[]>>({ state: 'loading' });
  const [insights, setInsights] = useState<Section<InsightList>>({ state: 'loading' });
  const [trends, setTrends] = useState<Section<TrendAnalysis[]>>({ state: 'loading' });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fallback = t('errorDescription');

  // Each loader answers whether its section was read, so a refresh can say it succeeded only when every section was.
  const loadMetrics = useCallback(
    () =>
      fetchCardMetrics(fallback).then(
        (value) => (setMetrics({ state: 'ready', value }), true),
        (error) => (setMetrics(failure(error, fallback)), false),
      ),
    [fallback],
  );
  const loadKpis = useCallback(
    () =>
      fetchKpis(fallback).then(
        (value) => (setKpis({ state: 'ready', value }), true),
        (error) => (setKpis(failure(error, fallback)), false),
      ),
    [fallback],
  );
  const loadInsights = useCallback(
    () =>
      fetchInsights(fallback).then(
        (value) => (setInsights({ state: 'ready', value }), true),
        (error) => (setInsights(failure(error, fallback)), false),
      ),
    [fallback],
  );
  const loadTrends = useCallback(
    () =>
      fetchTrends(fallback).then(
        (value) => (setTrends({ state: 'ready', value }), true),
        (error) => (setTrends(failure(error, fallback)), false),
      ),
    [fallback],
  );
  const loadAll = useCallback(
    () => Promise.all([loadMetrics(), loadKpis(), loadInsights(), loadTrends()]),
    [loadMetrics, loadKpis, loadInsights, loadTrends],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function refreshDashboard() {
    setIsRefreshing(true);
    const read = await loadAll();
    setIsRefreshing(false);
    if (read.every(Boolean)) toast({ title: t('dashboardRefreshed'), description: t('dashboardRefreshedDescription') });
  }

  const sections = [metrics, kpis, insights, trends];

  // The sections are read together the first time; a refresh keeps what is shown until its answer arrives.
  if (sections.some((section) => section.state === 'loading')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">{t('loadingMessage')}</p>
        </div>
      </div>
    );
  }

  const ready = metrics.state === 'ready' ? metrics.value : null;
  const latest = (points: MetricPoint[] | undefined) => points?.[0] ?? null;
  const period = (point: MetricPoint | null) =>
    point === null
      ? undefined
      : `${new Date(point.periodStart).toLocaleDateString(locale)} – ${new Date(point.periodEnd).toLocaleDateString(locale)}`;
  const unitLabel = (unit: string | null) => (unit === null ? '' : unit === 'days' ? ` ${t('days')}` : ` ${unit}`);

  const claims = latest(ready?.claims);
  const resolution = latest(ready?.resolution);
  const members = latest(ready?.members);
  const claimsSeries = seriesOf(ready?.claims ?? []);
  const resolutionSeries = seriesOf(ready?.resolution ?? []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshDashboard} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
          <KPIBuilderDialog onCreated={() => void loadKpis()} />
        </div>
      </div>

      {metrics.state === 'failed' && <SectionError message={metrics.message} onRetry={() => void loadMetrics()} />}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t('quickStats.claimsThisMonth')}
          value={claims === null ? DASH : formatNumber(claims.value)}
          trend={claims?.trend}
          icon={TrendingUp}
          description={period(claims)}
        />
        <MetricCard
          title={t('quickStats.avgResolutionTime')}
          value={resolution === null ? DASH : `${formatNumber(resolution.value)}${unitLabel(resolution.unit)}`}
          trend={resolution?.trend}
          icon={TrendingDown}
          description={period(resolution)}
        />
        <MetricCard
          title={t('quickStats.newMembers')}
          value={members === null ? DASH : formatNumber(members.value)}
          trend={members?.trend}
          icon={TrendingUp}
          description={period(members)}
        />
        <MetricCard
          title={t('quickStats.activeInsights')}
          value={insights.state === 'ready' ? String(insights.value.total) : DASH}
          icon={AlertCircle}
          description={t('requiresAttention')}
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="trends">{t('tabs.trends')}</TabsTrigger>
          <TabsTrigger value="insights">{t('tabs.insights')}</TabsTrigger>
          <TabsTrigger value="kpis">{t('tabs.kpis')}</TabsTrigger>
          <TabsTrigger value="compare">{t('tabs.compare')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>{t('claimsVolumeTrend.title')}</CardTitle>
                {claims?.periodType === 'daily' && <CardDescription>{t('claimsVolumeTrend.description')}</CardDescription>}
              </CardHeader>
              <CardContent>
                <TrendChart data={claimsSeries} type="line" />
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>{t('recentInsights.title')}</CardTitle>
                <CardDescription>{t('recentInsights.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                {insights.state === 'failed' ? (
                  <SectionError message={insights.message} onRetry={() => void loadInsights()} />
                ) : (
                  <InsightsPanel insights={insights.state === 'ready' ? insights.value.rows.slice(0, 3) : []} compact />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('resolutionTimeTrend.title')}</CardTitle>
              <CardDescription>{t('resolutionTimeTrend.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={resolutionSeries} type="area" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('trendAnalysis.title')}</CardTitle>
              <CardDescription>{t('trendAnalysis.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {trends.state === 'failed' && <SectionError message={trends.message} onRetry={() => void loadTrends()} />}
              {trends.state === 'ready' && trends.value.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('noTrends')}</p>
              )}
              {trends.state === 'ready' && (
                <div className="space-y-4">
                  {trends.value.map((trend) => (
                    <div key={trend.id} className="p-4 border rounded-lg space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize">{trend.detectedTrend ?? trend.analysisType}</span>
                        {trend.confidence !== null && (
                          <span className="text-sm text-muted-foreground">
                            ({(trend.confidence * 100).toFixed(1)}% {t('confidence')})
                          </span>
                        )}
                      </div>
                      {trend.insights !== null && <p className="text-sm text-muted-foreground">{trend.insights}</p>}
                      {trend.anomalyCount !== null && trend.anomalyCount > 0 && (
                        <p className="text-sm text-orange-600">{t('anomaliesDetected', { count: trend.anomalyCount })}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          {insights.state === 'failed' && <SectionError message={insights.message} onRetry={() => void loadInsights()} />}
          {insights.state === 'ready' && <InsightsPanel insights={insights.value.rows} onChanged={() => void loadInsights()} />}
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          {kpis.state === 'failed' && <SectionError message={kpis.message} onRetry={() => void loadKpis()} />}
          {kpis.state === 'ready' && <KPIGrid kpis={kpis.value} />}
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          <CapabilityUnavailable locale={locale} capability="UE-ANALYTICS-COMPARATIVE" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
