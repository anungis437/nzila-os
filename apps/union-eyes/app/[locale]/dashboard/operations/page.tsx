/**
 * Operations Dashboard
 * For Platform Lead, COO, CTO - Day-to-day platform operations
 *
 * @role platform_lead, coo, cto
 * @dashboard_path /dashboard/operations
 *
 * The physical table is public.platform_services (service_name, status, updated_at).
 * Incident, SLA, release, login, and capacity tables are not in the catalog.
 * This page does not invent those readings.
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { getLocale, getTranslations } from 'next-intl/server';

interface PlatformService {
  serviceName: string;
  status: string;
  updatedAt: string | null;
}

interface ServiceOverview {
  services: PlatformService[];
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  downServices: number;
  otherServices: number;
}

const RECORDED_STATUSES = new Set(['healthy', 'degraded', 'down']);

async function loadPlatformServices(): Promise<ServiceOverview> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT service_name, status, updated_at
      FROM platform_services
      ORDER BY
        CASE status WHEN 'down' THEN 0 WHEN 'degraded' THEN 1 ELSE 2 END,
        service_name
    `),
  ) as Array<Record<string, unknown>>;
  const services = rows.map((row) => ({
    serviceName: String(row.service_name),
    status: String(row.status),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  }));
  return {
    services,
    totalServices: services.length,
    healthyServices: services.filter((service) => service.status === 'healthy').length,
    degradedServices: services.filter((service) => service.status === 'degraded').length,
    downServices: services.filter((service) => service.status === 'down').length,
    otherServices: services.filter((service) => !RECORDED_STATUSES.has(service.status)).length,
  };
}

function serviceStatusIcon(status: string) {
  if (status === 'healthy') return '🟢';
  if (status === 'degraded') return '🟡';
  if (status === 'down') return '🔴';
  return '⚪';
}

export default async function OperationsDashboard(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: routeLocale } = await props.params;
  const locale = await getLocale();
  const t = await getTranslations('operationsPage');
  await requireUser();
  const hasAccess = await hasMinRole('platform_lead');
  if (!hasAccess) redirect(`/${routeLocale}/dashboard`);

  const searchParams = await props.searchParams;
  const tab = typeof searchParams.tab === 'string' ? searchParams.tab : 'overview';
  const tabs = ['overview', 'incidents', 'sla', 'releases', 'capacity'] as const;
  const tabLabels: Record<string, string> = {
    overview: t('tabOverview'),
    incidents: t('tabIncidents'),
    sla: t('tabSla'),
    releases: t('tabReleases'),
    capacity: t('tabCapacity'),
  };

  let overview: ServiceOverview | null = null;
  let readError: string | null = null;
  try {
    overview = await withSystemContext(() => loadPlatformServices());
  } catch (error) {
    readError = error instanceof Error ? error.message : 'platform_services read failed';
  }

  const allRecordedHealthy = Boolean(
    overview && overview.totalServices > 0 && overview.healthyServices === overview.totalServices,
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {tabs.map((tabKey) => (
          <Link
            key={tabKey}
            href={`?tab=${tabKey}`}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === tabKey ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            {tabLabels[tabKey]}
          </Link>
        ))}
      </div>

      {readError && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('serviceHealthTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700">{readError}</p>
          </CardContent>
        </Card>
      )}

      {overview && tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('systemHealthTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overview.healthyServices}/{overview.totalServices}
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.totalServices === 0
                    ? t('noServicesRecorded')
                    : allRecordedHealthy
                      ? t('allServicesHealthy')
                      : t('degradedServicesLabel', {
                          count: overview.degradedServices + overview.downServices + overview.otherServices,
                        })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('tableStatus')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>healthy {overview.healthyServices}</p>
                <p>degraded {overview.degradedServices}</p>
                <p>down {overview.downServices}</p>
                <p>other {overview.otherServices}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('serviceHealthTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overview.services.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noServicesRecorded')}</p>
              ) : (
                overview.services.map((service) => (
                  <div key={service.serviceName} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{serviceStatusIcon(service.status)}</span>
                      <span className="text-sm">{service.serviceName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{service.status}</span>
                      <span>
                        {service.updatedAt
                          ? new Date(service.updatedAt).toLocaleString(locale)
                          : t('emptyDash')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {overview && tab !== 'overview' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{tabLabels[tab] ?? tab}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('notRecordedInCatalog')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
