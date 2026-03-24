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
import { format } from 'date-fns';
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

function formatDate(date: string): string {
  return format(new Date(date), 'MMM dd, yyyy');
}

function formatDateTime(date: string): string {
  return format(new Date(date), 'MMM dd, yyyy h:mm a');
}

function getStatusBadge(status: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusConfig: Record<string, { variant: any; icon: React.ReactNode; label: string }> = {
    paid: {
      variant: 'default',
      icon: <CheckCircle className="h-3 w-3 mr-1" />,
      label: 'Paid',
    },
    pending: {
      variant: 'secondary',
      icon: <Clock className="h-3 w-3 mr-1" />,
      label: 'Pending',
    },
    overdue: {
      variant: 'destructive',
      icon: <AlertCircle className="h-3 w-3 mr-1" />,
      label: 'Overdue',
    },
    cancelled: {
      variant: 'outline',
      icon: <XCircle className="h-3 w-3 mr-1" />,
      label: 'Cancelled',
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
          throw new Error('Failed to fetch payment details');
        }

        const result = await response.json();
        setPayment(result);
      } catch (err) {
        logger.error('Error fetching payment details', { error: err, paymentId: params.id });
        setError('Failed to load payment details');
      } finally {
        setLoading(false);
      }
    };

    fetchPayment();
  }, [params.id]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading payment details...</p>
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
            Back
          </Button>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">{error || 'Payment not found'}</p>
            </div>
            <Button onClick={() => router.back()} className="mt-4">
              Go Back
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
            Back
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Payment Details</h1>
            <p className="text-sm text-muted-foreground">
              Transaction ID: {payment.id.substring(0, 8)}...
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download Invoice
          </Button>
          <Button variant="outline" size="sm">
            <Send className="h-4 w-4 mr-2" />
            Send Reminder
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
                <CardTitle>Payment Summary</CardTitle>
                {getStatusBadge(payment.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-3xl font-bold">{formatCurrency(payment.amount)}</p>
                </div>
                <DollarSign className="h-12 w-12 text-muted-foreground opacity-20" />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{formatDate(payment.dueDate)}</p>
                </div>
                {payment.paidDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Paid Date</p>
                    <p className="font-medium">{formatDate(payment.paidDate)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Breakdown</CardTitle>
              <CardDescription>Detailed breakdown of payment components</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Union Dues</span>
                  <span className="font-medium">{formatCurrency(payment.breakdown.duesAmount)}</span>
                </div>
                {payment.breakdown.copeAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">COPE Contribution</span>
                    <span className="font-medium">{formatCurrency(payment.breakdown.copeAmount)}</span>
                  </div>
                )}
                {payment.breakdown.pacAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">PAC Contribution</span>
                    <span className="font-medium">{formatCurrency(payment.breakdown.pacAmount)}</span>
                  </div>
                )}
                {payment.breakdown.strikeFundAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Strike Fund</span>
                    <span className="font-medium">
                      {formatCurrency(payment.breakdown.strikeFundAmount)}
                    </span>
                  </div>
                )}
                {payment.breakdown.lateFees > 0 && (
                  <div className="flex justify-between items-center text-red-600">
                    <span className="text-sm">Late Fees</span>
                    <span className="font-medium">{formatCurrency(payment.breakdown.lateFees)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(payment.amount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Details */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start space-x-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="font-medium">{payment.paymentMethod || 'Not specified'}</p>
                  </div>
                </div>

                {payment.transactionReference && (
                  <div className="flex items-start space-x-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Reference Number</p>
                      <p className="font-medium font-mono text-xs">
                        {payment.transactionReference}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start space-x-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Billing Period</p>
                    <p className="font-medium text-sm">
                      {formatDate(payment.metadata.periodStart)} -{' '}
                      {formatDate(payment.metadata.periodEnd)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Frequency</p>
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
                      <p className="text-sm text-muted-foreground">Invoice Number</p>
                      <p className="font-medium">{payment.metadata.invoiceNumber}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download
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
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>History of actions taken on this payment</CardDescription>
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
                            {formatDateTime(log.timestamp)}
                          </p>
                        </div>
                        <p className="text-muted-foreground">by {log.userName}</p>
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
              <CardTitle>Member Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{payment.memberName}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium text-sm">{payment.memberEmail}</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground">Member ID</p>
                <p className="font-medium font-mono text-xs">{payment.memberId}</p>
              </div>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => router.push(`/dashboard/admin/members/${payment.memberId}`)}
              >
                View Member Profile
              </Button>
            </CardContent>
          </Card>

          {/* Admin Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Admin Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {payment.status === 'pending' && (
                <Button className="w-full" variant="default">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Paid
                </Button>
              )}

              {payment.status === 'paid' && (
                <Button className="w-full" variant="outline">
                  Initiate Refund
                </Button>
              )}

              <Button className="w-full" variant="outline">
                <Send className="h-4 w-4 mr-2" />
                Send Payment Reminder
              </Button>

              <Button className="w-full" variant="outline">
                Edit Payment
              </Button>

              {payment.status !== 'cancelled' && (
                <Button className="w-full" variant="destructive">
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Payment
                </Button>
              )}
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{formatDateTime(payment.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Updated</p>
                <p className="font-medium">{formatDateTime(payment.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
