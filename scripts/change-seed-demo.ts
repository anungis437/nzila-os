/**
 * change-seed-demo.ts — Seed demo change records
 *
 * Usage: pnpm exec tsx scripts/change-seed-demo.ts
 *
 * Creates 5 demo change records in ops/change-records/:
 *   1. Standard change (auto-approved)
 *   2. Normal approved change
 *   3. Emergency change
 *   4. Pending approval change
 *   5. Change with PIR completed
 */
import { saveChangeRecord, generateChangeId, nowISO } from '@nzila/platform-change-management'
import type { ChangeRecord } from '@nzila/platform-change-management/types'

const now = new Date()
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

const records: ChangeRecord[] = [
  // 1. Standard change — auto-approved, currently in window
  {
    change_id: 'CHG-2026-0001',
    title: 'Update UI component library to v4.2',
    description: 'Routine update of the shared UI package to latest stable. Low risk, pre-tested.',
    service: 'web',
    environment: 'STAGING',
    change_type: 'STANDARD',
    risk_level: 'LOW',
    impact_summary: 'Minor visual updates. No breaking changes.',
    requested_by: 'dev-team',
    approvers_required: [],
    approved_by: [],
    approval_status: 'APPROVED',
    implementation_window_start: oneHourAgo,
    implementation_window_end: twoHoursFromNow,
    rollback_plan: 'Revert to previous UI package version via pnpm.',
    test_evidence_refs: ['evidence/ui-regression-2026-03-12.json'],
    linked_prs: ['#1042'],
    linked_commits: ['abc1234'],
    status: 'SCHEDULED',
    created_at: twoDaysAgo,
    updated_at: yesterday,
  },

  // 2. Normal approved change — production deployment
  {
    change_id: 'CHG-2026-0002',
    title: 'Deploy union-eyes v2.8 to production',
    description: 'Production release of union-eyes with governance improvements and new voting module.',
    service: 'union-eyes',
    environment: 'PROD',
    change_type: 'NORMAL',
    risk_level: 'MEDIUM',
    impact_summary: 'New voting features. Existing functionality preserved. Backward-compatible DB migrations.',
    requested_by: 'platform-lead',
    approvers_required: ['service_owner', 'change_manager'],
    approved_by: ['service_owner', 'change_manager'],
    approval_status: 'APPROVED',
    implementation_window_start: oneDayFromNow,
    implementation_window_end: twoDaysFromNow,
    rollback_plan: 'Rollback container image to v2.7 tag. Revert DB migration if needed.',
    test_evidence_refs: ['evidence/union-eyes-e2e-2026-03-11.json', 'evidence/contract-tests-latest.json'],
    linked_prs: ['#1050', '#1051'],
    linked_commits: ['def5678', 'ghi9012'],
    linked_build_attestation: 'attestation/union-eyes-v2.8.json',
    status: 'APPROVED',
    created_at: twoDaysAgo,
    updated_at: yesterday,
  },

  // 3. Emergency change
  {
    change_id: 'CHG-2026-0003',
    title: 'Emergency hotfix: Fix authentication bypass in console',
    description: 'Critical security fix for authentication bypass vulnerability discovered in production.',
    service: 'console',
    environment: 'PROD',
    change_type: 'EMERGENCY',
    risk_level: 'CRITICAL',
    impact_summary: 'Security patch. No feature changes. Must deploy immediately.',
    requested_by: 'security-team',
    approvers_required: ['service_owner'],
    approved_by: ['service_owner'],
    approval_status: 'APPROVED',
    implementation_window_start: oneHourAgo,
    implementation_window_end: twoHoursFromNow,
    rollback_plan: 'Revert to previous container image. Enable WAF rule to block exploit path.',
    test_evidence_refs: ['evidence/security-patch-verification.json'],
    linked_prs: ['#1055'],
    linked_commits: ['sec7890'],
    status: 'IMPLEMENTING',
    created_at: oneHourAgo,
    updated_at: nowISO(),
  },

  // 4. Pending approval change
  {
    change_id: 'CHG-2026-0004',
    title: 'Deploy partners portal v3.1 to staging',
    description: 'New partner onboarding flow with improved KYC integration.',
    service: 'partners',
    environment: 'STAGING',
    change_type: 'NORMAL',
    risk_level: 'HIGH',
    impact_summary: 'New partner onboarding flow. Requires security review due to KYC data handling.',
    requested_by: 'product-team',
    approvers_required: ['service_owner', 'change_manager', 'security_approver'],
    approved_by: ['service_owner'],
    approval_status: 'PENDING',
    implementation_window_start: oneDayFromNow,
    implementation_window_end: twoDaysFromNow,
    rollback_plan: 'Revert to partners v3.0 container image.',
    test_evidence_refs: ['evidence/partners-e2e-2026-03-12.json'],
    linked_prs: ['#1060'],
    linked_commits: ['par3456'],
    status: 'UNDER_REVIEW',
    created_at: yesterday,
    updated_at: nowISO(),
  },

  // 5. Completed change with PIR
  {
    change_id: 'CHG-2026-0005',
    title: 'Database migration: Add audit columns to transactions table',
    description: 'Schema migration adding created_by and updated_by audit columns.',
    service: 'console',
    environment: 'PROD',
    change_type: 'NORMAL',
    risk_level: 'MEDIUM',
    impact_summary: 'Schema change. No application downtime. Backward compatible.',
    requested_by: 'data-team',
    approvers_required: ['service_owner', 'change_manager'],
    approved_by: ['service_owner', 'change_manager'],
    approval_status: 'APPROVED',
    implementation_window_start: twoDaysAgo,
    implementation_window_end: yesterday,
    rollback_plan: 'Drop new columns via reverse migration script.',
    test_evidence_refs: ['evidence/db-migration-test-2026-03-10.json'],
    linked_prs: ['#1035'],
    linked_commits: ['mig1234'],
    linked_build_attestation: 'attestation/console-db-migration.json',
    status: 'COMPLETED',
    created_at: twoDaysAgo,
    updated_at: yesterday,
    completed_at: yesterday,
    post_implementation_review: {
      outcome: 'SUCCESS',
      incidents_triggered: false,
      incident_refs: [],
      observations: 'Migration completed successfully. All queries performing within SLO thresholds. No data integrity issues detected.',
    },
  },
]

// ── Write records ───────────────────────────────────────────────────────────

console.log('\n📋 Seeding demo change records...\n')

for (const record of records) {
  try {
    saveChangeRecord(record)
    console.log(`  ✅ ${record.change_id} — ${record.title}`)
  } catch (err) {
    console.error(`  ❌ ${record.change_id} — ${(err as Error).message}`)
  }
}

console.log(`\n✅ Seeded ${records.length} change records to ops/change-records/\n`)
