/**
 * Invoices List Page
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, AlertCircle } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalCad: string;
  status: string;
  issueDate: string;
  dueDate: string;
  paidAmountCad: string;
  balanceDueCad: string;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/invoices?limit=50');
      if (!res.ok) throw new Error('Failed to load invoices');
      const json = await res.json();
      setInvoices(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'default';
      case 'overdue': return 'destructive';
      case 'sent': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Card className="p-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full mb-2" />
          ))}
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" /> Invoices
        </h1>
      </div>

      {invoices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No invoices generated yet</p>
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Total (CAD)</TableHead>
                <TableHead>Paid (CAD)</TableHead>
                <TableHead>Balance Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/finance/invoices/${inv.id}`)}
                >
                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell>${inv.totalCad}</TableCell>
                  <TableCell>${inv.paidAmountCad}</TableCell>
                  <TableCell>${inv.balanceDueCad}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(inv.status)}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(inv.issueDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
