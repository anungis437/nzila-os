'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
 
import { useToast } from '@/lib/hooks/use-toast';

interface ExpenseRequest {
  id: string;
  requestNumber: string;
  requesterId: string;
  expenseDate: string;
  description: string;
  vendorName?: string;
  totalAmount: string;
  status: string;
  submittedAt?: string;
  category?: string;
}

interface ExpenseApprovalQueueProps {
  organizationId: string;
}

export default function ExpenseApprovalQueue({ organizationId: _organizationId }: ExpenseApprovalQueueProps) {
  const t = useTranslations('expenseApproval');
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRequest | null>(null);
  const [approvalComments, setApprovalComments] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingExpenses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPendingExpenses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/financial/expenses?pendingApproval=true');
      if (!response.ok) throw new Error('Failed to fetch expenses');
      
      const data = await response.json();
      setExpenses(data.data.expenses || []);
    } catch (_error) {
      toast({
        title: t('errorTitle'),
        description: t('loadError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (expenseId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/financial/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalAction: action,
          approvalComments,
        }),
      });

      if (!response.ok) throw new Error(`Failed to ${action} expense`);

      toast({
        title: t('successTitle'),
        description: action === 'approve' ? t('approvedSuccess') : t('rejectedSuccess'),
      });

      setSelectedExpense(null);
      setApprovalComments('');
      fetchPendingExpenses();
    } catch (_error) {
      toast({
        title: t('errorTitle'),
        description: t('actionFailed', { action: action === 'approve' ? t('actions.approve') : t('actions.reject') }),
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', icon?: unknown }> = {
      submitted: { variant: 'outline', icon: Clock },
      approved: { variant: 'default', icon: CheckCircle },
      rejected: { variant: 'destructive', icon: XCircle },
    };
    const config = variants[status] || { variant: 'outline' };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant}>
        {Icon && <Icon className="mr-1 h-3 w-3" />}
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('pendingTitle')}</CardTitle>
          <CardDescription>
            {t(expenses.length === 1 ? 'pending' : 'pendingPlural', { count: expenses.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('empty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.requestNumber')}</TableHead>
                  <TableHead>{t('table.date')}</TableHead>
                  <TableHead>{t('table.vendor')}</TableHead>
                  <TableHead>{t('table.description')}</TableHead>
                  <TableHead>{t('table.category')}</TableHead>
                  <TableHead>{t('table.amount')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead>{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-mono">{expense.requestNumber}</TableCell>
                    <TableCell>{new Date(expense.expenseDate).toLocaleDateString()}</TableCell>
                    <TableCell>{expense.vendorName || '—'}</TableCell>
                    <TableCell className="max-w-xs truncate">{expense.description}</TableCell>
                    <TableCell className="capitalize">{expense.category?.replace('_', ' ') || '—'}</TableCell>
                    <TableCell className="font-semibold">${parseFloat(expense.totalAmount).toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(expense.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedExpense(expense)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {t('actions.review')}
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setSelectedExpense(expense);
                            setActionType('approve');
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {t('actions.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedExpense(expense);
                            setActionType('reject');
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {t('actions.reject')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      {selectedExpense && (
        <Dialog open={!!selectedExpense} onOpenChange={() => setSelectedExpense(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{actionType === 'approve' ? t('dialog.approveTitle') : t('dialog.rejectTitle')}</DialogTitle>
              <DialogDescription>
                {t('dialog.requestPrefix', { number: selectedExpense.requestNumber })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">{t('dialog.amount')}</div>
                  <div className="font-semibold text-lg">${parseFloat(selectedExpense.totalAmount).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('dialog.date')}</div>
                  <div className="font-medium">{new Date(selectedExpense.expenseDate).toLocaleDateString()}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">{t('dialog.description')}</div>
                  <div className="font-medium">{selectedExpense.description}</div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comments">{actionType === 'reject' ? t('dialog.commentsRequired') : t('dialog.comments')}</Label>
                <Textarea
                  id="comments"
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder={actionType === 'reject' ? t('dialog.rejectPlaceholder') : t('dialog.approvePlaceholder')}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedExpense(null)}>
                {t('dialog.cancel')}
              </Button>
              <Button
                variant={actionType === 'approve' ? 'default' : 'destructive'}
                onClick={() => handleApproval(selectedExpense.id, actionType)}
                disabled={actionType === 'reject' && !approvalComments}
              >
                {actionType === 'approve' ? t('dialog.confirmApprove') : t('dialog.confirmReject')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
