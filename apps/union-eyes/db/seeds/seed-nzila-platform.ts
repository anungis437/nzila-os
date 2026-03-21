/**
 * Seed: Nzila Platform Organization
 *
 * Creates the platform-level organization that platform admins use to
 * view cross-org metrics and manage the Union Eyes instance.
 *
 * Uses the DEFAULT_ORGANIZATION_ID constant (458a56cb-...) so that all
 * code referencing that ID resolves to this record.
 *
 * Idempotent: uses ON CONFLICT (slug) DO NOTHING.
 *
 * Usage:
 *   npx tsx apps/union-eyes/db/seeds/seed-nzila-platform.ts
 */

/* eslint-disable no-console */
import { db } from '@/db/db';
import { organizations, organizationMembers } from '@/db/schema-organizations';
import { eq } from 'drizzle-orm';

const NZILA_PLATFORM_ORG_ID = '458a56cb-251a-4c91-a0b5-81bb8ac39087';

const NZILA_PLATFORM_ORG = {
  id: NZILA_PLATFORM_ORG_ID,
  name: 'Nzila Platform',
  slug: 'nzila-platform',
  displayName: 'Nzila',
  shortName: 'Nzila',
  description: 'Platform-level organization for Nzila administrators. Provides cross-org metrics and platform management.',
  organizationType: 'congress' as const,
  parentId: null,
  hierarchyPath: [] as string[],
  hierarchyLevel: 0,
  provinceTerritory: null,
  sectors: [] as [],
  email: null,
  phone: null,
  website: null,
  address: null,
  clcAffiliated: false,
  memberCount: 0,
  activeMemberCount: 0,
  status: 'active',
  featuresEnabled: [
    'platform-admin',
    'cross-org-metrics',
    'org-management',
    'audit-log',
  ],
  settings: {
    isPlatformOrg: true,
  },
};

export interface NzilaPlatformSeedResult {
  organizationId: string | null;
  adminMembershipsCreated: number;
  skipped: string[];
}

/**
 * Idempotent seed: inserts the Nzila Platform org and creates
 * platform admin memberships for users listed in PLATFORM_ADMIN_USER_IDS.
 */
export async function seedNzilaPlatform(): Promise<NzilaPlatformSeedResult> {
  const result: NzilaPlatformSeedResult = {
    organizationId: null,
    adminMembershipsCreated: 0,
    skipped: [],
  };

  // 1. Upsert the Nzila Platform organization
  //    The org may already exist with id=NZILA_PLATFORM_ORG_ID but slug="default" (legacy).
  //    Update name/slug/type if the ID exists; insert if it doesn't.
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, NZILA_PLATFORM_ORG_ID))
    .limit(1);

  if (existing.length > 0) {
    // Update the existing record to reflect Nzila Platform branding
    await db
      .update(organizations)
      .set({
        name: NZILA_PLATFORM_ORG.name,
        slug: NZILA_PLATFORM_ORG.slug,
        displayName: NZILA_PLATFORM_ORG.displayName,
        shortName: NZILA_PLATFORM_ORG.shortName,
        description: NZILA_PLATFORM_ORG.description,
        organizationType: NZILA_PLATFORM_ORG.organizationType,
        featuresEnabled: NZILA_PLATFORM_ORG.featuresEnabled,
        settings: NZILA_PLATFORM_ORG.settings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, NZILA_PLATFORM_ORG_ID));
    result.organizationId = NZILA_PLATFORM_ORG_ID;
    console.log(`✅ Updated existing org ${NZILA_PLATFORM_ORG_ID} → "Nzila Platform"`);
  } else {
    // Insert fresh
    const [row] = await db
      .insert(organizations)
      .values(NZILA_PLATFORM_ORG)
      .onConflictDoNothing({ target: organizations.slug })
      .returning({ id: organizations.id });

    if (row) {
      result.organizationId = row.id;
      console.log(`✅ Created Nzila Platform org: ${row.id}`);
    } else {
      result.organizationId = NZILA_PLATFORM_ORG_ID;
      result.skipped.push('nzila-platform organization (slug conflict)');
      console.log('⏭️  Nzila Platform slug already exists — skipping insert');
    }
  }

  // 2. Create admin memberships for platform admins
  const adminIds = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  for (const userId of adminIds) {
    try {
      await db
        .insert(organizationMembers)
        .values({
          organizationId: NZILA_PLATFORM_ORG_ID,
          userId,
          name: `Platform Admin (${userId.slice(0, 12)})`,
          email: `admin+${userId.slice(5, 15)}@nzila.io`,
          role: 'super_admin',
          isPrimary: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
      result.adminMembershipsCreated++;
      console.log(`✅ Created admin membership for ${userId}`);
    } catch {
      result.skipped.push(`membership for ${userId} (may already exist)`);
    }
  }

  return result;
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed-nzila-platform.ts')) {
  seedNzilaPlatform()
    .then(r => {
      console.log('\n📊 Seed result:', JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    });
}
