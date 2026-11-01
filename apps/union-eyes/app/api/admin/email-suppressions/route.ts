/**
 * POST /api/admin/email-suppressions — lift the platform-wide delivery suppression of one address.
 *
 * A suppression is created by a provider complaint or provider suppression (see lib/communications/address-suppression.ts) and is lifted
 * only here, by a platform administrator, with a stated reason. The row is kept (lifted_at, lifted_by, lift_reason), the change and its
 * audit record commit together, and the audit record carries a fragment of the address hash, never the address. A new complaint on a
 * later message suppresses the address again.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withSystemAdminAuth, type BaseAuthContext } from '@/lib/api-auth-guard';
import { performAtomicAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';
import { addressSha256, liftAddressSuppression } from '@/lib/communications/address-suppression';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const liftSchema = z.object({
  address: z.string().trim().min(3).max(254).email(),
  reason: z.string().trim().min(10).max(500),
});

export const POST = withSystemAdminAuth(async (request, context: BaseAuthContext) => {
  const parsed = liftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'An address and a reason of at least 10 characters are required');
  }
  const { address, reason } = parsed.data;
  const { userId, organizationId } = context;
  const fragment = addressSha256(address).slice(0, 12);

  class NothingToLift extends Error {}
  try {
    await performAtomicAuditedOperation(
      {
        organizationId,
        userId,
        scope: 'system',
        action: 'communications.address_suppression.lift',
        resourceType: 'email_address_suppressions',
        details: { addressSha256Prefix: fragment, reasonLength: reason.length },
      },
      async (tx) => {
        const lifted = await liftAddressSuppression(tx as never, { address, liftedBy: userId as string, reason });
        if (!lifted) throw new NothingToLift();
      },
    );
  } catch (error) {
    if (error instanceof NothingToLift) {
      return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'No active suppression for that address');
    }
    const refused = operationAuditResponse(error);
    if (refused) return NextResponse.json(refused.body, { status: refused.status });
    throw error;
  }
  return NextResponse.json({ lifted: true });
});