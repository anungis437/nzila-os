import { z } from 'zod';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { pilotEvents } from '@/db/schema';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';

const payloadSchema = z.object({
  eventType: z.enum(['org_created', 'user_invited', 'role_assigned']),
  targetUserId: z.string().optional(),
  role: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const POST = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;

  const canEmit = await hasMinRole('steward');
  if (!canEmit) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Only steward or above can emit onboarding events');
  }

  const body = await request.json();
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid onboarding event payload', parsed.error.flatten());
  }

  // The event row and its audit record commit together; a failed audit rolls the event back.
  await withRLSContext({ organizationId }, async (tx) => {
    const [event] = await tx
      .insert(pilotEvents)
      .values({
        userId,
        organizationId,
        sessionId: `server:onboarding:${parsed.data.eventType}`,
        eventType: parsed.data.eventType,
        metadata: {
          targetUserId: parsed.data.targetUserId,
          role: parsed.data.role,
          ...(parsed.data.metadata ?? {}),
        },
      })
      .returning({ id: pilotEvents.id });

    await persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: `onboarding.event.${parsed.data.eventType}`,
      resourceType: 'pilot_events',
      resourceId: event?.id,
      details: {
        targetUserId: parsed.data.targetUserId ?? null,
        role: parsed.data.role ?? null,
        metadata: parsed.data.metadata ?? {},
      },
    });
  });

  return standardSuccessResponse({
    ok: true,
    eventType: parsed.data.eventType,
  });
});
