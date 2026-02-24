'use client';

import { useState, useEffect } from 'react';
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
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [_selectedBudget, _setSelectedBudget] = useState<Budget | null>(null);
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
        title: 'Error',
        description: 'Failed to load budgets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async () => {
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
        title: 'Success',
        description: 'Budget created successfully',
      });

      setIsCreateDialogOpen(false);
      resetForm();
      fetchBudgets();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
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
        title: 'Success',
        description: 'Budget deleted successfully',
      });

      fetchBudgets();
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to delete budget',
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
        title: 'Success',
        description: 'Budget approved successfully',
      });

      fetchBudgets();
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to approve budget',
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
          <h2 className="text-3xl font-bold tracking-tight">Budget Management</h2>
          <p className="text-muted-foreground">
            Manage organizational budgets and track spending
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Budget
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-48">
              <Label htmlFor="fiscalYear">Fiscal Year</Label>
              <Select
                value={fiscalYearFilter}
                onValueChange={setFiscalYearFilter}
              >
                <SelectTrigger id="fiscalYear">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Years</SelectItem>
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
          <CardTitle>Budgets</CardTitle>
          <CardDescription>
            {budgets.length} budget{budgets.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading budgets...</div>
          ) : budgets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No budgets found. Create your first budget to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Budget Name</TableHead>
                  <TableHead>Fiscal Year</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Total Budget</TableHead>
                  <TableHead>Spent</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
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
                                Approve
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
            <DialogTitle>Create New Budget</DialogTitle>
            <DialogDescription>
              Create an organizational budget for fiscal planning and tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="budgetName">Budget Name *</Label>
              <Input
                id="budgetName"
                value={formData.budgetName}
                onChange={(e) => setFormData({ ...formData, budgetName: e.target.value })}
                placeholder="e.g., 2026 Annual Operating Budget"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fiscalYear">Fiscal Year *</Label>
                <Input
                  id="fiscalYear"
                  type="number"
                  value={formData.fiscalYear}
                  onChange={(e) => setFormData({ ...formData, fiscalYear: parseInt(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="periodType">Period Type *</Label>
                <Select
                  value={formData.periodType}
                  onValueChange={(value) => setFormData({ ...formData, periodType: value })}
                >
                  <SelectTrigger id="periodType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="totalBudget">Total Budget Amount *</Label>
              <Input
                id="totalBudget"
                type="number"
                step="0.01"
                value={formData.totalBudget}
                onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional budget notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBudget}>Create Budget</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
