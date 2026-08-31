'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import DeductionHistory from './deduction-history';
import ReportDeductionIssue from './report-deduction-issue';
import PaymentHistory from './payment-history';

type BalanceStatus = 'paid_up' | 'owing' | 'credit';

interface LastPayment {
  amount: number;
  date: string;
}

interface DuesBalance {
  source: 'native' | 'unavailable';
  currentBalance: number;
  balanceStatus: BalanceStatus;
  isInArrears: boolean;
  arrearsAmount: number;
  lastPayment: LastPayment | null;
}

interface DuesPaymentPortalProps {
  userId: string;
}

export default function DuesPaymentPortal({ userId }: DuesPaymentPortalProps) {
  const t = useTranslations('dashboard.dues');
  const [balance, setBalance] = useState<DuesBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedDeductionId, setSelectedDeductionId] = useState<string | undefined>();

  const loadDuesBalance = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch(`/api/dues/balance?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to load dues balance');
      const json = await response.json();
      setBalance(json?.data ?? json);
    } catch (_error) {
      // Honest failure state — never fabricate a balance to make the UI render.
      setBalance(null);
      setLoadError(true);
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

  if (!balance || balance.source === 'unavailable' || loadError) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-12">
          <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('unavailableTitle')}</h3>
          <p className="text-muted-foreground">{t('unavailableBody')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-2">
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
            <p className="text-xs text-muted-foreground mt-2">{t('sourceNative')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('membershipStatus')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge
              variant={balance.balanceStatus === 'owing' ? 'destructive' : 'default'}
              className="text-sm"
            >
              {t(`balanceStatus.${balance.balanceStatus}`)}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              {balance.lastPayment
                ? t('lastPayment', {
                    amount: formatCurrency(balance.lastPayment.amount),
                    date: new Date(balance.lastPayment.date).toLocaleDateString(),
                  })
                : t('noLastPayment')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert for Overdue Amounts */}
      {balance.isInArrears && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('overdueBalance')}
            </CardTitle>
            <CardDescription>
              {t('overdueBalanceDescription', { amount: formatCurrency(balance.arrearsAmount) })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Main Tabs — direct payment/autopay are not part of the supported
          surface (see MEMBER_DUES_CONTEXT capability disposition): the
          Stripe payment flow has no reconciliation back into the member's
          dues ledger, and autopay/saved-payment-method management is
          largely unimplemented. Deduction visibility, issue reporting, and
          payment history remain fully supported. */}
      <Tabs defaultValue="deductions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deductions">{t('tabs.deductions')}</TabsTrigger>
          <TabsTrigger value="report-issue">{t('tabs.reportIssue')}</TabsTrigger>
          <TabsTrigger value="history">{t('tabs.history')}</TabsTrigger>
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
      </Tabs>
    </div>
  );
}

