export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { listLedger } from '@/lib/services/rewards/wallet-service';
import { CreditTimeline } from '@/components/rewards/credit-timeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { History, Download, Filter } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Credit History | Recognition & Rewards',
  description: 'View your complete credit transaction history',
};

interface PageProps {
  searchParams: {
    eventType?: string;
    limit?: string;
    page?: string;
  };
}

export default async function CreditHistoryPage({ searchParams }: PageProps) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  const t = await getTranslations('rewards.history');

  const eventType = searchParams.eventType || 'all';
  const limit = parseInt(searchParams.limit || '50');
  const page = parseInt(searchParams.page || '1');
  const offset = (page - 1) * limit;

  // Fetch ledger entries
  const result = await listLedger(orgId, userId, limit, offset);

  // Filter by event type if specified
  let filteredEntries = result.entries;
  if (eventType !== 'all') {
    filteredEntries = filteredEntries.filter((entry) => entry.eventType === eventType);
  }

  // Calculate summary stats
  const stats = {
    totalEarned: result.entries
      .filter((e) => e.eventType === 'earn')
      .reduce((sum, e) => sum + e.amountCredits, 0),
    totalSpent: result.entries
      .filter((e) => e.eventType === 'spend')
      .reduce((sum, e) => sum + Math.abs(e.amountCredits), 0),
    totalExpired: result.entries
      .filter((e) => e.eventType === 'expire')
      .reduce((sum, e) => sum + Math.abs(e.amountCredits), 0),
    totalTransactions: result.total,
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-2">{t('description')}</p>
        </div>
        <Link href="/dashboard/rewards">
          <Button variant="outline">{t('backToWallet')}</Button>
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('stats.totalEarned')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">+{stats.totalEarned}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('stats.totalSpent')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">-{stats.totalSpent}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('stats.totalExpired')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">-{stats.totalExpired}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('stats.transactions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalTransactions}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {t('filters.title')}
            </CardTitle>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              {t('exportCSV')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Select defaultValue={eventType}>
                <SelectTrigger>
                  <SelectValue placeholder={t('filters.eventType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all')}</SelectItem>
                  <SelectItem value="earn">{t('filters.earned')}</SelectItem>
                  <SelectItem value="spend">{t('filters.spent')}</SelectItem>
                  <SelectItem value="expire">{t('filters.expired')}</SelectItem>
                  <SelectItem value="revoke">{t('filters.revoked')}</SelectItem>
                  <SelectItem value="refund">{t('filters.refunded')}</SelectItem>
                  <SelectItem value="adjust">{t('filters.adjusted')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Select defaultValue={limit.toString()}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <CreditTimeline entries={filteredEntries} showBalance={true} />

      {/* Pagination */}
      {result.total > limit && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            asChild
          >
            <Link href={`?page=${page - 1}&eventType=${eventType}&limit=${limit}`}>
              {t('pagination.previous')}
            </Link>
          </Button>
          <div className="flex items-center gap-2 px-4">
            <span className="text-sm text-muted-foreground">
              {t('pagination.page', { current: page, total: Math.ceil(result.total / limit) })}
            </span>
          </div>
          <Button
            variant="outline"
            disabled={offset + limit >= result.total}
            asChild
          >
            <Link href={`?page=${page + 1}&eventType=${eventType}&limit=${limit}`}>
              {t('pagination.next')}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
