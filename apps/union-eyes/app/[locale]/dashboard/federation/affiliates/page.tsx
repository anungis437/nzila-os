/**
 * Federation affiliates: the member unions and locals directly below this organization.
 *
 * The filters are a plain GET form, so the list is filtered by the server from the address (?q=&type=&status=) and a filtered page can be linked to. The
 * type and status choices are the ones the affiliates actually have. Nothing here exports, creates or changes an affiliate.
 */

export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Building2, Filter, Mail, MapPin, Phone, Search, TrendingUp, Users } from 'lucide-react';
import { requireUser } from '@/lib/api-auth-guard';
import { hasFederationAccess } from '@/lib/organizations/federation-access';
import { listAffiliates } from '@/lib/organizations/affiliates';
import { filterAffiliates } from '@/lib/organizations/affiliate-filter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export const metadata: Metadata = {
  title: 'Affiliates | Federation Dashboard',
  description: 'View the member unions and locals within the federation',
};

const SELECT = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));

export default async function FederationAffiliatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const orgId = user.organizationId;
  if (!orgId || !(await hasFederationAccess(user.userId, orgId))) redirect(`/${locale}/dashboard`);

  const t = await getTranslations({ locale, namespace: 'federation.affiliates' });
  // A failed read is an error, not an empty list.
  const affiliates = await listAffiliates({ userId: user.userId, organizationId: orgId });

  const filter = { q: first(query.q).trim(), type: first(query.type), status: first(query.status) };
  const shown = filterAffiliates(affiliates, filter);
  const filtered = filter.q !== '' || filter.type !== '' || filter.status !== '';

  const types = [...new Set(affiliates.map((affiliate) => affiliate.organizationType))].sort();
  const statuses = [...new Set(affiliates.map((affiliate) => affiliate.status).filter((status): status is string => !!status))].sort();
  const typeLabel = (type: string): string => (type === 'local' ? t('filters.locals') : type === 'union' ? t('filters.unions') : type);
  const statusLabel = (status: string): string => (status === 'active' ? t('filters.active') : status === 'inactive' ? t('filters.inactive') : status);
  const number = new Intl.NumberFormat(locale);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link href={`/${locale}/dashboard/federation`} className="text-sm text-muted-foreground hover:text-foreground">
            {t('breadcrumb.federation')}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">{t('breadcrumb.affiliates')}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('summary.total')}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{number.format(affiliates.length)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('summary.locals')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{number.format(affiliates.filter((affiliate) => affiliate.organizationType === 'local').length)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('summary.unions')}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{number.format(affiliates.filter((affiliate) => affiliate.organizationType === 'union').length)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('filters.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input name="q" defaultValue={filter.q} aria-label={t('filters.search')} placeholder={t('filters.search')} className="pl-10" />
            </div>
            <select name="type" defaultValue={filter.type} aria-label={t('filters.type')} className={SELECT}>
              <option value="">{t('filters.allTypes')}</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={filter.status} aria-label={t('filters.status')} className={SELECT}>
              <option value="">{t('filters.allStatuses')}</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button type="submit" variant="outline" className="flex-1">
                {t('filters.apply')}
              </Button>
              {filtered && (
                <Button variant="ghost" asChild>
                  <Link href={`/${locale}/dashboard/federation/affiliates`}>{t('filters.clear')}</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('list.title')}
          </CardTitle>
          <CardDescription>
            {filtered ? t('list.filtered', { shown: shown.length, total: affiliates.length }) : t('list.description', { count: affiliates.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shown.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">{t('list.empty.title')}</h3>
              <p className="text-muted-foreground">{affiliates.length === 0 ? t('list.empty.none') : t('list.empty.description')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shown.map((affiliate) => (
                <div key={affiliate.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-semibold text-lg">{affiliate.name}</h3>
                    {affiliate.clcAffiliateCode && <Badge variant="outline">{affiliate.clcAffiliateCode}</Badge>}
                    <Badge variant="secondary" className="capitalize">
                      {typeLabel(affiliate.organizationType)}
                    </Badge>
                    {affiliate.status && affiliate.status !== 'active' && <Badge variant="destructive">{statusLabel(affiliate.status)}</Badge>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-muted-foreground">
                    {affiliate.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{affiliate.email}</span>
                      </div>
                    )}
                    {affiliate.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{affiliate.phone}</span>
                      </div>
                    )}
                    {affiliate.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{affiliate.address}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mt-2">{t('list.members', { count: affiliate.memberCount })}</p>
                  {affiliate.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{affiliate.description}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/dashboard/federation/remittances`}>
            <TrendingUp className="mr-2 h-4 w-4" />
            {t('quickLinks.remittances')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
