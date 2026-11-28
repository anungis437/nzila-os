/**
 * GET  /api/procedural-rules/holiday-calendars — every version of the organization's holiday calendars
 * POST /api/procedural-rules/holiday-calendars — create the next version of a holiday calendar as a DRAFT, with its source
 *      and the span it covers (a count reaching outside the span is refused, never guessed)
 *
 * Requires: steward+ to read, officer+ to draft. Only adopted versions are used for calculation.
 */
import { withApi } from '@/lib/api/framework';
import { HolidayCalendarDraftInputSchema } from '@/lib/procedural-rules/definition-schema';
import { createHolidayCalendarDraft, listHolidayCalendars } from '@/lib/procedural-rules/store';
import { PROCEDURAL_ENTITLEMENT, PROCEDURAL_RULES_DRAFT_MIN_ROLE, PROCEDURAL_RULES_READ_MIN_ROLE } from '@/lib/procedural-rules/route-support';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: PROCEDURAL_RULES_READ_MIN_ROLE },
    entitlement: PROCEDURAL_ENTITLEMENT,
    openapi: { tags: ['Procedural Rules'], summary: 'List holiday calendar versions' },
  },
  async ({ organizationId }) => ({ data: await listHolidayCalendars(organizationId!) }),
);

export const POST = withApi(
  {
    auth: { required: true, minRole: PROCEDURAL_RULES_DRAFT_MIN_ROLE },
    entitlement: PROCEDURAL_ENTITLEMENT,
    body: HolidayCalendarDraftInputSchema,
    openapi: { tags: ['Procedural Rules'], summary: 'Draft the next version of a holiday calendar' },
  },
  async ({ organizationId, userId, body }) => ({ data: await createHolidayCalendarDraft(organizationId!, userId!, body) }),
);
