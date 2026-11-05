/**
 * What the platform settings view reads, in the platform organization's own context.
 *
 * organizations and integration_api_keys are tenant tables: the runtime role reads them inside withRLSContext({ organizationId }), and the
 * system role holds no grant on integration_api_keys. The page used to read "the platform organization" (the first organization of type
 * platform or congress, whoever the viewer is) and its API keys as the system role. The platform view is for the people who belong to
 * the platform organization, so it reads their own organization: when the organization is a platform one, its settings, its keys and the
 * services' health; when it is not, there are no platform settings to show and the answer is null (the caller shows the organization's own
 * settings). platform_services is reference data with no row-level security, readable in any context.
 */
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export interface PlatformSettingsRows {
  settings: Record<string, unknown>;
  featuresEnabled: string[];
  apiKeys: Array<{ id: string; name: string; keyPrefix: string; status: string; scopes: string[]; requestCount: number }>;
  services: Array<{ serviceName: string; status: string }>;
}

type Row = Record<string, unknown>;

export function loadPlatformSettings(organizationId: string): Promise<PlatformSettingsRows | null> {
  return withRLSContext({ organizationId }, async (tx) => {
    const [organization] = Array.from(
      (await tx.execute(sql`
        SELECT settings, features_enabled
        FROM organizations
        WHERE id = ${organizationId}::uuid
          AND organization_type IN ('platform', 'congress')
        LIMIT 1
      `)) as Iterable<Row>,
    );
    if (!organization) return null;

    // A key records whether it is active, revoked or expired and how often it was used; it does not record an environment.
    const keys = Array.from(
      (await tx.execute(sql`
        SELECT k.id, k.name, k.key_prefix,
               CASE
                 WHEN k.revoked_at IS NOT NULL THEN 'revoked'
                 WHEN k.expires_at IS NOT NULL AND k.expires_at < NOW() THEN 'expired'
                 WHEN k.is_active THEN 'active'
                 ELSE 'inactive'
               END AS status,
               k.scopes, k.usage_count::int AS request_count
        FROM integration_api_keys k
        WHERE k.organization_id = ${organizationId}::uuid
        ORDER BY k.created_at DESC
      `)) as Iterable<Row>,
    );

    const services = Array.from(
      (await tx.execute(sql`
        SELECT service_name, status
        FROM platform_services
        ORDER BY service_name
      `)) as Iterable<Row>,
    );

    return {
      settings: (organization.settings ?? {}) as Record<string, unknown>,
      featuresEnabled: Array.isArray(organization.features_enabled) ? (organization.features_enabled as string[]) : [],
      apiKeys: keys.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        keyPrefix: String(r.key_prefix),
        status: String(r.status),
        scopes: Array.isArray(r.scopes) ? (r.scopes as string[]) : [],
        requestCount: Number(r.request_count),
      })),
      services: services.map((r) => ({ serviceName: String(r.service_name), status: String(r.status) })),
    };
  });
}
