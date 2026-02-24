/**
 * Payment Plans Page
 * 
 * Manage payment plans for members with arrears
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api/index';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Plus, CheckCircle, Clock } from 'lucide-react';
import { logger } from '@/lib/logger';

interface PaymentPlan {
  id: string;
  memberName: string;
  memberId: string;
  totalAmount: number;
  paidAmount: number;
  monthlyPayment: number;
  startDate: string;
  endDate: string;
  status: string;
  paymentsRemaining: number;
}

export default function PaymentPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentPlans();
  }, []);

  const fetchPaymentPlans = async () => {
    try {
      const data = await api.dues.paymentPlans.list();
      setPlans(data as PaymentPlan[]);
    } catch (error) {
      logger.error('Error fetching payment plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'defaulted':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalActive = plans.filter(p => p.status === 'active').length;
  const totalCompleted = plans.filter(p => p.status === 'completed').length;

  if (loading) {
    return <div className="container mx-auto py-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payment Plans</h1>
          <p className="text-muted-foreground">
            Manage member payment plans for outstanding dues
          </p>
        </div>
        <Button onClick={() => router.push('/dues/payment-plans/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Payment Plan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Plans</p>
              <p className="text-2xl font-bold text-green-600">{totalActive}</p>
            </div>
            <Clock className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completed Plans</p>
              <p className="text-2xl font-bold text-blue-600">{totalCompleted}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Plans</p>
              <p className="text-2xl font-bold">{plans.length}</p>
            </div>
            <FileText className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      {/* Plans Table */}
      <Card>
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Payment Plans</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Monthly Payment</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => {
              const progressPercentage = (plan.paidAmount / plan.totalAmount) * 100;
              
              return (
                <TableRow
                  key={plan.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/dues/payment-plans/${plan.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{plan.memberName}</p>
                      <p className="text-sm text-muted-foreground">{plan.memberId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">${plan.totalAmount.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        Paid: ${plan.paidAmount.toFixed(2)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">${plan.monthlyPayment.toFixed(2)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 min-w-[150px]">
                      <div className="flex justify-between text-sm">
                        <span>{progressPercentage.toFixed(0)}%</span>
                        <span className="text-muted-foreground">
                          {plan.paymentsRemaining} left
                        </span>
                      </div>
                      <Progress value={progressPercentage} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(plan.status)}>
                      {plan.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{new Date(plan.startDate).toLocaleDateString()}</p>
                      <p className="text-muted-foreground">
                        to {new Date(plan.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">View</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {plans.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No Payment Plans</h3>
          <p className="text-muted-foreground mb-4">
            Create payment plans for members with outstanding dues
          </p>
          <Button onClick={() => router.push('/dues/payment-plans/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Payment Plan
          </Button>
        </Card>
      )}
    </div>
  );
}
