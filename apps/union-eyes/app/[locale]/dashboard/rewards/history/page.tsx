export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireOrganizationScope } from '@/lib/page-data/organization-scope';
import { getTranslations } from 'next-intl/server';
import { loadCreditHistory, parseCreditHistoryQuery, LEDGER_EVENT_TYPES } from '@/lib/rewards/page-reads';
import { CreditTimeline } from '@/components/rewards/credit-timeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, Filter } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Credit History | Recognition & Rewards',
  description: 'View your complete credit transaction history',
};

interface PageProps {
  searchParams: Promise<{
    eventType?: string;
    limit?: string;
    page?: string;
  }>;
}

export default async function CreditHistoryPage({ params, searchParams }: PageProps & { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // The person and the organization are the signed-in member's own: an organization-less caller is sent back to the dashboard.
  const { userId, organizationId } = await requireOrganizationScope();

  const t = await getTranslations('rewards.history');
  const filterLabels = {
    earn: t('filters.earned'),
    spend: t('filters.spent'),
    expire: t('filters.expired'),
    revoke: t('filters.revoked'),
    refund: t('filters.refunded'),
    adjust: t('filters.adjusted'),
  } as const;
  const query = parseCreditHistoryQuery(await searchParams);
  const { eventType, limit, page } = query;

  // One page of the member's ledger, filtered in the database, with the totals over the whole ledger. A failed read is an error, not an empty history.
  const history = await loadCreditHistory(organizationId, userId, query);
  const totalPages = Math.max(1, Math.ceil(history.matching / limit));

  const historyHref = (overrides: Record<string, string>) =>
    `/${locale}/dashboard/rewards/history?${new URLSearchParams({ eventType, limit: String(limit), page: String(page), ...overrides })}`;

  const stats = {
    totalEarned: history.totalEarned,
    totalSpent: history.totalSpent,
    totalExpired: history.totalExpired,
    totalTransactions: history.totalTransactions,
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
        <Link href={`/${locale}/dashboard/rewards`}>
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

      {/* Filters: each one is a link, so the filtered history is a page of its own that can be shared and reloaded */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('filters.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant={eventType === 'all' ? 'default' : 'outline'} size="sm" asChild>
              <Link href={historyHref({ eventType: 'all', page: '1' })}>{t('filters.all')}</Link>
            </Button>
            {LEDGER_EVENT_TYPES.map((type) => (
              <Button key={type} variant={eventType === type ? 'default' : 'outline'} size="sm" asChild>
                <Link href={historyHref({ eventType: type, page: '1' })}>{filterLabels[type]}</Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <CreditTimeline entries={history.entries} showBalance={true} />

      {/* Pagination: a link only where there is a page to go to */}
      {history.matching > limit && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Button variant="outline" asChild>
              <Link href={historyHref({ page: String(page - 1) })}>{t('pagination.previous')}</Link>
            </Button>
          )}
          <div className="flex items-center gap-2 px-4">
            <span className="text-sm text-muted-foreground">
              {t('pagination.page', { current: page, total: totalPages })}
            </span>
          </div>
          {page < totalPages && (
            <Button variant="outline" asChild>
              <Link href={historyHref({ page: String(page + 1) })}>{t('pagination.next')}</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
