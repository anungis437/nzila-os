import { NextResponse } from 'next/server';

/**
 * The organization a pilot telemetry read is about.
 *
 * Pilot telemetry carries per-user identifiers and activity (logins, case counts, active days), so the organization is
 * never taken from the request. It is the caller's authenticated organization; a request that names a different one is
 * refused with the same answer whether or not that organization exists, and names nothing about it.
 */
export function resolveTelemetryOrganization(
  requestedOrganizationId: string | null,
  sessionOrganizationId: string | undefined,
): { organizationId: string } | { denied: NextResponse } {
  if (!sessionOrganizationId) {
    return { denied: NextResponse.json({ error: 'Organization context required' }, { status: 400 }) };
  }
  if (requestedOrganizationId && requestedOrganizationId !== sessionOrganizationId) {
    return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { organizationId: sessionOrganizationId };
}
