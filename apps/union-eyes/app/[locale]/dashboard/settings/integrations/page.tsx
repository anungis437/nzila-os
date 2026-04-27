/**
 * Enterprise Integration Settings
 * Manage data-source integrations: Pension, Calendar, HRIS, Insurance,
 * Accounting, Communication, CRM, and more.
 *
 * @role integration_manager
 * @dashboard_path /dashboard/settings/integrations
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Plug,
  Calendar,
  Wallet,
  Users,
  Shield,
  Calculator,
  MessageSquare,
  BarChart3,
  Database,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { getTranslations } from 'next-intl/server';

// ── Types ──────────────────────────────────────────────────────────────────

interface IntegrationConfig {
  id: string;
  type: string;
  provider: string;
  status: string;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DataDomain {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  providers: ProviderInfo[];
  tableCount: number;
}

interface ProviderInfo {
  key: string;
  label: string;
  status: 'connected' | 'available' | 'coming_soon';
  configId?: string;
}

interface DomainStats {
  domain: string;
  tableCount: number;
  totalRows: number;
}

// ── Data loaders ───────────────────────────────────────────────────────────

async function loadIntegrationConfigs(orgId: string): Promise<IntegrationConfig[]> {
  const result = await db.execute(sql`
    SELECT id, type, provider, status, metadata,
           created_by, created_at, updated_at
    FROM integration_configs
    WHERE org_id = ${orgId}::uuid
    ORDER BY type, provider
  `);

  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    type: r.type as string,
    provider: r.provider as string,
    status: r.status as string,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdBy: r.created_by as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));
}

async function loadDomainTableStats(_orgId: string): Promise<DomainStats[]> {
  try {
    const result = await db.execute(sql`
      SELECT
        CASE
          WHEN table_name LIKE 'external_pension%' THEN 'pension'
          WHEN table_name LIKE 'external_calendar%' THEN 'calendar'
          WHEN table_name LIKE 'external_hris%' THEN 'hris'
          WHEN table_name LIKE 'external_insurance%' THEN 'insurance'
          WHEN table_name LIKE 'external_accounting%' THEN 'accounting'
          WHEN table_name LIKE 'external_communication%' THEN 'communication'
          WHEN table_name LIKE 'external_crm%' THEN 'crm'
          WHEN table_name LIKE 'external_commerce%' THEN 'commerce'
          WHEN table_name LIKE 'external_lrb%' OR table_name LIKE 'external_labour%' THEN 'labour'
          WHEN table_name LIKE 'external_health%' THEN 'health'
          WHEN table_name LIKE 'external_clc%' OR table_name LIKE 'external_collective%' THEN 'collective'
          ELSE 'other'
        END AS domain,
        count(*)::int AS table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'external_%'
      GROUP BY 1
      ORDER BY 1
    `);

    return Array.from(result).map((r: Record<string, unknown>) => ({
      domain: r.domain as string,
      tableCount: r.table_count as number,
      totalRows: 0,
    }));
  } catch {
    return [];
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function statusVariant(status: string) {
  switch (status) {
    case 'active':
    case 'connected':
      return 'default' as const;
    case 'inactive':
    case 'available':
      return 'secondary' as const;
    case 'suspended':
    case 'error':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'active':
    case 'connected':
      return <CheckCircle2 className="h-3 w-3" />;
    case 'inactive':
      return <Clock className="h-3 w-3" />;
    case 'suspended':
    case 'error':
      return <XCircle className="h-3 w-3" />;
    default:
      return null;
  }
}

function timeAgo(dateStr: string, t: Awaited<ReturnType<typeof getTranslations>>) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return t('timeAgo.minutes', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('timeAgo.hours', { count: hours });
  const days = Math.floor(hours / 24);
  return t('timeAgo.days', { count: days });
}

function integrationStatusLabel(
  status: ProviderInfo['status'] | IntegrationConfig['status'],
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  switch (status) {
    case 'connected':
      return t('statuses.connected');
    case 'available':
      return t('statuses.available');
    case 'coming_soon':
      return t('statuses.comingSoon');
    case 'active':
      return t('statuses.active');
    case 'inactive':
      return t('statuses.inactive');
    case 'suspended':
      return t('statuses.suspended');
    case 'error':
      return t('statuses.error');
    default:
      return status;
  }
}

// ── Domain catalogue ───────────────────────────────────────────────────────

function buildDomainCatalogue(
  configs: IntegrationConfig[],
  domainStats: DomainStats[],
  t: Awaited<ReturnType<typeof getTranslations>>,
): DataDomain[] {
  const configsByDomain = new Map<string, IntegrationConfig[]>();
  for (const cfg of configs) {
    const domain = (cfg.metadata?.domain as string) ?? cfg.type;
    if (!configsByDomain.has(domain)) configsByDomain.set(domain, []);
    configsByDomain.get(domain)!.push(cfg);
  }

  const statsMap = new Map(domainStats.map((s) => [s.domain, s]));

  const providerStatus = (domain: string, providerKey: string): ProviderInfo['status'] => {
    const domainConfigs = configsByDomain.get(domain) ?? [];
    const cfg = domainConfigs.find((c) => c.provider === providerKey);
    if (cfg?.status === 'active') return 'connected';
    return 'available';
  };

  const providerConfigId = (domain: string, providerKey: string): string | undefined => {
    const domainConfigs = configsByDomain.get(domain) ?? [];
    return domainConfigs.find((c) => c.provider === providerKey)?.id;
  };

  return [
    {
      key: 'pension',
      label: t('domains.pension.label'),
      description: t('domains.pension.description'),
      icon: <Wallet className="h-5 w-5" />,
      tableCount: statsMap.get('pension')?.tableCount ?? 0,
      providers: [
        { key: 'otpp', label: t('providers.otpp'), status: providerStatus('pension', 'otpp'), configId: providerConfigId('pension', 'otpp') },
        { key: 'cpp', label: t('providers.cpp'), status: providerStatus('pension', 'cpp'), configId: providerConfigId('pension', 'cpp') },
        { key: 'hoopp', label: t('providers.hoopp'), status: providerStatus('pension', 'hoopp'), configId: providerConfigId('pension', 'hoopp') },
        { key: 'omers', label: t('providers.omers'), status: providerStatus('pension', 'omers'), configId: providerConfigId('pension', 'omers') },
      ],
    },
    {
      key: 'calendar',
      label: t('domains.calendar.label'),
      description: t('domains.calendar.description'),
      icon: <Calendar className="h-5 w-5" />,
      tableCount: statsMap.get('calendar')?.tableCount ?? 0,
      providers: [
        { key: 'outlook', label: t('providers.outlook'), status: providerStatus('calendar', 'outlook'), configId: providerConfigId('calendar', 'outlook') },
        { key: 'google', label: t('providers.google'), status: providerStatus('calendar', 'google'), configId: providerConfigId('calendar', 'google') },
        { key: 'apple', label: t('providers.apple'), status: 'coming_soon' as const },
      ],
    },
    {
      key: 'hris',
      label: t('domains.hris.label'),
      description: t('domains.hris.description'),
      icon: <Users className="h-5 w-5" />,
      tableCount: statsMap.get('hris')?.tableCount ?? 0,
      providers: [
        { key: 'workday', label: t('providers.workday'), status: providerStatus('hris', 'workday'), configId: providerConfigId('hris', 'workday') },
        { key: 'bamboohr', label: t('providers.bamboohr'), status: providerStatus('hris', 'bamboohr'), configId: providerConfigId('hris', 'bamboohr') },
        { key: 'adp', label: t('providers.adp'), status: providerStatus('hris', 'adp'), configId: providerConfigId('hris', 'adp') },
      ],
    },
    {
      key: 'insurance',
      label: t('domains.insurance.label'),
      description: t('domains.insurance.description'),
      icon: <Shield className="h-5 w-5" />,
      tableCount: statsMap.get('insurance')?.tableCount ?? 0,
      providers: [
        { key: 'sunlife', label: t('providers.sunlife'), status: providerStatus('insurance', 'sunlife'), configId: providerConfigId('insurance', 'sunlife') },
        { key: 'manulife', label: t('providers.manulife'), status: providerStatus('insurance', 'manulife'), configId: providerConfigId('insurance', 'manulife') },
        { key: 'greatwest', label: t('providers.greatwest'), status: providerStatus('insurance', 'greatwest'), configId: providerConfigId('insurance', 'greatwest') },
      ],
    },
    {
      key: 'accounting',
      label: t('domains.accounting.label'),
      description: t('domains.accounting.description'),
      icon: <Calculator className="h-5 w-5" />,
      tableCount: statsMap.get('accounting')?.tableCount ?? 0,
      providers: [
        { key: 'quickbooks', label: t('providers.quickbooks'), status: providerStatus('accounting', 'quickbooks'), configId: providerConfigId('accounting', 'quickbooks') },
        { key: 'sage', label: t('providers.sage'), status: providerStatus('accounting', 'sage'), configId: providerConfigId('accounting', 'sage') },
        { key: 'xero', label: t('providers.xero'), status: providerStatus('accounting', 'xero'), configId: providerConfigId('accounting', 'xero') },
      ],
    },
    {
      key: 'communication',
      label: t('domains.communication.label'),
      description: t('domains.communication.description'),
      icon: <MessageSquare className="h-5 w-5" />,
      tableCount: statsMap.get('communication')?.tableCount ?? 0,
      providers: [
        { key: 'resend', label: t('providers.resend'), status: providerStatus('communication', 'resend'), configId: providerConfigId('communication', 'resend') },
        { key: 'twilio', label: t('providers.twilio'), status: providerStatus('communication', 'twilio'), configId: providerConfigId('communication', 'twilio') },
        { key: 'sendgrid', label: t('providers.sendgrid'), status: providerStatus('communication', 'sendgrid'), configId: providerConfigId('communication', 'sendgrid') },
      ],
    },
    {
      key: 'crm',
      label: t('domains.crm.label'),
      description: t('domains.crm.description'),
      icon: <BarChart3 className="h-5 w-5" />,
      tableCount: statsMap.get('crm')?.tableCount ?? 0,
      providers: [
        { key: 'hubspot', label: t('providers.hubspot'), status: providerStatus('crm', 'hubspot'), configId: providerConfigId('crm', 'hubspot') },
        { key: 'salesforce', label: t('providers.salesforce'), status: 'coming_soon' as const },
      ],
    },
  ];
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function IntegrationSettingsPage({
  params: paramsPromise,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; domain?: string }>;
}) {
  const { locale } = await paramsPromise;
  const params = await searchParams;
  const t = await getTranslations('settingsIntegrationsPage');
  const activeTab = params.tab ?? 'overview';
  const filterDomain = params.domain ?? null;

  const user = await requireUser();
  const hasAccess = await hasMinRole('integration_manager');
  if (!hasAccess) {
    redirect(`/${locale}/dashboard`);
  }

  const organizationId = user.organizationId;

  let configs: IntegrationConfig[] = [];
  let domainStats: DomainStats[] = [];

  if (organizationId) {
    try {
      [configs, domainStats] = await withSystemContext(() =>
        Promise.all([
          loadIntegrationConfigs(organizationId),
          loadDomainTableStats(organizationId),
        ]),
      );
    } catch (error) {
      logger.error('Error loading integration settings:', error);
    }
  }

  const domains = buildDomainCatalogue(configs, domainStats, t);
  const filteredDomains = filterDomain
    ? domains.filter((d) => d.key === filterDomain)
    : domains;

  const totalConnected = domains
    .flatMap((d) => d.providers)
    .filter((p) => p.status === 'connected').length;
  const totalAvailable = domains
    .flatMap((d) => d.providers)
    .filter((p) => p.status === 'available').length;
  const totalComingSoon = domains
    .flatMap((d) => d.providers)
    .filter((p) => p.status === 'coming_soon').length;
  const totalTables = domainStats.reduce((sum, s) => sum + s.tableCount, 0);

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
            <Link href={`/${locale}/dashboard/settings/integrations`} className="no-underline">
              {t('tabs.overview')}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="domains">
            <Link href={`/${locale}/dashboard/settings/integrations?tab=domains`} className="no-underline">
              {t('tabs.domains', { count: domains.length })}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="configs">
            <Link href={`/${locale}/dashboard/settings/integrations?tab=configs`} className="no-underline">
              {t('tabs.configs', { count: configs.length })}
            </Link>
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ──────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {t('overview.connectedTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalConnected}</div>
                <p className="text-xs text-muted-foreground">{t('overview.connectedDescription')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Plug className="h-4 w-4 text-blue-600" />
                  {t('overview.availableTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAvailable}</div>
                <p className="text-xs text-muted-foreground">{t('overview.availableDescription')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4 text-purple-600" />
                  {t('overview.dataTablesTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalTables}</div>
                <p className="text-xs text-muted-foreground">{t('overview.dataTablesDescription')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  {t('overview.comingSoonTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalComingSoon}</div>
                <p className="text-xs text-muted-foreground">{t('overview.comingSoonDescription')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Domain summary cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {domains.map((domain) => {
              const connected = domain.providers.filter((p) => p.status === 'connected').length;
              const total = domain.providers.length;
              return (
                <Link
                  key={domain.key}
                  href={`/${locale}/dashboard/settings/integrations?tab=domains&domain=${domain.key}`}
                  className="no-underline"
                >
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {domain.icon}
                        {domain.label}
                      </CardTitle>
                      <CardDescription className="text-xs">{domain.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={connected > 0 ? 'default' : 'secondary'}>
                            {t('overview.domainConnectedBadge', { connected, total })}
                          </Badge>
                        </div>
                        {domain.tableCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {t('overview.domainTables', { count: domain.tableCount })}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Domains tab ───────────────────────────────────────────── */}
        <TabsContent value="domains" className="space-y-4">
          {filterDomain && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {t('domainsTab.filtered', {
                  domain: domains.find((d) => d.key === filterDomain)?.label ?? filterDomain,
                })}
              </Badge>
              <Link
                href={`/${locale}/dashboard/settings/integrations?tab=domains`}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t('domainsTab.showAll')}
              </Link>
            </div>
          )}

          {filteredDomains.map((domain) => (
            <Card key={domain.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {domain.icon}
                    <div>
                      <CardTitle>{domain.label}</CardTitle>
                      <CardDescription>{domain.description}</CardDescription>
                    </div>
                  </div>
                  {domain.tableCount > 0 && (
                    <Badge variant="outline">{t('overview.domainTables', { count: domain.tableCount })}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {domain.providers.map((provider) => (
                    <div
                      key={provider.key}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium">{provider.label}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {provider.key}
                        </p>
                      </div>
                      <Badge
                        variant={
                          provider.status === 'connected'
                            ? 'default'
                            : provider.status === 'coming_soon'
                              ? 'outline'
                              : 'secondary'
                        }
                        className="flex items-center gap-1"
                      >
                        {provider.status === 'connected' && (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {provider.status === 'coming_soon' && (
                          <Clock className="h-3 w-3" />
                        )}
                        {provider.status === 'available' && (
                          <Plug className="h-3 w-3" />
                        )}
                        {provider.status === 'connected'
                          ? t('statuses.connected')
                          : provider.status === 'coming_soon'
                            ? t('statuses.comingSoon')
                            : t('statuses.available')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Configs tab ───────────────────────────────────────────── */}
        <TabsContent value="configs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('configs.title')}</CardTitle>
              <CardDescription>
                {t('configs.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Plug className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{t('configs.emptyTitle')}</p>
                  <p className="text-sm mt-1">
                    {t('configs.emptyDescriptionPrefix')}{' '}
                    <Link
                      href={`/${locale}/dashboard/settings/integrations?tab=domains`}
                      className="text-primary underline"
                    >
                      {t('tabs.domainsLink')}
                    </Link>{' '}
                    {t('configs.emptyDescriptionSuffix')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {configs.map((cfg) => (
                    <div
                      key={cfg.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {statusIcon(cfg.status)}
                        <div>
                          <p className="text-sm font-medium">{cfg.provider}</p>
                          <p className="text-xs text-muted-foreground">
                            {t('configs.updatedLabel', {
                              type: cfg.type,
                              value: timeAgo(cfg.updatedAt, t),
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(cfg.status)} className="flex items-center gap-1">
                          {statusIcon(cfg.status)}
                          {integrationStatusLabel(cfg.status, t)}
                        </Badge>
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
