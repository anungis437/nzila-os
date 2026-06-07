'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, RefreshCw, Plus, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RewardWalletLedgerEntry as RewardWalletLedger } from '@/db/schema/recognition-rewards-schema';

interface LedgerTableProps {
  entries: (RewardWalletLedger & {
    created_by_name?: string;
  })[];
}

export function LedgerTable({ entries }: LedgerTableProps) {
  const t = useTranslations('rewards.wallet.ledger');

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{t('empty', { defaultValue: 'No transactions yet' })}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">
              {t('columns.date', { defaultValue: 'Date' })}
            </TableHead>
            <TableHead>
              {t('columns.description', { defaultValue: 'Description' })}
            </TableHead>
            <TableHead>
              {t('columns.type', { defaultValue: 'Type' })}
            </TableHead>
            <TableHead className="text-right">
              {t('columns.amount', { defaultValue: 'Amount' })}
            </TableHead>
            <TableHead className="text-right">
              {t('columns.balance', { defaultValue: 'Balance' })}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isCredit = entry.amountCredits > 0;
            const Icon = getTransactionIcon(entry.eventType);

            return (
              <TableRow key={entry.id}>
                <TableCell className="font-medium text-sm text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">
                      {getTransactionTitle(entry, t)}
                    </span>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(entry as any).notes && (
                      <span className="text-sm text-muted-foreground">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(entry as any).notes}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="flex items-center gap-1 w-fit">
                    <Icon className="h-3 w-3" />
                    {formatEntryType(entry.eventType, t)}
                  </Badge>
                </TableCell>
                <TableCell
                  className={`text-right font-semibold ${
                    isCredit ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {isCredit ? '+' : ''}
                  {entry.amountCredits.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {entry.balanceAfter.toLocaleString()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function getTransactionIcon(type: string) {
  switch (type) {
    case 'earned':
      return Plus;
    case 'redeemed':
      return Minus;
    case 'refund':
      return RefreshCw;
    case 'adjustment':
      return RefreshCw;
    case 'revoked':
      return Minus;
    default:
      return ArrowUp;
  }
}

function getTransactionTitle(
  entry: RewardWalletLedger & { created_by_name?: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
): string {
  switch (entry.eventType) {
    case 'earn':
      return t('types.earned', { defaultValue: 'Award Received' });
    case 'spend':
      return t('types.redeemed', { defaultValue: 'Credits Redeemed' });
    case 'refund':
      return t('types.refund', { defaultValue: 'Refund Processed' });
    case 'adjust':
      return t('types.adjustment', { defaultValue: 'Balance Adjustment' });
    case 'revoke':
      return t('types.revoked', { defaultValue: 'Award Revoked' });
    default:
      return entry.eventType;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatEntryType(type: string, t: any): string {
  switch (type) {
    case 'earned':
      return t('badges.earned', { defaultValue: 'Earned' });
    case 'redeemed':
      return t('badges.redeemed', { defaultValue: 'Redeemed' });
    case 'refund':
      return t('badges.refund', { defaultValue: 'Refund' });
    case 'adjustment':
      return t('badges.adjustment', { defaultValue: 'Adjustment' });
    case 'revoked':
      return t('badges.revoked', { defaultValue: 'Revoked' });
    default:
      return type;
  }
}

