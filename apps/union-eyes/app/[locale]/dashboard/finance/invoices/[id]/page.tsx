/**
 * Invoice Detail Page
 *
 * Full invoice view: header, line items, payment history, and payment recording.
 * Accessible to officers+ (admin required to record payment).
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  costType: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  currency: string;
  notes: string | null;
  lineItems: LineItem[];
}

interface Payment {
  id: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  externalReference: string | null;
  paidAt: string | null;
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (s) {
    case 'paid': return 'default';
    case 'overdue': return 'destructive';
    case 'partially_paid': return 'secondary';
    case 'void':
    case 'written_off': return 'outline';
    default: return 'secondary';
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'paid') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'overdue') return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function formatMethod(m: string) {
  const map: Record<string, string> = {
    eft: 'EFT', wire: 'Wire Transfer', cheque: 'Cheque',
    ach: 'ACH', credit_card: 'Credit Card', pad: 'PAD', other: 'Other',
  };
  return map[m] ?? m;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Record payment form
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'eft', externalReference: '' });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, pmtRes] = await Promise.all([
        fetch(`/api/finance/invoices/${id}`),
        fetch(`/api/finance/invoices/${id}/payments`),
      ]);
      if (!invRes.ok) throw new Error('Invoice not found');
      const invJson = await invRes.json();
      setInvoice(invJson.data);

      if (pmtRes.ok) {
        const pmtJson = await pmtRes.json();
        setPayments(pmtJson.data ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleRecordPayment = async () => {
    if (!payForm.amount || !payForm.method) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/finance/invoices/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(payForm.amount).toFixed(2),
          method: payForm.method,
          externalReference: payForm.externalReference || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? 'Failed to record payment');
      }
      setShowPayForm(false);
      setPayForm({ amount: '', method: 'eft', externalReference: '' });
      await load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Error');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Card className="p-6 space-y-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
        </Card>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Card className="p-8 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive font-medium">{error ?? 'Invoice not found'}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/finance/invoices')}>
            Back to Invoices
          </Button>
        </Card>
      </div>
    );
  }

  const balance = Number(invoice.totalAmount) - Number(invoice.amountPaid);
  const isPaid = invoice.status === 'paid' || balance <= 0;

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Nav */}
      <Button variant="ghost" size="sm" onClick={() => router.push('/finance/invoices')} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Invoices
      </Button>

      {/* Invoice Header */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-muted-foreground shrink-0" />
            <div>
              <h1 className="text-xl font-bold">{invoice.invoiceNumber}</h1>
              <p className="text-sm text-muted-foreground">
                Issued {new Date(invoice.issueDate).toLocaleDateString('en-CA')} ·
                Due {new Date(invoice.dueDate).toLocaleDateString('en-CA')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon status={invoice.status} />
            <Badge variant={statusVariant(invoice.status)} className="capitalize">
              {invoice.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {/* Amount Summary */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t pt-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Subtotal</p>
            <p className="text-lg font-semibold">{formatCurrency(Number(invoice.subtotal))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Tax</p>
            <p className="text-lg font-semibold">{formatCurrency(Number(invoice.taxAmount))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total (CAD)</p>
            <p className="text-xl font-bold">{formatCurrency(Number(invoice.totalAmount))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance Due</p>
            <p className={`text-xl font-bold ${balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {formatCurrency(balance)}
            </p>
          </div>
        </div>

        {invoice.notes && (
          <p className="mt-4 text-sm text-muted-foreground border-t pt-4">{invoice.notes}</p>
        )}
      </Card>

      {/* Line Items */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Line Items</h2>
        </div>
        {invoice.lineItems.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No line items</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lineItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                      {item.costType}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{Number(item.quantity).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(item.unitPrice))}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(item.amount))}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell colSpan={4} className="text-right">Total</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(invoice.totalAmount))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Payment History */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Payment History</h2>
          {!isPaid && (
            <Button size="sm" onClick={() => setShowPayForm((v) => !v)}>
              {showPayForm ? 'Cancel' : 'Record Payment'}
            </Button>
          )}
        </div>

        {/* Record Payment Form */}
        {showPayForm && (
          <div className="px-6 py-4 border-b bg-muted/30 space-y-3">
            <p className="text-sm font-medium">Record a payment against this invoice</p>
            {payError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {payError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder={`Amount (CAD, max ${balance.toFixed(2)})`}
                value={payForm.amount}
                onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
              />
              <Select value={payForm.method} onValueChange={(v) => setPayForm((f) => ({ ...f, method: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eft">EFT</SelectItem>
                  <SelectItem value="wire">Wire Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="pad">PAD</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Reference # (optional)"
                value={payForm.externalReference}
                onChange={(e) => setPayForm((f) => ({ ...f, externalReference: e.target.value }))}
              />
            </div>
            <Button size="sm" onClick={handleRecordPayment} disabled={paying || !payForm.amount}>
              {paying ? 'Saving...' : 'Confirm Payment'}
            </Button>
          </div>
        )}

        {payments.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No payments recorded yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount (CAD)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((pmt) => (
                <TableRow key={pmt.id}>
                  <TableCell>{formatMethod(pmt.method)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(pmt.amount))}</TableCell>
                  <TableCell>
                    <Badge variant={pmt.status === 'completed' ? 'default' : pmt.status === 'failed' ? 'destructive' : 'secondary'}>
                      {pmt.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{pmt.externalReference ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    {pmt.paidAt
                      ? new Date(pmt.paidAt).toLocaleDateString('en-CA')
                      : new Date(pmt.createdAt).toLocaleDateString('en-CA')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
