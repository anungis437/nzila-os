/**
 * Finance Dashboard Page
 *
 * Platform economics overview: billing, ledger, allocations,
 * chargebacks, and dues alignment anomalies.
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
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  FileText,
  Download,
  BarChart3,
  ArrowRight,
} from 'lucide-react';

interface DashboardData {
  billingAccount: {
    id: string;
    displayName: string;
    status: string;
    currency: string;
  } | null;
  ledgerSummary: {
    totalAmountCad: string;
    entryCount: number;
    byCostType: Record<string, string>;
  } | null;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    totalCad: string;
    status: string;
    issueDate: string;
    dueDate: string;
  }>;
  recentChargebacks: Array<{
    id: string;
    localId: string;
    netAmountCad: string;
    status: string;
  }>;
  duesAlignment: {
    anomalyCount: number;
    anomalies: Array<{
      type: string;
      description: string;
      severity: string;
    }>;
    memberCount: number;
    arrearsCount: number;
  };
}

export default function FinanceDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Finance Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive">{error ?? 'No data available'}</p>
          <Button variant="outline" className="mt-4" onClick={fetchDashboard}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'outline';
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'default';
      case 'overdue': return 'destructive';
      case 'draft': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Finance Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/finance/exports')}>
            <Download className="h-4 w-4 mr-1" /> Exports
          </Button>
          <Button variant="outline" size="sm" onClick={fetchDashboard}>
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            Billing Status
          </div>
          <div className="text-xl font-semibold">
            {data.billingAccount?.status ?? 'Not configured'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.billingAccount?.displayName ?? 'Set up billing to get started'}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            Ledger Entries
          </div>
          <div className="text-xl font-semibold">
            {data.ledgerSummary?.entryCount ?? 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total: ${data.ledgerSummary?.totalAmountCad ?? '0.00'} CAD
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <BarChart3 className="h-4 w-4" />
            Members
          </div>
          <div className="text-xl font-semibold">
            {data.duesAlignment.memberCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.duesAlignment.arrearsCount} in arrears
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <AlertCircle className="h-4 w-4" />
            Anomalies
          </div>
          <div className="text-xl font-semibold">
            {data.duesAlignment.anomalyCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Dues alignment issues
          </p>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" /> Recent Invoices
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/finance/invoices')}
          >
            View all <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        {data.recentInvoices.length === 0 ? (
          <p className="text-muted-foreground text-sm">No invoices yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Amount (CAD)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentInvoices.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/finance/invoices/${inv.id}`)}
                >
                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell>${inv.totalCad}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(inv.status)}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(inv.issueDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Anomalies */}
      {data.duesAlignment.anomalyCount > 0 && (
        <Card className="p-4 border-yellow-500/30">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Dues Alignment Anomalies
          </h2>
          <div className="space-y-2">
            {data.duesAlignment.anomalies.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Badge variant={severityColor(a.severity)} className="mt-0.5">
                  {a.severity}
                </Badge>
                <span>{a.description}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Chargebacks */}
      {data.recentChargebacks.length > 0 && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-3">Recent Chargebacks</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Local</TableHead>
                <TableHead>Net Amount (CAD)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentChargebacks.map((cb) => (
                <TableRow key={cb.id}>
                  <TableCell className="font-mono text-xs">{cb.localId}</TableCell>
                  <TableCell>${cb.netAmountCad}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(cb.status)}>{cb.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Cost Type Breakdown */}
      {data.ledgerSummary && Object.keys(data.ledgerSummary.byCostType).length > 0 && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-3">Cost Type Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(data.ledgerSummary.byCostType).map(([type, amount]) => (
              <div key={type} className="border rounded-md p-3">
                <p className="text-xs text-muted-foreground capitalize">
                  {type.replace(/_/g, ' ')}
                </p>
                <p className="text-sm font-semibold">${amount} CAD</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
