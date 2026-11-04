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
import { envelopeRows, readApiError } from '@/lib/client/api-envelope';

// The columns GET /api/dues/deductions selects: numeric columns arrive as decimal text, and gross pay is null when the source did not state it.
interface DeductionItem {
  id: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  unionDuesAmount: string;
  grossPay: string | null;
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
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const [deductions, setDeductions] = useState<DeductionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDeductions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // The server knows who is asking; the request names nobody.
      const response = await fetch('/api/dues/deductions');
      if (!response.ok) throw new Error(await readApiError(response, tErrors('loadingError')));
      // The route answers { success, data: { data: rows } }: the framework's envelope around the route's own { data } body.
      setDeductions(envelopeRows(await response.json()) as DeductionItem[]);
    } catch (error) {
      setDeductions([]);
      setLoadError(error instanceof Error ? error.message : tErrors('loadingError'));
    } finally {
      setLoading(false);
    }
  }, [tErrors]);

  // The list belongs to the signed-in member, so it is fetched again when the member shown changes.
  useEffect(() => {
    loadDeductions();
  }, [loadDeductions, userId]);

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

  if (loadError !== null) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <p role="alert" className="text-muted-foreground">{loadError}</p>
          <Button variant="outline" className="mt-4" onClick={() => void loadDeductions()}>
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
                    {formatCurrency(Number(deduction.unionDuesAmount))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {deduction.grossPay !== null ? formatCurrency(Number(deduction.grossPay)) : '—'}
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
