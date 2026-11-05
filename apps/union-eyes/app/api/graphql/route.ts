/**
 * GraphQL API Endpoint — retired
 *
 * The resolvers behind this endpoint read and write claims, members, remittances and insurance connections with no
 * organization scope, no role check and no audit record: any authenticated caller could read or change another
 * organization's records. Nothing in the application calls it, so it now says so (501) and performs no operation
 * instead of exposing that surface. The resource-specific REST routes enforce tenant scope, authority and audit.
 */
import { withApiAuth } from '@/lib/api-auth-guard';
import { retiredHandler } from '@/lib/api/retired-route';

export const dynamic = 'force-dynamic';

const retired = retiredHandler('the resource-specific REST routes (for example /api/claims and /api/members)');

export const GET = withApiAuth(retired);
export const POST = withApiAuth(retired);
