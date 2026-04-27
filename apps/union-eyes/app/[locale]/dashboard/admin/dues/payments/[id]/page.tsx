'use client';


export const dynamic = 'force-dynamic';
/**
 * Admin Payment Detail View
 * 
 * Phase 3: Admin UI - Payment Detail
 * 
 * Features:
 * - Payment summary with status badge
 * - Member information
 * - Payment breakdown (dues, COPE, PAC, strike fund, late fees)
 * - Transaction details
 * - Payment metadata (frequency, period, invoice)
 * - Audit log/activity history
 * - Admin actions (mark paid, refund, send reminder)
 * 
 * @module app/dashboard/admin/dues/payments/[id]
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  Mail,
  Calendar,
  CreditCard,
  FileText,
  Download,
  Send,
  AlertCircle,
} from 'lucide-react';
import { logger } from '@/lib/logger';

// =============================================================================
// TYPES
// =============================================================================

interface PaymentDetail {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  amount: number;
  status: string;
  dueDate: string;
  paidDate: string | null;
  paymentMethod: string | null;
  transactionReference: string | null;
  createdAt: string;
  updatedAt: string;
  breakdown: {
    duesAmount: number;
    copeAmount: number;
    pacAmount: number;
    strikeFundAmount: number;
    lateFees: number;
  };
  metadata: {
    frequency: string;
    periodStart: string;
    periodEnd: string;
    invoiceNumber: string | null;
  };
  auditLog: Array<{
    action: string;
    timestamp: string;
    userId: string;
    userName: string;
    details: string;
  }>;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

function formatDateTime(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

function getStatusBadge(status: string, t: (key: string) => string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusConfig: Record<string, { variant: any; icon: React.ReactNode; label: string }> = {
    paid: {
      variant: 'default',
      icon: <CheckCircle className="h-3 w-3 mr-1" />,
      label: t('status.paid'),
    },
    pending: {
      variant: 'secondary',
      icon: <Clock className="h-3 w-3 mr-1" />,
      label: t('status.pending'),
    },
    overdue: {
      variant: 'destructive',
      icon: <AlertCircle className="h-3 w-3 mr-1" />,
      label: t('status.overdue'),
    },
    cancelled: {
      variant: 'outline',
      icon: <XCircle className="h-3 w-3 mr-1" />,
      label: t('status.cancelled'),
    },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge variant={config.variant} className="flex items-center w-fit">
      {config.icon}
      {config.label}
    </Badge>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PaymentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const t = useTranslations('adminDuesPaymentDetailPage');
  const locale = useLocale();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch payment details
  useEffect(() => {
    const fetchPayment = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/dues/payments/${params.id}`);

        if (!response.ok) {
          throw new Error(t('failedToFetchPaymentDetails'));
        }

        const result = await response.json();
        setPayment(result);
      } catch (err) {
        logger.error(t('errorFetchingPaymentDetailsLog'), { error: err, paymentId: params.id });
        setError(t('failedToLoadPaymentDetails'));
      } finally {
        setLoading(false);
      }
    };

    fetchPayment();
  }, [params.id, t]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backButton')}
          </Button>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">{t('loadingPaymentDetails')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !payment) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backButton')}
          </Button>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">{error || t('paymentNotFound')}</p>
            </div>
            <Button onClick={() => router.back()} className="mt-4">
              {t('goBackButton')}
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
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backButton')}
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('transactionIdLabel')}: {payment.id.substring(0, 8)}...
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            {t('downloadInvoiceButton')}
          </Button>
          <Button variant="outline" size="sm">
            <Send className="h-4 w-4 mr-2" />
            {t('sendReminderButton')}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('paymentSummaryTitle')}</CardTitle>
                {getStatusBadge(payment.status, t)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('totalAmountLabel')}</p>
                  <p className="text-3xl font-bold">{formatCurrency(payment.amount, locale)}</p>
                </div>
                <DollarSign className="h-12 w-12 text-muted-foreground opacity-20" />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('dueDateLabel')}</p>
                  <p className="font-medium">{formatDate(payment.dueDate, locale)}</p>
                </div>
                {payment.paidDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t('paidDateLabel')}</p>
                    <p className="font-medium">{formatDate(payment.paidDate, locale)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>{t('paymentBreakdownTitle')}</CardTitle>
              <CardDescription>{t('paymentBreakdownDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">{t('unionDuesLabel')}</span>
                  <span className="font-medium">{formatCurrency(payment.breakdown.duesAmount, locale)}</span>
                </div>
                {payment.breakdown.copeAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('copeContributionLabel')}</span>
                    <span className="font-medium">{formatCurrency(payment.breakdown.copeAmount, locale)}</span>
                  </div>
                )}
                {payment.breakdown.pacAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('pacContributionLabel')}</span>
                    <span className="font-medium">{formatCurrency(payment.breakdown.pacAmount, locale)}</span>
                  </div>
                )}
                {payment.breakdown.strikeFundAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('strikeFundLabel')}</span>
                    <span className="font-medium">
                      {formatCurrency(payment.breakdown.strikeFundAmount, locale)}
                    </span>
                  </div>
                )}
                {payment.breakdown.lateFees > 0 && (
                  <div className="flex justify-between items-center text-red-600">
                    <span className="text-sm">{t('lateFeesLabel')}</span>
                    <span className="font-medium">{formatCurrency(payment.breakdown.lateFees, locale)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center font-bold">
                  <span>{t('totalLabel')}</span>
                  <span>{formatCurrency(payment.amount, locale)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Details */}
          <Card>
            <CardHeader>
              <CardTitle>{t('transactionDetailsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start space-x-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('paymentMethodLabel')}</p>
                    <p className="font-medium">{payment.paymentMethod || t('notSpecified')}</p>
                  </div>
                </div>

                {payment.transactionReference && (
                  <div className="flex items-start space-x-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('referenceNumberLabel')}</p>
                      <p className="font-medium font-mono text-xs">
                        {payment.transactionReference}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start space-x-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('billingPeriodLabel')}</p>
                    <p className="font-medium text-sm">
                      {formatDate(payment.metadata.periodStart, locale)} -{' '}
                      {formatDate(payment.metadata.periodEnd, locale)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('frequencyLabel')}</p>
                    <p className="font-medium capitalize">
                      {payment.metadata.frequency.replace('_', '-')}
                    </p>
                  </div>
                </div>
              </div>

              {payment.metadata.invoiceNumber && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('invoiceNumberLabel')}</p>
                      <p className="font-medium">{payment.metadata.invoiceNumber}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      {t('downloadButton')}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Activity Log */}
          {payment.auditLog.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('activityLogTitle')}</CardTitle>
                <CardDescription>{t('activityLogDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {payment.auditLog.map((log, index) => (
                    <div key={index} className="flex items-start space-x-3 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{log.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(log.timestamp, locale)}
                          </p>
                        </div>
                        <p className="text-muted-foreground">{t('byUser', { user: log.userName })}</p>
                        {log.details && <p className="text-xs mt-1">{log.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-6">
          {/* Member Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('memberInformationTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('nameLabel')}</p>
                  <p className="font-medium">{payment.memberName}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('emailLabel')}</p>
                  <p className="font-medium text-sm">{payment.memberEmail}</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground">{t('memberIdLabel')}</p>
                <p className="font-medium font-mono text-xs">{payment.memberId}</p>
              </div>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => router.push(`/dashboard/admin/members/${payment.memberId}`)}
              >
                {t('viewMemberProfileButton')}
              </Button>
            </CardContent>
          </Card>

          {/* Admin Actions */}
          <Card>
            <CardHeader>
              <CardTitle>{t('adminActionsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {payment.status === 'pending' && (
                <Button className="w-full" variant="default">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('markAsPaidButton')}
                </Button>
              )}

              {payment.status === 'paid' && (
                <Button className="w-full" variant="outline">
                  {t('initiateRefundButton')}
                </Button>
              )}

              <Button className="w-full" variant="outline">
                <Send className="h-4 w-4 mr-2" />
                {t('sendPaymentReminderButton')}
              </Button>

              <Button className="w-full" variant="outline">
                {t('editPaymentButton')}
              </Button>

              {payment.status !== 'cancelled' && (
                <Button className="w-full" variant="destructive">
                  <XCircle className="h-4 w-4 mr-2" />
                  {t('cancelPaymentButton')}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('systemInformationTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">{t('createdLabel')}</p>
                <p className="font-medium">{formatDateTime(payment.createdAt, locale)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('lastUpdatedLabel')}</p>
                <p className="font-medium">{formatDateTime(payment.updatedAt, locale)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
