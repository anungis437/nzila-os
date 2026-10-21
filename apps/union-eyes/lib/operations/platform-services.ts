/**
 * Platform service health for the operations dashboard.
 *
 * public.platform_services is GLOBAL_REFERENCE_DATA. The packaged catalog contract grants it
 * to union_eyes_runtime (SELECT) and not to union_eyes_system, so this read runs on the
 * runtime identity. It does not use withSystemContext, which executes as union_eyes_system
 * and is denied. Nothing here widens a grant or opens a privileged connection.
 *
 * Under the canonical V2 context the application connection reaches the runtime role the
 * same way withRLSContext does: SET LOCAL ROLE inside a transaction. That lowers privilege,
 * and the table has no RLS, so no tenant binding is involved.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';

export interface PlatformService {
  serviceName: string;
  status: string;
  updatedAt: string | null;
}

export interface ServiceOverview {
  services: PlatformService[];
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  downServices: number;
  otherServices: number;
}

const RECORDED_STATUSES = new Set(['healthy', 'degraded', 'down']);

const PLATFORM_SERVICES_QUERY = sql`
  SELECT service_name, status, updated_at
  FROM platform_services
  ORDER BY
    CASE status WHEN 'down' THEN 0 WHEN 'degraded' THEN 1 ELSE 2 END,
    service_name
`;

export function summarizePlatformServices(rows: Array<Record<string, unknown>>): ServiceOverview {
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

/** Throws on any database failure. A failed read must never look like an empty service list. */
export async function loadPlatformServices(): Promise<ServiceOverview> {
  const result = currentStateContextEnabled()
    ? await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`);
        return tx.execute(PLATFORM_SERVICES_QUERY);
      })
    : await db.execute(PLATFORM_SERVICES_QUERY);
  return summarizePlatformServices(Array.from(result) as Array<Record<string, unknown>>);
}
