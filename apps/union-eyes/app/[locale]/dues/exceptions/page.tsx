/**
 * Dues Exception Queue
 *
 * Review and resolve unmatched deductions, amount mismatches,
 * and remittance exceptions that require manual intervention.
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface RemittanceException {
  id: string;
  remittanceId: string;
  employeeName: string | null;
  employeeNumber: string | null;
  amount: string;
  lineStatus: string;
  exceptionReason: string | null;
  createdAt: string;
}

export default function DuesExceptionsPage() {
  const router = useRouter();
  const t = useTranslations('dues.exceptions');
  const [exceptions, setExceptions] = useState<RemittanceException[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExceptions = useCallback(async () => {
    try {
      const res = await fetch('/api/dues/exceptions');
      if (!res.ok) throw new Error('Failed to fetch exceptions');
      const body = await res.json();
      setExceptions(body.data ?? []);
    } catch (error) {
      logger.error('Error fetching exceptions', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'exception':
        return 'bg-red-100 text-red-800';
      case 'manual_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getReasonLabel = (reason: string | null) => {
    switch (reason) {
      case 'member_not_found':
        return 'Member Not Found';
      case 'amount_mismatch':
        return 'Amount Mismatch';
      case 'duplicate':
        return 'Duplicate Entry';
      case 'invalid_data':
        return 'Invalid Data';
      default:
        return reason ?? 'Unknown';
    }
  };

  if (loading) {
    return <div className="container mx-auto py-6">{t('loading')}</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2 text-sm text-muted-foreground items-center">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          <span>{exceptions.length} {t('itemsRequiringReview')}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-sm text-muted-foreground">{t('exceptions')}</p>
              <p className="text-2xl font-bold text-red-600">
                {exceptions.filter(e => e.lineStatus === 'exception').length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-sm text-muted-foreground">{t('manualReview')}</p>
              <p className="text-2xl font-bold text-yellow-600">
                {exceptions.filter(e => e.lineStatus === 'manual_review').length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">{t('pending')}</p>
              <p className="text-2xl font-bold text-blue-600">
                {exceptions.filter(e => e.lineStatus === 'pending').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Exceptions Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('employee')}</TableHead>
              <TableHead>{t('employeeNumber')}</TableHead>
              <TableHead>{t('amount')}</TableHead>
              <TableHead>{t('reason')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('date')}</TableHead>
              <TableHead>{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exceptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('noExceptions')}
                </TableCell>
              </TableRow>
            ) : (
              exceptions.map((exc) => (
                <TableRow key={exc.id}>
                  <TableCell className="font-medium">
                    {exc.employeeName ?? t('unknown')}
                  </TableCell>
                  <TableCell>{exc.employeeNumber ?? '—'}</TableCell>
                  <TableCell>{formatCurrency(parseFloat(exc.amount))}</TableCell>
                  <TableCell>
                    <Badge className="bg-orange-100 text-orange-800">
                      {getReasonLabel(exc.exceptionReason)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(exc.lineStatus)}>
                      {exc.lineStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(exc.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/dues/reconcile?highlight=${exc.remittanceId}`)}
                    >
                      {t('review')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
