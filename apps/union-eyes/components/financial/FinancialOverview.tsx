'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  Receipt,
  CreditCard,
  FileWarning,
  Users,
  Shield,
  Percent,
  CalendarCheck,
  Gavel,
  Landmark,
  PiggyBank,
  Wallet,
  Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import FinancialAiInsights from './FinancialAiInsights';

// ── Types matching API response shapes ───────────────────────────────────────

interface FinancialKpis {
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  currentBalance: number;
}

interface PaymentStats {
  pending: number;
  paid: number;
  overdue: number;
  total: number;
}

interface RecentPayment {
  id: string;
  memberName: string;
  amount: number;
  status: string;
  paidDate: string | null;
  dueDate: string;
}

interface PeriodStats {
  thisMonth: { collected: number; outstanding: number; transactionCount: number };
  lastMonth: { collected: number; outstanding: number; transactionCount: number };
}

interface DuesOverview {
  financialKpis: FinancialKpis;
  paymentStats: PaymentStats;
  recentPayments: RecentPayment[];
  periodStats: PeriodStats;
}

interface DuesDashboard {
  totalCollected: number;
  pendingRemittances: number;
  inArrears: number;
  reconciliationQueue: number;
}

interface ArrearsCase {
  id: string;
  memberId: string;
  memberName: string;
  email: string;
  amountOwed: string;
  status: string;
  hasPaymentPlan: boolean;
  lastPayment: string | null;
  monthsBehind: number;
}

// ── Executive Summary types ──────────────────────────────────────────────────

interface RemittancePeriod {
  year: number;
  month: number;
  amount: number;
  memberCount: number;
  expected: number;
  variance: number;
  reconciled: boolean;
  status: string;
}

interface FinancialPeriod {
  year: number;
  month: number;
  status: string;
  revenue: number;
  arrears: number;
  memberCount: number;
}

interface ExecutiveSummary {
  collectionRate: number;
  totalPaid: number;
  totalCharged: number;
  uniquePayingMembers: number;
  totalOrgMembers: number;
  memberStanding: {
    total: number;
    current: number;
    warning: number;
    suspended: number;
    onPaymentPlan: number;
  };
  paymentPlans: {
    activePlans: number;
    totalRemaining: number;
    totalRecovered: number;
  };
  reconciliation: {
    reconciled: number;
    unreconciled: number;
    unreconciledAmount: number;
  };
  remittanceTrend: RemittancePeriod[];
  financialPeriods: FinancialPeriod[];
  strikeFund: {
    totalDisbursements: number;
    totalDisbursed: number;
    craThresholdBreaches: number;
    requiresT4a: number;
    t4aGenerated: number;
  };
  perCapitaTax: {
    totalPaid: number;
    totalPending: number;
    entries: {
      year: number;
      month: number;
      amount: number;
      members: number;
      rate: number;
      status: string;
      dueDate: string;
    }[];
  };
  grievanceCosts: {
    totalClaims: number;
    openClaims: number;
    totalLegalCosts: number;
    arbitrations: {
      total: number;
      estimatedCost: number;
      actualCost: number;
      unionShare: number;
    };
    settlements: {
      total: number;
      totalSettled: number;
      accepted: number;
    };
  };
  pensionHealth: {
    totalMembers: number;
    activeMembers: number;
    totalYearsService: number;
    contributions: {
      total: number;
      received: number;
      pending: number;
      totalFunded: number;
      totalPending: number;
    };
  };
  glSnapshot: {
    assets: number;
    liabilities: number;
    equity: number;
    revenue: number;
    expenses: number;
    netPosition: number;
  };
  perCapitaInbound: {
    isParentOrg: boolean;
    childCount: number;
    totalDue: number;
    totalPaid: number;
    totalOverdue: number;
    children: {
      orgId: string;
      orgName: string;
      totalDue: number;
      totalPaid: number;
      totalOverdue: number;
      pendingCount: number;
      overdueCount: number;
    }[];
  };
  budgets: {
    name: string;
    totalBudget: number;
    allocated: number;
    spent: number;
    utilization: number;
  }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-8 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 w-1/4 bg-gray-200 rounded" />
          <div className="h-4 w-1/6 bg-gray-200 rounded" />
          <div className="h-4 w-1/6 bg-gray-100 rounded" />
          <div className="h-4 w-1/4 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  variant = 'default',
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: typeof DollarSign;
  trend?: number | null;
  trendLabel?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variantColors = {
    default: 'text-blue-600 bg-blue-50',
    success: 'text-emerald-600 bg-emerald-50',
    warning: 'text-amber-600 bg-amber-50',
    danger: 'text-red-600 bg-red-50',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn('rounded-lg p-2.5', variantColors[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend !== undefined && trend !== null && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {trend >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
            )}
            <span className={trend >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
            {trendLabel && (
              <span className="text-muted-foreground ml-1">{trendLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Arrears Status Badge ─────────────────────────────────────────────────────

function ArrearsStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    warning: { label: 'Warning', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
    suspended: { label: 'Suspended', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
    bad_debt: { label: 'Bad Debt', className: 'bg-red-200 text-red-900 hover:bg-red-200' },
    current: { label: 'Current', className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' },
  };
  const c = config[status] ?? { label: status, className: 'bg-gray-100 text-gray-800' };
  return <Badge className={c.className}>{c.label}</Badge>;
}

// ── Payment Status Badge ─────────────────────────────────────────────────────

function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    posted: { label: 'Posted', className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
    reversed: { label: 'Reversed', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
    voided: { label: 'Voided', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
  };
  const c = config[status] ?? { label: status, className: 'bg-gray-100 text-gray-800' };
  return <Badge className={c.className}>{c.label}</Badge>;
}

// ═════════════════════════════════════════════════════════════════════════════
// FinancialOverview — organizational finance visibility surface
// ═════════════════════════════════════════════════════════════════════════════

export default function FinancialOverview() {
  const [overview, setOverview] = useState<DuesOverview | null>(null);
  const [dashboard, setDashboard] = useState<DuesDashboard | null>(null);
  const [arrearsCases, setArrearsCases] = useState<ArrearsCase[]>([]);
  const [executive, setExecutive] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, dashboardRes, arrearsRes, execRes] = await Promise.allSettled([
        fetch('/api/admin/dues/overview'),
        fetch('/api/dues/dashboard'),
        fetch('/api/dues/arrears'),
        fetch('/api/finance/summary'),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.ok) {
        const overviewJson = await overviewRes.value.json();
        setOverview(overviewJson.data ?? overviewJson);
      }
      if (dashboardRes.status === 'fulfilled' && dashboardRes.value.ok) {
        const dashJson = await dashboardRes.value.json();
        setDashboard(dashJson.data ?? dashJson);
      }
      if (arrearsRes.status === 'fulfilled' && arrearsRes.value.ok) {
        const arrearsJson = await arrearsRes.value.json();
        const members = arrearsJson.data?.members ?? arrearsJson.members ?? [];
        setArrearsCases(members);
      }
      if (execRes.status === 'fulfilled' && execRes.value.ok) {
        const execJson = await execRes.value.json();
        setExecutive(execJson.data ?? execJson);
      }
    } catch {
      setError('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <XCircle className="h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900">Unable to Load Financial Data</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const kpis = overview?.financialKpis;
  const period = overview?.periodStats;
  const collectionTrend = period
    ? percentChange(period.thisMonth.collected, period.lastMonth.collected)
    : null;

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      {loading ? (
        <KpiSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total Collected"
              value={formatCurrency(kpis?.totalCollected ?? 0)}
              subtitle={`${overview?.paymentStats.paid ?? 0} payments posted`}
              icon={DollarSign}
              trend={collectionTrend}
              trendLabel="vs last month"
              variant="success"
            />
            <KpiCard
              title="Outstanding"
              value={formatCurrency(kpis?.totalOutstanding ?? 0)}
              subtitle={`${overview?.paymentStats.pending ?? 0} pending`}
              icon={Clock}
              variant="warning"
            />
            <KpiCard
              title="Total Overdue"
              value={formatCurrency(kpis?.totalOverdue ?? 0)}
              subtitle={`${overview?.paymentStats.overdue ?? 0} members in arrears`}
              icon={AlertTriangle}
              variant="danger"
            />
            <KpiCard
              title="Collection Rate"
              value={`${executive?.collectionRate ?? 0}%`}
              subtitle={`${executive?.uniquePayingMembers ?? 0} of ${executive?.totalOrgMembers ?? 0} members`}
              icon={Percent}
              variant={(executive?.collectionRate ?? 0) >= 90 ? 'success' : (executive?.collectionRate ?? 0) >= 75 ? 'warning' : 'danger'}
            />
          </div>

          {/* ── Executive Summary Strip ──────────────────────────────────── */}
          {executive && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <MiniStat
                label="Reconciled"
                value={`${executive.reconciliation.reconciled}/${executive.reconciliation.reconciled + executive.reconciliation.unreconciled}`}
                detail="remittances"
                color={executive.reconciliation.unreconciled === 0 ? 'emerald' : 'amber'}
              />
              <MiniStat
                label="Members Current"
                value={`${executive.memberStanding.current}`}
                detail={`of ${executive.memberStanding.total} tracked`}
                color={executive.memberStanding.suspended === 0 ? 'emerald' : 'amber'}
              />
              <MiniStat
                label="Strike Fund"
                value={formatCurrency(executive.strikeFund.totalDisbursed)}
                detail={`${executive.strikeFund.totalDisbursements} disbursements`}
                color={executive.strikeFund.craThresholdBreaches > 0 ? 'amber' : 'emerald'}
              />
              <MiniStat
                label="Legal Costs"
                value={formatCurrency(executive.grievanceCosts.totalLegalCosts)}
                detail={`${executive.grievanceCosts.openClaims} open claims`}
                color={executive.grievanceCosts.openClaims > 0 ? 'amber' : 'emerald'}
              />
              <MiniStat
                label="Pension Funded"
                value={formatCurrency(executive.pensionHealth.contributions.totalFunded)}
                detail={`${executive.pensionHealth.activeMembers} active members`}
                color={executive.pensionHealth.contributions.pending > 0 ? 'amber' : 'emerald'}
              />
              <MiniStat
                label="Net Position"
                value={formatCurrency(executive.glSnapshot.netPosition)}
                detail="assets − liabilities"
                color={executive.glSnapshot.netPosition > 0 ? 'emerald' : 'amber'}
              />
            </div>
          )}
        </>
      )}

      {/* ── Tabbed Detail Sections ──────────────────────────────────────── */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="arrears" className="gap-1.5">
            <FileWarning className="h-4 w-4" />
            Arrears
            {arrearsCases.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-xs">
                {arrearsCases.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Recent Payments
          </TabsTrigger>
          <TabsTrigger value="remittances" className="gap-1.5">
            <Receipt className="h-4 w-4" />
            Remittance Trend
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5">
            <Shield className="h-4 w-4" />
            Health
          </TabsTrigger>
          <TabsTrigger value="strikefund" className="gap-1.5">
            <Landmark className="h-4 w-4" />
            Strike Fund
          </TabsTrigger>
          <TabsTrigger value="legal" className="gap-1.5">
            <Gavel className="h-4 w-4" />
            Legal
          </TabsTrigger>
          <TabsTrigger value="pension" className="gap-1.5">
            <PiggyBank className="h-4 w-4" />
            Pension
          </TabsTrigger>
          <TabsTrigger value="budget" className="gap-1.5">
            <Wallet className="h-4 w-4" />
            Budget & GL
          </TabsTrigger>
          <TabsTrigger value="ai-insights" className="gap-1.5">
            <Brain className="h-4 w-4" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Period Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Month-over-Month</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TableSkeleton rows={3} />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                      <span>Metric</span>
                      <span className="text-right">This Month</span>
                      <span className="text-right">Last Month</span>
                    </div>
                    <PeriodRow
                      label="Collected"
                      current={period?.thisMonth.collected ?? 0}
                      previous={period?.lastMonth.collected ?? 0}
                    />
                    <PeriodRow
                      label="Outstanding"
                      current={period?.thisMonth.outstanding ?? 0}
                      previous={period?.lastMonth.outstanding ?? 0}
                      invertTrend
                    />
                    <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t">
                      <span className="font-medium">Transactions</span>
                      <span className="text-right font-semibold">
                        {period?.thisMonth.transactionCount ?? 0}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {period?.lastMonth.transactionCount ?? 0}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Remittance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Remittance & Reconciliation</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TableSkeleton rows={4} />
                ) : (
                  <div className="space-y-4">
                    <SummaryRow
                      icon={CheckCircle}
                      iconColor="text-emerald-600"
                      label="Reconciled Remittances"
                      value={formatCurrency(dashboard?.totalCollected ?? 0)}
                    />
                    <SummaryRow
                      icon={Clock}
                      iconColor="text-amber-600"
                      label="Pending Remittances"
                      value={formatCurrency(dashboard?.pendingRemittances ?? 0)}
                    />
                    <SummaryRow
                      icon={AlertTriangle}
                      iconColor="text-red-600"
                      label="In Arrears"
                      value={formatCurrency(dashboard?.inArrears ?? 0)}
                    />
                    <SummaryRow
                      icon={FileWarning}
                      iconColor="text-blue-600"
                      label="Reconciliation Queue"
                      value={`${dashboard?.reconciliationQueue ?? 0} items`}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Collection Funnel */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Payment Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TableSkeleton rows={2} />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatBlock
                      label="Posted"
                      value={overview?.paymentStats.paid ?? 0}
                      color="bg-emerald-500"
                    />
                    <StatBlock
                      label="Pending"
                      value={overview?.paymentStats.pending ?? 0}
                      color="bg-amber-500"
                    />
                    <StatBlock
                      label="Overdue"
                      value={overview?.paymentStats.overdue ?? 0}
                      color="bg-red-500"
                    />
                    <StatBlock
                      label="Total"
                      value={overview?.paymentStats.total ?? 0}
                      color="bg-blue-500"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Arrears Tab ───────────────────────────────────────────────── */}
        <TabsContent value="arrears">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Members in Arrears</CardTitle>
                {arrearsCases.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {arrearsCases.length} member{arrearsCases.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={5} />
              ) : arrearsCases.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <CheckCircle className="h-10 w-10 text-emerald-400 mb-3" />
                  <p className="text-sm font-medium text-gray-900">All Members Current</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No members currently in arrears
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Member</th>
                        <th className="pb-2 font-medium">Amount Owed</th>
                        <th className="pb-2 font-medium">Months Behind</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Payment Plan</th>
                        <th className="pb-2 font-medium">Last Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {arrearsCases.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-3">
                            <div>
                              <p className="font-medium">{c.memberName || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{c.email}</p>
                            </div>
                          </td>
                          <td className="py-3 font-semibold text-red-600">
                            {formatCurrencyFull(parseFloat(c.amountOwed))}
                          </td>
                          <td className="py-3">
                            <span className={cn(
                              'inline-flex items-center gap-1',
                              c.monthsBehind >= 3 ? 'text-red-600 font-semibold' : 'text-amber-600',
                            )}>
                              {c.monthsBehind}
                              <span className="text-xs text-muted-foreground">mo</span>
                            </span>
                          </td>
                          <td className="py-3">
                            <ArrearsStatusBadge status={c.status} />
                          </td>
                          <td className="py-3">
                            {c.hasPaymentPlan ? (
                              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Active</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">None</span>
                            )}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {formatDate(c.lastPayment)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Recent Payments Tab ────────────────────────────────────────── */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={5} />
              ) : (overview?.recentPayments ?? []).length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <CreditCard className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-900">No Recent Payments</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Payment activity will appear here
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Member</th>
                        <th className="pb-2 font-medium">Amount</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Paid Date</th>
                        <th className="pb-2 font-medium">Period</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(overview?.recentPayments ?? []).map((p) => (
                        <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-3 font-medium">{p.memberName}</td>
                          <td className="py-3 font-semibold">
                            {formatCurrencyFull(Math.abs(p.amount))}
                          </td>
                          <td className="py-3">
                            <PaymentStatusBadge status={p.status} />
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {formatDate(p.paidDate)}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {formatDate(p.dueDate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Remittance Trend Tab ──────────────────────────────────────── */}
        <TabsContent value="remittances">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">12-Month Employer Remittance Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {!executive?.remittanceTrend?.length ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <Receipt className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-900">No Remittance Data</p>
                </div>
              ) : (
                <RemittanceChart data={executive.remittanceTrend} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Financial Health Tab ──────────────────────────────────────── */}
        <TabsContent value="health">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Member Standing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Member Standing
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive ? (
                  <div className="space-y-3">
                    <StandingBar
                      label="Current"
                      count={executive.memberStanding.current}
                      total={executive.memberStanding.total}
                      color="bg-emerald-500"
                    />
                    <StandingBar
                      label="Warning"
                      count={executive.memberStanding.warning}
                      total={executive.memberStanding.total}
                      color="bg-amber-500"
                    />
                    <StandingBar
                      label="Suspended"
                      count={executive.memberStanding.suspended}
                      total={executive.memberStanding.total}
                      color="bg-red-500"
                    />
                    <div className="pt-3 border-t text-sm text-muted-foreground flex justify-between">
                      <span>{executive.memberStanding.onPaymentPlan} on payment plan</span>
                      <span>{executive.totalOrgMembers} total org members</span>
                    </div>
                  </div>
                ) : (
                  <TableSkeleton rows={3} />
                )}
              </CardContent>
            </Card>

            {/* Reconciliation Health */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4" />
                  Reconciliation Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                        <span className="text-sm">Reconciled</span>
                      </div>
                      <span className="text-sm font-semibold">{executive.reconciliation.reconciled}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-amber-500" />
                        <span className="text-sm">Pending</span>
                      </div>
                      <span className="text-sm font-semibold">{executive.reconciliation.unreconciled}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${executive.reconciliation.reconciled + executive.reconciliation.unreconciled > 0
                            ? (executive.reconciliation.reconciled / (executive.reconciliation.reconciled + executive.reconciliation.unreconciled)) * 100
                            : 100}%`,
                        }}
                      />
                    </div>
                    {executive.reconciliation.unreconciledAmount > 0 && (
                      <p className="text-xs text-amber-600 mt-2">
                        {formatCurrency(executive.reconciliation.unreconciledAmount)} awaiting reconciliation
                      </p>
                    )}
                  </div>
                ) : (
                  <TableSkeleton rows={3} />
                )}
              </CardContent>
            </Card>

            {/* Payment Plans */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Plan Recovery
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive ? (
                  executive.paymentPlans.activePlans === 0 ? (
                    <div className="flex flex-col items-center py-6 text-center">
                      <CheckCircle className="h-8 w-8 text-emerald-400 mb-2" />
                      <p className="text-sm text-muted-foreground">No active payment plans</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold">{executive.paymentPlans.activePlans}</p>
                          <p className="text-xs text-muted-foreground">Active Plans</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-emerald-600">
                            {formatCurrency(executive.paymentPlans.totalRecovered)}
                          </p>
                          <p className="text-xs text-muted-foreground">Recovered</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-amber-600">
                            {formatCurrency(executive.paymentPlans.totalRemaining)}
                          </p>
                          <p className="text-xs text-muted-foreground">Remaining</p>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{
                            width: `${executive.paymentPlans.totalRecovered + executive.paymentPlans.totalRemaining > 0
                              ? (executive.paymentPlans.totalRecovered / (executive.paymentPlans.totalRecovered + executive.paymentPlans.totalRemaining)) * 100
                              : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                ) : (
                  <TableSkeleton rows={3} />
                )}
              </CardContent>
            </Card>

            {/* Financial Periods */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Fiscal Periods
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive?.financialPeriods?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 font-medium">Period</th>
                          <th className="pb-2 font-medium text-right">Revenue</th>
                          <th className="pb-2 font-medium text-right">Arrears</th>
                          <th className="pb-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {executive.financialPeriods.map((fp) => (
                          <tr key={`${fp.year}-${fp.month}`} className="hover:bg-muted/50 transition-colors">
                            <td className="py-2.5 font-medium">
                              {monthName(fp.month)} {fp.year}
                            </td>
                            <td className="py-2.5 text-right">
                              {formatCurrency(fp.revenue)}
                            </td>
                            <td className={cn('py-2.5 text-right', fp.arrears > 0 ? 'text-red-600 font-medium' : '')}>
                              {fp.arrears > 0 ? formatCurrency(fp.arrears) : '—'}
                            </td>
                            <td className="py-2.5">
                              <PeriodStatusBadge status={fp.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <TableSkeleton rows={4} />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Strike Fund Tab ───────────────────────────────────────────── */}
        <TabsContent value="strikefund">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark className="h-4 w-4" />
                  Strike Fund Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{formatCurrency(executive.strikeFund.totalDisbursed)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Total Disbursed</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{executive.strikeFund.totalDisbursements}</p>
                        <p className="text-xs text-muted-foreground mt-1">Disbursements</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <TableSkeleton rows={2} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  CRA Tax Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive ? (
                  <div className="space-y-4">
                    <SummaryRow
                      icon={AlertTriangle}
                      iconColor={executive.strikeFund.craThresholdBreaches > 0 ? 'text-amber-600' : 'text-emerald-600'}
                      label="CRA Threshold Breaches"
                      value={`${executive.strikeFund.craThresholdBreaches}`}
                    />
                    <SummaryRow
                      icon={FileWarning}
                      iconColor="text-blue-600"
                      label="T4A Slips Required"
                      value={`${executive.strikeFund.requiresT4a}`}
                    />
                    <SummaryRow
                      icon={CheckCircle}
                      iconColor="text-emerald-600"
                      label="T4A Generated"
                      value={`${executive.strikeFund.t4aGenerated}`}
                    />
                    {executive.strikeFund.requiresT4a > executive.strikeFund.t4aGenerated && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                        {executive.strikeFund.requiresT4a - executive.strikeFund.t4aGenerated} T4A slip(s) outstanding — generate before CRA deadline
                      </div>
                    )}
                  </div>
                ) : (
                  <TableSkeleton rows={3} />
                )}
              </CardContent>
            </Card>

            {/* Per-Capita Tax Obligations */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Per-Capita Tax Obligations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive?.perCapitaTax ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                        <p className="text-lg font-bold text-emerald-700">{formatCurrencyFull(executive.perCapitaTax.totalPaid)}</p>
                        <p className="text-xs text-emerald-600">Paid to National</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                        <p className="text-lg font-bold text-amber-700">{formatCurrencyFull(executive.perCapitaTax.totalPending)}</p>
                        <p className="text-xs text-amber-600">Pending</p>
                      </div>
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
                        <p className="text-lg font-bold text-blue-700">{formatCurrencyFull(executive.perCapitaTax.totalPaid + executive.perCapitaTax.totalPending)}</p>
                        <p className="text-xs text-blue-600">Total Obligation</p>
                      </div>
                    </div>
                    {executive.perCapitaTax.entries.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 font-medium">Period</th>
                              <th className="pb-2 font-medium text-right">Members</th>
                              <th className="pb-2 font-medium text-right">Rate</th>
                              <th className="pb-2 font-medium text-right">Amount</th>
                              <th className="pb-2 font-medium">Due Date</th>
                              <th className="pb-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {executive.perCapitaTax.entries.map((e) => (
                              <tr key={`${e.year}-${e.month}`} className="hover:bg-muted/50 transition-colors">
                                <td className="py-2.5 font-medium">{monthName(e.month)} {e.year}</td>
                                <td className="py-2.5 text-right">{e.members}</td>
                                <td className="py-2.5 text-right">{formatCurrencyFull(e.rate)}</td>
                                <td className="py-2.5 text-right font-semibold">{formatCurrencyFull(e.amount)}</td>
                                <td className="py-2.5 text-muted-foreground">{formatDate(e.dueDate)}</td>
                                <td className="py-2.5">
                                  <Badge className={e.status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                                    : 'bg-amber-100 text-amber-800 hover:bg-amber-100'}>
                                    {e.status === 'paid' ? 'Paid' : 'Pending'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <TableSkeleton rows={4} />
                )}
              </CardContent>
            </Card>

            {/* Inbound Per-Capita (Parent Orgs Only) */}
            {executive?.perCapitaInbound?.isParentOrg && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4" />
                    Per-Capita Received from Locals
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {executive.perCapitaInbound.childCount} child organization{executive.perCapitaInbound.childCount !== 1 ? 's' : ''}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                        <p className="text-lg font-bold text-emerald-700">{formatCurrencyFull(executive.perCapitaInbound.totalPaid)}</p>
                        <p className="text-xs text-emerald-600">Received</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                        <p className="text-lg font-bold text-amber-700">{formatCurrencyFull(executive.perCapitaInbound.totalDue)}</p>
                        <p className="text-xs text-amber-600">Pending</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                        <p className="text-lg font-bold text-red-700">{formatCurrencyFull(executive.perCapitaInbound.totalOverdue)}</p>
                        <p className="text-xs text-red-600">Overdue</p>
                      </div>
                    </div>
                    {executive.perCapitaInbound.children.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 font-medium">Local</th>
                              <th className="pb-2 font-medium text-right">Paid</th>
                              <th className="pb-2 font-medium text-right">Pending</th>
                              <th className="pb-2 font-medium text-right">Overdue</th>
                              <th className="pb-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {executive.perCapitaInbound.children.map((child) => (
                              <tr key={child.orgId} className="hover:bg-muted/50 transition-colors">
                                <td className="py-2.5 font-medium">{child.orgName}</td>
                                <td className="py-2.5 text-right text-emerald-700">{formatCurrencyFull(child.totalPaid)}</td>
                                <td className="py-2.5 text-right text-amber-700">{formatCurrencyFull(child.totalDue)}</td>
                                <td className="py-2.5 text-right text-red-700">{formatCurrencyFull(child.totalOverdue)}</td>
                                <td className="py-2.5">
                                  <Badge className={child.overdueCount > 0
                                    ? 'bg-red-100 text-red-800 hover:bg-red-100'
                                    : child.pendingCount > 0
                                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                                    : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'}>
                                    {child.overdueCount > 0 ? 'Overdue' : child.pendingCount > 0 ? 'Pending' : 'Current'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Legal / Grievance Tab ─────────────────────────────────────── */}
        <TabsContent value="legal">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileWarning className="h-4 w-4" />
                  Claims Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-3xl font-bold">{executive.grievanceCosts.totalClaims}</p>
                        <p className="text-xs text-muted-foreground">Total Claims</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-amber-600">{executive.grievanceCosts.openClaims}</p>
                        <p className="text-xs text-muted-foreground">Open</p>
                      </div>
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-sm text-muted-foreground">Total Legal Costs</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(executive.grievanceCosts.totalLegalCosts)}</p>
                    </div>
                  </div>
                ) : (
                  <TableSkeleton rows={3} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gavel className="h-4 w-4" />
                  Arbitrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive ? (
                  <div className="space-y-3">
                    <div className="text-center pb-3 border-b">
                      <p className="text-3xl font-bold">{executive.grievanceCosts.arbitrations.total}</p>
                      <p className="text-xs text-muted-foreground">Active Arbitrations</p>
                    </div>
                    <SummaryRow icon={Clock} iconColor="text-amber-600" label="Estimated Cost" value={formatCurrency(executive.grievanceCosts.arbitrations.estimatedCost)} />
                    <SummaryRow icon={DollarSign} iconColor="text-red-600" label="Actual Cost" value={formatCurrency(executive.grievanceCosts.arbitrations.actualCost)} />
                    <SummaryRow icon={Users} iconColor="text-blue-600" label="Union Share" value={formatCurrency(executive.grievanceCosts.arbitrations.unionShare)} />
                  </div>
                ) : (
                  <TableSkeleton rows={4} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Settlements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive ? (
                  <div className="space-y-3">
                    <div className="text-center pb-3 border-b">
                      <p className="text-3xl font-bold">{executive.grievanceCosts.settlements.total}</p>
                      <p className="text-xs text-muted-foreground">Total Settlements</p>
                    </div>
                    <SummaryRow icon={DollarSign} iconColor="text-emerald-600" label="Total Settled" value={formatCurrency(executive.grievanceCosts.settlements.totalSettled)} />
                    <SummaryRow icon={CheckCircle} iconColor="text-emerald-600" label="Accepted" value={`${executive.grievanceCosts.settlements.accepted}`} />
                    {executive.grievanceCosts.settlements.total > executive.grievanceCosts.settlements.accepted && (
                      <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                        {executive.grievanceCosts.settlements.total - executive.grievanceCosts.settlements.accepted} settlement(s) still pending acceptance
                      </div>
                    )}
                  </div>
                ) : (
                  <TableSkeleton rows={4} />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Pension Tab ───────────────────────────────────────────────── */}
        <TabsContent value="pension">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PiggyBank className="h-4 w-4" />
                  Pension Membership
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{executive.pensionHealth.totalMembers}</p>
                        <p className="text-xs text-muted-foreground">Enrolled</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-emerald-600">{executive.pensionHealth.activeMembers}</p>
                        <p className="text-xs text-muted-foreground">Active</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{Math.round(executive.pensionHealth.totalYearsService * 10) / 10}</p>
                        <p className="text-xs text-muted-foreground">Total Yrs Service</p>
                      </div>
                    </div>
                    <StandingBar
                      label="Active Enrollment"
                      count={executive.pensionHealth.activeMembers}
                      total={executive.pensionHealth.totalMembers}
                      color="bg-emerald-500"
                    />
                  </div>
                ) : (
                  <TableSkeleton rows={3} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Contribution Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                        <p className="text-lg font-bold text-emerald-700">{formatCurrency(executive.pensionHealth.contributions.totalFunded)}</p>
                        <p className="text-xs text-emerald-600">{executive.pensionHealth.contributions.received} received</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                        <p className="text-lg font-bold text-amber-700">{formatCurrency(executive.pensionHealth.contributions.totalPending)}</p>
                        <p className="text-xs text-amber-600">{executive.pensionHealth.contributions.pending} pending</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Funding Progress</span>
                        <span className="font-medium">
                          {executive.pensionHealth.contributions.totalFunded + executive.pensionHealth.contributions.totalPending > 0
                            ? Math.round((executive.pensionHealth.contributions.totalFunded / (executive.pensionHealth.contributions.totalFunded + executive.pensionHealth.contributions.totalPending)) * 100)
                            : 100}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{
                            width: `${executive.pensionHealth.contributions.totalFunded + executive.pensionHealth.contributions.totalPending > 0
                              ? (executive.pensionHealth.contributions.totalFunded / (executive.pensionHealth.contributions.totalFunded + executive.pensionHealth.contributions.totalPending)) * 100
                              : 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <TableSkeleton rows={3} />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Budget & GL Tab ───────────────────────────────────────────── */}
        <TabsContent value="budget">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GL Snapshot */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Balance Sheet Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive ? (
                  <div className="space-y-3">
                    <SummaryRow icon={TrendingUp} iconColor="text-emerald-600" label="Total Assets" value={formatCurrency(executive.glSnapshot.assets)} />
                    <SummaryRow icon={TrendingDown} iconColor="text-red-600" label="Total Liabilities" value={formatCurrency(executive.glSnapshot.liabilities)} />
                    <SummaryRow icon={Users} iconColor="text-blue-600" label="Members Equity" value={formatCurrency(executive.glSnapshot.equity)} />
                    <div className="border-t pt-3">
                      <SummaryRow icon={DollarSign} iconColor="text-emerald-600" label="Revenue YTD" value={formatCurrency(executive.glSnapshot.revenue)} />
                      <div className="mt-2">
                        <SummaryRow icon={DollarSign} iconColor="text-red-600" label="Expenses YTD" value={formatCurrency(executive.glSnapshot.expenses)} />
                      </div>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Net Position</span>
                        <span className={cn('text-lg font-bold', executive.glSnapshot.netPosition >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                          {formatCurrency(executive.glSnapshot.netPosition)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <TableSkeleton rows={5} />
                )}
              </CardContent>
            </Card>

            {/* Budget Utilization */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Budget Utilization
                </CardTitle>
              </CardHeader>
              <CardContent>
                {executive?.budgets?.length ? (
                  <div className="space-y-5">
                    {executive.budgets.map((b) => (
                      <div key={b.name} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{b.name}</span>
                          <span className={cn(
                            'font-semibold',
                            b.utilization > 80 ? 'text-red-600' : b.utilization > 50 ? 'text-amber-600' : 'text-emerald-600'
                          )}>
                            {b.utilization}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              b.utilization > 80 ? 'bg-red-500' : b.utilization > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                            )}
                            style={{ width: `${Math.min(b.utilization, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Spent: {formatCurrency(b.spent)}</span>
                          <span>Budget: {formatCurrency(b.totalBudget)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6 text-center">
                    <Wallet className="h-8 w-8 text-gray-300 mb-2" />
                    <p className="text-sm text-muted-foreground">No active budgets</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── AI Insights Tab ───────────────────────────────────────────── */}
        <TabsContent value="ai-insights">
          <FinancialAiInsights />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PeriodRow({
  label,
  current,
  previous,
  invertTrend = false,
}: {
  label: string;
  current: number;
  previous: number;
  invertTrend?: boolean;
}) {
  const change = percentChange(current, previous);
  const isPositive = invertTrend ? (change !== null && change <= 0) : (change !== null && change >= 0);

  return (
    <div className="grid grid-cols-3 gap-4 text-sm items-center">
      <span className="font-medium">{label}</span>
      <div className="text-right">
        <span className="font-semibold">{formatCurrency(current)}</span>
        {change !== null && (
          <div className="flex items-center justify-end gap-0.5 mt-0.5">
            {isPositive ? (
              <TrendingUp className="h-3 w-3 text-emerald-600" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-600" />
            )}
            <span className={cn('text-xs', isPositive ? 'text-emerald-600' : 'text-red-600')}>
              {change > 0 ? '+' : ''}{change}%
            </span>
          </div>
        )}
      </div>
      <span className="text-right text-muted-foreground">{formatCurrency(previous)}</span>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  iconColor,
  label,
  value,
}: {
  icon: typeof CheckCircle;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function StatBlock({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="text-center p-4 rounded-lg bg-muted/50">
      <div className={cn('mx-auto h-2 w-12 rounded-full mb-3', color)} />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ── Executive sub-components ─────────────────────────────────────────────────

function MiniStat({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color: 'emerald' | 'amber' | 'blue';
}) {
  const colors = {
    emerald: 'border-emerald-200 bg-emerald-50/60',
    amber: 'border-amber-200 bg-amber-50/60',
    blue: 'border-blue-200 bg-blue-50/60',
  };
  return (
    <div className={cn('rounded-lg border px-3 py-2', colors[color])}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function StandingBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function monthName(m: number) {
  return MONTH_NAMES[m] ?? `M${m}`;
}

function PeriodStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
    open: { variant: 'default', label: 'Open' },
    closed: { variant: 'secondary', label: 'Closed' },
    pending_close: { variant: 'outline', label: 'Pending Close' },
  };
  const cfg = map[status] ?? { variant: 'outline' as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function RemittanceChart({ data }: { data: RemittancePeriod[] }) {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        {data.map((d) => {
          const pct = (d.amount / maxAmount) * 100;
          const variance = d.expected > 0 ? d.amount - d.expected : 0;
          return (
            <div key={`${d.year}-${d.month}`} className="group">
              <div className="flex items-center gap-3">
                <span className="w-20 text-xs text-muted-foreground shrink-0">
                  {monthName(d.month)} {d.year}
                </span>
                <div className="flex-1 h-6 rounded bg-gray-100 overflow-hidden relative">
                  <div
                    className={cn(
                      'h-full rounded transition-all',
                      d.reconciled ? 'bg-emerald-500' : 'bg-amber-400',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="absolute inset-y-0 right-2 flex items-center text-xs font-medium">
                    {formatCurrency(d.amount)}
                  </span>
                </div>
                <span className="w-10 text-xs text-right text-muted-foreground">{d.memberCount}m</span>
              </div>
              {variance !== 0 && (
                <div className="ml-22 text-[11px] mt-0.5">
                  <span className={variance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {variance >= 0 ? '+' : ''}{formatCurrency(variance)} vs expected
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          <span>Reconciled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
          <span>Pending</span>
        </div>
      </div>
    </div>
  );
}
