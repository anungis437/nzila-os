export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  DollarSign, 
  AlertCircle, 
  TrendingUp, 
  CheckCircle,
  Clock,
  Search,
  Filter,
  Download,
  FileText,
  Building2
} from 'lucide-react';
import Link from 'next/link';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';
type IconComponent = typeof Clock | typeof FileText | typeof CheckCircle | typeof AlertCircle;

interface RemittanceData {
  id: string;
  year: number;
  month: number;
  organizationName: string;
  clcCode?: string;
  memberCount: number;
  perCapitaRate: number;
  totalAmount: number;
  dueDate: string;
  status: string;
}

export const metadata: Metadata = {
  title: 'Provincial Remittances | Federation Dashboard',
  description: 'Track and manage per-capita dues remittances from member unions',
};

async function checkFederationAccess(userId: string, orgId: string): Promise<boolean> {
  try {
    const userRole = await getUserRoleInOrganization(userId, orgId);
    return ['fed_staff', 'fed_executive', 'admin', 'system_admin'].includes(userRole || '');
  } catch {
    return false;
  }
}

async function getRemittanceData(_federationId: string) {
  try {
    // TODO: Replace with actual federation_remittances queries
    // For now, return placeholder data
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    return {
      remittances: [],
      summary: {
        totalDue: 0,
        totalPaid: 0,
        pending: 0,
        overdue: 0,
        collectionRate: 0,
      },
      currentPeriod: {
        year: currentYear,
        month: currentMonth,
      },
    };
  } catch {
    return {
      remittances: [],
      summary: {
        totalDue: 0,
        totalPaid: 0,
        pending: 0,
        overdue: 0,
        collectionRate: 0,
      },
      currentPeriod: {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
      },
    };
  }
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: BadgeVariant; icon: IconComponent; label: string }> = {
    pending: { 
      variant: 'secondary' as const, 
      icon: Clock, 
      label: 'Pending' 
    },
    submitted: { 
      variant: 'default' as const, 
      icon: FileText, 
      label: 'Submitted' 
    },
    paid: { 
      variant: 'default' as const, 
      icon: CheckCircle, 
      label: 'Paid' 
    },
    overdue: { 
      variant: 'destructive' as const, 
      icon: AlertCircle, 
      label: 'Overdue' 
    },
  };

  const config = variants[status] || variants.pending;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default async function FederationRemittancesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  const hasAccess = await checkFederationAccess(userId, orgId);
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('federation.remittances');
  const data = await getRemittanceData(orgId);
  const filterStatus = searchParams.filter as string | undefined;

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link 
              href="/dashboard/federation" 
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t('breadcrumb.federation', { defaultValue: 'Federation' })}
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">
              {t('breadcrumb.remittances', { defaultValue: 'Remittances' })}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            {t('title', { defaultValue: 'Provincial Remittances' })}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('description', { 
              defaultValue: 'Track per-capita dues remittances from member unions and locals' 
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {t('actions.export', { defaultValue: 'Export' })}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('summary.totalDue', { defaultValue: 'Total Due' })}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${data.summary.totalDue.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('summary.currentPeriod', { 
                month: data.currentPeriod.month,
                year: data.currentPeriod.year,
                defaultValue: `${data.currentPeriod.year}-${String(data.currentPeriod.month).padStart(2, '0')}` 
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('summary.totalPaid', { defaultValue: 'Total Paid' })}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${data.summary.totalPaid.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('summary.collectionRate', { 
                rate: data.summary.collectionRate,
                defaultValue: `${data.summary.collectionRate}% collection` 
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('summary.pending', { defaultValue: 'Pending' })}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.pending}</div>
            <p className="text-xs text-muted-foreground">
              {t('summary.awaitingSubmission', { defaultValue: 'Awaiting submission' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('summary.overdue', { defaultValue: 'Overdue' })}
            </CardTitle>
            <AlertCircle className={`h-4 w-4 ${data.summary.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.overdue > 0 ? 'text-destructive' : ''}`}>
              {data.summary.overdue}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('summary.pastDue', { defaultValue: 'Past due date' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Alert */}
      {data.summary.overdue > 0 && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t('alerts.overdue.title', { defaultValue: 'Overdue Remittances Require Attention' })}
            </CardTitle>
            <CardDescription>
              {t('alerts.overdue.description', { 
                count: data.summary.overdue,
                defaultValue: `${data.summary.overdue} remittance(s) are past due. Contact the affected locals to resolve.` 
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('filters.title', { defaultValue: 'Filters' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <Select defaultValue={filterStatus || 'all'}>
              <SelectTrigger>
                <SelectValue placeholder={t('filters.status', { defaultValue: 'Status' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allStatuses', { defaultValue: 'All' })}</SelectItem>
                <SelectItem value="pending">{t('filters.pending', { defaultValue: 'Pending' })}</SelectItem>
                <SelectItem value="submitted">{t('filters.submitted', { defaultValue: 'Submitted' })}</SelectItem>
                <SelectItem value="paid">{t('filters.paid', { defaultValue: 'Paid' })}</SelectItem>
                <SelectItem value="overdue">{t('filters.overdue', { defaultValue: 'Overdue' })}</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue={String(data.currentPeriod.year)}>
              <SelectTrigger>
                <SelectValue placeholder={t('filters.year', { defaultValue: 'Year' })} />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => data.currentPeriod.year - i).map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select defaultValue={String(data.currentPeriod.month)}>
              <SelectTrigger>
                <SelectValue placeholder={t('filters.month', { defaultValue: 'Month' })} />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <SelectItem key={month} value={String(month)}>
                    {format(new Date(2000, month - 1), 'MMMM')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('filters.search', { defaultValue: 'Search...' })}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              {t('filters.apply', { defaultValue: 'Apply' })}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Remittances Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('table.title', { defaultValue: 'Remittance Records' })}
          </CardTitle>
          <CardDescription>
            {t('table.description', { 
              count: data.remittances.length,
              defaultValue: `${data.remittances.length} remittances` 
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.remittances.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">
                {t('table.empty.title', { defaultValue: 'No Remittances Found' })}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t('table.empty.description', { 
                  defaultValue: 'No remittance records match the current filters' 
                })}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                {t('table.empty.hint', { 
                  defaultValue: 'Remittances are generated automatically at the start of each month based on member counts.' 
                })}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.columns.period', { defaultValue: 'Period' })}</TableHead>
                  <TableHead>{t('table.columns.organization', { defaultValue: 'Organization' })}</TableHead>
                  <TableHead className="text-right">{t('table.columns.members', { defaultValue: 'Members' })}</TableHead>
                  <TableHead className="text-right">{t('table.columns.rate', { defaultValue: 'Rate' })}</TableHead>
                  <TableHead className="text-right">{t('table.columns.amount', { defaultValue: 'Amount' })}</TableHead>
                  <TableHead>{t('table.columns.dueDate', { defaultValue: 'Due Date' })}</TableHead>
                  <TableHead>{t('table.columns.status', { defaultValue: 'Status' })}</TableHead>
                  <TableHead className="text-right">{t('table.columns.actions', { defaultValue: 'Actions' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.remittances.map((remittance: RemittanceData) => (
                  <TableRow key={remittance.id}>
                    <TableCell className="font-medium">
                      {format(new Date(remittance.year, remittance.month - 1), 'MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{remittance.organizationName}</div>
                        {remittance.clcCode && (
                          <Badge variant="outline" className="text-xs">
                            {remittance.clcCode}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {remittance.memberCount}
                    </TableCell>
                    <TableCell className="text-right">
                      ${remittance.perCapitaRate.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${remittance.totalAmount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(remittance.dueDate), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(remittance.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        {t('table.viewDetails', { defaultValue: 'View' })}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quickLinks.title', { defaultValue: 'Related Operations' })}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Button variant="outline" className="justify-start" asChild>
            <Link href="/dashboard/federation/affiliates">
              <Building2 className="mr-2 h-4 w-4" />
              {t('quickLinks.affiliates', { defaultValue: 'View Affiliates' })}
            </Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href="/dashboard/cross-union-analytics">
              <TrendingUp className="mr-2 h-4 w-4" />
              {t('quickLinks.analytics', { defaultValue: 'Analytics' })}
            </Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href="/dashboard/compliance">
              <FileText className="mr-2 h-4 w-4" />
              {t('quickLinks.compliance', { defaultValue: 'Compliance' })}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
