/**
 * Context-aware org id resolver.
 *
 * Contract:
 *  - If the request context already carries a validated app-level org UUID
 *    (from upstream auth/route guards), prefer it (zero extra DB roundtrip).
 *  - Otherwise, defer to the canonical resolver `getOrganizationIdForUser`.
 *  - If neither yields a value, return null. Callers MUST handle null with an
 *    honest no-org redirect or 404 — never silently fall back to a non-app
 *    identifier (e.g. an Entra group GUID).
 *
 * R9 doctrine anchor: docs/nzila-residual-closure/r9-org-resolver-callsite-audit.md
 */

import { getOrganizationIdForUser } from "./organization-utils";

const APP_ORG_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lightweight UUID v4-ish shape check; rejects empty / non-UUID strings. */
export function isAppOrgUuid(value: any): value is string {
  return typeof value === "string" && APP_ORG_UUID_RE.test(value);
}

export async function resolveOrgIdFromContext(
  context: { organizationId?: string | null },
  userId: string,
): Promise<string | null> {
  if (isAppOrgUuid(context.organizationId)) {
    return context.organizationId as string;
  }
  const resolved = await getOrganizationIdForUser(userId);
  return resolved && isAppOrgUuid(resolved) ? resolved : null;
}
