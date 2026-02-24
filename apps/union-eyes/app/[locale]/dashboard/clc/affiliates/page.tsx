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
  Building2, 
  Users, 
  MapPin, 
  Mail, 
  Search,
  Download,
  Eye,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  DollarSign,
  FileText
} from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logger } from '@/lib/logger';
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

interface AffiliateData {
  id: string;
  name: string;
  organizationType: string;
  province?: string | null;
  memberCount: number;
  remittanceStatus: string;
  lastRemittanceDate: string | null;
  complianceStatus: string;
}

type IconComponent = React.ComponentType<{ className?: string }>;

export const metadata: Metadata = {
  title: 'Manage Affiliates | CLC Dashboard',
  description: 'View and manage direct-chartered unions and provincial federations',
};

async function checkCLCAccess(userId: string, orgId: string): Promise<boolean> {
  try {
    const userRole = await getUserRoleInOrganization(userId, orgId);
    return ['clc_executive', 'clc_staff', 'system_admin'].includes(userRole || '');
  } catch {
    return false;
  }
}

async function getAffiliateData(clcId: string) {
  try {
    // Fetch all affiliates (direct-chartered unions and provincial federations)
    const affiliates = await db.query.organizations.findMany({
      where: (organizations, { eq }) => eq(organizations.parentId, clcId),
      orderBy: (organizations, { asc }) => [asc(organizations.name)],
    });

    // Categorize affiliates
    const directCharteredUnions = affiliates.filter(a => a.organizationType === 'union');
    const provincialFederations = affiliates.filter(a => a.organizationType === 'federation');
    const chapters = affiliates.filter(a => a.organizationType === 'local');
    const locals = affiliates.filter(a => a.organizationType === 'local');

    // Calculate summary metrics
    const totalAffiliates = affiliates.length;

    // TODO: Aggregate actual member counts, remittance status, etc. from database
    const affiliatesWithMetrics = affiliates.map(affiliate => ({
      ...affiliate,
      memberCount: 0, // TODO: Query members count
      remittanceStatus: 'current', // TODO: Query remittance status from per_capita_remittances
      lastRemittanceDate: null, // TODO: Query last remittance date
      complianceStatus: 'compliant', // TODO: Query compliance status
    }));

    return {
      affiliates: affiliatesWithMetrics,
      summary: {
        total: totalAffiliates,
        directCharteredUnions: directCharteredUnions.length,
        provincialFederations: provincialFederations.length,
        chapters: chapters.length,
        locals: locals.length,
      },
    };
  } catch (error) {
    logger.error('Error fetching affiliate data:', error);
    return {
      affiliates: [],
      summary: {
        total: 0,
        directCharteredUnions: 0,
        provincialFederations: 0,
        chapters: 0,
        locals: 0,
      },
    };
  }
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary', label: string }> = {
    current: { variant: 'default', label: 'Current' },
    overdue: { variant: 'destructive', label: 'Overdue' },
    pending: { variant: 'secondary', label: 'Pending' },
    exempt: { variant: 'outline', label: 'Exempt' },
  };
  const config = variants[status] || variants.current;
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getComplianceBadge = (status: string) => {
  const variants: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary', label: string, icon: IconComponent }> = {
    compliant: { variant: 'default', label: 'Compliant', icon: CheckCircle },
    'at-risk': { variant: 'secondary', label: 'At Risk', icon: AlertCircle },
    'non-compliant': { variant: 'destructive', label: 'Non-Compliant', icon: AlertCircle },
  };
  const config = variants[status] || variants.compliant;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};

export default async function CLCAffiliatesPage({
  searchParams: _searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  const hasAccess = await checkCLCAccess(userId, orgId);
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('clc.affiliates');
  const data = await getAffiliateData(orgId);

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-8 w-8 text-blue-600" />
            {t('title', { defaultValue: 'CLC Affiliates' })}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('description', { 
              defaultValue: 'Manage direct-chartered unions and provincial federations' 
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
            <Link href="/dashboard/admin/organizations/new">
              <Building2 className="mr-2 h-4 w-4" />
              {t('addAffiliate', { defaultValue: 'Add Affiliate' })}
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('summary.totalAffiliates', { defaultValue: 'Total Affiliates' })}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total}</div>
            <p className="text-xs text-muted-foreground">
              {t('summary.acrossCLC', { defaultValue: 'Across CLC' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('summary.directChartered', { defaultValue: 'Direct-Chartered' })}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.directCharteredUnions}</div>
            <p className="text-xs text-muted-foreground">
              {t('summary.nationalUnions', { defaultValue: 'National unions' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('summary.federations', { defaultValue: 'Federations' })}
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.provincialFederations}</div>
            <p className="text-xs text-muted-foreground">
              {t('summary.provincial', { defaultValue: 'Provincial/territorial' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('summary.locals', { defaultValue: 'Locals & Chapters' })}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.locals + data.summary.chapters}</div>
            <p className="text-xs text-muted-foreground">
              {t('summary.localUnits', { defaultValue: 'Local units' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search.placeholder', { defaultValue: 'Search by name, number, or region...' })}
                className="pl-10"
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('filter.type', { defaultValue: 'Organization Type' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filter.all', { defaultValue: 'All Types' })}</SelectItem>
                <SelectItem value="union">{t('filter.unions', { defaultValue: 'Direct-Chartered' })}</SelectItem>
                <SelectItem value="federation">{t('filter.federations', { defaultValue: 'Federations' })}</SelectItem>
                <SelectItem value="local">{t('filter.locals', { defaultValue: 'Locals' })}</SelectItem>
                <SelectItem value="chapter">{t('filter.chapters', { defaultValue: 'Chapters' })}</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('filter.status', { defaultValue: 'Status' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filter.allStatuses', { defaultValue: 'All Statuses' })}</SelectItem>
                <SelectItem value="current">{t('filter.current', { defaultValue: 'Current' })}</SelectItem>
                <SelectItem value="overdue">{t('filter.overdue', { defaultValue: 'Overdue' })}</SelectItem>
                <SelectItem value="at-risk">{t('filter.atRisk', { defaultValue: 'At Risk' })}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {t('export', { defaultValue: 'Export' })}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Affiliates Table */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">
            {t('tabs.all', { defaultValue: 'All Affiliates' })} ({data.summary.total})
          </TabsTrigger>
          <TabsTrigger value="unions">
            {t('tabs.unions', { defaultValue: 'Direct-Chartered' })} ({data.summary.directCharteredUnions})
          </TabsTrigger>
          <TabsTrigger value="federations">
            {t('tabs.federations', { defaultValue: 'Federations' })} ({data.summary.provincialFederations})
          </TabsTrigger>
          <TabsTrigger value="locals">
            {t('tabs.locals', { defaultValue: 'Locals & Chapters' })} ({data.summary.locals + data.summary.chapters})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.name', { defaultValue: 'Name' })}</TableHead>
                  <TableHead>{t('table.type', { defaultValue: 'Type' })}</TableHead>
                  <TableHead>{t('table.location', { defaultValue: 'Location' })}</TableHead>
                  <TableHead className="text-right">{t('table.members', { defaultValue: 'Members' })}</TableHead>
                  <TableHead>{t('table.remittance', { defaultValue: 'Remittance' })}</TableHead>
                  <TableHead>{t('table.compliance', { defaultValue: 'Compliance' })}</TableHead>
                  <TableHead className="text-right">{t('table.actions', { defaultValue: 'Actions' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.affiliates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      {t('table.noAffiliates', { defaultValue: 'No affiliates found' })}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.affiliates.map((affiliate: AffiliateData) => (
                    <TableRow key={affiliate.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {affiliate.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {affiliate.organizationType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {affiliate.province || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {affiliate.memberCount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(affiliate.remittanceStatus)}
                      </TableCell>
                      <TableCell>
                        {getComplianceBadge(affiliate.complianceStatus)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/admin/organizations/${affiliate.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/admin/clc-remittances?org=${affiliate.id}`}>
                              <DollarSign className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="unions">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-8">
                {t('tabs.unionsFilter', { defaultValue: 'Filtered view showing only direct-chartered unions' })}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="federations">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {data.affiliates
                .filter((a: AffiliateData) => a.organizationType === 'federation')
                .map((federation: AffiliateData) => (
                  <div key={federation.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-lg">{federation.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          {federation.province || 'Canada'}
                          <span className="mx-2">•</span>
                          <Users className="h-3 w-3" />
                          {federation.memberCount.toLocaleString()} members
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getComplianceBadge(federation.complianceStatus)}
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/federation?id=${federation.id}`}>
                          {t('viewDetails', { defaultValue: 'View Details' })}
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locals">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-8">
                {t('tabs.localsFilter', { defaultValue: 'Filtered view showing only locals and chapters' })}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('bulkActions.title', { defaultValue: 'Bulk Actions' })}</CardTitle>
          <CardDescription>
            {t('bulkActions.description', { defaultValue: 'Perform actions across multiple affiliates' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              {t('bulkActions.exportReport', { defaultValue: 'Export Report' })}
            </Button>
            <Button variant="outline">
              <Mail className="mr-2 h-4 w-4" />
              {t('bulkActions.sendReminder', { defaultValue: 'Send Reminders' })}
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {t('bulkActions.downloadData', { defaultValue: 'Download Data' })}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
