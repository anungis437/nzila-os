/**
 * Seed: CAPE-ACEP Pilot Organization
 *
 * Provisions the Canadian Association of Professional Employees (CAPE-ACEP)
 * for the first pilot deployment on the Union Eyes platform.
 *
 * Creates:
 *   1. CAPE-ACEP organization record (CLC-affiliated federal union)
 *   2. Default dues rule (percentage-of-salary, bi-weekly)
 *   3. Organization sharing settings (private by default)
 *
 * CAPE-ACEP background:
 *   - Represents ~23,000 federal public-service professionals
 *   - Economists (EC), translators (TR), social science (SI) groups
 *   - CLC affiliate since 1967 (one of the founding unions)
 *   - Headquarters: Ottawa, ON
 *   - Bargaining: Treasury Board of Canada Secretariat
 *
 * Idempotent: uses ON CONFLICT (slug) DO NOTHING so it is safe to
 * re-run without duplicating data.
 *
 * Usage:
 *   npx tsx apps/union-eyes/db/seeds/seed-cape-acep.ts
 *   — or via the /api/admin/seed-test-data POST endpoint
 */

import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { eq } from 'drizzle-orm';

// ──────────────────────────────────────────────────────────────────
// CAPE-ACEP Organization
// ──────────────────────────────────────────────────────────────────

const CAPE_ACEP_ORG = {
  name: 'Canadian Association of Professional Employees',
  slug: 'cape-acep',
  displayName: 'CAPE-ACEP',
  shortName: 'CAPE',
  organizationType: 'union' as const,
  parentId: null, // will be linked to CLC if found
  hierarchyPath: [] as string[],
  hierarchyLevel: 1,
  provinceTerritory: 'ON',
  sectors: ['public_service'] as const,
  email: 'info@acep-cape.ca',
  phone: '613-236-9181',
  website: 'https://acep-cape.ca',
  address: {
    street: '100 Queen Street, 4th Floor',
    city: 'Ottawa',
    province: 'ON',
    postalCode: 'K1P 1J9',
    country: 'CA',
  },
  clcAffiliated: true,
  affiliationDate: '1967-01-01',
  charterNumber: null,
  memberCount: 23_000,
  activeMemberCount: 23_000,
  status: 'active',
  legalName: 'Canadian Association of Professional Employees / Association canadienne des employés professionnels',
  businessNumber: null, // client to provide during onboarding
  clcAffiliateCode: 'CAPE',
  perCapitaRate: '0.54', // CLC standard per-capita
  remittanceDay: 15,
  fiscalYearEnd: '2024-12-31',
  settings: {
    perCapitaRate: 0.54,
    remittanceDay: 15,
    fiscalYearEnd: 'December 31',
    bargainingAgent: 'CAPE-ACEP',
    employer: 'Treasury Board of Canada Secretariat',
    bargainingGroups: ['EC', 'TR', 'SI'],
    language: 'bilingual', // EN/FR
  },
  featuresEnabled: [
    'dues-management',
    'member-directory',
    'grievance-tracking',
    'collective-bargaining',
    'financial-reporting',
    'tax-slips',
    'clc-integration',
    'strike-fund',
  ],
};

// ──────────────────────────────────────────────────────────────────
// Default Dues Rule — Percentage of salary (bi-weekly deduction)
// ──────────────────────────────────────────────────────────────────

const CAPE_DUES_RULE = {
  ruleName: 'CAPE Standard Dues',
  ruleCode: 'CAPE-STD',
  description:
    'Standard CAPE membership dues — percentage of base salary deducted bi-weekly at source by the employer (Treasury Board payroll).',
  calculationType: 'percentage',
  percentageRate: '1.50', // 1.5% of gross pay — typical for CAPE
  baseField: 'grossSalary',
  flatAmount: null,
  hourlyRate: null,
  hoursPerPeriod: null,
  tierStructure: null,
  customFormula: null,
  billingFrequency: 'biweekly',
  isActive: true,
  effectiveDate: '2025-01-01',
  endDate: null,
  createdBy: 'seed:cape-acep',
};

// ──────────────────────────────────────────────────────────────────
// Organization Sharing Settings (private by default for pilot)
// ──────────────────────────────────────────────────────────────────

const CAPE_SHARING_SETTINGS = {
  allowFederationSharing: false,
  allowSectorSharing: false,
  allowProvinceSharing: false,
  allowCongressSharing: false,
  autoShareClauses: false,
  autoSharePrecedents: false,
  requireAnonymization: true,
  defaultSharingLevel: 'private',
  allowedSharingLevels: ['private'],
  sharingApprovalRequired: true,
  sharingApproverRole: 'admin',
  maxSharedClauses: null,
  maxSharedPrecedents: null,
};

// ──────────────────────────────────────────────────────────────────
// Result type
// ──────────────────────────────────────────────────────────────────

export interface CapeAcepSeedResult {
  organizationId: string | null;
  duesRuleCreated: boolean;
  sharingSettingsCreated: boolean;
  linkedToClc: boolean;
  skipped: string[];
}

// ──────────────────────────────────────────────────────────────────
// Seed function
// ──────────────────────────────────────────────────────────────────

/**
 * Idempotent seed: inserts CAPE-ACEP org + dues rule + sharing settings.
 * Attempts to link to CLC parent if the CLC org already exists.
 */
export async function seedCapeAcep(): Promise<CapeAcepSeedResult> {
  const result: CapeAcepSeedResult = {
    organizationId: null,
    duesRuleCreated: false,
    sharingSettingsCreated: false,
    linkedToClc: false,
    skipped: [],
  };

  // 1. Find CLC parent (if already seeded)
  let clcId: string | null = null;
  try {
    const clc = await db.query.organizations.findFirst({
      where: (o, { eq: eqFn }) => eqFn(o.slug, 'clc'),
      columns: { id: true },
    });
    clcId = clc?.id ?? null;
  } catch {
    // CLC not seeded yet — proceed without parent
  }

  const orgValues = {
    ...CAPE_ACEP_ORG,
    parentId: clcId,
    hierarchyPath: clcId ? [clcId] : [],
  };

  // 2. Insert CAPE-ACEP organization
  const [capeRow] = await db
    .insert(organizations)
    .values(orgValues)
    .onConflictDoNothing({ target: organizations.slug })
    .returning({ id: organizations.id });

  if (capeRow) {
    result.organizationId = capeRow.id;
    result.linkedToClc = !!clcId;
  } else {
    // Already exists — look it up
    const existing = await db.query.organizations.findFirst({
      where: (o, { eq: eqFn }) => eqFn(o.slug, 'cape-acep'),
      columns: { id: true },
    });
    result.organizationId = existing?.id ?? null;
    result.skipped.push('cape-acep organization (already exists)');
  }

  if (!result.organizationId) {
    console.error('Failed to create or find CAPE-ACEP organization');
    return result;
  }

  // 3. Insert dues rule (use raw SQL insert for the duesRules table)
  try {
    await db.execute(
      /* sql */`
      INSERT INTO dues_rules (
        organization_id, rule_name, rule_code, description,
        calculation_type, percentage_rate, base_field,
        billing_frequency, is_active, effective_date, created_by
      ) VALUES (
        ${result.organizationId},
        ${CAPE_DUES_RULE.ruleName},
        ${CAPE_DUES_RULE.ruleCode},
        ${CAPE_DUES_RULE.description},
        ${CAPE_DUES_RULE.calculationType},
        ${CAPE_DUES_RULE.percentageRate},
        ${CAPE_DUES_RULE.baseField},
        ${CAPE_DUES_RULE.billingFrequency},
        ${CAPE_DUES_RULE.isActive},
        ${CAPE_DUES_RULE.effectiveDate},
        ${CAPE_DUES_RULE.createdBy}
      )
      ON CONFLICT (organization_id, rule_code) DO NOTHING
    `
    );
    result.duesRuleCreated = true;
  } catch (err) {
    result.skipped.push(`dues rule: ${err instanceof Error ? err.message : 'unknown error'}`);
  }

  // 4. Insert sharing settings
  try {
    await db.execute(
      /* sql */`
      INSERT INTO organization_sharing_settings (
        organization_id,
        allow_federation_sharing, allow_sector_sharing,
        allow_province_sharing, allow_congress_sharing,
        auto_share_clauses, auto_share_precedents,
        require_anonymization, default_sharing_level,
        allowed_sharing_levels, sharing_approval_required,
        sharing_approver_role
      ) VALUES (
        ${result.organizationId},
        ${CAPE_SHARING_SETTINGS.allowFederationSharing},
        ${CAPE_SHARING_SETTINGS.allowSectorSharing},
        ${CAPE_SHARING_SETTINGS.allowProvinceSharing},
        ${CAPE_SHARING_SETTINGS.allowCongressSharing},
        ${CAPE_SHARING_SETTINGS.autoShareClauses},
        ${CAPE_SHARING_SETTINGS.autoSharePrecedents},
        ${CAPE_SHARING_SETTINGS.requireAnonymization},
        ${CAPE_SHARING_SETTINGS.defaultSharingLevel},
        ${`{${CAPE_SHARING_SETTINGS.allowedSharingLevels.join(',')}}`},
        ${CAPE_SHARING_SETTINGS.sharingApprovalRequired},
        ${CAPE_SHARING_SETTINGS.sharingApproverRole}
      )
      ON CONFLICT (organization_id) DO NOTHING
    `
    );
    result.sharingSettingsCreated = true;
  } catch (err) {
    result.skipped.push(`sharing settings: ${err instanceof Error ? err.message : 'unknown error'}`);
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────
// CLI entry-point
// ──────────────────────────────────────────────────────────────────

if (require.main === module) {
  seedCapeAcep()
    .then((res) => {
      console.log('\n✅ CAPE-ACEP seed complete');
      console.log(`   Organization ID : ${res.organizationId}`);
      console.log(`   Dues rule       : ${res.duesRuleCreated ? 'created' : 'skipped'}`);
      console.log(`   Sharing settings: ${res.sharingSettingsCreated ? 'created' : 'skipped'}`);
      console.log(`   Linked to CLC   : ${res.linkedToClc ? 'yes' : 'no (CLC not found)'}`);
      if (res.skipped.length) {
        console.log(`   Skipped         : ${res.skipped.join(', ')}`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ CAPE-ACEP seed failed:', err);
      process.exit(1);
    });
}
