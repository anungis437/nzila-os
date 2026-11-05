import { z } from 'zod';
import { NextResponse } from 'next/server';
import { hasMinRole } from '@/lib/api-auth-guard';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import {
  confirmDeadline,
  overrideDeadline,
  supersedeDeadline,
} from '@/lib/services/deadline-confirmation-service';
import { isCalendarDay } from '@/lib/deadline-engine/deadline-day';

/** A calendar day ("2026-03-04") that exists: it falls due at 23:59 that day in the organization's zone. */
const calendarDay = z.string().refine(isCalendarDay, 'must be an existing calendar day (YYYY-MM-DD)');

const confirmationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('confirm'),
  }),
  z.object({
    action: z.literal('override'),
    // A datetime is an instant and is kept as sent; a bare day is due at the end of that day in the organization's zone.
    overrideDueDate: z.union([z.string().datetime(), calendarDay]),
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
        overrideDueDate: isCalendarDay(parsed.data.overrideDueDate)
          ? parsed.data.overrideDueDate
          : new Date(parsed.data.overrideDueDate),
        overrideReason: parsed.data.overrideReason,
      })
      : await supersedeDeadline(base);

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ data: updated });
});
