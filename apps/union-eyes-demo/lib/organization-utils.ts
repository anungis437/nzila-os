/**
 * Demo-local organization-utils shim.
 *
 * Wave 0 §2 remediation: replaces `@/lib/organization-utils` (which would
 * resolve into the operational app and hit the operational database).
 *
 * The demo has ONE synthetic organization — the CUPE 4373 fixture. There
 * is no database lookup; `getOrganizationIdForUser` always returns
 * `DEFAULT_ORGANIZATION_ID`.
 */

/**
 * Fixed synthetic organization ID for the CUPE 4373 demo fixture.
 * Any use of this ID outside `apps/union-eyes-demo` is a boundary
 * violation.
 */
export const DEFAULT_ORGANIZATION_ID = 'cupe4373-demo-org';

export async function getOrganizationIdForUser(_userId: string): Promise<string> {
  return DEFAULT_ORGANIZATION_ID;
}
