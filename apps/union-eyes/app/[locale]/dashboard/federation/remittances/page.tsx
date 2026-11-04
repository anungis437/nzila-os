/**
 * Provincial remittances: what this organization has been sent, reflected and nothing more.
 *
 * Dues and per-capita remittances are handled in an external system. Union Eyes reflects the remittance records that reached this organization (read in
 * its own context, see lib/organizations/per-capita-standing.ts) and does not collect, calculate, submit, reconcile or export them, so this page has no
 * filters, no export and no ledger. It shows four counts taken from those records; when there are no records it says so, and a read that fails is an
 * error, never a row of zeros.
 */

export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AlertCircle, Clock, Info, ShieldCheck, Users } from 'lucide-react';
import { requireUser } from '@/lib/api-auth-guard';
import { hasFederationAccess } from '@/lib/organizations/federation-access';
import { loadRemittanceFacts, summarizeRemittances } from '@/lib/organizations/per-capita-standing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Provincial Remittances | Federation Dashboard',
  description: 'Per-capita dues remittances reported to this organization by its member unions and locals',
};

export default async function FederationRemittancesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser();
  const orgId = user.organizationId;
  if (!orgId || !(await hasFederationAccess(user.userId, orgId))) redirect(`/${locale}/dashboard`);

  const t = await getTranslations({ locale, namespace: 'federation.remittances' });
  const facts = await loadRemittanceFacts(orgId);
  const metrics = summarizeRemittances(facts);
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: 'percent' });

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link href={`/${locale}/dashboard/federation`} className="text-sm text-muted-foreground hover:text-foreground">
            {t('breadcrumb.federation')}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">{t('breadcrumb.remittances')}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      <div role="note" className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-900">
        <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{t('externalNotice.title')}</p>
          <p className="text-sm">{t('externalNotice.body')}</p>
        </div>
      </div>

      {facts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-lg font-semibold mb-2">{t('empty.title')}</h2>
            <p className="text-muted-foreground">{t('empty.description')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('summary.pending')}</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{number.format(metrics.pendingRemittances)}</div>
                <p className="text-xs text-muted-foreground">{t('summary.awaitingSubmission')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('summary.overdue')}</CardTitle>
                <AlertCircle className={`h-4 w-4 ${metrics.overdueRemittances > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${metrics.overdueRemittances > 0 ? 'text-destructive' : ''}`}>{number.format(metrics.overdueRemittances)}</div>
                <p className="text-xs text-muted-foreground">{t('summary.pastDue')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('summary.members')}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{number.format(metrics.totalMembers)}</div>
                <p className="text-xs text-muted-foreground">{t('summary.membersNote')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('summary.onTime')}</CardTitle>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {/* No remittance fell due in the last twelve months: there is no rate, and none is shown. */}
                <div className="text-2xl font-bold">{metrics.complianceRate === null ? '—' : percent.format(metrics.complianceRate / 100)}</div>
                <p className="text-xs text-muted-foreground">{metrics.complianceRate === null ? t('summary.noneDue') : t('summary.onTimeNote')}</p>
              </CardContent>
            </Card>
          </div>

          {metrics.overdueRemittances > 0 && (
            <Card className="border-destructive bg-destructive/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  {t('alerts.overdue.title')}
                </CardTitle>
                <CardDescription>{t('alerts.overdue.description', { count: metrics.overdueRemittances })}</CardDescription>
              </CardHeader>
            </Card>
          )}
        </>
      )}

      <div>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/dashboard/federation/affiliates`}>{t('quickLinks.affiliates')}</Link>
        </Button>
      </div>
    </div>
  );
}
