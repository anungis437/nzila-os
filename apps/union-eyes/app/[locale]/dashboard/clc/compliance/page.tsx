export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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
  Download,
  MapPin,
  Building2,
  DollarSign,
  Clock,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import { logger } from '@/lib/logger';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProvincialComplianceData {
  name: string;
  affiliates: number;
  complianceRate: number;
  compliant: number;
  code: string;
}

interface ComplianceIssue {
  organization: string;
  description: string;
  severity: string;
  daysOverdue: number;
}

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata: Metadata = {
  title: 'CLC Compliance Tracking | Union Eyes',
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

async function getComplianceMetrics(_clcId: string) {
  try {
    // TODO: Replace with actual queries to per_capita_remittances and compliance tables
    
    // National compliance metrics
    const totalAffiliates = 0;
    const compliantAffiliates = 0;
    const atRiskAffiliates = 0;
    const nonCompliantAffiliates = 0;
    const overallComplianceRate = 0;
    
    // Remittance metrics
    const totalRemittancesDue = 0;
    const remittancesSubmitted = 0;
    const remittancesOverdue = 0;
    const totalAmountDue = 0;
    const totalAmountReceived = 0;
    
    // Provincial breakdown
    const provincialCompliance = [
      // TODO: Query by province
    ];
    
    // Recent compliance issues
    const recentIssues = [
      // TODO: Query compliance violations
    ];
    
    // Compliance trends
    const complianceTrends = [
      // TODO: Query historical compliance data
    ];

    return {
      national: {
        totalAffiliates,
        compliantAffiliates,
        atRiskAffiliates,
        nonCompliantAffiliates,
        overallComplianceRate,
      },
      remittances: {
        totalRemittancesDue,
        remittancesSubmitted,
        remittancesOverdue,
        totalAmountDue,
        totalAmountReceived,
        collectionRate: totalAmountDue > 0 ? (totalAmountReceived / totalAmountDue) * 100 : 0,
      },
      provincialCompliance,
      recentIssues,
      complianceTrends,
    };
  } catch (error) {
    logger.error('Error fetching compliance metrics:', error);
    return {
      national: {
        totalAffiliates: 0,
        compliantAffiliates: 0,
        atRiskAffiliates: 0,
        nonCompliantAffiliates: 0,
        overallComplianceRate: 0,
      },
      remittances: {
        totalRemittancesDue: 0,
        remittancesSubmitted: 0,
        remittancesOverdue: 0,
        totalAmountDue: 0,
        totalAmountReceived: 0,
        collectionRate: 0,
      },
      provincialCompliance: [],
      recentIssues: [],
      complianceTrends: [],
    };
  }
}

const getComplianceStatusColor = (rate: number) => {
  if (rate >= 95) return 'text-green-600';
  if (rate >= 85) return 'text-yellow-600';
  return 'text-red-600';
};

const getComplianceStatusIcon = (rate: number) => {
  if (rate >= 95) return CheckCircle;
  if (rate >= 85) return AlertCircle;
  return XCircle;
};

export default async function CLCCompliancePage() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  const hasAccess = await checkCLCAccess(userId, orgId);
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('clc.compliance');
  const metrics = await getComplianceMetrics(orgId);

  const StatusIcon = getComplianceStatusIcon(metrics.national.overallComplianceRate);

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
            <Link href="/dashboard/admin/clc-remittances">
              <DollarSign className="mr-2 h-4 w-4" />
              {t('manageRemittances', { defaultValue: 'Manage Remittances' })}
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
                <StatusIcon className={`h-6 w-6 ${getComplianceStatusColor(metrics.national.overallComplianceRate)}`} />
                {t('overallStatus', { defaultValue: 'Overall National Compliance' })}
              </CardTitle>
              <CardDescription className="mt-2">
                {t('statusDescription', { defaultValue: 'Aggregated compliance across all CLC affiliates' })}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${getComplianceStatusColor(metrics.national.overallComplianceRate)}`}>
                {metrics.national.overallComplianceRate}%
              </div>
              <p className="text-sm text-muted-foreground">
                {t('complianceRate', { defaultValue: 'Compliance Rate' })}
              </p>
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
            <div className="text-2xl font-bold">${metrics.remittances.totalAmountDue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              ${metrics.remittances.totalAmountReceived.toLocaleString()} {t('remittances.received', { defaultValue: 'received' })}
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
            <div className="text-2xl font-bold">{metrics.remittances.collectionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {t('remittances.thirtyDayAverage', { defaultValue: '30-day average' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Provincial Compliance Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t('provincial.title', { defaultValue: 'Provincial/Territorial Compliance' })}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('provincial.description', { defaultValue: 'Compliance breakdown by province and territory' })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('provincial.filter', { defaultValue: 'Filter by province' })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('provincial.allProvinces', { defaultValue: 'All Provinces' })}</SelectItem>
                  <SelectItem value="AB">Alberta</SelectItem>
                  <SelectItem value="BC">British Columbia</SelectItem>
                  <SelectItem value="MB">Manitoba</SelectItem>
                  <SelectItem value="NB">New Brunswick</SelectItem>
                  <SelectItem value="NL">Newfoundland and Labrador</SelectItem>
                  <SelectItem value="NS">Nova Scotia</SelectItem>
                  <SelectItem value="ON">Ontario</SelectItem>
                  <SelectItem value="PE">Prince Edward Island</SelectItem>
                  <SelectItem value="QC">Quebec</SelectItem>
                  <SelectItem value="SK">Saskatchewan</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                {t('export', { defaultValue: 'Export' })}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {metrics.provincialCompliance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>{t('provincial.noData', { defaultValue: 'No provincial compliance data available' })}</p>
              <p className="text-sm mt-2">{t('provincial.noDataHint', { defaultValue: 'Data will appear once remittances are submitted' })}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {metrics.provincialCompliance.map((province: ProvincialComplianceData, index: number) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{province.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {province.affiliates} {t('provincial.affiliates', { defaultValue: 'affiliates' })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-xl font-bold ${getComplianceStatusColor(province.complianceRate)}`}>
                        {province.complianceRate}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {province.compliant}/{province.affiliates} {t('provincial.compliant', { defaultValue: 'compliant' })}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/clc/compliance?province=${province.code}`}>
                        {t('viewDetails', { defaultValue: 'View Details' })}
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Compliance Issues */}
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
                  <TableHead>{t('issues.daysOverdue', { defaultValue: 'Days Overdue' })}</TableHead>
                  <TableHead className="text-right">{t('issues.actions', { defaultValue: 'Actions' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.recentIssues.map((issue: ComplianceIssue, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{issue.organization}</TableCell>
                    <TableCell>{issue.description}</TableCell>
                    <TableCell>
                      <Badge variant={issue.severity === 'high' ? 'destructive' : 'secondary'}>
                        {issue.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{issue.daysOverdue}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">
                        {t('issues.followUp', { defaultValue: 'Follow Up' })}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('actions.title', { defaultValue: 'Compliance Actions' })}</CardTitle>
          <CardDescription>
            {t('actions.description', { defaultValue: 'Common compliance management tasks' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto p-4 flex-col items-start" asChild>
              <Link href="/dashboard/admin/clc-remittances">
                <DollarSign className="h-5 w-5 mb-2" />
                <div className="font-semibold">{t('actions.reviewRemittances', { defaultValue: 'Review Remittances' })}</div>
                <div className="text-xs text-muted-foreground">{t('actions.reviewDesc', { defaultValue: 'Process pending submissions' })}</div>
              </Link>
            </Button>

            <Button variant="outline" className="h-auto p-4 flex-col items-start">
              <FileText className="h-5 w-5 mb-2" />
              <div className="font-semibold">{t('actions.generateReport', { defaultValue: 'Generate Report' })}</div>
              <div className="text-xs text-muted-foreground">{t('actions.reportDesc', { defaultValue: 'Quarterly compliance report' })}</div>
            </Button>

            <Button variant="outline" className="h-auto p-4 flex-col items-start" asChild>
              <Link href="/dashboard/clc/affiliates">
                <Building2 className="h-5 w-5 mb-2" />
                <div className="font-semibold">{t('actions.viewAffiliates', { defaultValue: 'View Affiliates' })}</div>
                <div className="text-xs text-muted-foreground">{t('actions.affiliatesDesc', { defaultValue: 'Manage affiliate status' })}</div>
              </Link>
            </Button>

            <Button variant="outline" className="h-auto p-4 flex-col items-start" asChild>
              <Link href="/dashboard/admin/clc-analytics">
                <BarChart3 className="h-5 w-5 mb-2" />
                <div className="font-semibold">{t('actions.analytics', { defaultValue: 'View Analytics' })}</div>
                <div className="text-xs text-muted-foreground">{t('actions.analyticsDesc', { defaultValue: 'Trends and forecasts' })}</div>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
