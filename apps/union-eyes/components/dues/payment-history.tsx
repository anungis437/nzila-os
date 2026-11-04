'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { envelopeRows, readApiError } from '@/lib/client/api-envelope';

// What GET /api/dues/payment-history sends for each posted, pending, reversed or voided payment of the signed-in member. The period and the
// method are null when the ledger entry does not state them.
interface PaymentHistoryItem {
  id: string;
  date: string;
  amount: number;
  lateFeeAmount: number;
  totalAmount: number;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

interface PaymentHistoryProps {
  userId: string;
}

export default function PaymentHistory({ userId }: PaymentHistoryProps) {
  const t = useTranslations('dashboard.dues.history');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPaymentHistory = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // The server knows who is asking; the request names nobody. The route answers { success, data: { data: rows } }.
      const response = await fetch('/api/dues/payment-history');
      if (!response.ok) throw new Error(await readApiError(response, tErrors('loadingError')));
      setPayments(envelopeRows(await response.json()) as PaymentHistoryItem[]);
    } catch (error) {
      setPayments([]);
      setLoadError(error instanceof Error ? error.message : tErrors('loadingError'));
    } finally {
      setLoading(false);
    }
  }, [tErrors]);

  useEffect(() => {
    loadPaymentHistory();
  }, [loadPaymentHistory, userId]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      pending: 'secondary',
      failed: 'destructive',
      refunded: 'outline',
    };

    const labelKey = (['completed', 'pending', 'failed', 'refunded'].includes(status) ? status : 'pending') as 'completed' | 'pending' | 'failed' | 'refunded';
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {t(`status.${labelKey}`)}
      </Badge>
    );
  };

  if (loading) {
    return <div className="text-center p-12">{t('loading')}</div>;
  }

  if (loadError !== null) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <p role="alert" className="text-muted-foreground">{loadError}</p>
          <Button variant="outline" className="mt-4" onClick={() => void loadPaymentHistory()}>
            {tCommon('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('empty')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.date')}</TableHead>
                <TableHead>{t('columns.period')}</TableHead>
                <TableHead>{t('columns.amount')}</TableHead>
                <TableHead>{t('columns.lateFee')}</TableHead>
                <TableHead>{t('columns.total')}</TableHead>
                <TableHead>{t('columns.method')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                <TableHead>{t('columns.receipt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    {new Date(payment.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {payment.periodStart !== null && payment.periodEnd !== null
                      ? `${new Date(payment.periodStart).toLocaleDateString()} - ${new Date(payment.periodEnd).toLocaleDateString()}`
                      : '—'}
                  </TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>
                    {payment.lateFeeAmount > 0 ? formatCurrency(payment.lateFeeAmount) : '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(payment.totalAmount)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {payment.paymentMethod ?? '—'}
                  </TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell>
                    {payment.status === 'completed' && (
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/${locale}/dashboard/dues/receipts/${payment.id}`} aria-label={t('columns.receipt')}>
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

