// Delegates to /api/onboarding — auth (withOrgScope, authorize(), withApi) is enforced by the delegated route.
// `dynamic` must be declared locally: Next.js/Turbopack forbids re-exporting route-segment config.
export { GET, POST } from '../../onboarding/route';
export const dynamic = 'force-dynamic';

