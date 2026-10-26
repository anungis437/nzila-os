/**
 * Retired: POST /api/admin/seed-cupe-pilot
 *
 * This route loaded demonstration data into an organization and, with `reset`, deleted that organization's members and
 * grievances on the strength of a platform rank. Its fixture is not part of the repository, and no operational flow
 * depends on it. It performs no operation (UE-CONV-K-011).
 */
import { withApiAuth } from '@/lib/api-auth-guard';
import { retiredHandler } from '@/lib/api/retired-route';

export const POST = withApiAuth(retiredHandler('a governed organization onboarding workflow'));
