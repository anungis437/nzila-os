/**
 * Platform service health for the operations dashboard.
 *
 * public.platform_services is GLOBAL_REFERENCE_DATA. The packaged catalog contract grants it
 * to union_eyes_runtime (SELECT) and not to union_eyes_system, so this read runs on the
 * runtime identity. It does not use withSystemContext, which executes as union_eyes_system
 * and is denied. Nothing here widens a grant or opens a privileged connection.
 *
 * Canonical V2 decides otherwise: the compiled current-security decisions
 * (lib/operations/catalog-v2-decisions.json, written by tooling/scripts/write-union-eyes-current-catalog.ts)
 * classify platform_services CONTAINED_NO_AUTHORITY - a historical object with no current source
 * authority, rows preserved, no runtime or system grant. In canonical mode the read is therefore not
 * attempted: it throws PlatformServicesUnavailableError, which the operations page shows as a failed
 * read, never as an empty or healthy service list.
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

/** platform_services has no current source authority in a canonical deployment (CONTAINED_NO_AUTHORITY). */
export class PlatformServicesUnavailableError extends Error {
  readonly code = 'PLATFORM_SERVICES_UNAVAILABLE'
  constructor() {
    super('Platform service health is unavailable: the canonical deployment holds no authority to read platform_services');
    this.name = 'PlatformServicesUnavailableError';
  }
}

/** Throws on any database failure. A failed read must never look like an empty service list. */
export async function loadPlatformServices(): Promise<ServiceOverview> {
  if (currentStateContextEnabled()) throw new PlatformServicesUnavailableError();
  // One statement on one transaction of the application connection (the runtime identity). The statement is written here, where the table it
  // reads can be seen, rather than held in a constant.
  const result = await db.transaction(async (tx) => {
    return tx.execute(sql`
      SELECT service_name, status, updated_at
      FROM platform_services
      ORDER BY
        CASE status WHEN 'down' THEN 0 WHEN 'degraded' THEN 1 ELSE 2 END,
        service_name
    `);
  });
  return summarizePlatformServices(Array.from(result) as Array<Record<string, unknown>>);
}
