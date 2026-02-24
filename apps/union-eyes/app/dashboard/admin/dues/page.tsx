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

import { useEffect, useState } from 'react';
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
import { format } from 'date-fns';
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

function formatDate(date: string): string {
  return format(new Date(date), 'MMM dd, yyyy');
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    paid: { variant: 'default', label: 'Paid' },
    pending: { variant: 'secondary', label: 'Pending' },
    overdue: { variant: 'destructive', label: 'Overdue' },
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
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatCurrency(value)}</div>
        {change !== undefined && (
          <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
            {isPositive && <TrendingUp className="h-3 w-3 text-green-600" />}
            {isNegative && <TrendingDown className="h-3 w-3 text-red-600" />}
            <span className={isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : ''}>
              {change > 0 ? '+' : ''}{change.toFixed(1)}% from last month
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
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch overview data
  const fetchOverview = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/dues/overview');

      if (!response.ok) {
        throw new Error('Failed to fetch dues overview');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      logger.error('Error fetching admin dues overview', { error: err });
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

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
              <CardTitle>Error Loading Dashboard</CardTitle>
            </div>
            <CardDescription>{error || 'Failed to load dues overview'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchOverview} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dues Administration</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage dues collection, billing cycles, and payments
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
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Collected"
          value={data.financialKpis.totalCollected}
          change={collectedChange}
          icon={<DollarSign className="h-4 w-4" />}
          description="All-time paid transactions"
        />
        <KpiCard
          title="Outstanding"
          value={data.financialKpis.totalOutstanding}
          icon={<Calendar className="h-4 w-4" />}
          description="Pending payments"
        />
        <KpiCard
          title="Overdue"
          value={data.financialKpis.totalOverdue}
          icon={<AlertCircle className="h-4 w-4" />}
          description="Past due date"
        />
        <KpiCard
          title="Current Balance"
          value={data.financialKpis.currentBalance}
          icon={<TrendingUp className="h-4 w-4" />}
          description="Outstanding + Overdue"
        />
      </div>

      {/* Period Comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">This Month</CardTitle>
            <CardDescription>Current month performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Collected</span>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(data.periodStats.thisMonth.collected)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Outstanding</span>
              <span className="text-lg font-medium">
                {formatCurrency(data.periodStats.thisMonth.outstanding)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Transactions</span>
              <span className="text-lg font-medium">
                {data.periodStats.thisMonth.transactionCount}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Last Month</CardTitle>
            <CardDescription>Previous month comparison</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Collected</span>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(data.periodStats.lastMonth.collected)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Outstanding</span>
              <span className="text-lg font-medium">
                {formatCurrency(data.periodStats.lastMonth.outstanding)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Transactions</span>
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
          <CardTitle>Payment Statistics</CardTitle>
          <CardDescription>Transaction counts by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col space-y-1">
              <span className="text-3xl font-bold text-green-600">{data.paymentStats.paid}</span>
              <span className="text-sm text-muted-foreground">Paid</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-3xl font-bold text-blue-600">{data.paymentStats.pending}</span>
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-3xl font-bold text-red-600">{data.paymentStats.overdue}</span>
              <span className="text-sm text-muted-foreground">Overdue</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-3xl font-bold">{data.paymentStats.total}</span>
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button className="w-full" variant="outline">
              <PlayCircle className="mr-2 h-4 w-4" />
              Generate Billing Cycle
            </Button>
            <Button className="w-full" variant="outline">
              <AlertCircle className="mr-2 h-4 w-4" />
              Process Late Fees
            </Button>
            <Button className="w-full" variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              View Reports
            </Button>
            <Button className="w-full" variant="outline">
              <Users className="mr-2 h-4 w-4" />
              Manage Members
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>Last 10 transactions across all members</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No recent payments</p>
              <p className="text-sm text-muted-foreground">Payments will appear here once created</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="hidden sm:table-cell">Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Paid Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.memberName}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {formatDate(payment.dueDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{formatCurrency(payment.amount)}</span>
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {formatDate(payment.dueDate)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {getStatusBadge(payment.status)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {payment.paidDate ? formatDate(payment.paidDate) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          View
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
