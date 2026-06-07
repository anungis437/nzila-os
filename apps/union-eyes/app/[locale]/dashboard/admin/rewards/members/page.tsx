export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { db } from '@/db/db';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { getOrganizationId } from '@/lib/organization-middleware';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { Wallet, Search, ArrowUpDown } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Member Wallets | Rewards Admin',
  description: 'View member reward balances and transaction history',
};

export default async function AdminRewardsMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const { locale } = await params;
  await requireUser();
  const hasAccess = await hasMinRole("admin");
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('rewards.admin.members');
  const orgId = await getOrganizationId();
  const resolvedParams = await searchParams;
  const page = Math.max(1, parseInt(resolvedParams.page || '1', 10));
  const search = resolvedParams.search || '';
  const perPage = 25;
  const offset = (page - 1) * perPage;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let members: unknown[] = [];
  let totalCount = 0;

  try {
    const result = await withSystemContext(async () => {
      const searchFilter = search
        ? sql`AND (om.first_name ILIKE ${'%' + search + '%'} OR om.last_name ILIKE ${'%' + search + '%'} OR om.email ILIKE ${'%' + search + '%'})`
        : sql``;

      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT om.id) AS total
        FROM organization_members om
        LEFT JOIN reward_wallets rw ON rw.member_id = om.id
        WHERE om.organization_id = ${orgId}::uuid
          AND om.deleted_at IS NULL
          ${searchFilter}
      `);

      const rows = await db.execute(sql`
        SELECT
          om.id,
          om.first_name,
          om.last_name,
          om.email,
          om.role,
          COALESCE(rw.balance, 0) AS balance,
          COALESCE(rw.lifetime_earned, 0) AS lifetime_earned,
          COALESCE(rw.lifetime_redeemed, 0) AS lifetime_redeemed,
          rw.updated_at AS wallet_updated_at
        FROM organization_members om
        LEFT JOIN reward_wallets rw ON rw.member_id = om.id
        WHERE om.organization_id = ${orgId}::uuid
          AND om.deleted_at IS NULL
          ${searchFilter}
        ORDER BY COALESCE(rw.balance, 0) DESC, om.last_name ASC
        LIMIT ${perPage} OFFSET ${offset}
      `);

      return {
        total: Number(Array.from(countResult)[0]?.total ?? 0),
        rows: Array.from(rows),
      };
    });

    members = result.rows;
    totalCount = result.total;
  } catch (e) {
    logger.error('[REWARDS] member wallets query failed', e instanceof Error ? e : new Error(String(e)));
  }

  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <Link
          href={`/${locale}/dashboard/admin/rewards`}
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
        >
          &larr; {t('backToAdmin', { defaultValue: 'Back to Admin' })}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('title', { defaultValue: 'Member Wallets' })}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('description', { defaultValue: 'View member balances and reward history' })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('summary.totalMembers', { defaultValue: 'Total Members' })}</CardDescription>
            <CardTitle className="text-2xl">{totalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('summary.withBalance', { defaultValue: 'With Balance' })}</CardDescription>
            <CardTitle className="text-2xl">
              {members.filter((m) => Number(m.balance) > 0).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('summary.totalOutstanding', { defaultValue: 'Total Outstanding Points' })}</CardDescription>
            <CardTitle className="text-2xl">
              {members.reduce((sum, m) => sum + Number(m.balance || 0), 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <form method="GET" className="flex-1">
              <input
                name="search"
                type="text"
                placeholder={t('search.placeholder', { defaultValue: 'Search by name or email...' })}
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
                  <th className="text-left p-3 font-medium">
                    <div className="flex items-center gap-1">
                      {t('table.name', { defaultValue: 'Name' })}
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="text-left p-3 font-medium">{t('table.email', { defaultValue: 'Email' })}</th>
                  <th className="text-left p-3 font-medium">{t('table.role', { defaultValue: 'Role' })}</th>
                  <th className="text-right p-3 font-medium">
                    <div className="flex items-center justify-end gap-1">
                      <Wallet className="h-3 w-3" />
                      {t('table.balance', { defaultValue: 'Balance' })}
                    </div>
                  </th>
                  <th className="text-right p-3 font-medium">{t('table.earned', { defaultValue: 'Lifetime Earned' })}</th>
                  <th className="text-right p-3 font-medium">{t('table.redeemed', { defaultValue: 'Redeemed' })}</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      {search
                        ? t('table.noResults', { defaultValue: 'No members found matching your search.' })
                        : t('table.empty', { defaultValue: 'No members found.' })}
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">{m.first_name} {m.last_name}</td>
                      <td className="p-3 text-muted-foreground">{m.email}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                          {m.role}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">{Number(m.balance).toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{Number(m.lifetime_earned).toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{Number(m.lifetime_redeemed).toLocaleString()}</td>
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
            <Link
              href={`/dashboard/admin/rewards/members?page=${page - 1}${search ? `&search=${search}` : ''}`}
              className="px-3 py-1 border rounded text-sm hover:bg-muted"
            >
              {t('pagination.previous', { defaultValue: 'Previous' })}
            </Link>
          )}
          <span className="px-3 py-1 text-sm text-muted-foreground">
            {t('pagination.info', {
              defaultValue: `Page ${page} of ${totalPages}`,
              page,
              totalPages,
            })}
          </span>
          {page < totalPages && (
            <Link
              href={`/dashboard/admin/rewards/members?page=${page + 1}${search ? `&search=${search}` : ''}`}
              className="px-3 py-1 border rounded text-sm hover:bg-muted"
            >
              {t('pagination.next', { defaultValue: 'Next' })}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
