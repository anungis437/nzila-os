import { z } from 'zod';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { pilotEvents } from '@/db/schema';
import { verifyOnboardingMilestone } from '@/lib/pilot/onboarding-event-evidence';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';

const payloadSchema = z.object({
  eventType: z.enum(['org_created', 'user_invited', 'role_assigned']),
  targetUserId: z.string().trim().min(1).max(255).optional(),
  role: z.string().trim().min(1).max(64).optional(),
  metadata: z
    .record(z.string().max(64), z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
    .refine((value) => Object.keys(value).length <= 20, 'metadata has too many keys')
    .optional(),
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

  // The event row and its audit record commit together; a failed audit rolls the event back. A milestone the
  // organization's own data does not show is refused: the event and the audit row state that it happened.
  const refusal = await withRLSContext({ organizationId }, async (tx) => {
    const check = await verifyOnboardingMilestone(
      tx,
      organizationId,
      parsed.data.eventType,
      parsed.data.targetUserId,
      parsed.data.role,
    );
    if (!check.ok) return check.reason;

    const [event] = await tx
      .insert(pilotEvents)
      .values({
        userId,
        organizationId,
        sessionId: `server:onboarding:${parsed.data.eventType}`,
        eventType: parsed.data.eventType,
        // The named target and role come last: caller metadata can add context but never replace what the audit row records.
        metadata: {
          ...(parsed.data.metadata ?? {}),
          targetUserId: parsed.data.targetUserId,
          role: parsed.data.role,
          verifiedAgainst: 'organization_members',
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
        evidence: check.evidence,
      },
    });
    return null;
  });

  if (refusal) {
    return standardErrorResponse(ErrorCode.CONFLICT, `Onboarding event not recorded: ${refusal}.`)
  }

  return standardSuccessResponse({
    ok: true,
    eventType: parsed.data.eventType,
  });
});
