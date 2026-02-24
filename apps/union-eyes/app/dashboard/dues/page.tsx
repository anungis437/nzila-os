/**
 * Dues Dashboard Page
 * Member view of their dues payments and history
 * 
 * @module app/dashboard/dues/page
 */

'use client';


export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Calendar, CreditCard, Download, DollarSign, TrendingUp, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';

// =============================================================================
// TYPES
// =============================================================================

interface DuesTransaction {
  id: string;
  organizationId: string;
  transactionType: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  duesAmount: string;
  copeAmount: string;
  pacAmount: string;
  strikeFundAmount: string;
  lateFeeAmount: string;
  adjustmentAmount: string;
  totalAmount: string;
  paidDate: string | null;
  paymentMethod: string | null;
  processorType: string | null;
  receiptUrl: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface DuesSummary {
  totalPending: number;
  totalOverdue: number;
  totalPaid: number;
  countPending: number;
  countOverdue: number;
  countPaid: number;
  nextDueDate: string | null;
}

interface DuesData {
  transactions: DuesTransaction[];
  summary: DuesSummary;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

function getStatusBadge(status: string) {
  const statusConfig = {
    pending: { variant: 'default' as const, label: 'Pending' },
    paid: { variant: 'success' as const, label: 'Paid' },
    overdue: { variant: 'destructive' as const, label: 'Overdue' },
    partial: { variant: 'secondary' as const, label: 'Partial' },
    waived: { variant: 'outline' as const, label: 'Waived' },
    refunded: { variant: 'outline' as const, label: 'Refunded' },
    cancelled: { variant: 'outline' as const, label: 'Cancelled' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function formatCurrency(amount: string | number): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(numAmount);
}

function formatDate(date: string | null): string {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), 'MMM dd, yyyy');
  } catch {
    return 'Invalid date';
  }
}

// =============================================================================
// OVERVIEW CARD COMPONENT
// =============================================================================

function DuesOverviewCard({ summary }: { summary: DuesSummary }) {
  const hasOverdue = summary.countOverdue > 0;
  const hasPending = summary.countPending > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Current Balance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(summary.totalPending + summary.totalOverdue)}
          </div>
          <p className="text-xs text-muted-foreground">
            {summary.countPending + summary.countOverdue} outstanding {summary.countPending + summary.countOverdue === 1 ? 'transaction' : 'transactions'}
          </p>
        </CardContent>
      </Card>

      {/* Overdue Amount */}
      <Card className={hasOverdue ? 'border-destructive' : ''}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          <AlertCircle className={`h-4 w-4 ${hasOverdue ? 'text-destructive' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${hasOverdue ? 'text-destructive' : ''}`}>
            {formatCurrency(summary.totalOverdue)}
          </div>
          <p className="text-xs text-muted-foreground">
            {summary.countOverdue} overdue {summary.countOverdue === 1 ? 'payment' : 'payments'}
          </p>
        </CardContent>
      </Card>

      {/* Next Due Date */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Next Due Date</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.nextDueDate ? formatDate(summary.nextDueDate) : 'None'}
          </div>
          <p className="text-xs text-muted-foreground">
            {hasPending ? 'Payment required' : 'All caught up'}
          </p>
        </CardContent>
      </Card>

      {/* Total Paid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(summary.totalPaid)}
          </div>
          <p className="text-xs text-muted-foreground">
            {summary.countPaid} completed {summary.countPaid === 1 ? 'payment' : 'payments'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// UPCOMING PAYMENTS TABLE
// =============================================================================

function UpcomingPaymentsTable({ transactions }: { transactions: DuesTransaction[] }) {
  const upcomingTransactions = transactions.filter(
    (t) => t.status === 'pending' || t.status === 'overdue'
  );

  if (upcomingTransactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Payments</CardTitle>
          <CardDescription>Your pending dues payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No upcoming payments</p>
            <p className="text-sm text-muted-foreground">You&apos;re all caught up!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Payments</CardTitle>
        <CardDescription>Your pending dues payments</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden md:table-cell">Period</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="hidden sm:table-cell">Amount</TableHead>
              <TableHead className="hidden lg:table-cell">Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {upcomingTransactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="hidden md:table-cell">
                  <div className="font-medium text-sm">
                    {formatDate(transaction.periodStart)} - {formatDate(transaction.periodEnd)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{formatDate(transaction.dueDate)}</span>
                    <span className="text-xs text-muted-foreground md:hidden">
                      {formatCurrency(transaction.totalAmount)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="font-medium">{formatCurrency(transaction.totalAmount)}</div>
                  <div className="text-xs text-muted-foreground hidden lg:block">
                    Dues: {formatCurrency(transaction.duesAmount)}
                    {parseFloat(transaction.copeAmount) > 0 && ` | COPE: ${formatCurrency(transaction.copeAmount)}`}
                    {parseFloat(transaction.pacAmount) > 0 && ` | PAC: ${formatCurrency(transaction.pacAmount)}`}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">{getStatusBadge(transaction.status)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant={transaction.status === 'overdue' ? 'destructive' : 'default'}
                    onClick={() => {
                      window.location.href = `/dashboard/dues/pay/${transaction.id}`;
                    }}
                    className="w-full sm:w-auto"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Pay Now</span>
                    <span className="sm:hidden">Pay</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// PAYMENT HISTORY TABLE
// =============================================================================

function PaymentHistoryTable({ transactions }: { transactions: DuesTransaction[] }) {
  const paidTransactions = transactions.filter((t) => t.status === 'paid');

  if (paidTransactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Your completed payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No payment history</p>
            <p className="text-sm text-muted-foreground">Your completed payments will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
        <CardDescription>Your completed payments</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden md:table-cell">Period</TableHead>
              <TableHead>Paid Date</TableHead>
              <TableHead className="hidden sm:table-cell">Amount</TableHead>
              <TableHead className="hidden lg:table-cell">Method</TableHead>
              <TableHead className="text-right">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paidTransactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="hidden md:table-cell">
                  <div className="font-medium text-sm">
                    {formatDate(transaction.periodStart)} - {formatDate(transaction.periodEnd)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{formatDate(transaction.paidDate)}</span>
                    <span className="text-xs text-muted-foreground md:hidden">
                      {formatCurrency(transaction.totalAmount)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="font-medium">{formatCurrency(transaction.totalAmount)}</div>
                  <div className="text-xs text-muted-foreground hidden lg:block">
                    Dues: {formatCurrency(transaction.duesAmount)}
                    {parseFloat(transaction.copeAmount) > 0 && ` | COPE: ${formatCurrency(transaction.copeAmount)}`}
                    {parseFloat(transaction.pacAmount) > 0 && ` | PAC: ${formatCurrency(transaction.pacAmount)}`}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="capitalize">{transaction.paymentMethod || 'N/A'}</div>
                  {transaction.processorType && (
                    <div className="text-xs text-muted-foreground capitalize">
                      via {transaction.processorType}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.location.href = `/dashboard/dues/receipts/${transaction.id}`;
                    }}
                    className="w-full sm:w-auto"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">View Receipt</span>
                    <span className="sm:hidden">View</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function DuesDashboardPage() {
  const [data, setData] = useState<DuesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDuesData() {
      try {
        setLoading(true);
        const response = await fetch('/api/members/dues');
        
        if (!response.ok) {
          throw new Error('Failed to fetch dues data');
        }

        const duesData = await response.json();
        setData(duesData);
      } catch (err) {
        logger.error('Error fetching dues data', { error: err });
        setError(err instanceof Error ? err.message : 'Failed to load dues data');
      } finally {
        setLoading(false);
      }
    }

    fetchDuesData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Page Header Skeleton */}
        <div className="flex flex-col space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>

        {/* Overview Cards Skeleton */}
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

        {/* Tables Skeleton */}
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

  if (error || !data) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-center min-h-100">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
              <CardDescription>Failed to load dues information</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{error || 'An unexpected error occurred'}</p>
              <Button 
                className="mt-4 w-full" 
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dues Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          View and manage your union dues payments
        </p>
      </div>

      {/* Overview Cards */}
      <DuesOverviewCard summary={data.summary} />

      {/* Upcoming Payments */}
      <UpcomingPaymentsTable transactions={data.transactions} />

      {/* Payment History */}
      <PaymentHistoryTable transactions={data.transactions} />
    </div>
  );
}
