/**
 * Receipt Viewer Page
 * View and download receipt for a paid dues transaction
 * 
 * @module app/dashboard/dues/receipts/[transactionId]/page
 */

'use client';


export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Printer,
  CheckCircle2,
  ArrowLeft,
  FileText,
  CreditCard,
  Building2,
  User,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';

// =============================================================================
// TYPES
// =============================================================================

interface ReceiptData {
  receiptNumber: string;
  paymentDate: string;
  generatedAt?: string;
  unionName: string;
  unionAddress?: string;
  unionPhone?: string;
  unionEmail?: string;
  memberName: string;
  memberNumber: string;
  memberEmail?: string;
  duesAmount: string;
  copeAmount?: string;
  pacAmount?: string;
  strikeFundAmount?: string;
  lateFee?: string;
  adjustmentAmount?: string;
  totalAmount: string;
  paymentMethod: string;
  paymentReference?: string;
  billingPeriod?: string;
  transaction?: {
    id: string;
    periodStart: string;
    periodEnd: string;
    amount: number;
    lateFee: number;
    total: number;
    paymentMethod: string | null;
    paymentReference: string | null;
  };
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

function formatDate(date: string): string {
  try {
    return format(new Date(date), 'MMMM dd, yyyy');
  } catch {
    return date;
  }
}

// =============================================================================
// RECEIPT HEADER COMPONENT
// =============================================================================

function ReceiptHeader({ receipt }: { receipt: ReceiptData }) {
  return (
    <div className="space-y-4 pb-6">
      {/* Union/Organization Info */}
      <div className="text-center border-b pb-4">
        <div className="flex items-center justify-center mb-2">
          <Building2 className="h-8 w-8 text-primary mr-2" />
          <h1 className="text-2xl font-bold">{receipt.unionName}</h1>
        </div>
        {receipt.unionAddress && (
          <p className="text-sm text-muted-foreground">{receipt.unionAddress}</p>
        )}
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
          {receipt.unionPhone && <span>{receipt.unionPhone}</span>}
          {receipt.unionEmail && <span>{receipt.unionEmail}</span>}
        </div>
      </div>

      {/* Receipt Title & Number */}
      <div className="text-center py-4">
        <div className="flex items-center justify-center mb-2">
          <CheckCircle2 className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-xl font-semibold">Payment Receipt</h2>
        </div>
        <Badge variant="outline" className="text-base px-4 py-1">
          {receipt.receiptNumber}
        </Badge>
        <p className="text-sm text-muted-foreground mt-2">
          Issued: {formatDate(receipt.paymentDate)}
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// RECEIPT DETAILS COMPONENT
// =============================================================================

function ReceiptDetails({ receipt }: { receipt: ReceiptData }) {
  return (
    <div className="space-y-6">
      {/* Member Information */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center">
          <User className="h-4 w-4 mr-2" />
          Member Information
        </h3>
        <div className="space-y-2 pl-6">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{receipt.memberName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Member ID</span>
            <span className="text-sm font-medium">{receipt.memberNumber}</span>
          </div>
          {receipt.memberEmail && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{receipt.memberEmail}</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Payment Information */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center">
          <CreditCard className="h-4 w-4 mr-2" />
          Payment Information
        </h3>
        <div className="space-y-2 pl-6">
          {receipt.billingPeriod && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Billing Period</span>
              <span className="text-sm font-medium">{receipt.billingPeriod}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Payment Date</span>
            <span className="text-sm font-medium">{formatDate(receipt.paymentDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Payment Method</span>
            <span className="text-sm font-medium capitalize">{receipt.paymentMethod}</span>
          </div>
          {receipt.paymentReference && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Reference</span>
              <span className="text-sm font-medium font-mono text-xs">
                {receipt.paymentReference}
              </span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Amount Breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          Amount Breakdown
        </h3>
        <div className="space-y-2 pl-6">
          <div className="flex justify-between">
            <span className="text-sm">Dues Amount</span>
            <span className="text-sm font-medium">{formatCurrency(receipt.duesAmount)}</span>
          </div>

          {receipt.copeAmount && parseFloat(receipt.copeAmount) > 0 && (
            <div className="flex justify-between">
              <span className="text-sm">COPE Contribution</span>
              <span className="text-sm font-medium">{formatCurrency(receipt.copeAmount)}</span>
            </div>
          )}

          {receipt.pacAmount && parseFloat(receipt.pacAmount) > 0 && (
            <div className="flex justify-between">
              <span className="text-sm">PAC Contribution</span>
              <span className="text-sm font-medium">{formatCurrency(receipt.pacAmount)}</span>
            </div>
          )}

          {receipt.strikeFundAmount && parseFloat(receipt.strikeFundAmount) > 0 && (
            <div className="flex justify-between">
              <span className="text-sm">Strike Fund</span>
              <span className="text-sm font-medium">
                {formatCurrency(receipt.strikeFundAmount)}
              </span>
            </div>
          )}

          {receipt.lateFee && parseFloat(receipt.lateFee) > 0 && (
            <div className="flex justify-between text-orange-600">
              <span className="text-sm">Late Fee</span>
              <span className="text-sm font-medium">{formatCurrency(receipt.lateFee)}</span>
            </div>
          )}

          {receipt.adjustmentAmount && parseFloat(receipt.adjustmentAmount) !== 0 && (
            <div className="flex justify-between">
              <span className="text-sm">Adjustment</span>
              <span className="text-sm font-medium">
                {formatCurrency(receipt.adjustmentAmount)}
              </span>
            </div>
          )}

          <Separator className="my-3" />

          <div className="flex justify-between items-center pt-2">
            <span className="text-base font-semibold">Total Amount</span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(receipt.totalAmount)}
            </span>
          </div>
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
  const transactionId = params.transactionId as string;

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Fetch receipt data
  useEffect(() => {
    async function fetchReceipt() {
      try {
        setLoading(true);
        const response = await fetch(`/api/dues/receipt/${transactionId}?format=json`);

        if (!response.ok) {
          throw new Error('Failed to fetch receipt');
        }

        const data = await response.json();
        setReceipt(data);
      } catch (err) {
        logger.error('Error fetching receipt', { error: err, transactionId });
        setError(err instanceof Error ? err.message : 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    }

    if (transactionId) {
      fetchReceipt();
    }
  }, [transactionId]);

  // Handle PDF download
  const handleDownload = async () => {
    try {
      setDownloading(true);
      const response = await fetch(`/api/dues/receipt/${transactionId}?format=pdf`);

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receipt?.receiptNumber || transactionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      logger.error('Error downloading receipt', { error: err, transactionId });
      alert('Failed to download receipt. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center min-h-100">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium">Loading receipt...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !receipt) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/dues')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dues
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Receipt Not Found</CardTitle>
            <CardDescription>{error || 'Failed to load receipt'}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The receipt you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
            </p>
            <Button onClick={() => router.push('/dashboard/dues')}>
              Return to Dues Dashboard
            </Button>
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
          <Button variant="ghost" onClick={() => router.push('/dashboard/dues')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dues
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Receipt Card */}
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8">
          <ReceiptHeader receipt={receipt} />
          <ReceiptDetails receipt={receipt} />

          {/* Footer */}
          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-xs text-muted-foreground">
              This is an official receipt for your records. Please keep it for tax purposes.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Thank you for your payment!
            </p>
            {receipt.generatedAt && (
              <p className="text-xs text-muted-foreground mt-4">
                Generated: {receipt.generatedAt}
              </p>
            )}
          </div>
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
