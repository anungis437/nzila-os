import { z } from 'zod';
import { NextResponse } from 'next/server';
import { hasMinRole } from '@/lib/api-auth-guard';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import {
  confirmDeadline,
  overrideDeadline,
  supersedeDeadline,
} from '@/lib/services/deadline-confirmation-service';

const confirmationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('confirm'),
  }),
  z.object({
    action: z.literal('override'),
    overrideDueDate: z.string().datetime(),
    overrideReason: z.string().min(1).max(1000),
  }),
  z.object({
    action: z.literal('supersede'),
  }),
]);

export const POST = withOrganizationAuth(async (request, context, params?: { id?: string }) => {
  if (!params?.id) {
    return NextResponse.json({ error: 'Missing deadline ID' }, { status: 400 });
  }

  const canConfirm = await hasMinRole('steward');
  if (!canConfirm) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = confirmationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid confirmation payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const base = {
    deadlineId: params.id,
    organizationId: context.organizationId,
    actorId: context.userId,
  };

  const updated = parsed.data.action === 'confirm'
    ? await confirmDeadline(base)
    : parsed.data.action === 'override'
      ? await overrideDeadline({
        ...base,
        overrideDueDate: new Date(parsed.data.overrideDueDate),
        overrideReason: parsed.data.overrideReason,
      })
      : await supersedeDeadline(base);

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ data: updated });
});
