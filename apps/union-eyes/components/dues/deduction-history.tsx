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
import { FileText, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface DeductionItem {
  id: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  unionDuesAmount: number;
  grossPay?: number;
  source: string;
  verified: boolean;
  createdAt: string;
}

interface DeductionHistoryProps {
  userId: string;
  onReportIssue?: (deductionId: string) => void;
}

export default function DeductionHistory({ userId, onReportIssue }: DeductionHistoryProps) {
  const t = useTranslations('dashboard.dues.deductions');
  const [deductions, setDeductions] = useState<DeductionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDeductions = useCallback(async () => {
    try {
      const response = await fetch(`/api/dues/deductions?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to load deductions');
      const json = await response.json();
      const items = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      setDeductions(items);
    } catch (_error) {
      setDeductions([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDeductions();
  }, [loadDeductions]);

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'remittance':
        return t('sources.remittance');
      case 'payroll_api':
        return t('sources.payrollApi');
      case 'pay_stub_upload':
        return t('sources.payStubUpload');
      case 'manual_entry':
        return t('sources.manualEntry');
      default:
        return source;
    }
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
        {deductions.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('empty')}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {t('emptyHint')}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.payPeriod')}</TableHead>
                <TableHead>{t('columns.duesDeducted')}</TableHead>
                <TableHead>{t('columns.grossPay')}</TableHead>
                <TableHead>{t('columns.source')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                {onReportIssue && <TableHead>{t('columns.actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {deductions.map((deduction) => (
                <TableRow key={deduction.id}>
                  <TableCell className="text-sm">
                    {new Date(deduction.payPeriodStart).toLocaleDateString()} –{' '}
                    {new Date(deduction.payPeriodEnd).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(deduction.unionDuesAmount)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {deduction.grossPay ? formatCurrency(deduction.grossPay) : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {getSourceLabel(deduction.source)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={deduction.verified ? 'default' : 'secondary'}>
                      {deduction.verified ? t('verified') : t('pending')}
                    </Badge>
                  </TableCell>
                  {onReportIssue && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReportIssue(deduction.id)}
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        {t('reportIssue')}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
