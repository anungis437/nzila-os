/**
 * What every SCIM route shares: who is calling, and where a resource lives.
 *
 * The caller is an identity provider, not a signed-in person: it authenticates with the organization's SCIM bearer token (lib/scim/scim-token.ts).
 * The token, not the organization named in the path, decides which organization is acted on; a path that names any other organization is a 404.
 * Each route declares `scimCaller` as its machine credential (withApi auth.machine), so the framework runs it before the handler and reads no
 * session: the tenant connection, which needs a session user, cannot serve this surface.
 */
import type { NextRequest } from 'next/server';
import { ApiError } from '@/lib/api/framework';
import { checkRateLimit } from '@/lib/rate-limiter';
import { clientAddress } from '@/lib/public-intake/guard';
import { authenticateScimRequest } from '@/lib/scim/scim-token';

// The token is the only credential on this surface, so guessing is bounded per client address before the token is looked up. A shared
// limiter that is unavailable refuses the request rather than leaving the endpoint unbounded.
async function authenticateScim(request: Request, pathOrganizationId: string | undefined) {
  const limited = await checkRateLimit(`scim:${clientAddress(request)}`, { limit: 600, window: 60, identifier: 'scim', failOpen: false }).catch(() => null);
  if (!limited) throw ApiError.externalService('rate-limiter', 'Provisioning is temporarily unavailable');
  if (!limited.allowed) throw ApiError.rateLimited(limited.resetIn ?? 60);
  const auth = await authenticateScimRequest(request);
  if (!auth.ok) {
    throw auth.status === 403 ? ApiError.forbidden('SCIM provisioning is not enabled for this organization') : ApiError.unauthorized('Invalid SCIM token');
  }
  if (pathOrganizationId !== auth.organizationId) throw ApiError.notFound('Organization');
  return auth;
}

/** The verifier of every SCIM operation: the token, not the organization named in the path, decides who is calling. */
export const scimCaller = (request: NextRequest, params: Record<string, string>) => authenticateScim(request, params.organizationId);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** The absolute URL of a provisioned user, when the application's public address is configured. */
export function scimLocation(organizationId: string, memberId: string): string | undefined {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  return base ? `${base}/api/scim/v2/${organizationId}/Users/${memberId}` : undefined;
}
