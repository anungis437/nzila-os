import { z } from 'zod';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import { trackPilotEvent } from '@/lib/services/pilot-tracking';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
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

  await trackPilotEvent({
    userId,
    organizationId,
    sessionId: `server:onboarding:${parsed.data.eventType}`,
    eventType: parsed.data.eventType,
    metadata: {
      targetUserId: parsed.data.targetUserId,
      role: parsed.data.role,
      ...(parsed.data.metadata ?? {}),
    },
  });

  await auditLog({
    eventType: AuditEventType.DATA_CREATE,
    severity: AuditSeverity.MEDIUM,
    userId,
    organizationId,
    resource: 'onboarding_events',
    action: parsed.data.eventType,
    details: {
      targetUserId: parsed.data.targetUserId,
      role: parsed.data.role,
      metadata: parsed.data.metadata ?? {},
    },
  });

  return standardSuccessResponse({
    ok: true,
    eventType: parsed.data.eventType,
  });
});
