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
import { format } from 'date-fns';
import { logger } from '@/lib/logger';

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

function formatCurrency(amount: string | number): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(numAmount);
}

function formatDate(date: string | null): string {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), 'MMMM dd, yyyy');
  } catch {
    return 'Invalid date';
  }
}

// =============================================================================
// TRANSACTION SUMMARY COMPONENT
// =============================================================================

function TransactionSummary({ transaction }: { transaction: DuesTransaction }) {
  const isDue = new Date(transaction.dueDate) < new Date();
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Payment Summary</CardTitle>
          {isDue && (
            <Badge variant="destructive" className="ml-2">
              Overdue
            </Badge>
          )}
        </div>
        <CardDescription>
          Dues period: {formatDate(transaction.periodStart)} - {formatDate(transaction.periodEnd)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Due Date */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Due Date</span>
          </div>
          <span className={`text-sm font-medium ${isDue ? 'text-destructive' : ''}`}>
            {formatDate(transaction.dueDate)}
          </span>
        </div>

        <Separator />

        {/* Amount Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Dues</span>
            <span className="font-medium">{formatCurrency(transaction.duesAmount)}</span>
          </div>

          {parseFloat(transaction.copeAmount) > 0 && (
            <div className="flex justify-between text-sm">
              <span>COPE Contribution</span>
              <span className="font-medium">{formatCurrency(transaction.copeAmount)}</span>
            </div>
          )}

          {parseFloat(transaction.pacAmount) > 0 && (
            <div className="flex justify-between text-sm">
              <span>PAC Contribution</span>
              <span className="font-medium">{formatCurrency(transaction.pacAmount)}</span>
            </div>
          )}

          {parseFloat(transaction.strikeFundAmount) > 0 && (
            <div className="flex justify-between text-sm">
              <span>Strike Fund</span>
              <span className="font-medium">{formatCurrency(transaction.strikeFundAmount)}</span>
            </div>
          )}

          {parseFloat(transaction.lateFeeAmount) > 0 && (
            <div className="flex justify-between text-sm text-destructive">
              <span>Late Fee</span>
              <span className="font-medium">{formatCurrency(transaction.lateFeeAmount)}</span>
            </div>
          )}

          {parseFloat(transaction.adjustmentAmount) !== 0 && (
            <div className="flex justify-between text-sm">
              <span>Adjustment</span>
              <span className="font-medium">{formatCurrency(transaction.adjustmentAmount)}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between items-center pt-2">
          <span className="text-lg font-semibold">Total Amount</span>
          <span className="text-2xl font-bold">{formatCurrency(transaction.totalAmount)}</span>
        </div>

        {/* Additional Info */}
        <div className="pt-4 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            <FileText className="h-3 w-3" />
            <span>Transaction ID: {transaction.id.slice(0, 8)}...</span>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
        <CardDescription>Select how you&apos;d like to pay</CardDescription>
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
              <div className="font-semibold">Credit or Debit Card</div>
              <div className="text-sm text-muted-foreground">
                Pay securely with Visa, Mastercard, or American Express
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
              <div className="font-semibold">Bank Transfer (ACH)</div>
              <div className="text-sm text-muted-foreground">Coming soon</div>
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
          throw new Error('Failed to fetch transaction');
        }

        const data = await response.json();
        const txn = data.transactions.find((t: DuesTransaction) => t.id === transactionId);
        
        if (!txn) {
          throw new Error('Transaction not found');
        }

        // Check if already paid
        if (txn.status === 'paid') {
          setSuccess(true);
        }

        setTransaction(txn);
      } catch (err) {
        logger.error('Error fetching transaction', { error: err, transactionId });
        setError(err instanceof Error ? err.message : 'Failed to load transaction');
      } finally {
        setLoading(false);
      }
    }

    if (transactionId) {
      fetchTransaction();
    }
  }, [transactionId]);

  // Handle payment initiation
  const handlePaymentMethodSelected = async (method: string) => {
    if (!transaction) return;

    try {
      setProcessing(true);
      setError(null);

      logger.info('Initiating payment', { transactionId, method });

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
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data: CheckoutSession = await response.json();

      // Redirect to checkout
      if (data.url) {
        const safeUrl = validateRedirectUrl(data.url);
        if (!safeUrl) throw new Error('Untrusted checkout URL');
        window.location.href = safeUrl;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      logger.error('Error creating checkout session', { error: err, transactionId });
      setError(err instanceof Error ? err.message : 'Failed to start payment process');
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
            <p className="text-base md:text-lg font-medium">Loading payment details...</p>
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
          onClick={() => router.push('/dashboard/dues')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dues
        </Button>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || 'Failed to load transaction details'}
          </AlertDescription>
        </Alert>

        <div className="mt-6">
          <Button onClick={() => router.push('/dashboard/dues')}>
            Return to Dues Dashboard
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
          onClick={() => router.push('/dashboard/dues')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dues
        </Button>

        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Payment Complete</AlertTitle>
          <AlertDescription>
            This transaction has already been paid.
          </AlertDescription>
        </Alert>

        <div className="mt-6">
          <Button onClick={() => router.push('/dashboard/dues')}>
            Return to Dues Dashboard
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
          onClick={() => router.push('/dashboard/dues')}
          disabled={processing}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Complete Payment</h1>
          <p className="text-sm md:text-base text-muted-foreground">Review and pay your union dues</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Payment Error</AlertTitle>
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
                  <div className="font-medium mb-1">Secure Payment</div>
                  <p className="text-muted-foreground">
                    Your payment information is encrypted and secure. We never store your card details.
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
                  <h3 className="text-lg font-semibold mb-2">Processing Payment</h3>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we set up your secure payment...
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
