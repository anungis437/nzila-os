export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getBalance, listLedger } from '@/lib/services/rewards/wallet-service';
import { getTotalEarned, getTotalRedeemed } from '@/lib/utils/rewards-stats-utils';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift, TrendingUp, Calendar } from 'lucide-react';
import Link from 'next/link';
import { WalletBalanceCard } from '@/components/rewards/wallet-balance-card';
import { LedgerTable } from '@/components/rewards/ledger-table';
import { getOrganizationIdForUser } from '@/lib/organization-utils';

export const metadata: Metadata = {
  title: 'My Wallet | Recognition & Rewards',
  description: 'View your reward credits balance and transaction history',
};

export default async function RewardsWalletPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Use DB-based organization (not Clerk org) since this app uses its own org management
  let orgId: string;
  try {
    orgId = await getOrganizationIdForUser(userId);
  } catch {
    // User has no organization membership - show rewards page with empty state
    orgId = '';
  }

  const t = await getTranslations('rewards');

  // Fetch wallet data — guard against schema mismatch (wallet table may be incomplete in this environment)
  let balance = 0;
  let ledgerEntries: Awaited<ReturnType<typeof listLedger>>['entries'] = [];
  let totalEarned = 0;
  let totalRedeemed = 0;

  try {
    balance = await getBalance(orgId, userId);
    const result = await listLedger(orgId, userId, 20, 0);
    ledgerEntries = result.entries;
    totalEarned = await getTotalEarned(userId, orgId);
    totalRedeemed = await getTotalRedeemed(userId, orgId);
  } catch {
    // Wallet data unavailable — render page with empty state
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('wallet.title', { defaultValue: 'My Reward Wallet' })}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('wallet.description', { 
              defaultValue: 'View your reward credits and redeem them for products and services' 
            })}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/dashboard/rewards/redeem">
            <Gift className="mr-2 h-5 w-5" />
            {t('wallet.redeemButton', { defaultValue: 'Redeem Credits' })}
          </Link>
        </Button>
      </div>

      {/* Balance Card */}
      <WalletBalanceCard balance={balance} />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('wallet.stats.totalEarned', { defaultValue: 'Total Earned' })}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalEarned.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('wallet.stats.allTime', { defaultValue: 'All time' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('wallet.stats.totalRedeemed', { defaultValue: 'Total Redeemed' })}
            </CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRedeemed.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('wallet.stats.allTime', { defaultValue: 'All time' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('wallet.stats.lastActivity', { defaultValue: 'Last Activity' })}
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ledgerEntries.length > 0 
                ? new Date(ledgerEntries[0].createdAt).toLocaleDateString()
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('wallet.stats.mostRecent', { defaultValue: 'Most recent transaction' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('wallet.ledger.title', { defaultValue: 'Transaction History' })}
          </CardTitle>
          <CardDescription>
            {t('wallet.ledger.description', { 
              defaultValue: 'Complete record of all credit transactions' 
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LedgerTable entries={ledgerEntries} />
        </CardContent>
      </Card>
    </div>
  );
}
