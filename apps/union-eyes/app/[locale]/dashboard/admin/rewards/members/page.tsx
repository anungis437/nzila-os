export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { isUuid } from '@/lib/page-data/uuid';
import { loadMemberWallets, parsePageNumber, MEMBER_WALLETS_PER_PAGE } from '@/lib/rewards/admin-reads';
import { Wallet, Search } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Member Wallets | Rewards Admin',
  description: 'View member reward balances and transaction history',
};

interface MemberWalletRow {
  id: string;
  name: string;
  email: string;
  role: string;
  balance: unknown;
  lifetime_earned: unknown;
  lifetime_redeemed: unknown;
}

export default async function AdminRewardsMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser();
  const hasAccess = await hasMinRole("admin");
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('rewards.admin.members');
  const format = await getFormatter();
  // The organization is the administrator's own, from their verified membership: never the cookie the browser sends.
  const orgId = user.organizationId;
  if (!isUuid(orgId)) {
    redirect('/dashboard');
  }
  const resolvedParams = await searchParams;
  const page = parsePageNumber(resolvedParams.page);
  const search = resolvedParams.search || '';
  const perPage = MEMBER_WALLETS_PER_PAGE;

  // A failed read is an error, not an empty list of members: nothing here catches it.
  const { rows, total: matching, summary } = await loadMemberWallets(orgId, { search, page, perPage });
  const members = rows as unknown as MemberWalletRow[];

  const totalPages = Math.ceil(matching / perPage);
  const number = (value: unknown) => format.number(Number(value ?? 0));
  const pageHref = (target: number) =>
    `/${locale}/dashboard/admin/rewards/members?page=${target}${search ? `&search=${encodeURIComponent(search)}` : ''}`;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <Link
          href={`/${locale}/dashboard/admin/rewards`}
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
        >
          &larr; {t('backToAdmin')}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      {/* The whole organization's figures, whatever the search or the page below */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('summary.totalMembers')}</CardDescription>
            <CardTitle className="text-2xl">{number(summary.members)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('summary.withBalance')}</CardDescription>
            <CardTitle className="text-2xl">{number(summary.withBalance)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('summary.totalOutstanding')}</CardDescription>
            <CardTitle className="text-2xl">{number(summary.outstanding)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <form method="GET" className="flex-1">
              <input
                name="search"
                type="search"
                aria-label={t('search.label')}
                placeholder={t('search.placeholder')}
                defaultValue={search}
                className="w-full border-none bg-transparent outline-none text-sm"
              />
            </form>
          </div>
        </CardHeader>
      </Card>

      {/* Members Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">{t('table.name')}</th>
                  <th className="text-left p-3 font-medium">{t('table.email')}</th>
                  <th className="text-left p-3 font-medium">{t('table.role')}</th>
                  <th className="text-right p-3 font-medium">
                    <div className="flex items-center justify-end gap-1">
                      <Wallet className="h-3 w-3" aria-hidden="true" />
                      {t('table.balance')}
                    </div>
                  </th>
                  <th className="text-right p-3 font-medium">{t('table.earned')}</th>
                  <th className="text-right p-3 font-medium">{t('table.redeemed')}</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      {search ? t('table.noResults') : t('table.empty')}
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">{m.name}</td>
                      <td className="p-3 text-muted-foreground">{m.email}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                          {m.role}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">{number(m.balance)}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{number(m.lifetime_earned)}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{number(m.lifetime_redeemed)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="px-3 py-1 border rounded text-sm hover:bg-muted">
              {t('pagination.previous')}
            </Link>
          )}
          <span className="px-3 py-1 text-sm text-muted-foreground">{t('pagination.info', { page, totalPages })}</span>
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="px-3 py-1 border rounded text-sm hover:bg-muted">
              {t('pagination.next')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
