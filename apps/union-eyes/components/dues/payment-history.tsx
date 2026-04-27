'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
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
import { Download, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/lib/hooks/use-toast';

interface PaymentHistoryItem {
  id: string;
  date: string;
  amount: number;
  lateFeeAmount: number;
  totalAmount: number;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  periodStart: string;
  periodEnd: string;
  receiptUrl?: string;
}

interface PaymentHistoryProps {
  userId: string;
}

export default function PaymentHistory({ userId }: PaymentHistoryProps) {
  const t = useTranslations('dashboard.dues.history');
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadPaymentHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/dues/payment-history?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to load payment history');
      const json = await response.json();
      const items = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      setPayments(items);
    } catch (_error) {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPaymentHistory();
  }, [loadPaymentHistory]);

  const handleDownloadReceipt = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/dues/receipt/${paymentId}`);
      if (!response.ok) throw new Error('Failed to download receipt');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dues-receipt-${paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: t('successTitle'),
        description: t('downloadSuccess'),
      });
    } catch (_error) {
toast({
        title: t('errorTitle'),
        description: t('downloadFailed'),
        variant: 'destructive',
      });
    }
  };

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
                    {new Date(payment.periodStart).toLocaleDateString()} - {new Date(payment.periodEnd).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>
                    {payment.lateFeeAmount > 0 ? formatCurrency(payment.lateFeeAmount) : '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(payment.totalAmount)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {payment.paymentMethod}
                  </TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell>
                    {payment.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownloadReceipt(payment.id)}
                      >
                        <Download className="h-4 w-4" />
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

