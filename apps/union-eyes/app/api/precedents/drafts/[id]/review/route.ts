/**
 * POST /api/precedents/drafts/[id]/review — review a typed arbitration decision that is pending review.
 *
 * Body: { outcome: 'share' | 'reject' | 'revoke', redactionConfirmed, consentConfirmed, notes? }. 'share' moves the decision into the shared precedent library;
 * 'reject' keeps it private, and 'revoke' withdraws a previously shared decision. The reviewer's authority is checked first and is not designated yet (see
 * lib/services/precedent-review-authority.ts): until the institution decides who may publish to the shared library, every review is refused with
 * 403 and nothing changes (DEF-0B11-PRP-PRECEDENT-POST-PUBLISHES-INTO-THE-SHARED-LIBRARY-WITH-NO-REVIEW-PROVENANCE-OR-OWNING-ORGANIZATION).
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { resolvePrecedentReviewerAuthority } from '@/lib/services/precedent-review-authority';
import { reviewPrecedentAudited } from '@/lib/services/precedent-audited-service';

export const dynamic = 'force-dynamic';

const reviewSchema = z.object({
  outcome: z.enum(['share', 'reject', 'revoke']),
  redactionConfirmed: z.boolean(),
  consentConfirmed: z.boolean(),
  notes: z.string().max(2000).optional(),
}).strict();

// The review opens its own tenant transaction and writes its audit record in it (reviewPrecedentAudited), so the wrapper opens none.
export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    body: reviewSchema,
    openapi: { tags: ['Precedents'], summary: 'Review, share, reject, or revoke a precedent' },
  },
  async ({ body, params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden();
    const id = z.guid().safeParse((params as { id?: string }).id);
    if (!id.success) throw ApiError.badRequest('A precedent id is required');

    const authority = await resolvePrecedentReviewerAuthority({ organizationId, userId });
    if (!authority.allowed) {
      throw ApiError.forbidden('No reviewer authority for the shared precedent library is designated; the draft stays pending review');
    }

    const result = await reviewPrecedentAudited({ organizationId, userId }, { id: id.data, ...body });
    if (!result.ok) {
      switch (result.kind) {
        case 'not_found':
          throw ApiError.notFound('Precedent draft');
        case 'not_pending':
          throw ApiError.conflict(body.outcome === 'revoke' ? 'The precedent is not currently shared' : 'The precedent is not pending review');
        case 'self_review':
          throw ApiError.forbidden('A precedent is reviewed by someone other than the person who typed it');
        case 'attestation_required':
          throw ApiError.badRequest('Sharing requires confirming the redaction and the consent or public status of the decision');
      }
    }
    return { precedent: result.precedent, publicationStatus: result.publicationStatus };
  },
);
