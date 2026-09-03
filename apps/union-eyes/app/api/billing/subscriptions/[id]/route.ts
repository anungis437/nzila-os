/**
 * Billing Subscription Item Route
 *
 * GET    /api/billing/subscriptions/:id — Retrieve a specific org subscription
 * PATCH  /api/billing/subscriptions/:id — Update subscription fields
 * DELETE /api/billing/subscriptions/:id — Cancel subscription (soft delete)
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { db } from '@/db';
import { orgSubscriptions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Billing'], summary: 'Get a subscription by ID' },
  },
  async ({ organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const { id } = await params;

    const [subscription] = await db
      .select()
      .from(orgSubscriptions)
      .where(and(eq(orgSubscriptions.id, id), eq(orgSubscriptions.organizationId, organizationId)));

    if (!subscription) throw ApiError.notFound('Subscription not found');

    return { data: subscription };
  },
);

const patchSchema = z.object({
  status: z.enum(['active', 'paused', 'cancelled', 'trialing']).optional(),
  seatCount: z.number().int().min(0).optional(),
  localCount: z.number().int().min(0).optional(),
  moduleList: z.array(z.string()).optional(),
  discountPercent: z.string().optional(),
  subsidyAmount: z.string().optional(),
  endDate: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// PR #752 round 28: commercial-transition (app/api/pilot/apply/[id]/
// commercial-transition/route.ts) stamps these 2 keys into a subscription's
// metadata at creation as immutable historical provenance (see
// buildCommercialTermsSnapshot in lib/pilot/commercialization-wave1.ts) — an
// ordinary steward PATCH here must never be able to erase or forge them by
// replacing the whole metadata object.
const SERVER_OWNED_SUBSCRIPTION_METADATA_KEYS = ['commercialTermsSnapshot', 'commercialTermsFingerprint'] as const;

export const PATCH = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Billing'], summary: 'Update a subscription' },
  },
  async ({ organizationId, userId: _userId, params, request }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const { id } = params;

    const body = patchSchema.parse(await request.json());

    const [existing] = await db
      .select()
      .from(orgSubscriptions)
      .where(and(eq(orgSubscriptions.id, id), eq(orgSubscriptions.organizationId, organizationId)));

    if (!existing) throw ApiError.notFound('Subscription not found');

    const setValues: Record<string, unknown> = { ...body, updatedAt: new Date() };

    if ('metadata' in body) {
      // Strip the client's fragment of the server-owned keys (never trust a
      // client-supplied value for them, whether erased or forged), then
      // restore each one from the row's CURRENT value — never from an
      // earlier read, and never fabricated if the row never had it.
      const existingMetadata = (existing.metadata ?? {}) as Record<string, unknown>;
      const sanitizedMetadata: Record<string, unknown> = { ...(body.metadata ?? {}) };
      for (const key of SERVER_OWNED_SUBSCRIPTION_METADATA_KEYS) {
        delete sanitizedMetadata[key];
      }
      for (const key of SERVER_OWNED_SUBSCRIPTION_METADATA_KEYS) {
        if (key in existingMetadata) {
          sanitizedMetadata[key] = existingMetadata[key];
        }
      }
      setValues.metadata = sanitizedMetadata;
    }

    const [updated] = await db
      .update(orgSubscriptions)
      .set(setValues)
      .where(eq(orgSubscriptions.id, id))
      .returning();

    logger.info('Subscription updated', { subscriptionId: id, organizationId });

    return { data: updated };
  },
);

export const DELETE = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Billing'], summary: 'Cancel a subscription' },
  },
  async ({ organizationId, userId: _userId, params }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const { id } = params;

    const [existing] = await db
      .select()
      .from(orgSubscriptions)
      .where(and(eq(orgSubscriptions.id, id), eq(orgSubscriptions.organizationId, organizationId)));

    if (!existing) throw ApiError.notFound('Subscription not found');

    const [cancelled] = await db
      .update(orgSubscriptions)
      .set({ status: 'cancelled', endDate: new Date(), updatedAt: new Date() })
      .where(eq(orgSubscriptions.id, id))
      .returning();

    logger.info('Subscription cancelled', { subscriptionId: id, organizationId });

    return { data: cancelled };
  },
);
