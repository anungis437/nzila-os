'use client';


export const dynamic = 'force-dynamic';
/**
 * Admin Dues Dashboard
 * 
 * Phase 3: Admin UI - Dues Management Dashboard
 * 
 * Comprehensive overview of organization's dues collection:
 * - Financial KPIs (collected, outstanding, overdue)
 * - Recent payments table
 * - Period comparison (this month vs last month)
 * - Quick actions (billing cycle, late fees, reports)
 * 
 * @module app/dashboard/admin/dues
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertCircle,
  RefreshCw,
  Download,
  PlayCircle,
  FileText,
  Users,
} from 'lucide-react';
import { logger } from '@/lib/logger';

// =============================================================================
// TYPES
// =============================================================================

interface OverviewData {
  financialKpis: {
    totalCollected: number;
    totalOutstanding: number;
    totalOverdue: number;
    currentBalance: number;
  };
  paymentStats: {
    pending: number;
    paid: number;
    overdue: number;
    total: number;
  };
  recentPayments: Array<{
    id: string;
    memberName: string;
    amount: number;
    status: string;
    paidDate: string | null;
    dueDate: string;
  }>;
  periodStats: {
    thisMonth: {
      collected: number;
      outstanding: number;
      transactionCount: number;
    };
    lastMonth: {
      collected: number;
      outstanding: number;
      transactionCount: number;
    };
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

function getStatusBadge(status: string, t: (key: string) => string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    paid: { variant: 'default', label: t('status.paid') },
    pending: { variant: 'secondary', label: t('status.pending') },
    overdue: { variant: 'destructive', label: t('status.overdue') },
  };

  const config = variants[status] || { variant: 'outline' as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// =============================================================================
// KPI CARD COMPONENT
// =============================================================================

interface KpiCardProps {
  title: string;
  value: number;
  change?: number;
  icon: React.ReactNode;
  description?: string;
}

function KpiCard({ title, value, change, icon, description }: KpiCardProps) {
  const t = useTranslations('adminDuesPage');
  const locale = useLocale();
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatCurrency(value, locale)}</div>
        {change !== undefined && (
          <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
            {isPositive && <TrendingUp className="h-3 w-3 text-green-600" />}
            {isNegative && <TrendingDown className="h-3 w-3 text-red-600" />}
            <span className={isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : ''}>
              {t('fromLastMonth', { change: `${change > 0 ? '+' : ''}${change.toFixed(1)}` })}
            </span>
          </div>
        )}
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MAIN DASHBOARD COMPONENT
// =============================================================================

export default function AdminDuesDashboard() {
  const t = useTranslations('adminDuesPage');
  const locale = useLocale();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch overview data
  const fetchOverview = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/dues/overview');

      if (!response.ok) {
        throw new Error(t('failedToFetchOverview'));
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      logger.error(t('errorFetchingOverviewLog'), { error: err });
      setError(err instanceof Error ? err.message : t('failedToLoadOverview'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>{t('errorLoadingDashboardTitle')}</CardTitle>
            </div>
            <CardDescription>{error || t('failedToLoadOverview')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchOverview} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('tryAgainButton')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate period changes
  const collectedChange = calculatePercentageChange(
    data.periodStats.thisMonth.collected,
    data.periodStats.lastMonth.collected
  );
  const _outstandingChange = calculatePercentageChange(
    data.periodStats.thisMonth.outstanding,
    data.periodStats.lastMonth.outstanding
  );

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOverview}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {t('refreshButton')}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            {t('exportButton')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={t('kpi.totalCollectedTitle')}
          value={data.financialKpis.totalCollected}
          change={collectedChange}
          icon={<DollarSign className="h-4 w-4" />}
          description={t('kpi.totalCollectedDescription')}
        />
        <KpiCard
          title={t('kpi.outstandingTitle')}
          value={data.financialKpis.totalOutstanding}
          icon={<Calendar className="h-4 w-4" />}
          description={t('kpi.outstandingDescription')}
        />
        <KpiCard
          title={t('kpi.overdueTitle')}
          value={data.financialKpis.totalOverdue}
          icon={<AlertCircle className="h-4 w-4" />}
          description={t('kpi.overdueDescription')}
        />
        <KpiCard
          title={t('kpi.currentBalanceTitle')}
          value={data.financialKpis.currentBalance}
          icon={<TrendingUp className="h-4 w-4" />}
          description={t('kpi.currentBalanceDescription')}
        />
      </div>

      {/* Period Comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('thisMonthTitle')}</CardTitle>
            <CardDescription>{t('thisMonthDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('collectedLabel')}</span>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(data.periodStats.thisMonth.collected, locale)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('outstandingLabel')}</span>
              <span className="text-lg font-medium">
                {formatCurrency(data.periodStats.thisMonth.outstanding, locale)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('transactionsLabel')}</span>
              <span className="text-lg font-medium">
                {data.periodStats.thisMonth.transactionCount}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('lastMonthTitle')}</CardTitle>
            <CardDescription>{t('lastMonthDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('collectedLabel')}</span>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(data.periodStats.lastMonth.collected, locale)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('outstandingLabel')}</span>
              <span className="text-lg font-medium">
                {formatCurrency(data.periodStats.lastMonth.outstanding, locale)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('transactionsLabel')}</span>
              <span className="text-lg font-medium">
                {data.periodStats.lastMonth.transactionCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>{t('paymentStatisticsTitle')}</CardTitle>
          <CardDescription>{t('paymentStatisticsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col space-y-1">
              <span className="text-3xl font-bold text-green-600">{data.paymentStats.paid}</span>
              <span className="text-sm text-muted-foreground">{t('status.paid')}</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-3xl font-bold text-blue-600">{data.paymentStats.pending}</span>
              <span className="text-sm text-muted-foreground">{t('status.pending')}</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-3xl font-bold text-red-600">{data.paymentStats.overdue}</span>
              <span className="text-sm text-muted-foreground">{t('status.overdue')}</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-3xl font-bold">{data.paymentStats.total}</span>
              <span className="text-sm text-muted-foreground">{t('totalLabel')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quickActionsTitle')}</CardTitle>
          <CardDescription>{t('quickActionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button className="w-full" variant="outline">
              <PlayCircle className="mr-2 h-4 w-4" />
              {t('actions.generateBillingCycle')}
            </Button>
            <Button className="w-full" variant="outline">
              <AlertCircle className="mr-2 h-4 w-4" />
              {t('actions.processLateFees')}
            </Button>
            <Button className="w-full" variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              {t('actions.viewReports')}
            </Button>
            <Button className="w-full" variant="outline">
              <Users className="mr-2 h-4 w-4" />
              {t('actions.manageMembers')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle>{t('recentPaymentsTitle')}</CardTitle>
          <CardDescription>{t('recentPaymentsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t('noRecentPaymentsTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('noRecentPaymentsDescription')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('tableMember')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('tableDueDate')}</TableHead>
                    <TableHead>{t('tableAmount')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('tableStatus')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('tablePaidDate')}</TableHead>
                    <TableHead className="text-right">{t('tableActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.memberName}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {formatDate(payment.dueDate, locale)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{formatCurrency(payment.amount, locale)}</span>
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {formatDate(payment.dueDate, locale)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {getStatusBadge(payment.status, t)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {payment.paidDate ? formatDate(payment.paidDate, locale) : t('naLabel')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          {t('viewButton')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
