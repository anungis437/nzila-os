/**
 * Payment Checkout Page
 * Complete payment for a specific dues transaction
 * 
 * @module app/dashboard/dues/pay/[transactionId]/page
 */

'use client';


export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { validateRedirectUrl } from '@/lib/utils/sanitize';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  ArrowLeft,
  Calendar,
  DollarSign,
  FileText,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface DuesTransaction {
  id: string;
  organizationId: string;
  transactionType: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  duesAmount: string;
  copeAmount: string;
  pacAmount: string;
  strikeFundAmount: string;
  lateFeeAmount: string;
  adjustmentAmount: string;
  totalAmount: string;
  paidDate: string | null;
  paymentMethod: string | null;
  processorType: string | null;
  receiptUrl: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface CheckoutSession {
  url: string;
  sessionId: string;
}

// =============================================================================
// UTILITIES
// =============================================================================

function formatDate(date: string | null, locale: string, t: (key: string) => string): string {
  if (!date) return t('naLabel');
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    }).format(new Date(date));
  } catch {
    return t('invalidDate');
  }
}

// =============================================================================
// TRANSACTION SUMMARY COMPONENT
// =============================================================================

function TransactionSummary({ transaction }: { transaction: DuesTransaction }) {
  const t = useTranslations('duesPayPage');
  const locale = useLocale();
  const isDue = new Date(transaction.dueDate) < new Date();
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('paymentSummaryTitle')}</CardTitle>
          {isDue && (
            <Badge variant="destructive" className="ml-2">
              {t('statusOverdue')}
            </Badge>
          )}
        </div>
        <CardDescription>
          {t('duesPeriodLabel')}: {formatDate(transaction.periodStart, locale, t)} - {formatDate(transaction.periodEnd, locale, t)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Due Date */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('dueDateLabel')}</span>
          </div>
          <span className={`text-sm font-medium ${isDue ? 'text-destructive' : ''}`}>
            {formatDate(transaction.dueDate, locale, t)}
          </span>
        </div>

        <Separator />

        {/* Amount Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t('duesLabel')}</span>
            <span className="font-medium">{formatCurrency(Number(transaction.duesAmount))}</span>
          </div>

          {parseFloat(transaction.copeAmount) > 0 && (
            <div className="flex justify-between text-sm">
              <span>{t('copeContributionLabel')}</span>
              <span className="font-medium">{formatCurrency(Number(transaction.copeAmount))}</span>
            </div>
          )}

          {parseFloat(transaction.pacAmount) > 0 && (
            <div className="flex justify-between text-sm">
              <span>{t('pacContributionLabel')}</span>
              <span className="font-medium">{formatCurrency(Number(transaction.pacAmount))}</span>
            </div>
          )}

          {parseFloat(transaction.strikeFundAmount) > 0 && (
            <div className="flex justify-between text-sm">
              <span>{t('strikeFundLabel')}</span>
              <span className="font-medium">{formatCurrency(Number(transaction.strikeFundAmount))}</span>
            </div>
          )}

          {parseFloat(transaction.lateFeeAmount) > 0 && (
            <div className="flex justify-between text-sm text-destructive">
              <span>{t('lateFeeLabel')}</span>
              <span className="font-medium">{formatCurrency(Number(transaction.lateFeeAmount))}</span>
            </div>
          )}

          {parseFloat(transaction.adjustmentAmount) !== 0 && (
            <div className="flex justify-between text-sm">
              <span>{t('adjustmentLabel')}</span>
              <span className="font-medium">{formatCurrency(Number(transaction.adjustmentAmount))}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between items-center pt-2">
          <span className="text-lg font-semibold">{t('totalAmountLabel')}</span>
          <span className="text-2xl font-bold">{formatCurrency(Number(transaction.totalAmount))}</span>
        </div>

        {/* Additional Info */}
        <div className="pt-4 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            <FileText className="h-3 w-3" />
            <span>{t('transactionIdLabel')}: {transaction.id.slice(0, 8)}...</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// PAYMENT METHOD SELECTOR COMPONENT
// =============================================================================

function PaymentMethodSelector({
  onPaymentMethodSelected,
  loading,
}: {
  onPaymentMethodSelected: (method: string) => void;
  loading: boolean;
}) {
  const t = useTranslations('duesPayPage');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('paymentMethodTitle')}</CardTitle>
        <CardDescription>{t('paymentMethodDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credit/Debit Card */}
        <Button
          variant="outline"
          className="w-full h-auto py-4 justify-start"
          onClick={() => onPaymentMethodSelected('card')}
          disabled={loading}
        >
          <div className="flex items-center space-x-4 w-full">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold">{t('cardOptionTitle')}</div>
              <div className="text-sm text-muted-foreground">
                {t('cardOptionDescription')}
              </div>
            </div>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </Button>

        {/* Future: ACH/Bank Transfer */}
        <Button
          variant="outline"
          className="w-full h-auto py-4 justify-start opacity-50 cursor-not-allowed"
          disabled
        >
          <div className="flex items-center space-x-4 w-full">
            <div className="p-2 bg-muted rounded-lg">
              <DollarSign className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold">{t('bankTransferOptionTitle')}</div>
              <div className="text-sm text-muted-foreground">{t('bankTransferOptionDescription')}</div>
            </div>
          </div>
        </Button>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function PaymentCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('duesPayPage');
  const transactionId = params.transactionId as string;

  const [transaction, setTransaction] = useState<DuesTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch transaction details
  useEffect(() => {
    async function fetchTransaction() {
      try {
        setLoading(true);
        const response = await fetch('/api/members/dues');
        
        if (!response.ok) {
          throw new Error(t('failedToFetchTransaction'));
        }

        const data = await response.json();
        const txn = data.transactions.find((t: DuesTransaction) => t.id === transactionId);
        
        if (!txn) {
          throw new Error(t('transactionNotFound'));
        }

        // Check if already paid
        if (txn.status === 'paid') {
          setSuccess(true);
        }

        setTransaction(txn);
      } catch (err) {
        logger.error(t('errorFetchingTransactionLog'), { error: err, transactionId });
        setError(err instanceof Error ? err.message : t('failedToLoadTransaction'));
      } finally {
        setLoading(false);
      }
    }

    if (transactionId) {
      fetchTransaction();
    }
  }, [transactionId, t]);

  // Handle payment initiation
  const handlePaymentMethodSelected = async (method: string) => {
    if (!transaction) return;

    try {
      setProcessing(true);
      setError(null);

      logger.info(t('initiatingPaymentLog'), { transactionId, method });

      // Create checkout session
      const response = await fetch('/api/payments/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          paymentMethod: method,
          successUrl: `${window.location.origin}/dashboard/dues?payment=success`,
          cancelUrl: `${window.location.origin}/dashboard/dues/pay/${transaction.id}?payment=cancelled`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('failedToCreateCheckoutSession'));
      }

      const data: CheckoutSession = await response.json();

      // Redirect to checkout
      if (data.url) {
        const safeUrl = validateRedirectUrl(data.url);
        if (!safeUrl) throw new Error(t('untrustedCheckoutUrl'));
        window.location.href = safeUrl;
      } else {
        throw new Error(t('noCheckoutUrlReceived'));
      }
    } catch (err) {
      logger.error(t('errorCreatingCheckoutSessionLog'), { error: err, transactionId });
      setError(err instanceof Error ? err.message : t('failedToStartPaymentProcess'));
      setProcessing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <div className="flex items-center justify-center min-h-100">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-base md:text-lg font-medium">{t('loadingPaymentDetails')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !transaction) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => router.push(`/${locale}/dashboard/dues`)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backToDuesButton')}
        </Button>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('errorTitle')}</AlertTitle>
          <AlertDescription>
            {error || t('failedToLoadTransactionDetails')}
          </AlertDescription>
        </Alert>

        <div className="mt-6">
          <Button onClick={() => router.push(`/${locale}/dashboard/dues`)}>
            {t('returnToDuesDashboardButton')}
          </Button>
        </div>
      </div>
    );
  }

  // Success state (already paid)
  if (success) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => router.push(`/${locale}/dashboard/dues`)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backToDuesButton')}
        </Button>

        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>{t('paymentCompleteTitle')}</AlertTitle>
          <AlertDescription>
            {t('alreadyPaidDescription')}
          </AlertDescription>
        </Alert>

        <div className="mt-6">
          <Button onClick={() => router.push(`/${locale}/dashboard/dues`)}>
            {t('returnToDuesDashboardButton')}
          </Button>
        </div>
      </div>
    );
  }

  // Main checkout UI
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
        <Button
          variant="ghost"
          onClick={() => router.push(`/${locale}/dashboard/dues`)}
          disabled={processing}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backButton')}
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('completePaymentTitle')}</h1>
          <p className="text-sm md:text-base text-muted-foreground">{t('completePaymentSubtitle')}</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('paymentErrorTitle')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Transaction Summary */}
        <div>
          <TransactionSummary transaction={transaction} />
        </div>

        {/* Right Column - Payment Method */}
        <div>
          <PaymentMethodSelector
            onPaymentMethodSelected={handlePaymentMethodSelected}
            loading={processing}
          />

          {/* Security Notice */}
          <Card className="mt-6 border-muted">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-green-100 rounded-lg shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 text-sm">
                  <div className="font-medium mb-1">{t('securePaymentTitle')}</div>
                  <p className="text-muted-foreground">
                    {t('securePaymentDescription')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Processing Overlay */}
      {processing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">{t('processingPaymentTitle')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('processingPaymentDescription')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
