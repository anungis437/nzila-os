/**
 * SCIM bearer token administration
 * GET    /api/enterprise/sso/scim-token — token status (never the token)
 * POST   /api/enterprise/sso/scim-token — issue or rotate the token; the token is returned once
 * DELETE /api/enterprise/sso/scim-token — revoke the token and disable provisioning
 *
 * This is an administrator's signed-in action on their own organization. It is deliberately not under /api/scim/v2/, which is the
 * identity provider's token-authenticated surface and is reachable without a session.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { scimConfigurations } from '@/db/schema/sso-scim-schema';
import {
  SCIM_DEFAULT_TOKEN_DAYS,
  SCIM_MAX_TOKEN_DAYS,
  generateScimToken,
  hashScimToken,
} from '@/lib/scim/scim-token';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const issueSchema = z.object({
  expiresInDays: z.number().int().min(1).max(SCIM_MAX_TOKEN_DAYS).optional(),
});

const DEFAULT_USER_ATTRIBUTE_MAPPING = { userName: 'userName', email: 'emails[primary].value', name: 'name' };

function status(config: typeof scimConfigurations.$inferSelect | undefined) {
  return {
    configured: Boolean(config?.tokenHash),
    enabled: Boolean(config?.enabled),
    tokenCreatedAt: config?.tokenCreatedAt ?? null,
    tokenExpiresAt: config?.tokenExpiresAt ?? null,
    tokenLastUsedAt: config?.tokenLastUsedAt ?? null,
    revokedAt: config?.revokedAt ?? null,
  };
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Auth'], summary: 'SCIM token status', description: 'Reports whether a SCIM token is issued, when it expires and was last used.' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    return withRLSContext({ organizationId }, async (tx) => {
      const [config] = await tx.select().from(scimConfigurations).where(eq(scimConfigurations.organizationId, organizationId)).limit(1);
      return status(config);
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Auth'], summary: 'Issue or rotate SCIM token', description: 'Issues a new SCIM bearer token, replacing any earlier one. The token is returned once.' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const parsed = issueSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw ApiError.badRequest('expiresInDays must be a whole number of days between 1 and 365');
    const days = parsed.data.expiresInDays ?? SCIM_DEFAULT_TOKEN_DAYS;

    const token = generateScimToken();
    const tokenHash = hashScimToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 86_400_000);

    const rotated = await withRLSContext({ organizationId }, async (tx) => {
      const [existing] = await tx.select({ id: scimConfigurations.id }).from(scimConfigurations).where(eq(scimConfigurations.organizationId, organizationId)).limit(1);
      const fields = { tokenHash, tokenCreatedAt: now, tokenExpiresAt: expiresAt, tokenLastUsedAt: null, revokedAt: null, enabled: true, updatedAt: now };
      let configurationId: string;
      if (existing) {
        await tx.update(scimConfigurations).set(fields).where(and(eq(scimConfigurations.id, existing.id), eq(scimConfigurations.organizationId, organizationId)));
        configurationId = existing.id;
      } else {
        const [created] = await tx
          .insert(scimConfigurations)
          .values({
            organizationId,
            baseUrl: `/api/scim/v2/${organizationId}`,
            userAttributeMapping: DEFAULT_USER_ATTRIBUTE_MAPPING,
            createdBy: userId,
            ...fields,
          })
          .returning({ id: scimConfigurations.id });
        configurationId = created!.id;
      }
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: existing ? 'scim.token.rotate' : 'scim.token.issue',
        resourceType: 'scim_configurations',
        resourceId: configurationId,
        details: { expiresAt: expiresAt.toISOString() },
      });
      return Boolean(existing);
    });

    return { token, rotated, expiresAt, baseUrl: `/api/scim/v2/${organizationId}` };
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Auth'], summary: 'Revoke SCIM token', description: 'Revokes the SCIM token and disables provisioning.' },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    return withRLSContext({ organizationId }, async (tx) => {
      const [config] = await tx
        .update(scimConfigurations)
        .set({ revokedAt: new Date(), enabled: false, updatedAt: new Date() })
        .where(eq(scimConfigurations.organizationId, organizationId))
        .returning({ id: scimConfigurations.id });
      if (!config) throw ApiError.notFound('SCIM configuration');
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'scim.token.revoke',
        resourceType: 'scim_configurations',
        resourceId: config.id,
        details: {},
      });
      return { revoked: true };
    });
  },
);
