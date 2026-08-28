// Delegates to /api/onboarding — auth (withOrgScope, authorize(), withApi) is enforced by the delegated route.
// Kept as a pure re-export per contract test in ../__tests__/continuity-inheritance.route.test.ts.
export { GET, POST, dynamic } from '../../onboarding/route';

