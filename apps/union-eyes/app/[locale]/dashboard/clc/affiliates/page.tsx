export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  MapPin,
  Eye,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import { listAffiliates } from '@/lib/organizations/affiliates';
import { loadAffiliateStandings, standingOf } from '@/lib/organizations/per-capita-standing';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
type Translate = Awaited<ReturnType<typeof getTranslations>>;

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

/**
 * The congress's affiliates with their real standing. The list is a system read authorized by the caller's administrative standing
 * over the organization; the standing comes from the per-capita remittances addressed to the organization (read in its own context):
 * an affiliate with none on file is pending and at risk, never "current" and "compliant". A failed read is an error, not an empty list.
 */
async function getAffiliateData(userId: string, clcId: string) {
  const [rows, standings] = await Promise.all([
    listAffiliates({ userId, organizationId: clcId }),
    loadAffiliateStandings(clcId),
  ]);
  const affiliates: AffiliateData[] = rows.map((affiliate) => ({
    id: affiliate.id,
    name: affiliate.name,
    organizationType: affiliate.organizationType,
    province: affiliate.provinceTerritory,
    memberCount: affiliate.memberCount,
    ...(standings.get(affiliate.id) ?? standingOf([])),
  }));

  return {
    affiliates,
    summary: {
      total: affiliates.length,
      directCharteredUnions: affiliates.filter((a) => a.organizationType === 'union').length,
      provincialFederations: affiliates.filter((a) => a.organizationType === 'federation').length,
      // The organization types are union, federation, local and the like; "chapter" is not one, so every local is counted once.
      chapters: 0,
      locals: affiliates.filter((a) => a.organizationType === 'local').length,
    },
  };
}

// A status this page does not know is shown as it is stored: it is never read as "current" or "compliant".
const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary', label: string }> = {
    current: { variant: 'default', label: 'Current' },
    overdue: { variant: 'destructive', label: 'Overdue' },
    pending: { variant: 'secondary', label: 'Pending' },
    exempt: { variant: 'outline', label: 'Exempt' },
  };
  const config = variants[status] ?? { variant: 'outline' as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getComplianceBadge = (status: string) => {
  const variants: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary', label: string, icon: IconComponent }> = {
    compliant: { variant: 'default', label: 'Compliant', icon: CheckCircle },
    'at-risk': { variant: 'secondary', label: 'At Risk', icon: AlertCircle },
    'non-compliant': { variant: 'destructive', label: 'Non-Compliant', icon: AlertCircle },
  };
  const config = variants[status] ?? { variant: 'outline' as const, label: status, icon: AlertCircle };
  const Icon = config.icon;
  return (
    <Badge variant={config.variant}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};

function AffiliatesTable({ affiliates, t }: { affiliates: AffiliateData[]; t: Translate }) {
  return (
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
          {affiliates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                {t('table.noAffiliates', { defaultValue: 'No affiliates found' })}
              </TableCell>
            </TableRow>
          ) : (
            affiliates.map((affiliate) => (
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
                <TableCell className="text-right">{affiliate.memberCount.toLocaleString()}</TableCell>
                <TableCell>{getStatusBadge(affiliate.remittanceStatus)}</TableCell>
                <TableCell>{getComplianceBadge(affiliate.complianceStatus)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/admin/organizations/${affiliate.id}`} aria-label={`${affiliate.name}`}>
                        <Eye className="h-4 w-4" />
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
  );
}

export default async function CLCAffiliatesPage() {
  const user = await requireUser();
  const userId = user.userId;
  const orgId = user.organizationId!;

  const hasAccess = await checkCLCAccess(userId, orgId);
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('clc.affiliates');
  const data = await getAffiliateData(userId, orgId);
  const unions = data.affiliates.filter((a) => a.organizationType === 'union');
  const federations = data.affiliates.filter((a) => a.organizationType === 'federation');
  const locals = data.affiliates.filter((a) => a.organizationType === 'local');

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

      {/* Affiliates */}
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
          <AffiliatesTable affiliates={data.affiliates} t={t} />
        </TabsContent>

        <TabsContent value="unions" className="space-y-4">
          <AffiliatesTable affiliates={unions} t={t} />
        </TabsContent>

        <TabsContent value="federations">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {federations.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">{t('table.noAffiliates', { defaultValue: 'No affiliates found' })}</p>
              )}
              {federations.map((federation) => (
                <div key={federation.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">{federation.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {federation.province && (
                          <>
                            <MapPin className="h-3 w-3" />
                            {federation.province}
                            <span className="mx-2">•</span>
                          </>
                        )}
                        <Users className="h-3 w-3" />
                        {federation.memberCount.toLocaleString()} members
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getComplianceBadge(federation.complianceStatus)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locals" className="space-y-4">
          <AffiliatesTable affiliates={locals} t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
