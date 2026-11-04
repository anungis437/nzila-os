/**
 * Receipt Viewer Page
 * Shows the dues ledger entry behind a payment to the member it belongs to.
 *
 * GET /api/dues/receipt/:id answers the member's own member_dues_ledger entry as JSON. The entry states no union or member name, no breakdown of
 * the amount and no rendered PDF, so this page states none of those either.
 *
 * @module app/dashboard/dues/receipts/[transactionId]/page
 */

'use client';


export const dynamic = 'force-dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Printer, ArrowLeft, FileText, CreditCard, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { ApiShapeError, envelopeRow, readApiError } from '@/lib/client/api-envelope';
import { optionalString, requiredString } from '@/lib/client/row-fields';
import { recordedDay } from '@/lib/client/day';

// =============================================================================
// TYPES
// =============================================================================

// The columns of the member_dues_ledger entry this page reads. `amount` is decimal text; the receipt number, method, reference and period are null
// when the entry does not state them.
interface LedgerReceipt {
  id: string;
  transactionDate: string;
  amount: number;
  status: string;
  description: string;
  receiptNumber: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

function readLedgerReceipt(row: Record<string, unknown>): LedgerReceipt {
  const amount = Number(requiredString(row, 'amount'));
  if (!Number.isFinite(amount)) throw new ApiShapeError('amount is not a number');
  return {
    id: requiredString(row, 'id'),
    transactionDate: requiredString(row, 'transactionDate'),
    amount,
    status: requiredString(row, 'status'),
    description: requiredString(row, 'description'),
    receiptNumber: optionalString(row, 'receiptNumber'),
    paymentMethod: optionalString(row, 'paymentMethod'),
    paymentReference: optionalString(row, 'paymentReference'),
    periodStart: optionalString(row, 'periodStart'),
    periodEnd: optionalString(row, 'periodEnd'),
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

function formatDate(date: string, locale: string): string {
  const parsed = recordedDay(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

// =============================================================================
// RECEIPT COMPONENTS
// =============================================================================

function ReceiptHeader({ receipt }: { receipt: LedgerReceipt }) {
  const t = useTranslations('duesReceiptPage');
  const locale = useLocale();

  return (
    <div className="space-y-2 pb-6 text-center">
      <h2 className="text-xl font-semibold">{t('paymentReceiptTitle')}</h2>
      {receipt.receiptNumber !== null && (
        <Badge variant="outline" className="text-base px-4 py-1">
          {receipt.receiptNumber}
        </Badge>
      )}
      <p className="text-sm text-muted-foreground">{receipt.description}</p>
      <p className="text-sm text-muted-foreground">
        {t('issuedPrefix')}: {formatDate(receipt.transactionDate, locale)}
      </p>
    </div>
  );
}

function ReceiptDetails({ receipt }: { receipt: LedgerReceipt }) {
  const t = useTranslations('duesReceiptPage');
  const locale = useLocale();
  const paymentMethod = receipt.paymentMethod
    ? (t.has(`paymentMethod.${receipt.paymentMethod}`)
        ? t(`paymentMethod.${receipt.paymentMethod}`)
        : receipt.paymentMethod)
    : t('naLabel');
  const status = t.has(`status.${receipt.status}`) ? t(`status.${receipt.status}`) : receipt.status;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center">
          <CreditCard className="h-4 w-4 mr-2" />
          {t('paymentInformationTitle')}
        </h3>
        <div className="space-y-2 pl-6">
          {receipt.periodStart !== null && receipt.periodEnd !== null && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t('billingPeriodLabel')}</span>
              <span className="text-sm font-medium">
                {formatDate(receipt.periodStart, locale)} – {formatDate(receipt.periodEnd, locale)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">{t('paymentDateLabel')}</span>
            <span className="text-sm font-medium">{formatDate(receipt.transactionDate, locale)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">{t('paymentMethodLabel')}</span>
            <span className="text-sm font-medium capitalize">{paymentMethod}</span>
          </div>
          {receipt.paymentReference !== null && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t('referenceLabel')}</span>
              <span className="text-xs font-medium font-mono">{receipt.paymentReference}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">{t('statusLabel')}</span>
            <span className="text-sm font-medium capitalize">{status}</span>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          {t('amountBreakdownTitle')}
        </h3>
        <div className="flex justify-between items-center pl-6 pt-2">
          <span className="text-base font-semibold">{t('totalAmountLabel')}</span>
          <span className="text-2xl font-bold">{formatCurrency(receipt.amount)}</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function ReceiptViewerPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('duesReceiptPage');
  const transactionId = params.transactionId as string;

  const [receipt, setReceipt] = useState<LedgerReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipt = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/dues/receipt/${encodeURIComponent(transactionId)}`);

      if (!response.ok) {
        throw new Error(await readApiError(response, t('failedToFetchReceipt')));
      }

      // The route answers { success, data: { data: <ledger entry> } }.
      setReceipt(readLedgerReceipt(envelopeRow(await response.json())));
    } catch (err) {
      logger.error(t('errorFetchingReceiptLog'), { error: err, transactionId });
      setReceipt(null);
      setError(err instanceof Error ? err.message : t('failedToLoadReceipt'));
    } finally {
      setLoading(false);
    }
  }, [transactionId, t]);

  useEffect(() => {
    if (transactionId) {
      void fetchReceipt();
    }
  }, [transactionId, fetchReceipt]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center min-h-100">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium">{t('loadingReceipt')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error !== null || !receipt) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => router.push(`/${locale}/dashboard/dues`)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backToDuesButton')}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">{t('receiptNotFoundTitle')}</CardTitle>
            <CardDescription role="alert">{error ?? t('failedToLoadReceipt')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void fetchReceipt()}>
                {t('retryButton')}
              </Button>
              <Button onClick={() => router.push(`/${locale}/dashboard/dues`)}>
                {t('returnToDuesDashboardButton')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main receipt UI
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header Actions - Hide on print */}
      <div className="mb-6 print:hidden">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push(`/${locale}/dashboard/dues`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToDuesButton')}
          </Button>

          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            {t('printButton')}
          </Button>
        </div>
      </div>

      {/* Receipt Card */}
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8">
          <ReceiptHeader receipt={receipt} />
          <ReceiptDetails receipt={receipt} />
        </CardContent>
      </Card>

      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-0 {
            border: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
