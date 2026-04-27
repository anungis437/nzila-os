/**
 * Billing Admin Dashboard
 * For Billing Manager & Billing Specialists - Subscription & payment operations
 *
 * @role billing_manager, billing_specialist
 * @dashboard_path /dashboard/billing-admin
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { DollarSign, CreditCard, TrendingUp, Users, FileText, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { logger } from '@/lib/logger';
import {
  getAdminSubscriptions,
  getAdminInvoices,
  getAdminPayments,
} from '@/services/platform-economics';
import { formatCurrency } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';

// ── Types ──────────────────────────────────────────────────────────────────

interface Subscription {
  id: string;
  organizationId: string;
  orgName: string;
  planName: string;
  planCode: string;
  pricingModel: string;
  baseFee: string;
  currency: string;
  billingInterval: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  localCount: number | null;
  seatCount: number | null;
  discountPercent: string | null;
  memberCount: number | null;
  perCapitaRate: string | null;
  createdAt: Date;
}

interface Invoice {
  id: string;
  organizationId: string;
  orgName: string;
  invoiceNumber: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  dueDate: Date;
  issueDate: Date;
  notes: string | null;
  createdAt: Date;
}

interface Payment {
  id: string;
  organizationId: string;
  orgName: string;
  amount: string;
  currency: string;
  status: string;
  method: string;
  failureReason: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

interface BillingStats {
  totalMrr: number;
  activeSubscriptions: number;
  totalSubscriptions: number;
  paymentSuccessRate: number;
  totalPayments: number;
  succeededPayments: number;
  failedPayments: number;
  overdueInvoices: number;
  issuedInvoices: number;
  paidInvoices: number;
  totalInvoices: number;
  totalRevenue: number;
  totalOutstanding: number;
}

// ── Data loaders ───────────────────────────────────────────────────────────

async function loadSubscriptions(): Promise<Subscription[]> {
  const rows = await getAdminSubscriptions();
  return rows as Subscription[];
}

async function loadInvoices(): Promise<Invoice[]> {
  const rows = await getAdminInvoices();
  return rows as Invoice[];
}

async function loadPayments(): Promise<Payment[]> {
  const rows = await getAdminPayments();
  return rows as Payment[];
}

function computeStats(
  subscriptions: Subscription[],
  invoices: Invoice[],
  payments: Payment[],
): BillingStats {
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
  const totalMrr = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + Number(s.baseFee), 0);

  const completedPayments = payments.filter(p => p.status === 'completed').length;
  const failedPayments = payments.filter(p => p.status === 'failed').length;
  const totalPayments = payments.length;
  const paymentSuccessRate = totalPayments > 0
    ? Math.round((completedPayments / totalPayments) * 1000) / 10
    : 100;

  const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;
  const issuedInvoices = invoices.filter(i => i.status === 'issued').length;
  const paidInvoices = invoices.filter(i => i.status === 'paid').length;
  const totalRevenue = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalOutstanding = invoices
    .reduce((sum, i) => sum + (Number(i.totalAmount) - Number(i.amountPaid)), 0);

  return {
    totalMrr,
    activeSubscriptions,
    totalSubscriptions: subscriptions.length,
    paymentSuccessRate,
    totalPayments,
    succeededPayments: completedPayments,
    failedPayments,
    overdueInvoices,
    issuedInvoices,
    paidInvoices,
    totalInvoices: invoices.length,
    totalRevenue,
    totalOutstanding,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function invoiceStatusVariant(status: string) {
  switch (status) {
    case 'paid': return 'default' as const;
    case 'issued': return 'secondary' as const;
    case 'overdue': return 'destructive' as const;
    case 'draft': return 'outline' as const;
    default: return 'outline' as const;
  }
}

function paymentStatusVariant(status: string) {
  switch (status) {
    case 'completed': return 'default' as const;
    case 'failed': return 'destructive' as const;
    case 'pending': return 'secondary' as const;
    default: return 'outline' as const;
  }
}

function formatDate(dateStr: string | Date, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function timeAgo(dateStr: string | Date, t: Awaited<ReturnType<typeof getTranslations>>) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return t('timeAgo.minutes', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('timeAgo.hours', { count: hours });
  const days = Math.floor(hours / 24);
  return t('timeAgo.days', { count: days });
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function BillingAdminDashboard({
  params: paramsPromise,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const { locale } = await paramsPromise;
  const params = await searchParams;
  const t = await getTranslations('billingAdminPage');
  const activeTab = params.tab ?? 'overview';
  const filterStatus = params.status ?? null;

  await requireUser();

  const hasAccess = await hasMinRole('billing_specialist');
  if (!hasAccess) {
    redirect(`/${locale}/dashboard`);
  }

  let subscriptions: Subscription[] = [];
  let invoices: Invoice[] = [];
  let payments: Payment[] = [];

  try {
    [subscriptions, invoices, payments] = await Promise.all([
      loadSubscriptions(),
      loadInvoices(),
      loadPayments(),
    ]);
  } catch (error) {
    logger.error('Error loading billing data:', error);
  }

  const stats = computeStats(subscriptions, invoices, payments);

  // Filtered views
  const filteredInvoices = filterStatus
    ? invoices.filter(i => i.status === filterStatus)
    : invoices;
  const filteredPayments = filterStatus
    ? payments.filter(p => p.status === filterStatus)
    : payments;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <Link href={`/${locale}/dashboard/billing-admin`} className="no-underline">{t('tabs.overview')}</Link>
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <Link href={`/${locale}/dashboard/billing-admin?tab=subscriptions`} className="no-underline">
              {t('tabs.subscriptions', { count: stats.activeSubscriptions })}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <Link href={`/${locale}/dashboard/billing-admin?tab=invoices`} className="no-underline">
              {t('tabs.invoices')} {stats.overdueInvoices > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-xs">{stats.overdueInvoices}</Badge>
              )}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="payments">
            <Link href={`/${locale}/dashboard/billing-admin?tab=payments`} className="no-underline">
              {t('tabs.payments', { count: stats.totalPayments })}
            </Link>
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ─────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href={`/${locale}/dashboard/billing-admin?tab=subscriptions`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {t('overview.monthlyRecurringRevenueTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.totalMrr)}</div>
                  <p className="text-xs text-muted-foreground">
                    {t('overview.activeSubscriptions', { count: stats.activeSubscriptions })}
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/${locale}/dashboard/billing-admin?tab=subscriptions`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t('overview.activeSubscriptionsTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
                  <p className="text-xs text-muted-foreground">{t('overview.totalSubscriptions', { count: stats.totalSubscriptions })}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/${locale}/dashboard/billing-admin?tab=payments`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {t('overview.paymentSuccessRateTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stats.paymentSuccessRate >= 98 ? 'text-green-600' : stats.paymentSuccessRate >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {stats.paymentSuccessRate}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('overview.paymentsCount', { succeeded: stats.succeededPayments, total: stats.totalPayments })}
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/${locale}/dashboard/billing-admin?tab=invoices&status=overdue`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {t('overview.overdueTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stats.overdueInvoices > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.overdueInvoices}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('overview.outstandingAmount', { amount: formatCurrency(stats.totalOutstanding) })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {t('revenueSummary.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('revenueSummary.totalRevenueCollected')}</span>
                    <span className="text-sm font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('revenueSummary.monthlyRecurring')}</span>
                    <span className="text-sm font-bold">{formatCurrency(stats.totalMrr)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('revenueSummary.outstanding')}</span>
                    <span className={`text-sm font-bold ${stats.totalOutstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatCurrency(stats.totalOutstanding)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('revenueSummary.failedPayments')}</span>
                    <Badge variant={stats.failedPayments > 0 ? 'destructive' : 'outline'}>{stats.failedPayments}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('invoiceSummary.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link href={`/${locale}/dashboard/billing-admin?tab=invoices`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">{t('invoiceSummary.totalInvoices')}</span>
                    <span className="text-sm font-bold">{stats.totalInvoices}</span>
                  </Link>
                  <Link href={`/${locale}/dashboard/billing-admin?tab=invoices&status=paid`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">{t('statuses.paid')}</span>
                    <Badge variant="default">{stats.paidInvoices}</Badge>
                  </Link>
                  <Link href={`/${locale}/dashboard/billing-admin?tab=invoices&status=issued`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">{t('invoiceSummary.issuedAwaiting')}</span>
                    <Badge variant="secondary">{stats.issuedInvoices}</Badge>
                  </Link>
                  <Link href={`/${locale}/dashboard/billing-admin?tab=invoices&status=overdue`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">{t('statuses.overdue')}</span>
                    <Badge variant={stats.overdueInvoices > 0 ? 'destructive' : 'outline'}>{stats.overdueInvoices}</Badge>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Subscriptions Tab ────────────────────────────────────────── */}
        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('subscriptions.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('subscriptions.empty')}</p>
              ) : (
                <div className="space-y-4">
                  {subscriptions.map((sub) => (
                    <div key={sub.id} className="flex items-start justify-between border-b pb-4 last:border-0 gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{sub.orgName}</span>
                          <Badge variant="outline" className="text-xs capitalize">{sub.planCode}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{sub.planName}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>{t('subscriptions.members', { count: (sub.memberCount ?? 0).toLocaleString(locale) })}</span>
                          <span>&bull;</span>
                          <span>{t('subscriptions.perCapita', { amount: formatCurrency(Number(sub.perCapitaRate ?? 0)) })}</span>
                          <span>&bull;</span>
                          <span>{t('subscriptions.billedInterval', { interval: sub.billingInterval })}</span>
                          {sub.endDate && (
                            <>
                              <span>&bull;</span>
                              <span>{t('subscriptions.renews', { date: formatDate(sub.endDate, locale) })}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right space-y-1 shrink-0">
                        <Badge variant={sub.status === 'active' ? 'default' : sub.status === 'cancelled' ? 'destructive' : 'secondary'}>
                          {t(`statuses.${sub.status}`)}
                        </Badge>
                        <p className="text-sm font-bold">{t('subscriptions.monthlyFee', { amount: formatCurrency(Number(sub.baseFee)) })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Invoices Tab ─────────────────────────────────────────────── */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('invoices.title')}</CardTitle>
                {filterStatus ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t('invoices.filtered', { status: filterStatus })}</Badge>
                    <Link href={`/${locale}/dashboard/billing-admin?tab=invoices`} className="text-xs text-muted-foreground hover:text-foreground">
                      {t('invoices.clearFilter')}
                    </Link>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Link href={`/${locale}/dashboard/billing-admin?tab=invoices&status=paid`}>
                      <Badge variant="default" className="cursor-pointer hover:opacity-80">{t('invoices.paidFilter', { count: stats.paidInvoices })}</Badge>
                    </Link>
                    {stats.issuedInvoices > 0 && (
                      <Link href={`/${locale}/dashboard/billing-admin?tab=invoices&status=issued`}>
                        <Badge variant="secondary" className="cursor-pointer hover:opacity-80">{t('invoices.issuedFilter', { count: stats.issuedInvoices })}</Badge>
                      </Link>
                    )}
                    {stats.overdueInvoices > 0 && (
                      <Link href={`/${locale}/dashboard/billing-admin?tab=invoices&status=overdue`}>
                        <Badge variant="destructive" className="cursor-pointer hover:opacity-80">{t('invoices.overdueFilter', { count: stats.overdueInvoices })}</Badge>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('invoices.empty')}</p>
              ) : (
                <div className="space-y-3">
                  {filteredInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-start justify-between border-b pb-3 last:border-0 gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium font-mono">{inv.invoiceNumber}</span>
                          <span className="text-sm text-muted-foreground">&mdash; {inv.orgName}</span>
                        </div>
                        {inv.notes && (
                          <p className="text-xs text-muted-foreground">{inv.notes}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {inv.issueDate && <span>{t('invoices.issuedDate', { date: formatDate(inv.issueDate, locale) })}</span>}
                          {inv.dueDate && (
                            <>
                              <span>&bull;</span>
                              <span className={inv.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                                {t('invoices.dueDate', { date: formatDate(inv.dueDate, locale) })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right space-y-1 shrink-0">
                        <Badge variant={invoiceStatusVariant(inv.status)}>
                          {t(`statuses.${inv.status}`)}
                        </Badge>
                        <p className="text-sm font-bold">{formatCurrency(Number(inv.totalAmount))}</p>
                        {Number(inv.totalAmount) - Number(inv.amountPaid) > 0 && (
                          <p className="text-xs text-orange-600">{t('invoices.dueAmount', { amount: formatCurrency(Number(inv.totalAmount) - Number(inv.amountPaid)) })}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payments Tab ─────────────────────────────────────────────── */}
        <TabsContent value="payments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('payments.succeededTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.succeededPayments}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('statuses.failed')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.failedPayments}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('payments.successRateTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.paymentSuccessRate >= 98 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {stats.paymentSuccessRate}%
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('payments.title')}</CardTitle>
                {filterStatus ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t('payments.filtered', { status: filterStatus })}</Badge>
                    <Link href={`/${locale}/dashboard/billing-admin?tab=payments`} className="text-xs text-muted-foreground hover:text-foreground">
                      {t('payments.clearFilter')}
                    </Link>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Link href={`/${locale}/dashboard/billing-admin?tab=payments&status=completed`}>
                      <Badge variant="default" className="cursor-pointer hover:opacity-80">{t('payments.succeededFilter', { count: stats.succeededPayments })}</Badge>
                    </Link>
                    {stats.failedPayments > 0 && (
                      <Link href={`/${locale}/dashboard/billing-admin?tab=payments&status=failed`}>
                        <Badge variant="destructive" className="cursor-pointer hover:opacity-80">{t('payments.failedFilter', { count: stats.failedPayments })}</Badge>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('payments.empty')}</p>
              ) : (
                <div className="space-y-3">
                  {filteredPayments.map((pay) => (
                    <div key={pay.id} className="flex items-start justify-between border-b pb-3 last:border-0 gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{pay.orgName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            {t('payments.method', { method: pay.method })}
                          </span>
                          <span>&bull;</span>
                          <span>{timeAgo(pay.createdAt, t)}</span>
                        </div>
                        {pay.failureReason && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            {pay.failureReason}
                          </p>
                        )}
                      </div>
                      <div className="text-right space-y-1 shrink-0">
                        <Badge variant={paymentStatusVariant(pay.status)}>
                          {pay.status === 'completed' ? (
                            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{t('payments.completed')}</span>
                          ) : pay.status === 'failed' ? (
                            <span className="flex items-center gap-1"><XCircle className="h-3 w-3" />{t('statuses.failed')}</span>
                          ) : (
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t(`statuses.${pay.status}`)}</span>
                          )}
                        </Badge>
                        <p className="text-sm font-bold">{formatCurrency(Number(pay.amount), pay.currency)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
