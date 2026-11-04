/**
 * Invoices List Page
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ApiShapeError, isRecord, readApiError } from '@/lib/client/api-envelope';
import { formatDay } from '@/lib/client/day';

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  status: string;
  issueDate: string;
  dueDate: string;
  amountPaid: string;
}

const PAGE_SIZE = 50;

export default function InvoicesPage() {
  const t = useTranslations('financeInvoicesPage');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const locale = useParams<{ locale: string }>().locale ?? 'en';
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GET /api/finance/invoices answers { success, data: [invoice, ...], meta } with the newest invoice first; a full page means there may be more.
  const readPage = useCallback(
    async (offset: number): Promise<Invoice[]> => {
      const res = await fetch(`/api/finance/invoices?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!res.ok) throw new Error(await readApiError(res, t('errors.failedLoad')));
      const body: unknown = await res.json();
      if (!isRecord(body) || !Array.isArray(body.data)) throw new ApiShapeError('no invoice list');
      return body.data as Invoice[];
    },
    [t],
  );

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await readPage(0);
      setInvoices(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setInvoices([]);
      setHasMore(false);
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [readPage, t]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await readPage(invoices.length);
      setInvoices((current) => [...current, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'default';
      case 'overdue': return 'destructive';
      case 'issued': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Card className="p-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full mb-2" />
          ))}
        </Card>
      </div>
    );
  }

  if (error && invoices.length === 0) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p role="alert" className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => void fetchInvoices()}>
            {tCommon('retry')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" /> {t('title')}
        </h1>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {invoices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t('empty')}</p>
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.invoiceNumber')}</TableHead>
                <TableHead>{t('table.totalCad')}</TableHead>
                <TableHead>{t('table.paidCad')}</TableHead>
                <TableHead>{t('table.balanceDue')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead>{t('table.issueDate')}</TableHead>
                <TableHead>{t('table.dueDate')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/${locale}/dashboard/finance/invoices/${inv.id}`)}
                >
                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell>{formatCurrency(Number(inv.totalAmount))}</TableCell>
                  <TableCell>{formatCurrency(Number(inv.amountPaid))}</TableCell>
                  <TableCell>{formatCurrency(Number(inv.totalAmount) - Number(inv.amountPaid))}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(inv.status)}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell>{formatDay(inv.issueDate, undefined, 'numeric')}</TableCell>
                  <TableCell>{formatDay(inv.dueDate, undefined, 'numeric')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
