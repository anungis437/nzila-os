/**
 * GET /api/tenant/current — retired compatibility alias.
 *
 * The old endpoint fabricated null organization metadata and an empty feature set. The canonical
 * /api/org/current endpoint is the only supported organization view. Authenticate and establish
 * the active organization before returning 410; do not disclose session/tenant state anonymously.
 */
import { withApi } from '@/lib/api/framework';
import { goneResponse } from '@/lib/api/deprecation';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'member' }, requireOrg: true },
  async () => goneResponse('/api/tenant/current', 'Use /api/org/current for current organization metadata and features.'),
);
