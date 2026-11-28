/**
 * POST /api/procedural-rules/holiday-calendars/{id}/lifecycle — move a holiday calendar version along draft -> reviewed -> adopted
 * (-> superseded | retired). Body: { target, reason }.
 *
 * Role floor by target: officer+ to review (or return to draft), admin+ to adopt, supersede or retire. Independently of role:
 * the reviewer and the adopter must not be the drafter, only a human may move a version past draft, and an illegal move is
 * refused (409). Every step is an append-only lifecycle event and an audit record.
 */
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { hasMinRole } from '@/lib/api-auth-guard';
import { LifecycleTransitionInputSchema } from '@/lib/procedural-rules/definition-schema';
import { transitionHolidayCalendar } from '@/lib/procedural-rules/store';
import { lifecycleMinRole, PROCEDURAL_ENTITLEMENT, PROCEDURAL_RULES_DRAFT_MIN_ROLE } from '@/lib/procedural-rules/route-support';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: PROCEDURAL_RULES_DRAFT_MIN_ROLE },
    entitlement: PROCEDURAL_ENTITLEMENT,
    body: LifecycleTransitionInputSchema,
    openapi: { tags: ['Procedural Rules'], summary: 'Review, adopt, supersede or retire a holiday calendar version' },
  },
  async ({ organizationId, userId, params, body }) => {
    if (!zUUID.safeParse(params.id).success) throw ApiError.notFound('Holiday calendar');
    const floor = lifecycleMinRole(body.target);
    if (!(await hasMinRole(floor))) throw ApiError.forbidden(`Moving a holiday calendar to ${body.target} requires at least ${floor}`);
    return { data: await transitionHolidayCalendar(organizationId!, { userId: userId!, kind: 'human' }, params.id, body.target, body.reason) };
  },
);
