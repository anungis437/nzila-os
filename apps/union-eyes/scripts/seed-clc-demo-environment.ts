/**
 * Seed: Union Eyes CLC Demo Environment
 *
 * Creates a canonical, institutionally believable demo environment
 * for the CLC convention pilot conversations and live demonstrations.
 *
 * Personas and data are designed to feel lived-in: real names,
 * realistic case histories, governance review activity, and
 * continuity-relevant organizational context.
 *
 * Idempotent: checks for existing records before inserting.
 *
 * Usage:
 *   npx tsx scripts/seed-clc-demo-environment.ts
 *
 * Production guard: this script aborts immediately if UE_ENVIRONMENT (or fallback
 * NEXT_PUBLIC_APP_ENV / NODE_ENV) resolves to "production" / "prod". Override
 * with ALLOW_PRODUCTION_SEED=1 only for documented one-time recovery.
 *
 * Safe to run repeatedly. Will skip existing records.
 */

import { db } from '@/db/db'
import { organizations } from '@/db/schema-organizations'
import { organizationMembers } from '@/db/schema/organization-members-schema'
import { claims } from '@/db/schema/claims-schema'
import { eq, and } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL DEMO ORGANIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CUPE Local 4279 — a mid-sized public-sector union local in Ontario.
 * Healthcare sector. CLC-affiliated. Realistic for a CLC convention audience.
 */
const CLC_DEMO_ORG_ID = 'a1b2c3d4-0001-4000-a000-clcdemo000001'

const CLC_DEMO_ORG = {
  name: 'CUPE Local 4279',
  slug: 'cupe-local-4279-clc-demo',
  displayName: 'CUPE Local 4279 — Ontario Healthcare',
  shortName: 'Local 4279',
  description:
    'CUPE Local 4279 represents 1,240 healthcare support workers across three hospital sites in the Hamilton–Niagara region. The local is affiliated with the Canadian Union of Public Employees and the CLC.',
  organizationType: 'local' as const,
  sectors: ['healthcare'],
  status: 'active',
  memberCount: 1240,
  website: 'https://demo.union-eyes.ca',
  address: {
    street: '220 Main St W',
    city: 'Hamilton',
    province: 'ON',
    postal_code: 'L8P 1H1',
    country: 'CA',
  },
  clcAffiliated: true,
  hierarchyPath: [] as string[],
  hierarchyLevel: 0,
  settings: {
    clc_demo: true,
    clc_convention_2026: true,
    continuity_tier: 'institutional',
    governance_review_cadence: 'quarterly',
    pilot_enrollment: 'active',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL CLC PERSONAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Six personas representing the full role spectrum.
 * Names are realistic Canadian union names. No lorem ipsum.
 */
const CLC_PERSONAS = [
  {
    userId: 'clc-demo-executive-001',
    organizationId: CLC_DEMO_ORG_ID,
    role: 'president',
    status: 'active',
    name: 'Margaret Beaumont',
    email: 'margaret.beaumont@demo.union-eyes.ca',
    position: 'Executive Director',
    department: 'Leadership',
    location: 'Hamilton, ON',
    membershipNumber: 'MBR-0001',
    seniority: 22,
    isPrimary: true,
    metadata: {
      clc_persona: 'executive',
      clc_demo: true,
      bio_note:
        'Margaret has served as Executive Director for 9 years. She leads institutional modernization strategy and represents the local at CLC convention.',
      continuity_priority: 'leadership_transition',
      governance_involvement: 'executive_committee',
    },
  },
  {
    userId: 'clc-demo-governance-001',
    organizationId: CLC_DEMO_ORG_ID,
    role: 'compliance_manager',
    status: 'active',
    name: 'David Okafor',
    email: 'david.okafor@demo.union-eyes.ca',
    position: 'Governance Officer',
    department: 'Governance & Compliance',
    location: 'Hamilton, ON',
    membershipNumber: 'MBR-0002',
    seniority: 14,
    isPrimary: true,
    metadata: {
      clc_persona: 'governance',
      clc_demo: true,
      bio_note:
        'David oversees governance review processes, audit evidence, and continuity documentation. He introduced the first structured governance review calendar in 2024.',
      continuity_priority: 'explainability',
      governance_involvement: 'audit_committee',
    },
  },
  {
    userId: 'clc-demo-steward-001',
    organizationId: CLC_DEMO_ORG_ID,
    role: 'chief_steward',
    status: 'active',
    name: 'Sofia Lemaire',
    email: 'sofia.lemaire@demo.union-eyes.ca',
    position: 'Steward Lead',
    department: 'Member Representation',
    location: 'Hamilton, ON',
    membershipNumber: 'MBR-0003',
    seniority: 11,
    isPrimary: true,
    metadata: {
      clc_persona: 'steward',
      clc_demo: true,
      bio_note:
        'Sofia coordinates the steward network across all three hospital sites. She handles case intake, assignment, and member communication.',
      continuity_priority: 'operational_coordination',
      governance_involvement: 'grievance_committee',
    },
  },
  {
    userId: 'clc-demo-staff-001',
    organizationId: CLC_DEMO_ORG_ID,
    role: 'support_agent',
    status: 'active',
    name: 'Raymond Chen',
    email: 'raymond.chen@demo.union-eyes.ca',
    position: 'Union Staff Coordinator',
    department: 'Member Services',
    location: 'Hamilton, ON',
    membershipNumber: 'MBR-0004',
    seniority: 7,
    isPrimary: false,
    metadata: {
      clc_persona: 'staff',
      clc_demo: true,
      bio_note:
        'Raymond manages day-to-day case correspondence, document tracking, and deadline monitoring for the member services team.',
      continuity_priority: 'fragmentation_reduction',
      governance_involvement: 'member_services',
    },
  },
  {
    userId: 'clc-demo-member-001',
    organizationId: CLC_DEMO_ORG_ID,
    role: 'member',
    status: 'active',
    name: 'Teresa Nakamura',
    email: 'teresa.nakamura@demo.union-eyes.ca',
    position: 'Healthcare Support Worker',
    department: 'Patient Services',
    location: 'Hamilton General Hospital',
    membershipNumber: 'MBR-0791',
    seniority: 5,
    isPrimary: false,
    metadata: {
      clc_persona: 'member',
      clc_demo: true,
      bio_note:
        'Teresa has been a member for five years. She filed a scheduling grievance in March 2026 and has been tracking its progress through the platform.',
      continuity_priority: 'member_experience',
      governance_involvement: 'none',
    },
  },
  {
    userId: 'clc-demo-admin-001',
    organizationId: CLC_DEMO_ORG_ID,
    role: 'admin',
    status: 'active',
    name: 'James Whitfield',
    email: 'james.whitfield@demo.union-eyes.ca',
    position: 'Platform Administrator',
    department: 'Technology & Operations',
    location: 'Hamilton, ON',
    membershipNumber: 'MBR-0005',
    seniority: 3,
    isPrimary: false,
    metadata: {
      clc_persona: 'admin',
      clc_demo: true,
      bio_note:
        'James manages the Union Eyes platform configuration for Local 4279, including pilot scope settings, user roles, and security audit exports.',
      continuity_priority: 'operational_stability',
      governance_involvement: 'technology_committee',
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// DEMO REFERENCE DATE
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-09T09:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL DEMO CLAIMS / CASES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Eight realistic cases in various stages.
 * Designed to tell a coherent operational story during demo walkthroughs.
 *
 * Case distribution:
 *   - 2 submitted (recent, showing active intake)
 *   - 2 under review (mid-stage, showing assignment flow)
 *   - 1 investigation (showing depth of process)
 *   - 1 pending documentation (showing member follow-up need)
 *   - 1 resolved (showing closure and audit trail)
 *   - 1 member case for Teresa (personal journey demo)
 */
const CLC_DEMO_CASES = [
  {
    claimId: 'clc00001-0000-4000-a000-demo00000001',
    claimNumber: 'GRV-2026-041',
    organizationId: CLC_DEMO_ORG_ID,
    memberId: 'clc-demo-member-001',
    claimType: 'grievance_schedule' as const,
    status: 'under_review' as const,
    priority: 'high' as const,
    incidentDate: new Date(NOW.getTime() - 48 * DAY),
    location: 'Hamilton General Hospital — Unit 3B',
    description:
      'Member was scheduled for mandatory overtime on a statutory holiday without the required 72-hour notice as specified in Article 18.2 of the collective agreement.',
    desiredOutcome:
      'Compliance with CBA scheduling provisions and written acknowledgement from management.',
    assignedTo: 'clc-demo-steward-001',
    assignedAt: new Date(NOW.getTime() - 44 * DAY),
    progress: 55,
    createdAt: new Date(NOW.getTime() - 48 * DAY),
    updatedAt: new Date(NOW.getTime() - 5 * DAY),
  },
  {
    claimId: 'clc00002-0000-4000-a000-demo00000002',
    claimNumber: 'GRV-2026-038',
    organizationId: CLC_DEMO_ORG_ID,
    memberId: 'clc-demo-staff-001',
    claimType: 'harassment_workplace' as const,
    status: 'investigation' as const,
    priority: 'critical' as const,
    incidentDate: new Date(NOW.getTime() - 62 * DAY),
    location: "St. Joseph's Healthcare — Nursing Station 2",
    description:
      'Member reported repeated verbal intimidation from a supervisor over a 3-week period. Incident log maintained. Witnesses identified.',
    desiredOutcome:
      'Formal investigation, written reprimand for supervisor, and updated respectful workplace procedure.',
    assignedTo: 'clc-demo-steward-001',
    assignedAt: new Date(NOW.getTime() - 58 * DAY),
    progress: 72,
    createdAt: new Date(NOW.getTime() - 62 * DAY),
    updatedAt: new Date(NOW.getTime() - 2 * DAY),
  },
  {
    claimId: 'clc00003-0000-4000-a000-demo00000003',
    claimNumber: 'GRV-2026-044',
    organizationId: CLC_DEMO_ORG_ID,
    memberId: 'clc-demo-member-001',
    claimType: 'grievance_pay' as const,
    status: 'submitted' as const,
    priority: 'medium' as const,
    incidentDate: new Date(NOW.getTime() - 12 * DAY),
    location: 'Hamilton General Hospital — Payroll',
    description:
      'Member did not receive weekend premium pay for three consecutive shifts in April 2026. Amount owed: $487.',
    desiredOutcome: 'Retroactive premium pay and audit of payroll records for the past 60 days.',
    assignedTo: 'clc-demo-staff-001',
    assignedAt: new Date(NOW.getTime() - 10 * DAY),
    progress: 15,
    createdAt: new Date(NOW.getTime() - 12 * DAY),
    updatedAt: new Date(NOW.getTime() - 10 * DAY),
  },
  {
    claimId: 'clc00004-0000-4000-a000-demo00000004',
    claimNumber: 'GRV-2026-031',
    organizationId: CLC_DEMO_ORG_ID,
    memberId: 'clc-demo-staff-001',
    claimType: 'discrimination_disability' as const,
    status: 'pending_documentation' as const,
    priority: 'high' as const,
    incidentDate: new Date(NOW.getTime() - 78 * DAY),
    location: 'Juravinski Hospital — Administration',
    description:
      'Member with a documented disability was denied accommodation for modified duties following medical leave. Employer failed to engage in collaborative accommodation process.',
    desiredOutcome:
      'Immediate accommodation plan in writing and retroactive accommodation for the 4-week gap period.',
    assignedTo: 'clc-demo-steward-001',
    assignedAt: new Date(NOW.getTime() - 74 * DAY),
    progress: 40,
    createdAt: new Date(NOW.getTime() - 78 * DAY),
    updatedAt: new Date(NOW.getTime() - 8 * DAY),
  },
  {
    claimId: 'clc00005-0000-4000-a000-demo00000005',
    claimNumber: 'GRV-2026-019',
    organizationId: CLC_DEMO_ORG_ID,
    memberId: 'clc-demo-staff-001',
    claimType: 'contract_dispute' as const,
    status: 'resolved' as const,
    priority: 'medium' as const,
    incidentDate: new Date(NOW.getTime() - 110 * DAY),
    location: 'Hamilton General Hospital — HR Department',
    description:
      'Member was assigned duties outside their classification under the collective agreement without compensation adjustment as required by Article 22.4.',
    desiredOutcome: 'Return to classification duties and retroactive pay differential.',
    assignedTo: 'clc-demo-steward-001',
    assignedAt: new Date(NOW.getTime() - 106 * DAY),
    progress: 100,
    resolvedAt: new Date(NOW.getTime() - 14 * DAY),
    createdAt: new Date(NOW.getTime() - 110 * DAY),
    updatedAt: new Date(NOW.getTime() - 14 * DAY),
  },
  {
    claimId: 'clc00006-0000-4000-a000-demo00000006',
    claimNumber: 'GRV-2026-047',
    organizationId: CLC_DEMO_ORG_ID,
    memberId: 'clc-demo-staff-001',
    claimType: 'workplace_safety' as const,
    status: 'submitted' as const,
    priority: 'high' as const,
    incidentDate: new Date(NOW.getTime() - 6 * DAY),
    location: "St. Joseph's Healthcare — Supply Room B",
    description:
      'Broken equipment reported on two occasions with no corrective action. Third-shift workers at risk of injury. Health and safety committee notified.',
    desiredOutcome:
      'Equipment removal and replacement within 72 hours. Joint health and safety committee review.',
    assignedTo: 'clc-demo-staff-001',
    assignedAt: new Date(NOW.getTime() - 5 * DAY),
    progress: 10,
    createdAt: new Date(NOW.getTime() - 6 * DAY),
    updatedAt: new Date(NOW.getTime() - 5 * DAY),
  },
  {
    claimId: 'clc00007-0000-4000-a000-demo00000007',
    claimNumber: 'GRV-2026-033',
    organizationId: CLC_DEMO_ORG_ID,
    memberId: 'clc-demo-staff-001',
    claimType: 'grievance_discipline' as const,
    status: 'under_review' as const,
    priority: 'high' as const,
    incidentDate: new Date(NOW.getTime() - 55 * DAY),
    location: 'Juravinski Hospital — Unit 7',
    description:
      'Member received a written disciplinary notice without access to union representation at the disciplinary meeting, in violation of Article 9.1 (Weingarten rights).',
    desiredOutcome:
      'Removal of notice from personnel file. Employer training on representation rights.',
    assignedTo: 'clc-demo-steward-001',
    assignedAt: new Date(NOW.getTime() - 51 * DAY),
    progress: 45,
    createdAt: new Date(NOW.getTime() - 55 * DAY),
    updatedAt: new Date(NOW.getTime() - 7 * DAY),
  },
  {
    claimId: 'clc00008-0000-4000-a000-demo00000008',
    claimNumber: 'GRV-2026-051',
    organizationId: CLC_DEMO_ORG_ID,
    memberId: 'clc-demo-member-001',
    claimType: 'harassment_verbal' as const,
    status: 'under_review' as const,
    priority: 'medium' as const,
    incidentDate: new Date(NOW.getTime() - 18 * DAY),
    location: 'Hamilton General Hospital — Unit 3B',
    description:
      'Member reported a single incident of disrespectful communication from charge nurse. Informal resolution attempted. Member requesting formal acknowledgement.',
    desiredOutcome:
      'Written apology and verbal communication standards reminder for the unit.',
    assignedTo: 'clc-demo-staff-001',
    assignedAt: new Date(NOW.getTime() - 15 * DAY),
    progress: 25,
    createdAt: new Date(NOW.getTime() - 18 * DAY),
    updatedAt: new Date(NOW.getTime() - 12 * DAY),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// SEED RUNNER
// ─────────────────────────────────────────────────────────────────────────────

import { assertNotProduction } from '@/lib/runtime/production-guard'

assertNotProduction('seed-clc-demo-environment')

async function main() {
  console.log('🌱 Union Eyes — CLC Demo Environment Seed')
  console.log('═'.repeat(56))

  // ── 1. Organization ─────────────────────────────────────────────────────────
  console.log('\n[1/3] Seeding demo organization...')
  let existingOrg = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, CLC_DEMO_ORG.slug))
    .limit(1)

  if (existingOrg.length === 0) {
    const inserted = await db.insert(organizations).values({
      name: CLC_DEMO_ORG.name,
      slug: CLC_DEMO_ORG.slug,
      displayName: CLC_DEMO_ORG.displayName,
      shortName: CLC_DEMO_ORG.shortName,
      description: CLC_DEMO_ORG.description,
      organizationType: CLC_DEMO_ORG.organizationType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sectors: CLC_DEMO_ORG.sectors as any,
      status: CLC_DEMO_ORG.status,
      memberCount: CLC_DEMO_ORG.memberCount,
      website: CLC_DEMO_ORG.website,
      address: CLC_DEMO_ORG.address,
      clcAffiliated: CLC_DEMO_ORG.clcAffiliated,
      hierarchyPath: CLC_DEMO_ORG.hierarchyPath,
      hierarchyLevel: CLC_DEMO_ORG.hierarchyLevel,
      settings: CLC_DEMO_ORG.settings,
    }).returning({ id: organizations.id })
    existingOrg = inserted
    console.log(`  ✓ Created: ${CLC_DEMO_ORG.displayName}`)
  } else {
    console.log(`  · Exists:  ${CLC_DEMO_ORG.displayName}`)
  }

  const resolvedOrgId = existingOrg[0].id

  // ── 2. Personas ──────────────────────────────────────────────────────────────
  console.log('\n[2/3] Seeding CLC personas...')
  for (const persona of CLC_PERSONAS) {
    const existing = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, persona.userId),
          eq(organizationMembers.organizationId, resolvedOrgId),
        ),
      )
      .limit(1)

    if (existing.length === 0) {
      await db.insert(organizationMembers).values({
        userId: persona.userId,
        organizationId: resolvedOrgId,
        role: persona.role,
        status: persona.status,
        name: persona.name,
        email: persona.email,
        position: persona.position,
        department: persona.department,
        location: persona.location,
        membershipNumber: persona.membershipNumber,
        seniority: persona.seniority,
        isPrimary: persona.isPrimary,
        metadata: persona.metadata,
        createdAt: new Date(NOW.getTime() - 90 * DAY),
        joinedAt: new Date(NOW.getTime() - persona.seniority * 365 * DAY),
      })
      console.log(`  ✓ Created: ${persona.name} (${persona.position})`)
    } else {
      console.log(`  · Exists:  ${persona.name}`)
    }
  }

  // ── 3. Cases ─────────────────────────────────────────────────────────────────
  console.log('\n[3/3] Seeding demo cases...')
  for (const demoCase of CLC_DEMO_CASES) {
    const existing = await db
      .select({ id: claims.id })
      .from(claims)
      .where(eq(claims.claimId, demoCase.claimId))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(claims).values({
        claimId: demoCase.claimId,
        claimNumber: demoCase.claimNumber,
        organizationId: resolvedOrgId,
        memberId: demoCase.memberId,
        claimType: demoCase.claimType,
        status: demoCase.status,
        priority: demoCase.priority,
        incidentDate: demoCase.incidentDate,
        location: demoCase.location,
        description: demoCase.description,
        desiredOutcome: demoCase.desiredOutcome,
        assignedTo: demoCase.assignedTo,
        assignedAt: demoCase.assignedAt,
        progress: demoCase.progress,
        createdAt: demoCase.createdAt,
        updatedAt: demoCase.updatedAt,
        resolvedAt: 'resolvedAt' in demoCase ? demoCase.resolvedAt : undefined,
      })
      console.log(`  ✓ Created: ${demoCase.claimNumber} — ${demoCase.claimType} [${demoCase.status}]`)
    } else {
      console.log(`  · Exists:  ${demoCase.claimNumber}`)
    }
  }

  console.log('\n═'.repeat(56))
  console.log('✅ CLC Demo Environment ready.')
  console.log()
  console.log('Personas:')
  for (const p of CLC_PERSONAS) {
    console.log(`  ${p.name.padEnd(26)} ${p.role.padEnd(22)} ${p.email}`)
  }
  console.log()
  console.log(`Cases seeded: ${CLC_DEMO_CASES.length}`)
  console.log(`Organization: ${CLC_DEMO_ORG.displayName}`)
  console.log('═'.repeat(56))
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
