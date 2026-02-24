'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslations } from 'next-intl';
import type { RewardBudgetEnvelope } from '@/db/schema/recognition-rewards-schema';

interface BudgetsListProps {
  budgets: RewardBudgetEnvelope[];
}

export function BudgetsList({ budgets }: BudgetsListProps) {
  const t = useTranslations('rewards.admin.budgets');

  if (budgets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{t('list.empty', { defaultValue: 'No budget envelopes created yet' })}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('list.columns.name', { defaultValue: 'Name' })}</TableHead>
            <TableHead>{t('list.columns.allocated', { defaultValue: 'Allocated' })}</TableHead>
            <TableHead>{t('list.columns.used', { defaultValue: 'Used' })}</TableHead>
            <TableHead>{t('list.columns.remaining', { defaultValue: 'Remaining' })}</TableHead>
            <TableHead>{t('list.columns.period', { defaultValue: 'Period' })}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {budgets.map((budget) => {
            const remaining = budget.amountLimit - budget.amountUsed;
            const _usagePercent = (budget.amountUsed / budget.amountLimit) * 100;
            
            return (
              <TableRow key={budget.id}>
                <TableCell className="font-medium">{budget.name}</TableCell>
                <TableCell>{budget.amountLimit.toLocaleString()}</TableCell>
                <TableCell>{budget.amountUsed.toLocaleString()}</TableCell>
                <TableCell>
                  <span className={remaining < budget.amountLimit * 0.1 ? 'text-destructive font-semibold' : ''}>
                    {remaining.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {budget.startsAt && budget.endsAt
                    ? `${new Date(budget.startsAt).toLocaleDateString()} - ${new Date(budget.endsAt).toLocaleDateString()}`
                    : t('list.ongoing', { defaultValue: 'Ongoing' })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

