/**
 * Builds the single authoritative `/api/members` request URL. Deliberately
 * does not query any other endpoint or guess across candidate organization
 * IDs — the server resolves the caller's own organization from the
 * authenticated session when `organizationId` is omitted.
 */
export function buildMembersFetchUrl(organizationId: string | 'auto'): string {
  return organizationId === 'auto'
    ? '/api/members'
    : `/api/members?organizationId=${encodeURIComponent(organizationId)}`;
}
