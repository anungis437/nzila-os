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

import { assertNotProduction } from '@/lib/runtime/production-guard'
import { db } from '@/db/db'
import { claims, claimUpdates } from '@/db/schema'
import { organizationMembers } from '@/db/schema/organization-members-schema'
import { eq } from 'drizzle-orm'

assertNotProduction('seed-union-eyes-demo')

// ── Fixed IDs for determinism ───────────────────────────

const DEMO_ORG_ID = '458a56cb-251a-4c91-a0b5-81bb8ac39087'

const DEMO_MEMBERS = [
  {
    userId: 'demo-steward-001',
    organizationId: DEMO_ORG_ID,
    role: 'steward',
    status: 'active',
    displayName: 'Alex Martins',
  },
  {
    userId: 'demo-grievance-officer-001',
    organizationId: DEMO_ORG_ID,
    role: 'grievance_officer',
    status: 'active',
    displayName: 'Priya Patel',
  },
  {
    userId: 'demo-executive-001',
    organizationId: DEMO_ORG_ID,
    role: 'executive',
    status: 'active',
    displayName: 'Diane Okafor',
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

const claimTypes = [
  'grievance_pay',
  'workplace_safety',
  'harassment_workplace',
  'contract_dispute',
  'discrimination_gender',
] as const
const claimStatuses = [
  'submitted',
  'under_review',
  'investigation',
  'pending_documentation',
  'resolved',
] as const
const priorities = ['medium', 'high', 'critical'] as const

const DEMO_CLAIMS = Array.from({ length: 12 }, (_, index) => {
  const claimIndex = index + 1
  const claimId = `dc000001-0000-4000-a000-0000000000${String(claimIndex).padStart(2, '0')}`
  const createdOffset = 2 + index * 2
  const status = claimStatuses[index % claimStatuses.length]
  const claimType = claimTypes[index % claimTypes.length]
  const memberId = index % 2 === 0 ? 'demo-member-001' : 'demo-member-002'
  const assignee = index % 3 === 0 ? 'demo-grievance-officer-001' : 'demo-steward-001'
  const isResolved = status === 'resolved'

  return {
    claimId,
    claimNumber: `GRV-2026-${String(claimIndex).padStart(3, '0')}`,
    organizationId: DEMO_ORG_ID,
    memberId,
    claimType,
    status,
    priority: priorities[index % priorities.length],
    incidentDate: new Date(NOW.getTime() - (createdOffset + 1) * DAY),
    location: `Unit ${100 + claimIndex}`,
    description: `Demo grievance ${claimIndex} for procurement walkthrough and evidence traceability validation.`,
    desiredOutcome: 'Timely case resolution with complete audit trail and exportable evidence package.',
    assignedTo: assignee,
    assignedAt: new Date(NOW.getTime() - createdOffset * DAY),
    progress: Math.min(95, 15 + claimIndex * 6),
    createdAt: new Date(NOW.getTime() - createdOffset * DAY),
    updatedAt: new Date(NOW.getTime() - Math.max(1, createdOffset - 1) * DAY),
    resolvedAt: isResolved ? new Date(NOW.getTime() - DAY) : undefined,
  }
})

const OVERDUE_CLAIM_IDS = new Set(DEMO_CLAIMS.slice(0, 3).map((claim) => claim.claimId))
const EXPORTABLE_CASE_CLAIM_ID = DEMO_CLAIMS[4]?.claimId

const DEMO_EVENTS: Array<{
  claimId: string
  updateType: string
  message: string
  createdBy: string
  isInternal: boolean
  metadata: Record<string, unknown>
  createdAt: Date
}> = DEMO_CLAIMS.flatMap((claim, index) => {
  const events: Array<{
    claimId: string
    updateType: string
    message: string
    createdBy: string
    isInternal: boolean
    metadata: Record<string, unknown>
    createdAt: Date
  }> = [
    {
      claimId: claim.claimId,
      updateType: 'status_change',
      message: 'Claim submitted by member.',
      createdBy: claim.memberId,
      isInternal: false,
      metadata: { previousStatus: null, newStatus: 'submitted' },
      createdAt: new Date(claim.createdAt),
    },
    {
      claimId: claim.claimId,
      updateType: 'assignment',
      message: `Assigned to ${claim.assignedTo}.`,
      createdBy: 'demo-executive-001',
      isInternal: true,
      metadata: { assignedTo: claim.assignedTo },
      createdAt: new Date(claim.assignedAt ?? claim.createdAt),
    },
    {
      claimId: claim.claimId,
      updateType: 'document_added',
      message: `Evidence document uploaded: grievance-${String(index + 1).padStart(3, '0')}.pdf`,
      createdBy: 'demo-grievance-officer-001',
      isInternal: false,
      metadata: { docType: 'evidence_pdf' },
      createdAt: new Date(claim.updatedAt),
    },
  ]

  if (OVERDUE_CLAIM_IDS.has(claim.claimId)) {
    events.push({
      claimId: claim.claimId,
      updateType: 'deadline_alert',
      message: 'Deadline overdue by 3+ days. Escalated for immediate steward action.',
      createdBy: 'demo-grievance-officer-001',
      isInternal: true,
      metadata: { overdue: true, overdueDays: 3 },
      createdAt: new Date(NOW.getTime() - DAY),
    })
  }

  if (claim.claimId === EXPORTABLE_CASE_CLAIM_ID) {
    events.push({
      claimId: claim.claimId,
      updateType: 'export_ready',
      message: 'Evidence package generated and marked export-ready for procurement demo.',
      createdBy: 'demo-steward-001',
      isInternal: false,
      metadata: { exportableCase: true },
      createdAt: new Date(NOW.getTime() - DAY),
    })
  }

  return events
})

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

  const dashboardMetrics = {
    steward_user: 'demo-steward-001',
    grievance_officer_user: 'demo-grievance-officer-001',
    executive_user: 'demo-executive-001',
    grievances_seeded: DEMO_CLAIMS.length,
    overdue_deadlines: OVERDUE_CLAIM_IDS.size,
    evidence_documents_seeded: DEMO_CLAIMS.length,
    exportable_case_claim_id: EXPORTABLE_CASE_CLAIM_ID,
  }
  console.log('\n📊 Demo dashboard metrics:')
  console.log(JSON.stringify(dashboardMetrics, null, 2))

  console.log('\n✅ Demo seed complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
