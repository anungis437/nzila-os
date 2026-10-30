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
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
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

// The commercial terms of a subscription (status, seats, locals, modules, discount, subsidy, end date) are set by the
// commercial transition and the pause/resume operation, never by the customer: a steward who could edit them could
// grant their own organization a discount or modules. Only the free-form metadata is the customer's, and unknown
// fields are refused rather than ignored so a refused change is not mistaken for an applied one.
const patchSchema = z.object({ metadata: z.record(z.string(), z.unknown()).optional() }).strict();

// PR #752 round 28: commercial-transition (app/api/pilot/apply/[id]/
// commercial-transition/route.ts) stamps these 2 keys into a subscription's
// metadata at creation as immutable historical provenance (see
// buildCommercialTermsSnapshot in lib/pilot/commercialization-wave1.ts) — an
// ordinary steward PATCH here must never be able to erase or forge them by
// replacing the whole metadata object.
const SERVER_OWNED_SUBSCRIPTION_METADATA_KEYS = ['commercialTermsSnapshot', 'commercialTermsFingerprint'] as const;

export const PATCH = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Billing'], summary: 'Update a subscription' },
  },
  async ({ organizationId, userId, params, request }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const { id } = params;

    const parsedBody = patchSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      throw ApiError.badRequest('Only metadata can be changed here; commercial terms are set by the commercial transition');
    }
    const body = parsedBody.data;

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

    const updated = await withRLSContext({ organizationId }, async (tx) => {
      const [row] = await tx
        .update(orgSubscriptions)
        .set(setValues)
        .where(and(eq(orgSubscriptions.id, id), eq(orgSubscriptions.organizationId, organizationId)))
        .returning();
      if (!row) throw ApiError.notFound('Subscription not found');
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'billing.subscription.metadata_update',
        resourceType: 'org_subscriptions',
        resourceId: id,
        details: { fields: Object.keys(body) },
      });
      return row;
    });

    logger.info('Subscription updated', { subscriptionId: id, organizationId });

    return { data: updated };
  },
);

export const DELETE = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Billing'], summary: 'Cancel a subscription' },
  },
  async ({ organizationId, userId, params }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const { id } = params;

    const [existing] = await db
      .select()
      .from(orgSubscriptions)
      .where(and(eq(orgSubscriptions.id, id), eq(orgSubscriptions.organizationId, organizationId)));

    if (!existing) throw ApiError.notFound('Subscription not found');

    if (existing.status === 'cancelled') throw ApiError.conflict('Subscription is already cancelled');

    const cancelled = await withRLSContext({ organizationId }, async (tx) => {
      const [row] = await tx
        .update(orgSubscriptions)
        .set({ status: 'cancelled', endDate: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(orgSubscriptions.id, id),
            eq(orgSubscriptions.organizationId, organizationId),
            eq(orgSubscriptions.status, existing.status),
          ),
        )
        .returning();
      if (!row) throw ApiError.conflict('The subscription changed while it was being cancelled');
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'billing.subscription.cancel',
        resourceType: 'org_subscriptions',
        resourceId: id,
        details: { from: existing.status },
      });
      return row;
    });

    logger.info('Subscription cancelled', { subscriptionId: id, organizationId });

    return { data: cancelled };
  },
);
