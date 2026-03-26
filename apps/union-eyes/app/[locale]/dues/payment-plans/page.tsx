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
import { formatCurrency } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('dues.paymentPlans');
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
    return <div className="container mx-auto py-6">{t('loading')}</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={() => router.push('/dues/payment-plans/new')}>
          <Plus className="mr-2 h-4 w-4" />
          {t('newPlan')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('activePlans')}</p>
              <p className="text-2xl font-bold text-green-600">{totalActive}</p>
            </div>
            <Clock className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('completedPlans')}</p>
              <p className="text-2xl font-bold text-blue-600">{totalCompleted}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('totalPlans')}</p>
              <p className="text-2xl font-bold">{plans.length}</p>
            </div>
            <FileText className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      {/* Plans Table */}
      <Card>
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">{t('title')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('member')}</TableHead>
              <TableHead>{t('totalAmount')}</TableHead>
              <TableHead>{t('monthlyPayment')}</TableHead>
              <TableHead>{t('progress')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('period')}</TableHead>
              <TableHead>{t('actions')}</TableHead>
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
                      <p className="font-medium">{formatCurrency(plan.totalAmount)}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('paid')}: {formatCurrency(plan.paidAmount)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{formatCurrency(plan.monthlyPayment)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 min-w-[150px]">
                      <div className="flex justify-between text-sm">
                        <span>{progressPercentage.toFixed(0)}%</span>
                        <span className="text-muted-foreground">
                          {t('paymentsLeft', { count: plan.paymentsRemaining })}
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
                        {t('to')} {new Date(plan.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">{t('view')}</Button>
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
          <h3 className="text-xl font-semibold mb-2">{t('noPlans')}</h3>
          <p className="text-muted-foreground mb-4">
            {t('noPlansDesc')}
          </p>
          <Button onClick={() => router.push('/dues/payment-plans/new')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('createPlan')}
          </Button>
        </Card>
      )}
    </div>
  );
}
