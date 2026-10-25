/**
 * Retired: this route duplicated the pension T4A route and its older, weaker authorization. The canonical route is
 * /api/pension/t4a (own records only; administration needs the named financial role). It performs no operation.
 */
import { withApiAuth } from '@/lib/api-auth-guard';
import { retiredHandler } from '@/lib/api/retired-route';

export const dynamic = 'force-dynamic';

export const GET = withApiAuth(retiredHandler('/api/pension/t4a'));
export const POST = withApiAuth(retiredHandler('/api/pension/t4a'));
