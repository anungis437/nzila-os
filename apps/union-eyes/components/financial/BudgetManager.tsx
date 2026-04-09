'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Plus, Edit, Trash2 } from 'lucide-react';
 
import { useToast } from '@/lib/hooks/use-toast';
import { budgetSchema, formatZodErrors } from '@/lib/validations/financial';

interface Budget {
  id: string;
  budgetName: string;
  fiscalYear: number;
  periodType: string;
  startDate: string;
  endDate: string;
  totalBudget: string;
  totalAllocated: string;
  totalSpent: string;
  totalCommitted: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface BudgetManagerProps {
  organizationId: string;
}

export default function BudgetManager({ organizationId: _organizationId }: BudgetManagerProps) {
  const t = useTranslations('financial.budgetManager');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [_selectedBudget, _setSelectedBudget] = useState<Budget | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fiscalYearFilter, setFiscalYearFilter] = useState<string>('');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    budgetName: '',
    fiscalYear: new Date().getFullYear(),
    periodType: 'annual',
    startDate: '',
    endDate: '',
    totalBudget: '',
    notes: '',
  });

  useEffect(() => {
    fetchBudgets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscalYearFilter]);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (fiscalYearFilter) params.set('fiscalYear', fiscalYearFilter);

      const response = await fetch(`/api/financial/budgets?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch budgets');
      
      const data = await response.json();
      setBudgets(data.data.budgets || []);
    } catch (_error) {
      toast({
        title: t('error'),
        description: t('loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async () => {
    const result = budgetSchema.safeParse(formData);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      setFieldErrors(errors);
      const firstError = result.error.issues[0]?.message ?? 'Please fix the highlighted fields';
      toast({
        title: t('error'),
        description: firstError,
        variant: 'destructive',
      });
      return;
    }
    setFieldErrors({});

    try {
      const response = await fetch('/api/financial/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create budget');
      }

      toast({
        title: t('success'),
        description: t('budgetCreated'),
      });

      setIsCreateDialogOpen(false);
      setFieldErrors({});
      resetForm();
      fetchBudgets();
    } catch (_error) {
      toast({
        title: t('error'),
        description: t('createFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm('Are you sure you want to delete this budget? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/financial/budgets/${budgetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete budget');

      toast({
        title: t('success'),
        description: t('deleteBudget'),
      });

      fetchBudgets();
    } catch (_error) {
      toast({
        title: t('error'),
        description: t('deleteFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleApproveBudget = async (budgetId: string) => {
    try {
      const response = await fetch(`/api/financial/budgets/${budgetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      if (!response.ok) throw new Error('Failed to approve budget');

      toast({
        title: t('success'),
        description: t('approve'),
      });

      fetchBudgets();
    } catch (_error) {
      toast({
        title: t('error'),
        description: t('approveFailed'),
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      budgetName: '',
      fiscalYear: new Date().getFullYear(),
      periodType: 'annual',
      startDate: '',
      endDate: '',
      totalBudget: '',
      notes: '',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'outline',
      approved: 'default',
      active: 'default',
      closed: 'secondary',
      revised: 'secondary',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getBudgetUtilization = (budget: Budget) => {
    const total = parseFloat(budget.totalBudget);
    const spent = parseFloat(budget.totalSpent);
    const committed = parseFloat(budget.totalCommitted);
    const used = spent + committed;
    return total > 0 ? (used / total) * 100 : 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('createBudget')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-48">
              <Label htmlFor="fiscalYear">{t('fiscalYear')}</Label>
              <Select
                value={fiscalYearFilter}
                onValueChange={setFiscalYearFilter}
              >
                <SelectTrigger id="fiscalYear">
                  <SelectValue placeholder={t('allYears')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('allYears')}</SelectItem>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('budgets')}</CardTitle>
          <CardDescription>
            {t('budgetsFound', { count: budgets.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
          ) : budgets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noBudgets')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('budgetName')}</TableHead>
                  <TableHead>{t('fiscalYear')}</TableHead>
                  <TableHead>{t('period')}</TableHead>
                  <TableHead>{t('totalBudget')}</TableHead>
                  <TableHead>{t('spent')}</TableHead>
                  <TableHead>{t('utilization')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((budget) => {
                  const utilization = getBudgetUtilization(budget);
                  return (
                    <TableRow key={budget.id}>
                      <TableCell className="font-medium">{budget.budgetName}</TableCell>
                      <TableCell>{budget.fiscalYear}</TableCell>
                      <TableCell className="capitalize">{budget.periodType}</TableCell>
                      <TableCell>${parseFloat(budget.totalBudget).toLocaleString()}</TableCell>
                      <TableCell>${parseFloat(budget.totalSpent).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={utilization} className="w-16" />
                          <span className="text-sm">{utilization.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(budget.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.location.href = `/dashboard/financial/budgets/${budget.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {budget.status === 'draft' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApproveBudget(budget.id)}
                              >
                                {t('approve')}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteBudget(budget.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Budget Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('createNewBudget')}</DialogTitle>
            <DialogDescription>
              {t('createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="budgetName">{t('budgetNameRequired')}</Label>
              <Input
                id="budgetName"
                value={formData.budgetName}
                onChange={(e) => setFormData({ ...formData, budgetName: e.target.value })}
                placeholder={t('budgetNamePlaceholder')}
                className={fieldErrors.budgetName ? 'border-destructive' : ''}
              />
              {fieldErrors.budgetName && <p className="text-xs text-destructive">{fieldErrors.budgetName}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fiscalYear">{t('fiscalYearRequired')}</Label>
                <Input
                  id="fiscalYear"
                  type="number"
                  value={formData.fiscalYear}
                  onChange={(e) => setFormData({ ...formData, fiscalYear: parseInt(e.target.value) })}
                  className={fieldErrors.fiscalYear ? 'border-destructive' : ''}
                />
                {fieldErrors.fiscalYear && <p className="text-xs text-destructive">{fieldErrors.fiscalYear}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="periodType">{t('periodTypeRequired')}</Label>
                <Select
                  value={formData.periodType}
                  onValueChange={(value) => setFormData({ ...formData, periodType: value })}
                >
                  <SelectTrigger id="periodType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">{t('periodAnnual')}</SelectItem>
                    <SelectItem value="quarterly">{t('periodQuarterly')}</SelectItem>
                    <SelectItem value="monthly">{t('periodMonthly')}</SelectItem>
                    <SelectItem value="project">{t('periodProject')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">{t('startDateRequired')}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className={fieldErrors.startDate ? 'border-destructive' : ''}
                />
                {fieldErrors.startDate && <p className="text-xs text-destructive">{fieldErrors.startDate}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">{t('endDateRequired')}</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className={fieldErrors.endDate ? 'border-destructive' : ''}
                />
                {fieldErrors.endDate && <p className="text-xs text-destructive">{fieldErrors.endDate}</p>}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="totalBudget">{t('totalBudgetRequired')}</Label>
              <Input
                id="totalBudget"
                type="number"
                step="0.01"
                value={formData.totalBudget}
                onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
                placeholder={t('amountPlaceholder')}
                className={fieldErrors.totalBudget ? 'border-destructive' : ''}
              />
              {fieldErrors.totalBudget && <p className="text-xs text-destructive">{fieldErrors.totalBudget}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">{t('notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('notesPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleCreateBudget}>{t('createBudget')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
