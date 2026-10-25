/**
 * GET PUT /api/precedents/jurisdiction-preferences
 *
 * User-level jurisdiction preferences for precedent filtering.
 * Backed by member_jurisdiction_preferences table.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { memberJurisdictionPreferences } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

const VALID_JURISDICTIONS = [
  'federal', 'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
];

const VALID_LEVELS = ['federal', 'provincial', 'municipal'];

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Precedents'],
      summary: 'Get jurisdiction preferences',
      description: 'Returns the current user\'s jurisdiction preferences for precedent filtering.',
    },
  },
  async ({ userId, organizationId }) => {
    const [prefs] = await db
      .select()
      .from(memberJurisdictionPreferences)
      .where(
        and(
          eq(memberJurisdictionPreferences.userId, userId!),
          eq(memberJurisdictionPreferences.organizationId, organizationId!),
        ),
      )
      .limit(1);

    if (!prefs) {
      return {
        preferredJurisdictions: [],
        preferredLevels: [],
        includeNational: true,
        autoApply: true,
        isConfigured: false,
      };
    }

    return { ...prefs, isConfigured: true };
  },
);

export const PUT = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Precedents'],
      summary: 'Update jurisdiction preferences',
      description: 'Creates or updates jurisdiction preferences for the current user.',
    },
  },
  async ({ body, userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.badRequest('Organization context required');
    const {
      preferredJurisdictions,
      preferredLevels,
      includeNational,
      autoApply,
    } = (body ?? {}) as {
      preferredJurisdictions?: string[];
      preferredLevels?: string[];
      includeNational?: boolean;
      autoApply?: boolean;
    };

    // Validate jurisdictions
    if (preferredJurisdictions) {
      if (!Array.isArray(preferredJurisdictions)) {
        throw ApiError.badRequest('preferredJurisdictions must be an array');
      }
      for (const j of preferredJurisdictions) {
        if (!VALID_JURISDICTIONS.includes(j)) {
          throw ApiError.badRequest(`Invalid jurisdiction: ${j}`);
        }
      }
    }

    // Validate levels
    if (preferredLevels) {
      if (!Array.isArray(preferredLevels)) {
        throw ApiError.badRequest('preferredLevels must be an array');
      }
      for (const l of preferredLevels) {
        if (!VALID_LEVELS.includes(l)) {
          throw ApiError.badRequest(`Invalid level: ${l}`);
        }
      }
    }

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (preferredJurisdictions !== undefined) data.preferredJurisdictions = preferredJurisdictions;
    if (preferredLevels !== undefined) data.preferredLevels = preferredLevels;
    if (includeNational !== undefined) data.includeNational = includeNational;
    if (autoApply !== undefined) data.autoApply = autoApply;

    return withRLSContext({ organizationId: organizationId! }, async (tx) => {
      const [current] = await tx
        .select()
        .from(memberJurisdictionPreferences)
        .where(
          and(
            eq(memberJurisdictionPreferences.userId, userId!),
            eq(memberJurisdictionPreferences.organizationId, organizationId!),
          ),
        )
        .limit(1);

      if (current) {
        const [updated] = await tx
          .update(memberJurisdictionPreferences)
          .set(data)
          .where(
            and(
              eq(memberJurisdictionPreferences.id, current.id),
              eq(memberJurisdictionPreferences.userId, userId!),
              eq(memberJurisdictionPreferences.organizationId, organizationId!),
            ),
          )
          .returning();
        await persistAtomicAudit(tx, {
          organizationId: organizationId!,
          userId: userId!,
          action: 'precedent.jurisdiction_preferences.update',
          resourceType: 'member_jurisdiction_preferences',
          resourceId: current.id,
          details: { fields: Object.keys(data).filter((k) => k !== 'updatedAt') },
        });
        return { ...updated, isConfigured: true };
      }

      const [created] = await tx
        .insert(memberJurisdictionPreferences)
        .values({
          userId: userId!,
          organizationId: organizationId!,
          preferredJurisdictions: preferredJurisdictions ?? [],
          preferredLevels: preferredLevels ?? [],
          includeNational: includeNational ?? true,
          autoApply: autoApply ?? true,
        })
        .returning();
      await persistAtomicAudit(tx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'precedent.jurisdiction_preferences.create',
        resourceType: 'member_jurisdiction_preferences',
        resourceId: created.id,
        details: {},
      });
      return { ...created, isConfigured: true };
    });
  },
);
