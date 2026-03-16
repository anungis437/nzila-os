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
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

// ── Types ──────────────────────────────────────────────────────────────────

interface Subscription {
  id: string;
  orgId: string;
  orgName: string;
  planName: string;
  planTier: string;
  status: string;
  amountCents: number;
  currency: string;
  billingInterval: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  memberCount: number;
  perCapitaRate: number;
  createdAt: string;
}

interface Invoice {
  id: string;
  orgId: string;
  orgName: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  dueDate: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  description: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  orgId: string;
  orgName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  cardLast4: string | null;
  cardBrand: string | null;
  failureReason: string | null;
  createdAt: string;
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
  const result = await db.execute(sql`
    SELECT
      bs.id, bs.organization_id, o.name AS org_name,
      bs.plan_name, bs.plan_tier, bs.status, bs.amount_cents,
      bs.currency, bs.billing_interval,
      bs.current_period_start, bs.current_period_end,
      o.member_count, o.per_capita_rate, bs.created_at
    FROM billing_subscriptions bs
    JOIN organizations o ON o.id = bs.organization_id
    ORDER BY bs.amount_cents DESC
  `);

  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    orgId: r.organization_id as string,
    orgName: r.org_name as string,
    planName: r.plan_name as string,
    planTier: r.plan_tier as string,
    status: r.status as string,
    amountCents: Number(r.amount_cents ?? 0),
    currency: r.currency as string,
    billingInterval: r.billing_interval as string,
    currentPeriodStart: r.current_period_start as string | null,
    currentPeriodEnd: r.current_period_end as string | null,
    memberCount: Number(r.member_count ?? 0),
    perCapitaRate: Number(r.per_capita_rate ?? 0),
    createdAt: r.created_at as string,
  }));
}

async function loadInvoices(): Promise<Invoice[]> {
  const result = await db.execute(sql`
    SELECT
      bi.id, bi.organization_id, o.name AS org_name,
      bi.invoice_number, bi.status, bi.subtotal, bi.tax_total,
      bi.total, bi.amount_paid, bi.amount_due,
      bi.due_date, bi.issued_at, bi.paid_at, bi.description, bi.created_at
    FROM billing_invoices bi
    JOIN organizations o ON o.id = bi.organization_id
    ORDER BY bi.created_at DESC
  `);

  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    orgId: r.organization_id as string,
    orgName: r.org_name as string,
    invoiceNumber: r.invoice_number as string,
    status: r.status as string,
    subtotal: Number(r.subtotal ?? 0),
    taxTotal: Number(r.tax_total ?? 0),
    total: Number(r.total ?? 0),
    amountPaid: Number(r.amount_paid ?? 0),
    amountDue: Number(r.amount_due ?? 0),
    dueDate: r.due_date as string | null,
    issuedAt: r.issued_at as string | null,
    paidAt: r.paid_at as string | null,
    description: r.description as string | null,
    createdAt: r.created_at as string,
  }));
}

async function loadPayments(): Promise<Payment[]> {
  const result = await db.execute(sql`
    SELECT
      bp.id, bp.organization_id, o.name AS org_name,
      bi.invoice_number,
      bp.amount, bp.currency, bp.status, bp.payment_method,
      bp.card_last4, bp.card_brand, bp.failure_reason, bp.created_at
    FROM billing_payments bp
    JOIN organizations o ON o.id = bp.organization_id
    LEFT JOIN billing_invoices bi ON bi.id = bp.invoice_id
    ORDER BY bp.created_at DESC
  `);

  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    orgId: r.organization_id as string,
    orgName: r.org_name as string,
    invoiceNumber: r.invoice_number as string | null,
    amount: Number(r.amount ?? 0),
    currency: r.currency as string,
    status: r.status as string,
    paymentMethod: r.payment_method as string,
    cardLast4: r.card_last4 as string | null,
    cardBrand: r.card_brand as string | null,
    failureReason: r.failure_reason as string | null,
    createdAt: r.created_at as string,
  }));
}

function computeStats(
  subscriptions: Subscription[],
  invoices: Invoice[],
  payments: Payment[],
): BillingStats {
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
  const totalMrr = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + s.amountCents, 0) / 100;

  const succeededPayments = payments.filter(p => p.status === 'succeeded').length;
  const failedPayments = payments.filter(p => p.status === 'failed').length;
  const totalPayments = payments.length;
  const paymentSuccessRate = totalPayments > 0
    ? Math.round((succeededPayments / totalPayments) * 1000) / 10
    : 100;

  const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;
  const issuedInvoices = invoices.filter(i => i.status === 'issued').length;
  const paidInvoices = invoices.filter(i => i.status === 'paid').length;
  const totalRevenue = payments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = invoices
    .reduce((sum, i) => sum + i.amountDue, 0);

  return {
    totalMrr,
    activeSubscriptions,
    totalSubscriptions: subscriptions.length,
    paymentSuccessRate,
    totalPayments,
    succeededPayments,
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
    case 'succeeded': return 'default' as const;
    case 'failed': return 'destructive' as const;
    case 'pending': return 'secondary' as const;
    default: return 'outline' as const;
  }
}

function formatCurrency(amount: number, currency = 'CAD') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function BillingAdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab ?? 'overview';
  const filterStatus = params.status ?? null;

  await requireUser();

  const hasAccess = await hasMinRole('billing_specialist');
  if (!hasAccess) {
    redirect('/dashboard');
  }

  let subscriptions: Subscription[] = [];
  let invoices: Invoice[] = [];
  let payments: Payment[] = [];

  try {
    [subscriptions, invoices, payments] = await withSystemContext(() =>
      Promise.all([
        loadSubscriptions(),
        loadInvoices(),
        loadPayments(),
      ])
    );
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
        <h1 className="text-3xl font-bold tracking-tight">Billing & Subscriptions</h1>
        <p className="text-muted-foreground mt-1">
          Manage customer subscriptions, invoices, and payments
        </p>
      </div>

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <Link href="/dashboard/billing-admin" className="no-underline">Overview</Link>
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <Link href="/dashboard/billing-admin?tab=subscriptions" className="no-underline">
              Subscriptions ({stats.activeSubscriptions})
            </Link>
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <Link href="/dashboard/billing-admin?tab=invoices" className="no-underline">
              Invoices {stats.overdueInvoices > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-xs">{stats.overdueInvoices}</Badge>
              )}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="payments">
            <Link href="/dashboard/billing-admin?tab=payments" className="no-underline">
              Payments ({stats.totalPayments})
            </Link>
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ─────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/dashboard/billing-admin?tab=subscriptions" className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Monthly Recurring Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.totalMrr)}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.activeSubscriptions} active subscriptions
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/billing-admin?tab=subscriptions" className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Active Subscriptions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
                  <p className="text-xs text-muted-foreground">{stats.totalSubscriptions} total</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/billing-admin?tab=payments" className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Payment Success Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stats.paymentSuccessRate >= 98 ? 'text-green-600' : stats.paymentSuccessRate >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {stats.paymentSuccessRate}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.succeededPayments}/{stats.totalPayments} payments
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/billing-admin?tab=invoices&status=overdue" className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Overdue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stats.overdueInvoices > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.overdueInvoices}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(stats.totalOutstanding)} outstanding
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
                  Revenue Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Revenue Collected</span>
                    <span className="text-sm font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Monthly Recurring</span>
                    <span className="text-sm font-bold">{formatCurrency(stats.totalMrr)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Outstanding</span>
                    <span className={`text-sm font-bold ${stats.totalOutstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatCurrency(stats.totalOutstanding)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Failed Payments</span>
                    <Badge variant={stats.failedPayments > 0 ? 'destructive' : 'outline'}>{stats.failedPayments}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoice Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link href="/dashboard/billing-admin?tab=invoices" className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">Total Invoices</span>
                    <span className="text-sm font-bold">{stats.totalInvoices}</span>
                  </Link>
                  <Link href="/dashboard/billing-admin?tab=invoices&status=paid" className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">Paid</span>
                    <Badge variant="default">{stats.paidInvoices}</Badge>
                  </Link>
                  <Link href="/dashboard/billing-admin?tab=invoices&status=issued" className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">Issued (awaiting)</span>
                    <Badge variant="secondary">{stats.issuedInvoices}</Badge>
                  </Link>
                  <Link href="/dashboard/billing-admin?tab=invoices&status=overdue" className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">Overdue</span>
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
              <CardTitle>Organization Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscriptions found</p>
              ) : (
                <div className="space-y-4">
                  {subscriptions.map((sub) => (
                    <div key={sub.id} className="flex items-start justify-between border-b pb-4 last:border-0 gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{sub.orgName}</span>
                          <Badge variant="outline" className="text-xs capitalize">{sub.planTier}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{sub.planName}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>{sub.memberCount.toLocaleString()} members</span>
                          <span>&bull;</span>
                          <span>Per-capita: {formatCurrency(sub.perCapitaRate)}</span>
                          <span>&bull;</span>
                          <span>Billed {sub.billingInterval}</span>
                          {sub.currentPeriodEnd && (
                            <>
                              <span>&bull;</span>
                              <span>Renews {formatDate(sub.currentPeriodEnd)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right space-y-1 shrink-0">
                        <Badge variant={sub.status === 'active' ? 'default' : sub.status === 'canceled' ? 'destructive' : 'secondary'}>
                          {sub.status}
                        </Badge>
                        <p className="text-sm font-bold">{formatCurrency(sub.amountCents / 100)}/mo</p>
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
                <CardTitle>Invoices</CardTitle>
                {filterStatus ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Filtered: {filterStatus}</Badge>
                    <Link href="/dashboard/billing-admin?tab=invoices" className="text-xs text-muted-foreground hover:text-foreground">
                      Clear filter
                    </Link>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Link href="/dashboard/billing-admin?tab=invoices&status=paid">
                      <Badge variant="default" className="cursor-pointer hover:opacity-80">Paid ({stats.paidInvoices})</Badge>
                    </Link>
                    {stats.issuedInvoices > 0 && (
                      <Link href="/dashboard/billing-admin?tab=invoices&status=issued">
                        <Badge variant="secondary" className="cursor-pointer hover:opacity-80">Issued ({stats.issuedInvoices})</Badge>
                      </Link>
                    )}
                    {stats.overdueInvoices > 0 && (
                      <Link href="/dashboard/billing-admin?tab=invoices&status=overdue">
                        <Badge variant="destructive" className="cursor-pointer hover:opacity-80">Overdue ({stats.overdueInvoices})</Badge>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices found</p>
              ) : (
                <div className="space-y-3">
                  {filteredInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-start justify-between border-b pb-3 last:border-0 gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium font-mono">{inv.invoiceNumber}</span>
                          <span className="text-sm text-muted-foreground">&mdash; {inv.orgName}</span>
                        </div>
                        {inv.description && (
                          <p className="text-xs text-muted-foreground">{inv.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {inv.issuedAt && <span>Issued {formatDate(inv.issuedAt)}</span>}
                          {inv.dueDate && (
                            <>
                              <span>&bull;</span>
                              <span className={inv.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                                Due {formatDate(inv.dueDate)}
                              </span>
                            </>
                          )}
                          {inv.paidAt && (
                            <>
                              <span>&bull;</span>
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                Paid {formatDate(inv.paidAt)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right space-y-1 shrink-0">
                        <Badge variant={invoiceStatusVariant(inv.status)}>
                          {inv.status}
                        </Badge>
                        <p className="text-sm font-bold">{formatCurrency(inv.total)}</p>
                        {inv.amountDue > 0 && (
                          <p className="text-xs text-orange-600">Due: {formatCurrency(inv.amountDue)}</p>
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
                <CardTitle className="text-sm font-medium">Succeeded</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.succeededPayments}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.failedPayments}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
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
                <CardTitle>Payment History</CardTitle>
                {filterStatus ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Filtered: {filterStatus}</Badge>
                    <Link href="/dashboard/billing-admin?tab=payments" className="text-xs text-muted-foreground hover:text-foreground">
                      Clear filter
                    </Link>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Link href="/dashboard/billing-admin?tab=payments&status=succeeded">
                      <Badge variant="default" className="cursor-pointer hover:opacity-80">Succeeded ({stats.succeededPayments})</Badge>
                    </Link>
                    {stats.failedPayments > 0 && (
                      <Link href="/dashboard/billing-admin?tab=payments&status=failed">
                        <Badge variant="destructive" className="cursor-pointer hover:opacity-80">Failed ({stats.failedPayments})</Badge>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments found</p>
              ) : (
                <div className="space-y-3">
                  {filteredPayments.map((pay) => (
                    <div key={pay.id} className="flex items-start justify-between border-b pb-3 last:border-0 gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{pay.orgName}</span>
                          {pay.invoiceNumber && (
                            <span className="text-xs text-muted-foreground font-mono">{pay.invoiceNumber}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            {pay.cardBrand ?? 'Card'} {pay.cardLast4 ? `••••${pay.cardLast4}` : ''}
                          </span>
                          <span>&bull;</span>
                          <span>{timeAgo(pay.createdAt)}</span>
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
                          {pay.status === 'succeeded' ? (
                            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Succeeded</span>
                          ) : pay.status === 'failed' ? (
                            <span className="flex items-center gap-1"><XCircle className="h-3 w-3" />Failed</span>
                          ) : (
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pay.status}</span>
                          )}
                        </Badge>
                        <p className="text-sm font-bold">{formatCurrency(pay.amount, pay.currency)}</p>
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
