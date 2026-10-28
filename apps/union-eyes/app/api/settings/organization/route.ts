/**
 * GET  /api/settings/organization – load org settings for the current user's org
 * PUT  /api/settings/organization – persist updated settings
 */
import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { organizationMembers } from '@/db/schema';
import { eq, sql, count } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { validateOrganizationSettingsPatch } from '@/lib/settings/organization-settings-policy';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

/* ── GET ──────────────────────────────────────────────────────────────────── */
export const GET = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async (ctx) => {
    const orgId = ctx.organizationId;
    if (!orgId) {
      return { organization: null };
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(sql`${organizations.id}::text`, orgId));

    if (!org) {
      return { organization: null };
    }

    // Live member count
    const [memberRow] = await db
      .select({ total: count() })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));

    const settings = (org.settings ?? {}) as Record<string, unknown>;

    return {
      organization: {
        id: org.id,
        name: org.name,
        shortName: org.shortName ?? '',
        provinceTerritory: org.provinceTerritory ?? '',
        organizationType: org.organizationType,
        status: org.status,
        memberCount: memberRow?.total ?? org.memberCount ?? 0,
        subscriptionTier: org.subscriptionTier ?? 'Free',
        featuresEnabled: org.featuresEnabled ?? [],
        fiscalYearEnd: org.fiscalYearEnd,
        settings,
      },
    };
  },
);

/* ── PUT ──────────────────────────────────────────────────────────────────── */
export const PUT = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async (ctx) => {
    const orgId = ctx.organizationId;
    if (!orgId) {
      throw new Error('No organization context');
    }

    const body = ctx.body as Record<string, unknown> | null;
    if (!body) {
      throw new Error('Request body is required');
    }

    // Build the update payload — only touch fields that were provided
    const updates: Record<string, unknown> = {};

    if (typeof body.name === 'string') updates.name = body.name;
    if (typeof body.shortName === 'string') updates.shortName = body.shortName;
    if (typeof body.provinceTerritory === 'string') updates.provinceTerritory = body.provinceTerritory;

    // Merge settings jsonb — we MERGE not replace to avoid clobbering keys, but only keys an administrator may set.
    let previousSettings: Record<string, unknown> = {};
    let writtenSettings: Record<string, unknown> = {};
    if (body.settings !== undefined && body.settings !== null) {
      const checked = validateOrganizationSettingsPatch(body.settings);
      if (!checked.ok) {
        // Key names only: a rejected value is never echoed back or logged.
        const detail = [
          checked.rejectedKeys.length ? `not writable: ${checked.rejectedKeys.join(', ')}` : '',
          checked.invalidKeys.length ? `invalid value: ${checked.invalidKeys.join(', ')}` : '',
        ].filter(Boolean).join('; ');
        throw ApiError.badRequest(`Settings were not saved (${detail})`);
      }
      const [currentOrg] = await db
        .select({ settings: organizations.settings })
        .from(organizations)
        .where(eq(sql`${organizations.id}::text`, orgId));

      const currentSettings = (currentOrg?.settings ?? {}) as Record<string, unknown>;
      writtenSettings = checked.settings;
      previousSettings = Object.fromEntries(Object.keys(writtenSettings).map((key) => [key, currentSettings[key] ?? null]));
      updates.settings = { ...currentSettings, ...writtenSettings };
    }

    if (Object.keys(updates).length === 0) {
      return { updated: false, message: 'No fields to update' };
    }

    updates.updatedAt = new Date();

    await withRLSContext(async (tx) => {
      await tx
        .update(organizations)
        .set(updates)
        .where(eq(sql`${organizations.id}::text`, orgId));
      await persistAtomicAudit(tx, {
        organizationId: orgId,
        userId: ctx.userId!,
        action: 'organization.settings_update',
        resourceType: 'organizations',
        resourceId: orgId,
        details: {
          fields: Object.keys(updates).filter((k) => k !== 'updatedAt'),
          // Every writable setting is a non-secret preference, so the change is recorded with its before and after.
          settingsBefore: previousSettings,
          settingsAfter: writtenSettings,
        },
      });
    });

    return { updated: true };
  },
);
