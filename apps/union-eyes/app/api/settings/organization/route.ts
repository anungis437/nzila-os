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
const boundedText = (value: unknown, field: string, max: number, required = false): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw ApiError.badRequest(`${field} must be text`);
  const text = value.trim();
  if (required && text.length === 0) throw ApiError.badRequest(`${field} must not be empty`);
  if (text.length > max) throw ApiError.badRequest(`${field} must be at most ${max} characters`);
  return text;
};

export const PUT = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async (ctx) => {
    const orgId = ctx.organizationId;
    if (!orgId) {
      throw ApiError.badRequest('Organization context required');
    }

    const body = ctx.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw ApiError.badRequest('Request body is required');
    }

    // Build the update payload — only touch fields that were provided, each validated before anything is read or written.
    const updates: Record<string, unknown> = {};
    const name = boundedText(body.name, 'name', 200, true);
    const shortName = boundedText(body.shortName, 'shortName', 50);
    const provinceTerritory = boundedText(body.provinceTerritory, 'provinceTerritory', 100);
    if (name !== undefined) updates.name = name;
    if (shortName !== undefined) updates.shortName = shortName;
    if (provinceTerritory !== undefined) updates.provinceTerritory = provinceTerritory;

    // Settings are merged, not replaced, and only the keys an administrator may set are accepted.
    let checkedSettings: Record<string, unknown> | null = null;
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
      checkedSettings = checked.settings;
    }

    if (Object.keys(updates).length === 0 && checkedSettings === null) {
      return { updated: false, message: 'No fields to update' };
    }

    const now = new Date();
    await withRLSContext(async (tx) => {
      let previousSettings: Record<string, unknown> = {};
      let writtenSettings: Record<string, unknown> = {};
      if (checkedSettings !== null) {
        // The merge reads the current settings and writes the result in one transaction, holding the row, so two administrators
        // saving different keys cannot overwrite each other with a stale copy.
        const [currentOrg] = await tx
          .select({ settings: organizations.settings })
          .from(organizations)
          .where(eq(sql`${organizations.id}::text`, orgId))
          .for('update');
        if (!currentOrg) throw ApiError.notFound('Organization');
        const currentSettings = (currentOrg.settings ?? {}) as Record<string, unknown>;
        writtenSettings = checkedSettings;
        previousSettings = Object.fromEntries(Object.keys(writtenSettings).map((key) => [key, currentSettings[key] ?? null]));
        updates.settings = { ...currentSettings, ...writtenSettings };
      }
      updates.updatedAt = now;

      const updated = await tx
        .update(organizations)
        .set(updates)
        .where(eq(sql`${organizations.id}::text`, orgId))
        .returning({ id: organizations.id });
      if (updated.length === 0) throw ApiError.notFound('Organization');
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