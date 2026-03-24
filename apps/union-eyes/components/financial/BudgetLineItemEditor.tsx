'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Plus, Edit } from 'lucide-react';
 
 
 
import { useToast } from '@/lib/hooks/use-toast';

interface BudgetLineItem {
  id: string;
  accountCode: string;
  accountName: string;
  allocatedAmount: string;
  spentAmount: string;
  committedAmount: string;
  remainingAmount: string;
  notes?: string;
}

interface BudgetLineItemEditorProps {
  budgetId: string;
  lineItems: BudgetLineItem[];
  onUpdate: () => void;
}

export default function BudgetLineItemEditor({ budgetId: _budgetId, lineItems, onUpdate: _onUpdate }: BudgetLineItemEditorProps) {
  const t = useTranslations('financial.budgetLineItems');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, _setEditingItem] = useState<BudgetLineItem | null>(null);
  const { toast: _toast } = useToast();

  const [formData, setFormData] = useState({
    accountCode: '',
    accountName: '',
    allocatedAmount: '',
    notes: '',
  });

  const getUtilization = (item: BudgetLineItem) => {
    const allocated = parseFloat(item.allocatedAmount);
    const spent = parseFloat(item.spentAmount);
    const committed = parseFloat(item.committedAmount);
    return allocated > 0 ? ((spent + committed) / allocated) * 100 : 0;
  };

  const getTotalAllocated = () => {
    return lineItems.reduce((sum, item) => sum + parseFloat(item.allocatedAmount), 0);
  };

  const getTotalSpent = () => {
    return lineItems.reduce((sum, item) => sum + parseFloat(item.spentAmount), 0);
  };

  const getTotalRemaining = () => {
    return lineItems.reduce((sum, item) => sum + parseFloat(item.remainingAmount), 0);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>
                {t('subtitle')}
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t('addLineItem')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lineItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noLineItems')}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('accountCode')}</TableHead>
                    <TableHead>{t('accountName')}</TableHead>
                    <TableHead>{t('allocated')}</TableHead>
                    <TableHead>{t('spent')}</TableHead>
                    <TableHead>{t('committed')}</TableHead>
                    <TableHead>{t('remaining')}</TableHead>
                    <TableHead>{t('utilization')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => {
                    const utilization = getUtilization(item);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.accountCode}</TableCell>
                        <TableCell>{item.accountName}</TableCell>
                        <TableCell>${parseFloat(item.allocatedAmount).toLocaleString()}</TableCell>
                        <TableCell>${parseFloat(item.spentAmount).toLocaleString()}</TableCell>
                        <TableCell>${parseFloat(item.committedAmount).toLocaleString()}</TableCell>
                        <TableCell className={parseFloat(item.remainingAmount) < 0 ? 'text-destructive' : ''}>
                          ${parseFloat(item.remainingAmount).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={Math.min(utilization, 100)} 
                              className={`w-16 ${utilization > 100 ? 'bg-destructive' : ''}`}
                            />
                            <span className={`text-sm ${utilization > 100 ? 'text-destructive' : ''}`}>
                              {utilization.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Summary Row */}
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">{t('totalAllocated')}</div>
                    <div className="text-lg font-semibold">${getTotalAllocated().toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t('totalSpent')}</div>
                    <div className="text-lg font-semibold">${getTotalSpent().toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t('totalRemaining')}</div>
                    <div className="text-lg font-semibold">${getTotalRemaining().toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t('overallUtilization')}</div>
                    <div className="text-lg font-semibold">
                      {getTotalAllocated() > 0 
                        ? ((getTotalSpent() / getTotalAllocated()) * 100).toFixed(1)
                        : 0}%
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? t('editLineItemDialog') : t('addLineItemDialog')}</DialogTitle>
            <DialogDescription>
              {editingItem ? t('editLineItemDesc') : t('addLineItemDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="accountCode">{t('accountCodeRequired')}</Label>
              <Input
                id="accountCode"
                value={formData.accountCode}
                onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
                placeholder={t('accountCodePlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountName">{t('accountNameRequired')}</Label>
              <Input
                id="accountName"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                placeholder={t('accountNamePlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="allocatedAmount">{t('allocatedRequired')}</Label>
              <Input
                id="allocatedAmount"
                type="number"
                step="0.01"
                value={formData.allocatedAmount}
                onChange={(e) => setFormData({ ...formData, allocatedAmount: e.target.value })}
                placeholder={t('amountPlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">{t('notes')}</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('notesPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={() => {}}>
              {editingItem ? t('updateItem') : t('addItem')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
