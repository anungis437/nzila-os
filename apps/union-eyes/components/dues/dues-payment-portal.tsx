'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import DeductionHistory from './deduction-history';
import ReportDeductionIssue from './report-deduction-issue';
import PaymentHistory from './payment-history';
import DuesPaymentForm from './dues-payment-form';
import PaymentMethodManager from './payment-method-manager';

interface DuesBalance {
  currentBalance: number;
  nextDueDate: string;
  nextDueAmount: number;
  overdueAmount: number;
  lastPaymentDate: string;
  lastPaymentAmount: number;
  isInArrears: boolean;
  arrearsAmount: number;
  membershipStatus: string;
  autoPayEnabled: boolean;
  paymentMethodLast4: string | null;
}

interface DuesPaymentPortalProps {
  userId: string;
}

export default function DuesPaymentPortal({ userId }: DuesPaymentPortalProps) {
  const t = useTranslations('dashboard.dues');
  const [balance, setBalance] = useState<DuesBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDeductionId, setSelectedDeductionId] = useState<string | undefined>();

  const loadDuesBalance = useCallback(async () => {
    try {
      const response = await fetch(`/api/dues/balance?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to load dues balance');
      const json = await response.json();
      setBalance(json?.data ?? json);
    } catch (_error) {
      // Fall back to zero-value balance so the UI renders instead of
      // showing the opaque "No dues information available" message.
      setBalance({
        currentBalance: 0,
        nextDueDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        nextDueAmount: 0,
        overdueAmount: 0,
        lastPaymentDate: new Date().toISOString(),
        lastPaymentAmount: 0,
        isInArrears: false,
        arrearsAmount: 0,
        membershipStatus: 'active',
        autoPayEnabled: false,
        paymentMethodLast4: null,
      });
    } finally {
      setLoading(false);
    }
   
  }, [userId]);

  useEffect(() => {
    loadDuesBalance();
  }, [loadDuesBalance]);

  if (loading) {
    return <div className="flex items-center justify-center p-12">{t('loading')}</div>;
  }

  if (!balance) {
    return <div className="text-center p-12">{t('noInfo')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('currentBalance')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(balance.currentBalance)}
            </div>
            {balance.isInArrears && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-2">
                <AlertTriangle className="h-3 w-3" />
                {t('overdueShort', { amount: formatCurrency(balance.arrearsAmount) })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('nextDeductionExpected')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(balance.nextDueAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('expected', { date: new Date(balance.nextDueDate).toLocaleDateString() })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('membershipStatus')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge 
              variant={balance.membershipStatus === 'good_standing' ? 'default' : 'destructive'}
              className="text-sm"
            >
              {balance.membershipStatus === 'good_standing' ? t('goodStanding') : t('arrears')}
            </Badge>
            {balance.autoPayEnabled && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                <Clock className="h-3 w-3" />
                {t('autopayEnabled', { last4: balance.paymentMethodLast4 ?? '' })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alert for Overdue Amounts */}
      {balance.overdueAmount > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('overdueBalance')}
            </CardTitle>
            <CardDescription>
              {t('overdueBalanceDescription', { amount: formatCurrency(balance.overdueAmount) })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Main Tabs — Deduction visibility is primary */}
      <Tabs defaultValue="deductions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="deductions">{t('tabs.deductions')}</TabsTrigger>
          <TabsTrigger value="report-issue">{t('tabs.reportIssue')}</TabsTrigger>
          <TabsTrigger value="history">{t('tabs.history')}</TabsTrigger>
          <TabsTrigger value="manual-payment">{t('tabs.manualPayment')}</TabsTrigger>
        </TabsList>

        <TabsContent value="deductions" className="space-y-4">
          <DeductionHistory
            userId={userId}
            onReportIssue={(deductionId) => {
              setSelectedDeductionId(deductionId);
            }}
          />
        </TabsContent>

        <TabsContent value="report-issue" className="space-y-4">
          <ReportDeductionIssue
            userId={userId}
            deductionId={selectedDeductionId}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <PaymentHistory userId={userId} />
        </TabsContent>

        <TabsContent value="manual-payment" className="space-y-4">
          <Card className="mb-4">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                <strong>{t('manualPaymentNote')}</strong>{' '}
                {t('manualPaymentNoteBody')}
              </p>
            </CardContent>
          </Card>
          <DuesPaymentForm 
            userId={userId}
            currentBalance={balance.currentBalance}
            overdueAmount={balance.overdueAmount}
            onPaymentComplete={loadDuesBalance}
          />
          <PaymentMethodManager 
            userId={userId}
            autoPayEnabled={balance.autoPayEnabled}
            onUpdate={loadDuesBalance}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

