/**
 * Seed: UnionEyes Staging Demo Data
 *
 * Creates deterministic claims, members, assignments, and events
 * for staging environment demonstrations.
 *
 * Idempotent: checks for existing records before inserting.
 *
 * Usage:
 *   npx tsx scripts/seed-union-eyes-demo.ts
 */

import { db } from '@/db/db'
import { claims, claimUpdates } from '@/db/schema'
import { organizationMembers } from '@/db/schema/organization-members-schema'
import { eq } from 'drizzle-orm'

// ── Fixed IDs for determinism ───────────────────────────

const DEMO_ORG_ID = '458a56cb-251a-4c91-a0b5-81bb8ac39087'

const DEMO_MEMBERS = [
  {
    userId: 'demo-steward-001',
    organizationId: DEMO_ORG_ID,
    role: 'steward',
    status: 'active',
    displayName: 'Sarah Johnson',
  },
  {
    userId: 'demo-steward-002',
    organizationId: DEMO_ORG_ID,
    role: 'steward',
    status: 'active',
    displayName: 'Marcus Chen',
  },
  {
    userId: 'demo-admin-001',
    organizationId: DEMO_ORG_ID,
    role: 'admin',
    status: 'active',
    displayName: 'Angela Moreau',
  },
  {
    userId: 'demo-member-001',
    organizationId: DEMO_ORG_ID,
    role: 'member',
    status: 'active',
    displayName: 'David Kim',
  },
  {
    userId: 'demo-member-002',
    organizationId: DEMO_ORG_ID,
    role: 'member',
    status: 'active',
    displayName: 'Rachel Green',
  },
]

const NOW = new Date('2026-03-16T10:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

const DEMO_CLAIMS = [
  {
    claimId: 'dc000001-0000-4000-a000-000000000001',
    claimNumber: 'DEMO-2026-001',
    organizationId: DEMO_ORG_ID,
    memberId: 'demo-member-001',
    claimType: 'grievance_pay' as const,
    status: 'submitted' as const,
    priority: 'high' as const,
    incidentDate: new Date(NOW.getTime() - 2 * DAY),
    location: 'Plant Floor A',
    description: 'Pay grade mismatch after shift reassignment. Expected Grade 7 pay, received Grade 5.',
    desiredOutcome: 'Retroactive pay correction and updated records.',
    progress: 10,
    createdAt: new Date(NOW.getTime() - 2 * DAY),
    updatedAt: new Date(NOW.getTime() - 2 * DAY),
  },
  {
    claimId: 'dc000001-0000-4000-a000-000000000002',
    claimNumber: 'DEMO-2026-002',
    organizationId: DEMO_ORG_ID,
    memberId: 'demo-member-002',
    claimType: 'workplace_safety' as const,
    status: 'investigation' as const,
    priority: 'critical' as const,
    incidentDate: new Date(NOW.getTime() - 10 * DAY),
    location: 'Warehouse B — Dock 4',
    description: 'Forklift near-miss incident. Safety guardrails missing from loading bay.',
    desiredOutcome: 'Guardrail installation and safety audit.',
    assignedTo: 'demo-steward-001',
    assignedAt: new Date(NOW.getTime() - 7 * DAY),
    progress: 50,
    createdAt: new Date(NOW.getTime() - 10 * DAY),
    updatedAt: new Date(NOW.getTime() - 3 * DAY),
  },
  {
    claimId: 'dc000001-0000-4000-a000-000000000003',
    claimNumber: 'DEMO-2026-003',
    organizationId: DEMO_ORG_ID,
    memberId: 'demo-member-001',
    claimType: 'harassment_workplace' as const,
    status: 'under_review' as const,
    priority: 'high' as const,
    incidentDate: new Date(NOW.getTime() - 5 * DAY),
    location: 'Office 302',
    description: 'Hostile work environment. Repeated dismissive behaviour from supervisor in team meetings.',
    desiredOutcome: 'Formal investigation and mediation.',
    progress: 25,
    createdAt: new Date(NOW.getTime() - 5 * DAY),
    updatedAt: new Date(NOW.getTime() - 3 * DAY),
  },
  {
    claimId: 'dc000001-0000-4000-a000-000000000004',
    claimNumber: 'DEMO-2026-004',
    organizationId: DEMO_ORG_ID,
    memberId: 'demo-member-002',
    claimType: 'contract_dispute' as const,
    status: 'resolved' as const,
    priority: 'medium' as const,
    incidentDate: new Date(NOW.getTime() - 30 * DAY),
    location: 'HR Office',
    description: 'Overtime calculation error under Article 14.3 of current CBA.',
    desiredOutcome: 'Recalculation and back-pay.',
    assignedTo: 'demo-steward-002',
    assignedAt: new Date(NOW.getTime() - 25 * DAY),
    progress: 90,
    createdAt: new Date(NOW.getTime() - 30 * DAY),
    updatedAt: new Date(NOW.getTime() - 1 * DAY),
    resolvedAt: new Date(NOW.getTime() - 1 * DAY),
  },
  {
    claimId: 'dc000001-0000-4000-a000-000000000005',
    claimNumber: 'DEMO-2026-005',
    organizationId: DEMO_ORG_ID,
    memberId: 'demo-member-001',
    claimType: 'discrimination_gender' as const,
    status: 'pending_documentation' as const,
    priority: 'high' as const,
    incidentDate: new Date(NOW.getTime() - 8 * DAY),
    location: 'Conference Room 1',
    description: 'Gender-based comments during promotion evaluation meeting.',
    desiredOutcome: 'Formal apology and policy review.',
    assignedTo: 'demo-steward-001',
    assignedAt: new Date(NOW.getTime() - 6 * DAY),
    progress: 60,
    createdAt: new Date(NOW.getTime() - 8 * DAY),
    updatedAt: new Date(NOW.getTime() - 2 * DAY),
  },
]

const DEMO_EVENTS = [
  // Claim 1 events
  {
    claimId: 'dc000001-0000-4000-a000-000000000001',
    updateType: 'status_change',
    message: 'Claim submitted by member.',
    createdBy: 'demo-member-001',
    isInternal: false,
    metadata: { previousStatus: null, newStatus: 'submitted' },
    createdAt: new Date(NOW.getTime() - 2 * DAY),
  },
  // Claim 2 events (full lifecycle)
  {
    claimId: 'dc000001-0000-4000-a000-000000000002',
    updateType: 'status_change',
    message: 'Claim submitted.',
    createdBy: 'demo-member-002',
    isInternal: false,
    metadata: { previousStatus: null, newStatus: 'submitted' },
    createdAt: new Date(NOW.getTime() - 10 * DAY),
  },
  {
    claimId: 'dc000001-0000-4000-a000-000000000002',
    updateType: 'status_change',
    message: 'Status changed from \'submitted\' to \'under_review\'.',
    createdBy: 'demo-steward-001',
    isInternal: false,
    metadata: { previousStatus: 'submitted', newStatus: 'under_review' },
    createdAt: new Date(NOW.getTime() - 9 * DAY),
  },
  {
    claimId: 'dc000001-0000-4000-a000-000000000002',
    updateType: 'assignment',
    message: 'Assigned to Sarah Johnson.',
    createdBy: 'demo-admin-001',
    isInternal: true,
    metadata: { assignedTo: 'demo-steward-001' },
    createdAt: new Date(NOW.getTime() - 7 * DAY),
  },
  {
    claimId: 'dc000001-0000-4000-a000-000000000002',
    updateType: 'status_change',
    message: 'Status changed from \'under_review\' to \'investigation\'.',
    createdBy: 'demo-steward-001',
    isInternal: false,
    metadata: { previousStatus: 'under_review', newStatus: 'investigation' },
    createdAt: new Date(NOW.getTime() - 5 * DAY),
  },
  // Claim 3 events
  {
    claimId: 'dc000001-0000-4000-a000-000000000003',
    updateType: 'status_change',
    message: 'Claim submitted.',
    createdBy: 'demo-member-001',
    isInternal: false,
    metadata: { previousStatus: null, newStatus: 'submitted' },
    createdAt: new Date(NOW.getTime() - 5 * DAY),
  },
  {
    claimId: 'dc000001-0000-4000-a000-000000000003',
    updateType: 'status_change',
    message: 'Status changed from \'submitted\' to \'under_review\'.',
    createdBy: 'demo-steward-002',
    isInternal: false,
    metadata: { previousStatus: 'submitted', newStatus: 'under_review' },
    createdAt: new Date(NOW.getTime() - 3 * DAY),
  },
  // Claim 4 events (full resolution)
  {
    claimId: 'dc000001-0000-4000-a000-000000000004',
    updateType: 'status_change',
    message: 'Claim submitted.',
    createdBy: 'demo-member-002',
    isInternal: false,
    metadata: { previousStatus: null, newStatus: 'submitted' },
    createdAt: new Date(NOW.getTime() - 30 * DAY),
  },
  {
    claimId: 'dc000001-0000-4000-a000-000000000004',
    updateType: 'status_change',
    message: 'Status changed from \'submitted\' to \'under_review\'.',
    createdBy: 'demo-steward-002',
    isInternal: false,
    metadata: { previousStatus: 'submitted', newStatus: 'under_review' },
    createdAt: new Date(NOW.getTime() - 28 * DAY),
  },
  {
    claimId: 'dc000001-0000-4000-a000-000000000004',
    updateType: 'status_change',
    message: 'Status changed from \'under_review\' to \'resolved\'. Overtime recalculated and back-pay approved.',
    createdBy: 'demo-steward-002',
    isInternal: false,
    metadata: { previousStatus: 'under_review', newStatus: 'resolved' },
    createdAt: new Date(NOW.getTime() - 1 * DAY),
  },
  // Claim 5 events
  {
    claimId: 'dc000001-0000-4000-a000-000000000005',
    updateType: 'status_change',
    message: 'Claim submitted.',
    createdBy: 'demo-member-001',
    isInternal: false,
    metadata: { previousStatus: null, newStatus: 'submitted' },
    createdAt: new Date(NOW.getTime() - 8 * DAY),
  },
  {
    claimId: 'dc000001-0000-4000-a000-000000000005',
    updateType: 'status_change',
    message: 'Status changed from \'submitted\' to \'pending_documentation\'. Additional evidence requested.',
    createdBy: 'demo-steward-001',
    isInternal: false,
    metadata: { previousStatus: 'submitted', newStatus: 'pending_documentation' },
    createdAt: new Date(NOW.getTime() - 2 * DAY),
  },
]

// ── Main ────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding UnionEyes staging demo data…')

  // Seed members (idempotent)
  for (const m of DEMO_MEMBERS) {
    const [exists] = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, m.userId))
      .limit(1)

    if (!exists) {
      await db.insert(organizationMembers).values({
        ...m,
        joinedAt: NOW,
      })
      console.log(`  ✓ Member: ${m.displayName} (${m.role})`)
    } else {
      console.log(`  ○ Member exists: ${m.displayName}`)
    }
  }

  // Seed claims (idempotent)
  for (const c of DEMO_CLAIMS) {
    const [exists] = await db
      .select({ claimId: claims.claimId })
      .from(claims)
      .where(eq(claims.claimNumber, c.claimNumber))
      .limit(1)

    if (!exists) {
      await db.insert(claims).values(c)
      console.log(`  ✓ Claim: ${c.claimNumber} (${c.status})`)
    } else {
      console.log(`  ○ Claim exists: ${c.claimNumber}`)
    }
  }

  // Seed events (idempotent — check by claimId + message)
  for (const e of DEMO_EVENTS) {
    const [exists] = await db
      .select({ updateId: claimUpdates.updateId })
      .from(claimUpdates)
      .where(eq(claimUpdates.claimId, e.claimId))
      .limit(1)

    // Only skip if this exact claim already has events (first run guard)
    // On re-runs the events already exist
    if (!exists) {
      await db.insert(claimUpdates).values(e)
      console.log(`  ✓ Event: ${e.claimId.slice(-4)} → ${e.updateType}`)
    }
  }

  console.log('\n✅ Demo seed complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
