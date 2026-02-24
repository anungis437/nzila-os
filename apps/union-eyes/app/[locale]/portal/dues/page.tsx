/**
 * Member Dues Page
 * View dues balance, payment history, and make payments
 */
"use client";


export const dynamic = 'force-dynamic';
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { validateRedirectUrl } from "@/lib/utils/sanitize";
 
import { 
  DollarSign, 
  Calendar, 
  CreditCard,
  Receipt,
  TrendingUp,
  AlertCircle
} from "lucide-react";

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
  const [paymentProcessing, setPaymentProcessing] = useState(false);

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

  const handlePayNow = async () => {
    setPaymentProcessing(true);
    try {
      const response = await fetch('/api/portal/dues/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: balance?.totalOwed }),
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to Stripe Checkout
        if (data.checkoutUrl) {
          const safeUrl = validateRedirectUrl(data.checkoutUrl);
          if (safeUrl) window.location.href = safeUrl;
        }
      }
    } catch (_error) {
} finally {
      setPaymentProcessing(false);
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
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
      {/* Balance Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Dues Balance</CardTitle>
          <CardDescription>Your current dues and upcoming payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Total Balance */}
            <div className="flex items-center justify-between p-6 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Balance</p>
                <p className="text-3xl font-bold text-blue-600">
                  ${balance?.totalOwed?.toFixed(2) || '0.00'}
                </p>
                {balance?.nextDueDate && (
                  <p className="text-sm text-gray-600 mt-2">
                    Next due: {new Date(balance.nextDueDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Button 
                size="lg" 
                onClick={handlePayNow}
                disabled={!balance?.totalOwed || paymentProcessing}
              >
                <CreditCard className="mr-2 h-5 w-5" />
                {paymentProcessing ? 'Processing...' : 'Pay Now'}
              </Button>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <Receipt className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Dues</p>
                  <p className="text-xl font-bold">${balance?.duesAmount?.toFixed(2) || '0.00'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">COPE</p>
                  <p className="text-xl font-bold">${balance?.copeAmount?.toFixed(2) || '0.00'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">PAC</p>
                  <p className="text-xl font-bold">${balance?.pacAmount?.toFixed(2) || '0.00'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <DollarSign className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Strike Fund</p>
                  <p className="text-xl font-bold">${balance?.strikeFundAmount?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>

            {balance && balance.lateFees > 0 && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">Late Fees</p>
                  <p className="text-sm text-red-700">
                    ${balance.lateFees.toFixed(2)} in late fees have been applied
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Your recent dues transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No payment history available
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
                        {new Date(transaction.billingPeriodStart).toLocaleDateString()} -{' '}
                        {new Date(transaction.billingPeriodEnd).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        {transaction.paidDate
                          ? `Paid on ${new Date(transaction.paidDate).toLocaleDateString()}`
                          : `Due ${new Date(transaction.dueDate).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-bold">${transaction.totalAmount.toFixed(2)}</p>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(transaction.paymentStatus)}`}
                    >
                      {transaction.paymentStatus}
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
