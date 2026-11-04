export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  TrendingUp,
  Calendar,
  FileText,
  MapPin,
  Building2,
  DollarSign,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import { listAffiliates } from '@/lib/organizations/affiliates';
import { loadRemittanceFacts, standingOf, summarizeRemittances, type RemittanceFact } from '@/lib/organizations/per-capita-standing';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ProvincialComplianceData {
  name: string;
  affiliates: number;
  compliant: number;
  complianceRate: number;
}

interface ComplianceIssue {
  id: string;
  organization: string;
  description: string;
  severity: 'high' | 'medium';
}

export const metadata: Metadata = {
  title: 'CLC Compliance Tracking | UnionEyes',
  description: 'National compliance monitoring and per-capita remittance tracking',
};

async function checkCLCAccess(userId: string, orgId: string): Promise<boolean> {
  try {
    const userRole = await getUserRoleInOrganization(userId, orgId);
    return ['clc_executive', 'clc_staff', 'system_admin'].includes(userRole || '');
  } catch {
    return false;
  }
}

const sumAmounts = (facts: readonly RemittanceFact[]) => facts.reduce((sum, fact) => sum + Number(fact.totalAmount), 0);

/**
 * The congress's compliance position, from the per-capita remittances addressed to it (read in its own context) and the affiliates below
 * it, and nothing else: a rate is null when no remittance fell due, never zero, and an affiliate with nothing on file is pending and at risk,
 * never compliant. The page used to read /api/v2/clc/compliance/metrics, which answers HTTP 410, and print its fallback zeros under a banner.
 * A failed read is an error, not a position.
 */
async function getComplianceData(userId: string, clcId: string) {
  const [affiliates, facts] = await Promise.all([
    listAffiliates({ userId, organizationId: clcId }),
    loadRemittanceFacts(clcId),
  ]);
  const summary = summarizeRemittances(facts);
  const standings = affiliates.map((affiliate) => {
    const own = facts.filter((fact) => fact.fromOrganizationId === affiliate.id);
    return { affiliate, own, standing: standingOf(own) };
  });

  const due = facts.filter((fact) => fact.fellDueInLastYear);
  const amountDue = sumAmounts(due);
  const amountReceived = sumAmounts(due.filter((fact) => fact.status === 'approved' || fact.status === 'paid'));

  const byProvince = new Map<string, { affiliates: number; compliant: number }>();
  for (const { affiliate, standing } of standings) {
    const key = affiliate.provinceTerritory ?? '';
    const entry = byProvince.get(key) ?? { affiliates: 0, compliant: 0 };
    entry.affiliates += 1;
    if (standing.complianceStatus === 'compliant') entry.compliant += 1;
    byProvince.set(key, entry);
  }
  const provincialCompliance: ProvincialComplianceData[] = [...byProvince]
    .map(([name, entry]) => ({
      name,
      affiliates: entry.affiliates,
      compliant: entry.compliant,
      complianceRate: Math.round((entry.compliant / entry.affiliates) * 100),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const recentIssues: ComplianceIssue[] = standings
    .filter(({ standing }) => standing.complianceStatus !== 'compliant')
    .map(({ affiliate, own, standing }) => {
      const overdue = own.filter((fact) => fact.overdue).length;
      return {
        id: affiliate.id,
        organization: affiliate.name,
        description:
          standing.remittanceStatus === 'overdue'
            ? `${overdue} overdue remittance${overdue === 1 ? '' : 's'}`
            : own.length === 0
              ? 'No remittance on file'
              : 'Remittance pending',
        severity: standing.remittanceStatus === 'overdue' ? 'high' : 'medium',
      };
    });

  return {
    national: {
      totalAffiliates: affiliates.length,
      compliantAffiliates: standings.filter(({ standing }) => standing.complianceStatus === 'compliant').length,
      atRiskAffiliates: standings.filter(({ standing }) => standing.complianceStatus === 'at-risk').length,
      nonCompliantAffiliates: standings.filter(({ standing }) => standing.complianceStatus === 'non-compliant').length,
      overallComplianceRate: summary.complianceRate,
    },
    remittances: {
      totalRemittancesDue: due.length,
      remittancesSubmitted: due.filter((fact) => fact.submittedAt !== null).length,
      remittancesOverdue: summary.overdueRemittances,
      totalAmountDue: amountDue,
      totalAmountReceived: amountReceived,
      collectionRate: amountDue > 0 ? (amountReceived / amountDue) * 100 : null,
    },
    provincialCompliance,
    recentIssues,
  };
}

const money = (value: number, locale: string) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(value);

const getComplianceStatusColor = (rate: number | null) => {
  if (rate === null) return 'text-muted-foreground';
  if (rate >= 95) return 'text-green-600';
  if (rate >= 85) return 'text-yellow-600';
  return 'text-red-600';
};

const getComplianceStatusIcon = (rate: number | null) => {
  if (rate === null) return Clock;
  if (rate >= 95) return CheckCircle;
  if (rate >= 85) return AlertCircle;
  return XCircle;
};

export default async function CLCCompliancePage() {
  const user = await requireUser();
  const userId = user.userId;
  const orgId = user.organizationId!;

  const hasAccess = await checkCLCAccess(userId, orgId);
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('clc.compliance');
  const locale = await getLocale();
  const metrics = await getComplianceData(userId, orgId);

  const StatusIcon = getComplianceStatusIcon(metrics.national.overallComplianceRate);
  const overallRate = metrics.national.overallComplianceRate;

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8 text-green-600" />
            {t('title', { defaultValue: 'CLC Compliance Tracking' })}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('description', { 
              defaultValue: 'National compliance monitoring, per-capita remittance tracking, and affiliate oversight' 
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/clc">
              <TrendingUp className="mr-2 h-4 w-4" />
              {t('backToDashboard', { defaultValue: 'Back to Dashboard' })}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/clc/affiliates">
              <Building2 className="mr-2 h-4 w-4" />
              {t('actions.viewAffiliates', { defaultValue: 'View Affiliates' })}
            </Link>
          </Button>
        </div>
      </div>

      {/* Overall Compliance Status */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                {/* eslint-disable-next-line react-hooks/static-components */}
                <StatusIcon className={`h-6 w-6 ${getComplianceStatusColor(overallRate)}`} />
                {t('overallStatus', { defaultValue: 'Overall National Compliance' })}
              </CardTitle>
              <CardDescription className="mt-2">
                {t('statusDescription', { defaultValue: 'Aggregated compliance across all CLC affiliates' })}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${getComplianceStatusColor(overallRate)}`}>
                {overallRate === null ? '—' : `${overallRate}%`}
              </div>
              <p className="text-sm text-muted-foreground">
                {t('complianceRate', { defaultValue: 'Compliance Rate' })}
              </p>
              {overallRate === null && <p className="text-xs text-muted-foreground">No remittance fell due in the last twelve months</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.national.compliantAffiliates}</div>
                <div className="text-sm text-muted-foreground">{t('compliant', { defaultValue: 'Compliant' })}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.national.atRiskAffiliates}</div>
                <div className="text-sm text-muted-foreground">{t('atRisk', { defaultValue: 'At Risk' })}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.national.nonCompliantAffiliates}</div>
                <div className="text-sm text-muted-foreground">{t('nonCompliant', { defaultValue: 'Non-Compliant' })}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.national.totalAffiliates}</div>
                <div className="text-sm text-muted-foreground">{t('totalAffiliates', { defaultValue: 'Total Affiliates' })}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remittance Compliance */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('remittances.due', { defaultValue: 'Remittances Due' })}
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.remittances.totalRemittancesDue}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.remittances.remittancesSubmitted} {t('remittances.submitted', { defaultValue: 'submitted' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('remittances.overdue', { defaultValue: 'Overdue' })}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics.remittances.remittancesOverdue}</div>
            <p className="text-xs text-muted-foreground">
              {t('remittances.requiresAction', { defaultValue: 'Requires follow-up' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('remittances.amountDue', { defaultValue: 'Amount Due' })}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(metrics.remittances.totalAmountDue, locale)}</div>
            <p className="text-xs text-muted-foreground">
              {money(metrics.remittances.totalAmountReceived, locale)} {t('remittances.received', { defaultValue: 'received' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('remittances.collectionRate', { defaultValue: 'Collection Rate' })}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.remittances.collectionRate === null ? '—' : `${metrics.remittances.collectionRate.toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">Remittances that fell due in the last twelve months</p>
          </CardContent>
        </Card>
      </div>

      {/* Provincial Compliance Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t('provincial.title', { defaultValue: 'Provincial/Territorial Compliance' })}
          </CardTitle>
          <CardDescription className="mt-1">
            {t('provincial.description', { defaultValue: 'Compliance breakdown by province and territory' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.provincialCompliance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>{t('provincial.noData', { defaultValue: 'No provincial compliance data available' })}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {metrics.provincialCompliance.map((province) => (
                <div key={province.name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{province.name === '' ? 'Province not recorded' : province.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {province.affiliates} {t('provincial.affiliates', { defaultValue: 'affiliates' })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-bold ${getComplianceStatusColor(province.complianceRate)}`}>{province.complianceRate}%</div>
                    <div className="text-xs text-muted-foreground">
                      {province.compliant}/{province.affiliates} {t('provincial.compliant', { defaultValue: 'compliant' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {t('issues.title', { defaultValue: 'Recent Compliance Issues' })}
          </CardTitle>
          <CardDescription>
            {t('issues.description', { defaultValue: 'Affiliates requiring attention or follow-up action' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.recentIssues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-600" />
              <p className="font-medium text-green-600">{t('issues.noIssues', { defaultValue: 'No compliance issues' })}</p>
              <p className="text-sm mt-1">{t('issues.allCompliant', { defaultValue: 'All affiliates are in good standing' })}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('issues.organization', { defaultValue: 'Organization' })}</TableHead>
                  <TableHead>{t('issues.issue', { defaultValue: 'Issue' })}</TableHead>
                  <TableHead>{t('issues.severity', { defaultValue: 'Severity' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.recentIssues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-medium">{issue.organization}</TableCell>
                    <TableCell>{issue.description}</TableCell>
                    <TableCell>
                      <Badge variant={issue.severity === 'high' ? 'destructive' : 'secondary'}>{issue.severity}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
