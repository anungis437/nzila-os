/**
 * The SCIM event log: one scim_events_log row for each provisioning event this stream causes, written on the same system transaction as the change
 * it records, so an event exists exactly when the change does.
 *
 * It records the protocol facts an identity-provider administrator reads when something goes wrong (what happened to which resource, by which
 * operation, answered with which status, how long it took, from which address) and nothing about the person: no request or response body is ever
 * stored, because they carry names and e-mail addresses, and the query string is dropped from the path because a filter can carry a userName. What
 * changed and why is the audit chain's job (persistAtomicAudit), which records field names and never values.
 */
import { sql } from 'drizzle-orm';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { clientAddress } from '@/lib/public-intake/guard';
import type { ScimConfigurationRef } from '@/lib/scim/provisioned-members';

export type ScimEventType = 'user.created' | 'user.updated' | 'user.deleted';
export type ScimEventOperation = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** What one request knows about itself: where it came in, from whom, and when it started. */
export interface ScimTrace {
  path: string;
  ipAddress: string | null;
  startedAt: number;
}

export function scimTraceOf(request: Request): ScimTrace {
  let path = '';
  try {
    path = new URL(request.url).pathname;
  } catch {
    path = '';
  }
  return { path: path.slice(0, 500), ipAddress: clientAddress(request) ?? null, startedAt: performance.now() };
}

export interface ScimEventInput {
  eventType: ScimEventType;
  resourceId: string;
  operation: ScimEventOperation;
  statusCode: number;
}

export async function recordScimEvent(tx: RLSTx, ref: ScimConfigurationRef, trace: ScimTrace, event: ScimEventInput): Promise<void> {
  const elapsed = Math.max(0, Math.round(performance.now() - trace.startedAt));
  // created_at is the moment of the event (clock_timestamp), not the start of the transaction (now), so the events of one request, such as an
  // update followed by a deprovision, keep their order in the log instead of tying.
  await tx.execute(sql`
    INSERT INTO public.scim_events_log
      (config_id, organization_id, event_type, resource_type, resource_id, operation, request_path, status, status_code,
       processing_time_ms, ip_address, authenticated_as, created_at)
    VALUES
      (${ref.configurationId}::uuid, ${ref.organizationId}::uuid, ${event.eventType}, 'User', ${event.resourceId}, ${event.operation}, ${trace.path},
       'success', ${event.statusCode}::int, ${elapsed}::int, ${trace.ipAddress ? trace.ipAddress.slice(0, 50) : null}, ${`scim:${ref.configurationId}`},
       clock_timestamp())`);
}
