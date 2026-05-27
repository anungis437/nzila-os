/**
 * decision-seed-demo.ts — Seed demo decision records
 *
 * Usage: pnpm exec tsx scripts/decision-seed-demo.ts
 *
 * Creates 5 demo decision records in ops/decisions/:
 *   1. Grievance backlog spike (STAFFING / HIGH)
 *   2. Financial irregularity (FINANCIAL / CRITICAL)
 *   3. Pricing outlier (FINANCIAL / MEDIUM)
 *   4. Partner performance drop (PARTNER / HIGH)
 *   5. High-risk deployment (DEPLOYMENT / HIGH)
 */
import { saveDecisionRecord, generateDecisionId, nowISO, ENGINE_VERSION } from '@nzila/platform-decision-engine'
import type { DecisionRecord } from '@nzila/platform-decision-engine'

const now = new Date()
const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

const records: DecisionRecord[] = [
  // 1. Grievance backlog spike — union-eyes
  {
    decision_id: generateDecisionId(),
    org_id: 'nzila-demo',
    category: 'STAFFING',
    type: 'RECOMMENDATION',
    severity: 'HIGH',
    title: 'Grievance backlog spike in union-eyes',
    summary: 'Detected 3.2x above expected for grievance_backlog_count',
    explanation: 'Grievance submissions jumped 320% above baseline in the past 24 hours. This correlates with recent policy changes affecting member benefits.',
    confidence_score: 0.78,
    generated_by: { source: 'rules', engine_version: ENGINE_VERSION },
    evidence_refs: [
      { type: 'anomaly', ref_id: 'ANO-001', summary: 'grievance_spike: 3.2x deviation on grievance_backlog_count' },
      { type: 'metric', ref_id: 'SIG-001', summary: 'spike on grievance_backlog in union-eyes (220% deviation)' },
    ],
    recommended_actions: [
      'Allocate additional grievance handlers from reserve pool',
      'Review grievance queue for patterns',
      'Consider temporary staff allocation',
    ],
    required_approvals: [],
    review_required: true,
    policy_context: { execution_allowed: true, reasons: [] },
    environment_context: { environment: 'STAGING', protected_environment: true },
    status: 'PENDING_REVIEW',
    generated_at: twoHoursAgo,
    expires_at: oneWeekFromNow,
  },

  // 2. Financial irregularity — cfo
  {
    decision_id: generateDecisionId(),
    org_id: 'nzila-demo',
    category: 'FINANCIAL',
    type: 'ESCALATION',
    severity: 'CRITICAL',
    title: 'Financial irregularity in cfo',
    summary: 'Budget metric revenue_variance deviated 4.1x from expected',
    explanation: 'Revenue variance exceeded all thresholds. Multiple cost centres show unexplained deviations that require immediate audit.',
    confidence_score: 0.92,
    generated_by: { source: 'rules', engine_version: ENGINE_VERSION },
    evidence_refs: [
      { type: 'anomaly', ref_id: 'ANO-002', summary: 'financial_irregularity: 4.1x deviation on revenue_variance' },
    ],
    recommended_actions: [
      'Investigate revenue variance root cause',
      'Review budget allocations',
      'Audit recent transactions',
      'Escalate to CFO for review',
    ],
    required_approvals: ['finance-admin', 'platform-admin'],
    review_required: true,
    policy_context: { execution_allowed: false, reasons: ['Protected environment', 'Critical severity — escalation required'] },
    environment_context: { environment: 'PRODUCTION', protected_environment: true },
    status: 'GENERATED',
    generated_at: sixHoursAgo,
    expires_at: oneWeekFromNow,
  },

  // 3. Pricing outlier — shop-quoter
  {
    decision_id: generateDecisionId(),
    org_id: 'nzila-demo',
    category: 'FINANCIAL',
    type: 'REVIEW_REQUEST',
    severity: 'MEDIUM',
    title: 'Pricing outlier detected in shop-quoter',
    summary: 'Pricing for unit_cost deviated 2.3x from expected range',
    explanation: 'Quotation unit costs in the building materials category are 130% above supplier benchmark. May indicate stale supplier rates or data entry error.',
    confidence_score: 0.65,
    generated_by: { source: 'rules', engine_version: ENGINE_VERSION },
    evidence_refs: [
      { type: 'anomaly', ref_id: 'ANO-003', summary: 'pricing_outlier: 2.3x deviation on unit_cost' },
    ],
    recommended_actions: [
      'Review pricing model for building materials',
      'Validate supplier rates',
      'Compare with historical pricing data',
    ],
    required_approvals: [],
    review_required: false,
    policy_context: { execution_allowed: true, reasons: [] },
    environment_context: { environment: 'STAGING', protected_environment: true },
    status: 'APPROVED',
    generated_at: oneDayAgo,
    expires_at: oneWeekFromNow,
    reviewed_by: ['procurement-lead'],
    review_notes: ['Confirmed as data entry error — supplier rates updated.'],
  },

  // 4. Partner performance drop — partners
  {
    decision_id: generateDecisionId(),
    org_id: 'nzila-demo',
    category: 'PARTNER',
    type: 'RECOMMENDATION',
    severity: 'HIGH',
    title: 'Partner performance drop — delivery_sla_compliance',
    summary: 'Partner performance metric dropped 2.8x below baseline',
    explanation: 'Three partners in the logistics tier dropped below 60% SLA compliance this month. Historical trend shows progressive decline over 3 months.',
    confidence_score: 0.81,
    generated_by: { source: 'rules', engine_version: ENGINE_VERSION },
    evidence_refs: [
      { type: 'anomaly', ref_id: 'ANO-004', summary: 'partner_performance_drop: 2.8x deviation on delivery_sla_compliance' },
      { type: 'insight', ref_id: 'INS-001', summary: 'compliance: SLA compliance declining across logistics partners' },
    ],
    recommended_actions: [
      'Schedule partner review meetings',
      'Assess contract SLAs',
      'Consider backup logistics providers',
    ],
    required_approvals: [],
    review_required: true,
    policy_context: { execution_allowed: true, reasons: [] },
    environment_context: { environment: 'STAGING', protected_environment: true },
    status: 'PENDING_REVIEW',
    generated_at: twoHoursAgo,
    expires_at: oneWeekFromNow,
  },

  // 5. High-risk deployment — platform
  {
    decision_id: generateDecisionId(),
    org_id: 'nzila-demo',
    category: 'DEPLOYMENT',
    type: 'REVIEW_REQUEST',
    severity: 'HIGH',
    title: 'High-risk deployment: Deploy union-eyes v3.0 to production',
    summary: 'Change CHG-2026-0010 is high-risk targeting production',
    explanation: 'Major version upgrade with database migrations and new authentication flow. Impact: all union-eyes users, estimated 2-hour maintenance window.',
    confidence_score: 0.85,
    generated_by: { source: 'rules', engine_version: ENGINE_VERSION },
    evidence_refs: [
      { type: 'change', ref_id: 'CHG-2026-0010', summary: 'Deploy union-eyes v3.0 to production' },
    ],
    recommended_actions: [
      'Ensure rollback plan',
      'Verify staging validation',
      'Schedule maintenance window',
      'Notify affected users',
    ],
    required_approvals: ['platform-admin', 'service-owner'],
    review_required: true,
    policy_context: { execution_allowed: false, reasons: ['Protected environment — manual approval required'] },
    environment_context: { environment: 'PRODUCTION', protected_environment: true },
    status: 'GENERATED',
    generated_at: nowISO(),
    expires_at: oneWeekFromNow,
  },
]

console.log('Seeding demo decisions...')
for (const record of records) {
  saveDecisionRecord(record)
  console.log(`  ✓ ${record.decision_id} — ${record.title}`)
}
console.log(`\nSeeded ${records.length} decision records in ops/decisions/`)
