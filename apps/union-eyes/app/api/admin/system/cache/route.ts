/**
 * POST /api/admin/system/cache
 *
 * Retired: the application has no cache this route could clear, and it used to answer "Application cache cleared"
 * regardless. It now says what is true and performs no operation.
 */
import { withApiAuth } from '@/lib/api-auth-guard';
import { retiredHandler } from '@/lib/api/retired-route';

export const dynamic = 'force-dynamic';

export const POST = withApiAuth(retiredHandler('the cache controls of the deployment platform'));
