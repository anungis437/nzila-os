'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface DeductionItem {
  id: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  unionDuesAmount: number;
  grossPay?: number;
  source: string;
  verified: boolean;
  createdAt: string;
}

interface DeductionHistoryProps {
  userId: string;
  onReportIssue?: (deductionId: string) => void;
}

export default function DeductionHistory({ userId, onReportIssue }: DeductionHistoryProps) {
  const [deductions, setDeductions] = useState<DeductionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDeductions = useCallback(async () => {
    try {
      const response = await fetch(`/api/dues/deductions?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to load deductions');
      const json = await response.json();
      const items = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      setDeductions(items);
    } catch (_error) {
      setDeductions([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDeductions();
  }, [loadDeductions]);

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'remittance':
        return 'Employer Remittance';
      case 'payroll_api':
        return 'Payroll System';
      case 'pay_stub_upload':
        return 'Pay Stub';
      case 'manual_entry':
        return 'Manual Entry';
      default:
        return source;
    }
  };

  if (loading) {
    return <div className="text-center p-12">Loading deduction history...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deduction History</CardTitle>
        <CardDescription>
          Union dues deducted from your payroll by your employer
        </CardDescription>
      </CardHeader>
      <CardContent>
        {deductions.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No deduction records available yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Deductions will appear here once your employer submits remittance data.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pay Period</TableHead>
                <TableHead>Dues Deducted</TableHead>
                <TableHead>Gross Pay</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                {onReportIssue && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {deductions.map((deduction) => (
                <TableRow key={deduction.id}>
                  <TableCell className="text-sm">
                    {new Date(deduction.payPeriodStart).toLocaleDateString()} –{' '}
                    {new Date(deduction.payPeriodEnd).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(deduction.unionDuesAmount)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {deduction.grossPay ? formatCurrency(deduction.grossPay) : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {getSourceLabel(deduction.source)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={deduction.verified ? 'default' : 'secondary'}>
                      {deduction.verified ? 'Verified' : 'Pending'}
                    </Badge>
                  </TableCell>
                  {onReportIssue && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReportIssue(deduction.id)}
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Report Issue
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
