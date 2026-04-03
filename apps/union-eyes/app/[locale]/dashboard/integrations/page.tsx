/**
 * Integrations Dashboard
 * For Integration Manager - API keys, webhooks, and partner integrations
 *
 * @role integration_manager
 * @dashboard_path /dashboard/integrations
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { Key, Webhook, Activity, CheckCircle2, XCircle, Clock, Plug, AlertTriangle } from 'lucide-react';
import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

// ── Types ──────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  requestCount: number;
  createdBy: string | null;
  createdAt: string;
}

interface WebhookEntry {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: string;
  lastTriggeredAt: string | null;
  lastStatus: string | null;
  lastResponseCode: number | null;
  successCount: number;
  failureCount: number;
  createdAt: string;
}

interface PartnerIntegration {
  id: string;
  name: string;
  provider: string;
  category: string;
  status: string;
  description: string | null;
  icon: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

interface IntegrationStats {
  activeApiKeys: number;
  totalApiKeys: number;
  revokedApiKeys: number;
  expiredApiKeys: number;
  activeWebhooks: number;
  totalWebhooks: number;
  errorWebhooks: number;
  pausedWebhooks: number;
  webhookSuccessRate: number;
  totalRequests: number;
  connectedPartners: number;
  totalPartners: number;
  pendingPartners: number;
  errorPartners: number;
}

// ── Data loaders ───────────────────────────────────────────────────────────

async function loadApiKeys(orgId: string): Promise<ApiKey[]> {
  const result = await db.execute(sql`
    SELECT id, name, key_prefix,
      CASE
        WHEN revoked_at IS NOT NULL THEN 'revoked'
        WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
        WHEN is_active THEN 'active'
        ELSE 'inactive'
      END AS status,
      scopes, last_used_at, expires_at, usage_count AS request_count,
      created_by, created_at
    FROM integration_api_keys
    WHERE organization_id = ${orgId}::uuid
    ORDER BY
      CASE
        WHEN revoked_at IS NOT NULL THEN 2
        WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 1
        ELSE 0
      END,
      created_at DESC
  `);

  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    keyPrefix: r.key_prefix as string,
    status: r.status as string,
    scopes: (r.scopes as string[]) ?? [],
    lastUsedAt: r.last_used_at as string | null,
    expiresAt: r.expires_at as string | null,
    requestCount: Number(r.request_count ?? 0),
    createdBy: r.created_by as string | null,
    createdAt: r.created_at as string,
  }));
}

async function loadWebhooks(orgId: string): Promise<WebhookEntry[]> {
  const result = await db.execute(sql`
    SELECT id,
      COALESCE(description, url) AS name,
      url, events,
      CASE WHEN is_active THEN 'active' ELSE 'paused' END AS status,
      last_triggered_at,
      NULL::text AS last_status,
      NULL::int AS last_response_code,
      GREATEST(delivery_count - failure_count, 0) AS success_count,
      failure_count, created_at
    FROM integration_webhooks
    WHERE organization_id = ${orgId}::uuid
    ORDER BY
      CASE WHEN failure_count > 0 AND is_active THEN 0 WHEN is_active THEN 1 ELSE 2 END,
      created_at DESC
  `);

  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    url: r.url as string,
    events: (r.events as string[]) ?? [],
    status: r.status as string,
    lastTriggeredAt: r.last_triggered_at as string | null,
    lastStatus: null,
    lastResponseCode: null,
    successCount: Number(r.success_count ?? 0),
    failureCount: Number(r.failure_count ?? 0),
    createdAt: r.created_at as string,
  }));
}

async function loadPartners(orgId: string): Promise<PartnerIntegration[]> {
  const result = await db.execute(sql`
    SELECT id, name, provider, category, status, description, icon, last_sync_at, created_at
    FROM integration_partners
    WHERE organization_id = ${orgId}::uuid
    ORDER BY
      CASE status WHEN 'error' THEN 0 WHEN 'pending' THEN 1 WHEN 'connected' THEN 2 ELSE 3 END,
      name
  `);

  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    provider: r.provider as string,
    category: r.category as string,
    status: r.status as string,
    description: r.description as string | null,
    icon: r.icon as string | null,
    lastSyncAt: r.last_sync_at as string | null,
    createdAt: r.created_at as string,
  }));
}

function computeStats(
  apiKeys: ApiKey[],
  webhooks: WebhookEntry[],
  partners: PartnerIntegration[],
): IntegrationStats {
  const activeApiKeys = apiKeys.filter(k => k.status === 'active').length;
  const revokedApiKeys = apiKeys.filter(k => k.status === 'revoked').length;
  const expiredApiKeys = apiKeys.filter(k => k.status === 'expired').length;
  const totalRequests = apiKeys.reduce((sum, k) => sum + k.requestCount, 0);

  const activeWebhooks = webhooks.filter(w => w.status === 'active').length;
  const errorWebhooks = webhooks.filter(w => w.status === 'error').length;
  const pausedWebhooks = webhooks.filter(w => w.status === 'paused').length;
  const totalSuccess = webhooks.reduce((sum, w) => sum + w.successCount, 0);
  const totalFailure = webhooks.reduce((sum, w) => sum + w.failureCount, 0);
  const totalDeliveries = totalSuccess + totalFailure;
  const webhookSuccessRate = totalDeliveries > 0
    ? Math.round((totalSuccess / totalDeliveries) * 1000) / 10
    : 100;

  const connectedPartners = partners.filter(p => p.status === 'connected').length;
  const pendingPartners = partners.filter(p => p.status === 'pending').length;
  const errorPartners = partners.filter(p => p.status === 'error' || p.status === 'disconnected').length;

  return {
    activeApiKeys,
    totalApiKeys: apiKeys.length,
    revokedApiKeys,
    expiredApiKeys,
    activeWebhooks,
    totalWebhooks: webhooks.length,
    errorWebhooks,
    pausedWebhooks,
    webhookSuccessRate,
    totalRequests,
    connectedPartners,
    totalPartners: partners.length,
    pendingPartners,
    errorPartners,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function keyStatusVariant(status: string) {
  switch (status) {
    case 'active': return 'default' as const;
    case 'expired': return 'secondary' as const;
    case 'revoked': return 'destructive' as const;
    default: return 'outline' as const;
  }
}

function webhookStatusVariant(status: string) {
  switch (status) {
    case 'active': return 'default' as const;
    case 'paused': return 'secondary' as const;
    case 'error': return 'destructive' as const;
    default: return 'outline' as const;
  }
}

function partnerStatusVariant(status: string) {
  switch (status) {
    case 'connected': return 'default' as const;
    case 'pending': return 'secondary' as const;
    case 'error': return 'destructive' as const;
    case 'disconnected': return 'destructive' as const;
    default: return 'outline' as const;
  }
}

function partnerStatusIcon(status: string) {
  switch (status) {
    case 'connected': return <CheckCircle2 className="h-3 w-3" />;
    case 'pending': return <Clock className="h-3 w-3" />;
    case 'error': return <XCircle className="h-3 w-3" />;
    case 'disconnected': return <XCircle className="h-3 w-3" />;
    default: return null;
  }
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

function formatNumber(n: number) {
  return n.toLocaleString();
}

function maskUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.pathname}`;
  } catch {
    return url;
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function IntegrationsDashboard({
  params: paramsPromise,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const { locale } = await paramsPromise;
  const params = await searchParams;
  const activeTab = params.tab ?? 'overview';
  const filterStatus = params.status ?? null;

  const user = await requireUser();

  const hasAccess = await hasMinRole('integration_manager');
  if (!hasAccess) {
    redirect(`/${locale}/dashboard`);
  }

  const organizationId = user.organizationId;

  let apiKeys: ApiKey[] = [];
  let webhooks: WebhookEntry[] = [];
  let partners: PartnerIntegration[] = [];

  if (organizationId) {
    try {
      [apiKeys, webhooks, partners] = await withSystemContext(() =>
        Promise.all([
          loadApiKeys(organizationId),
          loadWebhooks(organizationId),
          loadPartners(organizationId),
        ])
      );
    } catch (error) {
      logger.error('Error loading integrations data:', error);
    }
  }

  const stats = computeStats(apiKeys, webhooks, partners);

  // Integration health
  const healthStatus = stats.errorWebhooks > 0 || stats.errorPartners > 0
    ? 'Issues'
    : stats.pausedWebhooks > 0 || stats.pendingPartners > 0
    ? 'Warning'
    : 'Healthy';

  const healthColor = healthStatus === 'Healthy'
    ? 'text-green-600'
    : healthStatus === 'Warning'
    ? 'text-yellow-600'
    : 'text-red-600';

  // Filtered views
  const filteredApiKeys = filterStatus
    ? apiKeys.filter(k => k.status === filterStatus)
    : apiKeys;
  const filteredWebhooks = filterStatus
    ? webhooks.filter(w => w.status === filterStatus)
    : webhooks;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage API keys, webhooks, and partner integrations
        </p>
      </div>

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <Link href={`/${locale}/dashboard/integrations`} className="no-underline">Overview</Link>
          </TabsTrigger>
          <TabsTrigger value="api-keys">
            <Link href={`/${locale}/dashboard/integrations?tab=api-keys`} className="no-underline">
              API Keys ({stats.activeApiKeys})
            </Link>
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Link href={`/${locale}/dashboard/integrations?tab=webhooks`} className="no-underline">
              Webhooks {stats.errorWebhooks > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-xs">{stats.errorWebhooks}</Badge>
              )}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="partners">
            <Link href={`/${locale}/dashboard/integrations?tab=partners`} className="no-underline">
              Partners ({stats.connectedPartners})
            </Link>
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ─────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href={`/${locale}/dashboard/integrations?tab=api-keys`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Active API Keys
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeApiKeys}</div>
                  <p className="text-xs text-muted-foreground">Out of {stats.totalApiKeys} total</p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/${locale}/dashboard/integrations?tab=webhooks`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    Active Webhooks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeWebhooks}</div>
                  <p className="text-xs text-muted-foreground">Out of {stats.totalWebhooks} total</p>
                </CardContent>
              </Card>
            </Link>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Webhook Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.webhookSuccessRate >= 99 ? 'text-green-600' : stats.webhookSuccessRate >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {stats.webhookSuccessRate}%
                </div>
                <p className="text-xs text-muted-foreground">Across all deliveries</p>
              </CardContent>
            </Card>

            <Link href={`/${locale}/dashboard/integrations?tab=partners`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Plug className="h-4 w-4" />
                    Integration Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${healthColor}`}>{healthStatus}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.connectedPartners}/{stats.totalPartners} connected
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>API Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Requests</span>
                    <span className="text-sm font-bold">{formatNumber(stats.totalRequests)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Keys</span>
                    <span className="text-sm font-bold">{stats.activeApiKeys}</span>
                  </div>
                  <Link href={`/${locale}/dashboard/integrations?tab=api-keys&status=revoked`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">Revoked Keys</span>
                    <Badge variant={stats.revokedApiKeys > 0 ? 'destructive' : 'outline'}>{stats.revokedApiKeys}</Badge>
                  </Link>
                  <Link href={`/${locale}/dashboard/integrations?tab=api-keys&status=expired`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">Expired Keys</span>
                    <Badge variant={stats.expiredApiKeys > 0 ? 'secondary' : 'outline'}>{stats.expiredApiKeys}</Badge>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Partner Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {partners.map((partner) => (
                    <div key={partner.id} className="flex items-center justify-between">
                      <span className="text-sm">{partner.name}</span>
                      <Badge variant={partnerStatusVariant(partner.status)} className="flex items-center gap-1">
                        {partnerStatusIcon(partner.status)}
                        {partner.status === 'connected' ? 'Connected' :
                         partner.status === 'pending' ? 'Pending' :
                         partner.status === 'error' ? 'Error' :
                         partner.status === 'disconnected' ? 'Disconnected' : partner.status}
                      </Badge>
                    </div>
                  ))}
                  {partners.length === 0 && (
                    <p className="text-sm text-muted-foreground">No integrations configured</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── API Keys Tab ─────────────────────────────────────────────── */}
        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>API Keys</CardTitle>
                {filterStatus ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Filtered: {filterStatus}</Badge>
                    <Link href={`/${locale}/dashboard/integrations?tab=api-keys`} className="text-xs text-muted-foreground hover:text-foreground">
                      Clear filter
                    </Link>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Link href={`/${locale}/dashboard/integrations?tab=api-keys&status=active`}>
                      <Badge variant="default" className="cursor-pointer hover:opacity-80">Active ({stats.activeApiKeys})</Badge>
                    </Link>
                    {stats.revokedApiKeys > 0 && (
                      <Link href={`/${locale}/dashboard/integrations?tab=api-keys&status=revoked`}>
                        <Badge variant="destructive" className="cursor-pointer hover:opacity-80">Revoked ({stats.revokedApiKeys})</Badge>
                      </Link>
                    )}
                    {stats.expiredApiKeys > 0 && (
                      <Link href={`/${locale}/dashboard/integrations?tab=api-keys&status=expired`}>
                        <Badge variant="secondary" className="cursor-pointer hover:opacity-80">Expired ({stats.expiredApiKeys})</Badge>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredApiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">No API keys found</p>
              ) : (
                <div className="space-y-3">
                  {filteredApiKeys.map((key) => (
                    <div key={key.id} className="flex items-start justify-between border-b pb-3 last:border-0 gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{key.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{key.keyPrefix}••••••••</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>{formatNumber(key.requestCount)} requests</span>
                          <span>&bull;</span>
                          <span>Scopes: {key.scopes.join(', ')}</span>
                          {key.lastUsedAt && (
                            <>
                              <span>&bull;</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Used {timeAgo(key.lastUsedAt)}
                              </span>
                            </>
                          )}
                        </div>
                        {key.expiresAt && (
                          <p className={`text-xs ${new Date(key.expiresAt) < new Date() ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {new Date(key.expiresAt) < new Date() ? 'Expired' : 'Expires'}: {new Date(key.expiresAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Badge variant={keyStatusVariant(key.status)} className="shrink-0">
                        {key.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Webhooks Tab ─────────────────────────────────────────────── */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Webhooks</CardTitle>
                {filterStatus ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Filtered: {filterStatus}</Badge>
                    <Link href={`/${locale}/dashboard/integrations?tab=webhooks`} className="text-xs text-muted-foreground hover:text-foreground">
                      Clear filter
                    </Link>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Link href={`/${locale}/dashboard/integrations?tab=webhooks&status=active`}>
                      <Badge variant="default" className="cursor-pointer hover:opacity-80">Active ({stats.activeWebhooks})</Badge>
                    </Link>
                    {stats.errorWebhooks > 0 && (
                      <Link href={`/${locale}/dashboard/integrations?tab=webhooks&status=error`}>
                        <Badge variant="destructive" className="cursor-pointer hover:opacity-80">Error ({stats.errorWebhooks})</Badge>
                      </Link>
                    )}
                    {stats.pausedWebhooks > 0 && (
                      <Link href={`/${locale}/dashboard/integrations?tab=webhooks&status=paused`}>
                        <Badge variant="secondary" className="cursor-pointer hover:opacity-80">Paused ({stats.pausedWebhooks})</Badge>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredWebhooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No webhooks found</p>
              ) : (
                <div className="space-y-3">
                  {filteredWebhooks.map((hook) => {
                    const deliveryRate = hook.successCount + hook.failureCount > 0
                      ? Math.round((hook.successCount / (hook.successCount + hook.failureCount)) * 100)
                      : 100;

                    return (
                      <div key={hook.id} className="flex items-start justify-between border-b pb-3 last:border-0 gap-4">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{hook.name}</span>
                            {hook.lastStatus === 'failed' && (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono truncate">{maskUrl(hook.url)}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span>{hook.events.join(', ')}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span className={deliveryRate >= 99 ? 'text-green-600' : deliveryRate >= 95 ? 'text-yellow-600' : 'text-red-600'}>
                              {deliveryRate}% delivery rate
                            </span>
                            <span>&bull;</span>
                            <span>{formatNumber(hook.successCount)} delivered</span>
                            {hook.failureCount > 0 && (
                              <>
                                <span>&bull;</span>
                                <span className="text-red-600">{hook.failureCount} failed</span>
                              </>
                            )}
                            {hook.lastTriggeredAt && (
                              <>
                                <span>&bull;</span>
                                <span>Last: {timeAgo(hook.lastTriggeredAt)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant={webhookStatusVariant(hook.status)}>
                            {hook.status}
                          </Badge>
                          {hook.lastResponseCode && (
                            <span className={`text-xs font-mono ${hook.lastResponseCode < 300 ? 'text-green-600' : 'text-red-600'}`}>
                              HTTP {hook.lastResponseCode}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Partners Tab ─────────────────────────────────────────────── */}
        <TabsContent value="partners" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Connected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.connectedPartners}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.pendingPartners}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.errorPartners}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Partner Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              {partners.length === 0 ? (
                <p className="text-sm text-muted-foreground">No integrations configured</p>
              ) : (
                <div className="space-y-4">
                  {partners.map((partner) => (
                    <div key={partner.id} className="flex items-start justify-between border-b pb-4 last:border-0 gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{partner.name}</span>
                          <Badge variant="outline" className="text-xs">{partner.category}</Badge>
                        </div>
                        {partner.description && (
                          <p className="text-sm text-muted-foreground">{partner.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Provider: {partner.provider}</span>
                          {partner.lastSyncAt && (
                            <>
                              <span>&bull;</span>
                              <span>Last sync {timeAgo(partner.lastSyncAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant={partnerStatusVariant(partner.status)} className="flex items-center gap-1 shrink-0">
                        {partnerStatusIcon(partner.status)}
                        {partner.status === 'connected' ? 'Connected' :
                         partner.status === 'pending' ? 'Pending' :
                         partner.status === 'error' ? 'Error' :
                         partner.status === 'disconnected' ? 'Disconnected' : partner.status}
                      </Badge>
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
