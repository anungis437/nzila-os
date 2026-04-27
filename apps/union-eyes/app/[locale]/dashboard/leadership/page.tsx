/**
 * Leadership Dashboard Page
 *
 * Executive-level view for union presidents, exec directors,
 * senior LR staff, and board reporting.
 *
 * Shows KPIs, employer hotspots, grievance trends,
 * steward capacity, compliance summary, and export options.
 *
 * @module app/dashboard/leadership/page
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Shield, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSkeletonComposer } from '@/components/ui/loading-skeleton-composer';
import { EmptyState } from '@/components/ui/empty-state';
import { KpiCards, KpiCardsProps } from '@/components/leadership/kpi-cards';
import {
  EmployerHotspotsTable,
  EmployerHotspot,
} from '@/components/leadership/employer-hotspots-table';
import {
  GrievanceTrendsChart,
  TrendDataPoint,
  CategoryBreakdown,
} from '@/components/leadership/grievance-trends-chart';
import {
  StewardCapacityChart,
  StewardCapacity,
} from '@/components/leadership/steward-capacity-chart';
import {
  ComplianceSummaryCard,
  ComplianceMetrics,
  ComplianceAlert,
} from '@/components/leadership/compliance-summary-card';
import {
  LeadershipExport,
  ExportableMetrics,
} from '@/components/leadership/leadership-export';
import { logger } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────

interface DashboardData {
  kpi: Omit<KpiCardsProps, 'className'>;
  employers: EmployerHotspot[];
  trends: TrendDataPoint[];
  categories: CategoryBreakdown[];
  stewards: StewardCapacity[];
  compliance: {
    metrics: ComplianceMetrics;
    alerts: ComplianceAlert[];
  };
}

// ─── Page ─────────────────────────────────────────────────────

export default function LeadershipPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('leadershipPage');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/leadership?timeframe=${timeframe}`);
      if (response.ok) {
        const result = await response.json();
        setData(result.data ?? result);
      } else {
        logger.warn('Leadership dashboard fetch failed', { status: response.status });
      }
    } catch (error) {
      logger.error('Failed to load leadership dashboard', error);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ─── Export builder ───────────────────────────────────────

  const buildExportMetrics = (): ExportableMetrics | null => {
    if (!data) return null;
    return {
      title: t('export.title'),
      generatedAt: new Date().toLocaleDateString(locale),
      kpi: {
        [t('export.kpi.activeGrievances')]: data.kpi.activeGrievances,
        [t('export.kpi.resolvedThisMonth')]: data.kpi.resolvedThisMonth,
        [t('export.kpi.avgTriageDays')]: data.kpi.avgTriageDays,
        [t('export.kpi.avgResolutionDays')]: data.kpi.avgResolutionDays,
        [t('export.kpi.arbitrations')]: data.kpi.arbitrationCount,
        [t('export.kpi.overdueCases')]: data.kpi.overdueCases,
      },
      employerRows: data.employers.map((e) => ({
        [t('export.employerRows.employer')]: e.employerName,
        [t('export.employerRows.active')]: e.activeGrievances,
        [t('export.employerRows.overdue')]: e.overdueCases,
        [t('export.employerRows.resolvedQuarter')]: e.resolvedThisQuarter,
        [t('export.employerRows.topCategory')]: e.topCategory,
        [t('export.employerRows.avgDays')]: e.avgResolutionDays,
        [t('export.employerRows.trend')]: e.trend,
      })),
      stewardRows: data.stewards.map((s) => ({
        [t('export.stewardRows.steward')]: s.stewardName,
        [t('export.stewardRows.active')]: s.activeCases,
        [t('export.stewardRows.overdue')]: s.overdueCases,
        [t('export.stewardRows.capacityLimit')]: s.capacityLimit,
        [t('export.stewardRows.avgDaysPerCase')]: s.avgDaysPerCase,
        [t('export.stewardRows.resolvedMonth')]: s.resolvedThisMonth,
      })),
    };
  };

  // ─── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
        <LoadingSkeletonComposer variant="card" rows={3} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-6">
        <EmptyState
          icon={Shield}
          title={t('empty.title')}
          description={t('empty.description')}
        />
      </div>
    );
  }

  const exportMetrics = buildExportMetrics();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {exportMetrics && <LeadershipExport metrics={exportMetrics} />}
          <Button variant="outline" size="sm" onClick={fetchDashboard}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <KpiCards
        activeGrievances={data.kpi.activeGrievances}
        resolvedThisMonth={data.kpi.resolvedThisMonth}
        avgTriageDays={data.kpi.avgTriageDays}
        avgResolutionDays={data.kpi.avgResolutionDays}
        arbitrationCount={data.kpi.arbitrationCount}
        overdueCases={data.kpi.overdueCases}
        previousPeriod={data.kpi.previousPeriod}
      />

      {/* Main content: 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trends */}
        <GrievanceTrendsChart
          data={data.trends}
          categories={data.categories}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
        />

        {/* Steward capacity */}
        <StewardCapacityChart stewards={data.stewards} />
      </div>

      {/* Employer hotspots (full-width) */}
      <EmployerHotspotsTable
        employers={data.employers}
        onViewEmployer={(id) => router.push(`/employers/${id}`)}
      />

      {/* Compliance summary */}
      <ComplianceSummaryCard
        metrics={data.compliance.metrics}
        alerts={data.compliance.alerts}
      />
    </div>
  );
}
