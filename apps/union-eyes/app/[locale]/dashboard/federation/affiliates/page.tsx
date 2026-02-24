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
  Phone, 
  Mail, 
  Search,
  Filter,
  Download,
  Eye,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AffiliateData {
  id: string;
  name: string;
  clcAffiliateCode?: string;
  organizationType?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  address?: string;
  description?: string;
}

export const metadata: Metadata = {
  title: 'Manage Affiliates | Federation Dashboard',
  description: 'View and manage member unions and locals within the federation',
};

async function checkFederationAccess(userId: string, orgId: string): Promise<boolean> {
  try {
    const userRole = await getUserRoleInOrganization(userId, orgId);
    return ['fed_staff', 'fed_executive', 'admin', 'system_admin'].includes(userRole || '');
  } catch {
    return false;
  }
}

async function getAffiliateData(federationId: string) {
  try {
    // Fetch all member unions and locals
    const affiliates = await db.query.organizations.findMany({
      where: (organizations, { eq }) => eq(organizations.parentId, federationId),
      orderBy: (organizations, { asc }) => [asc(organizations.name)],
    });

    // Calculate summary metrics
    const totalAffiliates = affiliates.length;
    const locals = affiliates.filter(a => a.organizationType === 'local');
    const unions = affiliates.filter(a => a.organizationType === 'union');
    const chapters = affiliates.filter(a => a.organizationType === 'local');

    return {
      affiliates,
      summary: {
        total: totalAffiliates,
        locals: locals.length,
        unions: unions.length,
        chapters: chapters.length,
      },
    };
  } catch {
    return {
      affiliates: [],
      summary: {
        total: 0,
        locals: 0,
        unions: 0,
        chapters: 0,
      },
    };
  }
}

export default async function FederationAffiliatesPage({
  searchParams: _searchParams,
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

  const t = await getTranslations('federation.affiliates');
  const data = await getAffiliateData(orgId);

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
              {t('breadcrumb.affiliates', { defaultValue: 'Affiliates' })}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            {t('title', { defaultValue: 'Manage Affiliates' })}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('description', { 
              defaultValue: 'View and manage member unions, locals, and their details' 
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
              {t('summary.total', { defaultValue: 'Total Affiliates' })}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('summary.locals', { defaultValue: 'Locals' })}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.locals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('summary.unions', { defaultValue: 'Unions' })}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.unions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('summary.chapters', { defaultValue: 'Chapters' })}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.chapters}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('filters.title', { defaultValue: 'Filters' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('filters.search', { defaultValue: 'Search affiliates...' })}
                className="pl-10"
              />
            </div>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder={t('filters.type', { defaultValue: 'Organization Type' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allTypes', { defaultValue: 'All Types' })}</SelectItem>
                <SelectItem value="local">{t('filters.locals', { defaultValue: 'Locals' })}</SelectItem>
                <SelectItem value="union">{t('filters.unions', { defaultValue: 'Unions' })}</SelectItem>
                <SelectItem value="chapter">{t('filters.chapters', { defaultValue: 'Chapters' })}</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder={t('filters.status', { defaultValue: 'Status' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allStatuses', { defaultValue: 'All Statuses' })}</SelectItem>
                <SelectItem value="active">{t('filters.active', { defaultValue: 'Active' })}</SelectItem>
                <SelectItem value="inactive">{t('filters.inactive', { defaultValue: 'Inactive' })}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="w-full">
              {t('filters.apply', { defaultValue: 'Apply Filters' })}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Affiliates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('list.title', { defaultValue: 'Affiliated Organizations' })}
          </CardTitle>
          <CardDescription>
            {t('list.description', { 
              count: data.affiliates.length,
              defaultValue: `${data.affiliates.length} organizations` 
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.affiliates.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">
                {t('list.empty.title', { defaultValue: 'No Affiliates Found' })}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t('list.empty.description', { 
                  defaultValue: 'No affiliated organizations match the current filters' 
                })}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(data.affiliates as unknown as AffiliateData[]).map((affiliate: AffiliateData) => (
                <div 
                  key={affiliate.id} 
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{affiliate.name}</h3>
                        {affiliate.clcAffiliateCode && (
                          <Badge variant="outline">
                            {affiliate.clcAffiliateCode}
                          </Badge>
                        )}
                        {affiliate.organizationType && (
                          <Badge variant="secondary" className="capitalize">
                            {affiliate.organizationType}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-muted-foreground">
                        {affiliate.primaryContactEmail && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span>{affiliate.primaryContactEmail}</span>
                          </div>
                        )}
                        {affiliate.primaryContactPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{affiliate.primaryContactPhone}</span>
                          </div>
                        )}
                        {affiliate.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{affiliate.address}</span>
                          </div>
                        )}
                      </div>
                      
                      {affiliate.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {affiliate.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/federation/affiliates/${affiliate.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          {t('list.viewDetails', { defaultValue: 'View' })}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
            <Link href="/dashboard/federation/remittances">
              <TrendingUp className="mr-2 h-4 w-4" />
              {t('quickLinks.remittances', { defaultValue: 'View Remittances' })}
            </Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href="/dashboard/cross-union-analytics">
              <TrendingUp className="mr-2 h-4 w-4" />
              {t('quickLinks.analytics', { defaultValue: 'Cross-Union Analytics' })}
            </Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href="/dashboard/compliance">
              <AlertCircle className="mr-2 h-4 w-4" />
              {t('quickLinks.compliance', { defaultValue: 'Compliance Reports' })}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
