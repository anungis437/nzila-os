/**
 * UnionEyes — Org-Scoped Table Registry
 *
 * NzilaOS PR-UE-03: Mirrors packages/db/src/org-registry.ts for UE's local schema.
 *
 * UE tables use `org_id` (not `org_id` like the shared package schema).
 * This registry tracks which UE tables are org-scoped and must be filtered
 * by orgId in all queries.
 *
 * Contract test: tooling/contract-tests/ue-org-scoped-registry.test.ts
 *
 * @invariant INV-33: UE org-scoped table registry consistency
 */

/**
 * UE tables that have an `org_id` column and MUST be org-filtered.
 * Any query against these tables MUST include a WHERE org_id = ? clause
 * or be executed inside withRLSContext().
 */
export const UE_ORG_SCOPED_TABLES = [
  // Recognition & Rewards
  'recognition_programs',
  'recognition_award_types',
  'recognition_awards',
  'reward_wallet_ledger',
  'reward_budget_envelopes',
  'reward_redemptions',
  // Dues & Finance
  'dues_rules',
  'dues_transactions',
  'donations',
  'stipend_disbursements',
  'strike_funds',
  'employer_remittances',
  'arrears',
  // Governance
  'grievances',
  'grievance_workflows',
  'arbitration_precedents',
  'cba_clauses',
  // Communication
  'notification_queue',
  'notification_templates',
  'newsletter_campaigns',
  'sms_messages',
  // Surveys & Voting
  'surveys',
  'survey_responses',
  'votes',
  'voting_sessions',
  // Calendar & Documents
  'calendar_events',
  'documents',
  // Organization
  'organization_members',
  'organizations',
] as const;

/**
 * UE tables that are intentionally NOT org-scoped:
 * - Global reference tables
 * - User identity tables (scoped by user_id, not org_id)
 * - System configuration tables
 */
export const UE_NON_ORG_SCOPED_TABLES = [
  { table: 'users', reason: 'Global user identity — scoped by user_id' },
  { table: 'user_profiles', reason: 'User profile data — scoped by user_id' },
  { table: 'push_subscriptions', reason: 'User device tokens — scoped by user_id' },
  { table: 'feature_flags', reason: 'Global feature flag definitions' },
  { table: 'ab_tests', reason: 'Global A/B test definitions' },
  { table: 'system_settings', reason: 'Global system configuration' },
  { table: 'audit_logs', reason: 'Immutable audit trail — cross-org for compliance' },
  { table: 'hash_chain_entries', reason: 'Immutable hash chain — cross-org for compliance' },
] as const;

export type UEOrgScopedTableName = (typeof UE_ORG_SCOPED_TABLES)[number];

export const UE_ORG_SCOPED_TABLE_SET = new Set<string>(UE_ORG_SCOPED_TABLES);
export const UE_NON_ORG_SCOPED_TABLE_SET = new Set<string>(
  UE_NON_ORG_SCOPED_TABLES.map((t) => t.table),
);
