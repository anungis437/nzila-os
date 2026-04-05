/**
 * Member Dues Page
 * View payroll deductions, dues status, and report issues
 */
"use client";


export const dynamic = 'force-dynamic';
import { useEffect, useState } from "react";
import { useUser } from '@nzila/platform-auth/entra/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
 
import { 
  DollarSign, 
  Calendar, 
  Receipt,
  TrendingUp,
  AlertCircle,
  Eye,
  AlertTriangle
} from "lucide-react";
import { formatCurrency } from '@/lib/utils';

interface DuesBalance {
  totalOwed: number;
  nextDueDate: string;
  duesAmount: number;
  copeAmount: number;
  pacAmount: number;
  strikeFundAmount: number;
  lateFees: number;
}

interface Transaction {
  id: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalAmount: number;
  paymentStatus: string;
  paidDate?: string;
  dueDate: string;
}

export default function MemberDuesPage() {
  const { user: _user } = useUser();
  const [balance, setBalance] = useState<DuesBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDuesInfo() {
      try {
        const response = await fetch('/api/portal/dues/balance');
        if (response.ok) {
          const data = await response.json();
          setBalance(data.balance);
          setTransactions(data.transactions || []);
        }
      } catch (_error) {
} finally {
        setLoading(false);
      }
    }

    fetchDuesInfo();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'deducted':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Deducted';
      case 'overdue':
        return 'Overdue';
      default:
        return 'Pending';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deduction Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Dues & Deductions
          </CardTitle>
          <CardDescription>Your payroll deductions and dues status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Status Summary */}
            <div className="flex items-center justify-between p-6 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600 mb-1">Outstanding Balance</p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatCurrency(balance?.totalOwed ?? 0)}
                </p>
                {balance?.nextDueDate && (
                  <p className="text-sm text-gray-600 mt-2">
                    Next deduction expected: {new Date(balance.nextDueDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Badge variant={balance?.totalOwed === 0 ? 'default' : 'secondary'} className="text-sm">
                {balance?.totalOwed === 0 ? 'Current' : 'Balance Due'}
              </Badge>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <Receipt className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Dues</p>
                  <p className="text-xl font-bold">{formatCurrency(balance?.duesAmount ?? 0)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">COPE</p>
                  <p className="text-xl font-bold">{formatCurrency(balance?.copeAmount ?? 0)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">PAC</p>
                  <p className="text-xl font-bold">{formatCurrency(balance?.pacAmount ?? 0)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <DollarSign className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Strike Fund</p>
                  <p className="text-xl font-bold">{formatCurrency(balance?.strikeFundAmount ?? 0)}</p>
                </div>
              </div>
            </div>

            {balance && balance.lateFees > 0 && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">Late Fees</p>
                  <p className="text-sm text-red-700">
                    {formatCurrency(balance.lateFees)} in late fees have been applied
                  </p>
                </div>
              </div>
            )}

            {/* Issue Reporting CTA */}
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">Notice an issue with your deductions?</p>
                <p className="text-sm text-amber-700">
                  If a deduction is missing, incorrect, or unexpected, report it for review.
                </p>
              </div>
              <Button variant="outline" size="sm">
                Report Issue
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deduction History */}
      <Card>
        <CardHeader>
          <CardTitle>Deduction History</CardTitle>
          <CardDescription>Recent payroll deductions and dues transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No deduction history available yet.
              Records will appear once your employer submits remittance data.
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">
                        {new Date(transaction.billingPeriodStart).toLocaleDateString()} –{' '}
                        {new Date(transaction.billingPeriodEnd).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        {transaction.paidDate
                          ? `Deducted ${new Date(transaction.paidDate).toLocaleDateString()}`
                          : `Expected by ${new Date(transaction.dueDate).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-bold">{formatCurrency(transaction.totalAmount)}</p>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.paymentStatus)}`}
                    >
                      {getStatusLabel(transaction.paymentStatus)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
