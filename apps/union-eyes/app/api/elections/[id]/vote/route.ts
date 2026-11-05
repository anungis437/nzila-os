/**
 * Cast votes for a council election
 *
 * POST /api/elections/[id]/vote
 *
 * NOT IMPLEMENTED (UE-OFFICER-EXECUTIVE-CANONICAL-2.1 §VI).
 *
 * This route used to add arbitrary per-candidate counts to a globally scoped
 * `council_elections` record: no electorate, no voter authentication, no
 * duplicate-vote protection, no ballot secrecy and no independent tabulation.
 * A counter increment is not a ballot. Until a qualified election engine exists
 * the capability answers 501 rather than silently mutating results. Use the
 * record PATCH for administrative corrections of historical council records.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { GOVERNANCE_SYSTEM_ROLES } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, roles: [...GOVERNANCE_SYSTEM_ROLES] },
    openapi: {
      tags: ['Governance'],
      summary: 'Council election vote casting (not implemented)',
      description: 'No qualified election engine exists; vote counts cannot be incremented through this API.',
    },
  },
  async () => {
    throw ApiError.notImplemented(
      'Vote casting is not available: no qualified election engine (electorate, ballot integrity, independent tabulation) is provisioned.',
    );
  },
);
