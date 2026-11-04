'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { BudgetEnvelopeRow } from '@/lib/rewards/admin-reads';

interface BudgetsListProps {
  budgets: BudgetEnvelopeRow[];
}

export function BudgetsList({ budgets }: BudgetsListProps) {
  const t = useTranslations('rewards.admin.budgets');
  const format = useFormatter();

  if (budgets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{t('list.empty')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('list.columns.name')}</TableHead>
            <TableHead>{t('list.columns.program')}</TableHead>
            <TableHead>{t('list.columns.allocated')}</TableHead>
            <TableHead>{t('list.columns.used')}</TableHead>
            <TableHead>{t('list.columns.remaining')}</TableHead>
            <TableHead>{t('list.columns.period')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {budgets.map((budget) => {
            const remaining = budget.limit - budget.used;
            return (
              <TableRow key={budget.id}>
                <TableCell className="font-medium">{budget.name}</TableCell>
                <TableCell>{budget.programName ?? '—'}</TableCell>
                <TableCell>{format.number(budget.limit)}</TableCell>
                <TableCell>{format.number(budget.used)}</TableCell>
                <TableCell>
                  <span className={remaining < budget.limit * 0.1 ? 'text-destructive font-semibold' : ''}>{format.number(remaining)}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format.dateTime(new Date(budget.startsAt), { dateStyle: 'medium', timeZone: 'UTC' })} –{' '}
                  {format.dateTime(new Date(budget.endsAt), { dateStyle: 'medium', timeZone: 'UTC' })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
