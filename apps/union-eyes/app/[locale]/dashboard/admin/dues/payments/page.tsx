'use client';

import { useTranslations } from 'next-intl';

export const dynamic = 'force-dynamic';
/**
 * Admin Payments List
 * 
 * Phase 3: Admin UI - Payment Management
 * 
 * Comprehensive payment listing with:
 * - Filterable table (status, date range, member)
 * - Search functionality
 * - Pagination
 * - Bulk actions
 * - Export capabilities
 * 
 * @module app/dashboard/admin/dues/payments
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Filter,
  Download,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';
import { useRouter } from 'next/navigation';

// =============================================================================
// TYPES
// =============================================================================

interface Payment {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  paidDate: string | null;
  paymentMethod: string | null;
  createdAt: string;
}

interface PaymentsListResponse {
  payments: Payment[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
  const variants: Record<
    string,
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
  > = {
    paid: { variant: 'default', label: 'Paid' }, // Badge labels use option strings from select above
    pending: { variant: 'secondary', label: 'Pending' },
    overdue: { variant: 'destructive', label: 'Overdue' },
    cancelled: { variant: 'outline', label: 'Cancelled' },
  };

  const config = variants[status] || { variant: 'outline' as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AdminPaymentsList() {
  const t = useTranslations('adminPaymentsPage');
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch payments
  const fetchPayments = async () => {
    try {
      setRefreshing(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await fetch(`/api/admin/dues/payments?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }

      const result: PaymentsListResponse = await response.json();
      setPayments(result.payments);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
    } catch (err) {
      logger.error('Error fetching payments', { error: err });
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page on new search
    fetchPayments();
  };

  // Loading state
  if (loading && !refreshing) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="text-center py-12">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">{t('loadingPayments')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        < Card className="border-destructive">
          <CardHeader>
            <CardTitle>{t('errorLoadingPayments')}</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchPayments} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('tryAgainButton')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('pageTitle')}</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('pageDescription')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={fetchPayments} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {t('refreshButton')}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            {t('exportButton')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('filtersTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t('allStatusesPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('statusAll')}</SelectItem>
                  <SelectItem value="paid">{t('statusPaid')}</SelectItem>
                  <SelectItem value="pending">{t('statusPending')}</SelectItem>
                  <SelectItem value="overdue">{t('statusOverdue')}</SelectItem>
                  <SelectItem value="cancelled">{t('statusCancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Button */}
            <Button type="submit" className="w-full md:w-auto">
              <Filter className="mr-2 h-4 w-4" />
              {t('applyFiltersButton')}
            </Button>
          </form>

          {/* Results Summary */}
          <div className="mt-4 text-sm text-muted-foreground">
            {t('showingResults', { current: payments.length, total: totalCount })}
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('allPaymentsTitle')}</CardTitle>
          <CardDescription>
            {t('totalPaymentsCount', { count: totalCount })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t('noPaymentsFound')}</p>
              <p className="text-sm text-muted-foreground">
                {t('noPaymentsDescription')}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('memberColumn')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('dueDateColumn')}</TableHead>
                        <TableHead>{t('amountColumn')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('statusColumn')}</TableHead>
                        <TableHead className="hidden xl:table-cell">{t('paymentMethodColumn')}</TableHead>
                        <TableHead className="hidden xl:table-cell">{t('paidDateColumn')}</TableHead>
                        <TableHead className="text-right">{t('actionsColumn')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{payment.memberName}</span>
                            <span className="text-xs text-muted-foreground">
                              ID: {payment.memberId.substring(0, 8)}...
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatDate(payment.dueDate)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{formatCurrency(payment.amount)}</span>
                            <span className="text-xs text-muted-foreground md:hidden">
                              {t('dueLabel')}: {formatDate(payment.dueDate)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {getStatusBadge(payment.status)}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {payment.paymentMethod ? (
                            <span className="capitalize">{payment.paymentMethod}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {payment.paidDate ? (
                            formatDate(payment.paidDate)
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(`/dashboard/admin/dues/payments/${payment.id}`)
                            }
                          >
                            <Eye className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">{t('viewButton')}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t">
                <div className="text-sm text-muted-foreground">
                  {t('pageInfo', { current: page, total: totalPages })}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || refreshing}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {t('previousButton')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || refreshing}
                  >
                    {t('nextButton')}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
