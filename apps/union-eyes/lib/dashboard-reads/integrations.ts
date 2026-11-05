/**
 * What the integrations dashboard and the integration settings page read, in the organization's own context.
 *
 * integration_api_keys, integration_webhooks, integration_partners and integration_configs are tenant tables the runtime role reads inside
 * withRLSContext({ organizationId }); the system role holds no grant on any of them, and the pages read them as the system role and
 * swallowed the failure into an empty list. A failed read now rejects, and the caller shows the error state.
 */
import { sql } from 'drizzle-orm';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';

export interface ApiKey {
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

export interface WebhookEntry {
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

export interface PartnerIntegration {
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

export interface IntegrationConfig {
  id: string;
  type: string;
  provider: string;
  status: string;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DomainStats {
  domain: string;
  tableCount: number;
  totalRows: number;
}

type Row = Record<string, unknown>;

async function readApiKeys(tx: RLSTx, organizationId: string): Promise<ApiKey[]> {
  const result = await tx.execute(sql`
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
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY
      CASE
        WHEN revoked_at IS NOT NULL THEN 2
        WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 1
        ELSE 0
      END,
      created_at DESC
  `);

  return Array.from(result as Iterable<Row>).map((r) => ({
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

async function readWebhooks(tx: RLSTx, organizationId: string): Promise<WebhookEntry[]> {
  const result = await tx.execute(sql`
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
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY
      CASE WHEN failure_count > 0 AND is_active THEN 0 WHEN is_active THEN 1 ELSE 2 END,
      created_at DESC
  `);

  return Array.from(result as Iterable<Row>).map((r) => ({
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

async function readPartners(tx: RLSTx, organizationId: string): Promise<PartnerIntegration[]> {
  const result = await tx.execute(sql`
    SELECT id, name, provider, category, status, description, icon, last_sync_at, created_at
    FROM integration_partners
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY
      CASE status WHEN 'error' THEN 0 WHEN 'pending' THEN 1 WHEN 'connected' THEN 2 ELSE 3 END,
      name
  `);

  return Array.from(result as Iterable<Row>).map((r) => ({
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

async function readIntegrationConfigs(tx: RLSTx, organizationId: string): Promise<IntegrationConfig[]> {
  // An integration records its provider, its settings and whether it is enabled; the page's "metadata" is its settings, and its status is derived from `enabled`.
  const result = await tx.execute(sql`
    SELECT id, type, provider,
           CASE WHEN enabled THEN 'active' ELSE 'inactive' END AS status,
           settings AS metadata,
           created_at, updated_at
    FROM integration_configs
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY type, provider
  `);

  return Array.from(result as Iterable<Row>).map((r) => ({
    id: r.id as string,
    type: r.type as string,
    provider: r.provider as string,
    status: r.status as string,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdBy: null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));
}

/**
 * How many tables of each external-data domain the deployment has. Read from pg_tables, which lists every table whatever the role may do
 * with it (information_schema.tables lists only the tables the role holds a privilege on, so it would count fewer for the runtime role).
 */
async function readDomainTableStats(tx: RLSTx): Promise<DomainStats[]> {
  // starts_with, not LIKE: in a LIKE pattern the underscore of "external_" is a wildcard.
  const result = await tx.execute(sql`
    SELECT
      CASE
        WHEN starts_with(tablename, 'external_pension') THEN 'pension'
        WHEN starts_with(tablename, 'external_calendar') THEN 'calendar'
        WHEN starts_with(tablename, 'external_hris') THEN 'hris'
        WHEN starts_with(tablename, 'external_insurance') THEN 'insurance'
        WHEN starts_with(tablename, 'external_accounting') THEN 'accounting'
        WHEN starts_with(tablename, 'external_communication') THEN 'communication'
        WHEN starts_with(tablename, 'external_crm') THEN 'crm'
        WHEN starts_with(tablename, 'external_commerce') THEN 'commerce'
        WHEN starts_with(tablename, 'external_lrb') OR starts_with(tablename, 'external_labour') THEN 'labour'
        WHEN starts_with(tablename, 'external_health') THEN 'health'
        WHEN starts_with(tablename, 'external_clc') OR starts_with(tablename, 'external_collective') THEN 'collective'
        ELSE 'other'
      END AS domain,
      count(*)::int AS table_count
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND starts_with(tablename, 'external_')
    GROUP BY 1
    ORDER BY 1
  `);

  return Array.from(result as Iterable<Row>).map((r) => ({
    domain: r.domain as string,
    tableCount: r.table_count as number,
    totalRows: 0,
  }));
}

/** The organization's API keys, webhooks and partner integrations, in one transaction. Rejects when any cannot be read. */
export function loadIntegrationsDashboard(
  organizationId: string,
): Promise<{ apiKeys: ApiKey[]; webhooks: WebhookEntry[]; partners: PartnerIntegration[] }> {
  return withRLSContext({ organizationId }, async (tx) => ({
    apiKeys: await readApiKeys(tx, organizationId),
    webhooks: await readWebhooks(tx, organizationId),
    partners: await readPartners(tx, organizationId),
  }));
}

/** The organization's integration configurations and the deployment's external-data table counts. Rejects when either cannot be read. */
export function loadIntegrationSettings(organizationId: string): Promise<{ configs: IntegrationConfig[]; domainStats: DomainStats[] }> {
  return withRLSContext({ organizationId }, async (tx) => ({
    configs: await readIntegrationConfigs(tx, organizationId),
    domainStats: await readDomainTableStats(tx),
  }));
}
