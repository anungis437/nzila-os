'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import PaymentMethodManager from './payment-method-manager';
import DuesPaymentForm from './dues-payment-form';
import PaymentHistory from './payment-history';
import { useToast } from '@/lib/hooks/use-toast';

interface DuesBalance {
  currentBalance: number;
  nextDueDate: string;
  nextDueAmount: number;
  overdueAmount: number;
  lastPaymentDate: string;
  lastPaymentAmount: number;
  isInArrears: boolean;
  arrearsAmount: number;
  membershipStatus: string;
  autoPayEnabled: boolean;
  paymentMethodLast4: string | null;
}

interface DuesPaymentPortalProps {
  userId: string;
}

export default function DuesPaymentPortal({ userId }: DuesPaymentPortalProps) {
  const [balance, setBalance] = useState<DuesBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadDuesBalance = useCallback(async () => {
    try {
      const response = await fetch(`/api/dues/balance?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to load dues balance');
      const data = await response.json();
      setBalance(data);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load your dues information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    loadDuesBalance();
  }, [loadDuesBalance]);

  if (loading) {
    return <div className="flex items-center justify-center p-12">Loading...</div>;
  }

  if (!balance) {
    return <div className="text-center p-12">No dues information available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(balance.currentBalance)}
            </div>
            {balance.isInArrears && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-2">
                <AlertTriangle className="h-3 w-3" />
                {formatCurrency(balance.arrearsAmount)} overdue
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Payment Due</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(balance.nextDueAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Due {new Date(balance.nextDueDate).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membership Status</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge 
              variant={balance.membershipStatus === 'good_standing' ? 'default' : 'destructive'}
              className="text-sm"
            >
              {balance.membershipStatus === 'good_standing' ? 'Good Standing' : 'Arrears'}
            </Badge>
            {balance.autoPayEnabled && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                <Clock className="h-3 w-3" />
                AutoPay enabled (****{balance.paymentMethodLast4})
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alert for Overdue Amounts */}
      {balance.overdueAmount > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Overdue Balance
            </CardTitle>
            <CardDescription>
              You have {formatCurrency(balance.overdueAmount)} in overdue dues payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" size="lg">
              Pay Overdue Amount Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="make-payment" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="make-payment">Make Payment</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="make-payment" className="space-y-4">
          <DuesPaymentForm 
            userId={userId}
            currentBalance={balance.currentBalance}
            overdueAmount={balance.overdueAmount}
            onPaymentComplete={loadDuesBalance}
          />
        </TabsContent>

        <TabsContent value="payment-methods" className="space-y-4">
          <PaymentMethodManager 
            userId={userId}
            autoPayEnabled={balance.autoPayEnabled}
            onUpdate={loadDuesBalance}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <PaymentHistory userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

