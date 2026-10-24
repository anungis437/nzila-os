import type { PgTable } from 'drizzle-orm/pg-core'
import { getTableName } from 'drizzle-orm'
import { ApiError } from '@/lib/api/errors'

/**
 * Generic CRUD routes authorise by organization and role floor only. A role floor is eligibility, never authority
 * (UE-CONV-K-007): it cannot decide who may read another member's case, change an identity, move money, alter a
 * consent or touch a credential. Each table behind a generic route is therefore classified explicitly:
 *
 * - DENIED         no generic read or write; a dedicated, authority-checked route is the only path.
 * - SUBJECT_OWNED  the data subject's own record only: usable solely when the route declares an owner column, so the
 *                   subject can read and act on their own row and nobody else can reach it.
 * - OWN_ROWS_READ  reads are limited to the caller's own rows at every role; writes refused.
 * - READ_ONLY      reads keep the existing tenant and low-role rules; writes refused.
 * - OPERATIONAL    ordinary operational records; role floor and tenant scope apply, and writes are audited.
 *
 * A table that is not listed is treated as DENIED, so adding a generic route over a new table forces a decision.
 */
export type CrudGovernanceClass = 'DENIED' | 'SUBJECT_OWNED' | 'OWN_ROWS_READ' | 'READ_ONLY' | 'OPERATIONAL'

const SUBJECT_OWNED = ['data_subject_access_requests', 'user_consents', 'consent_records'] as const

const DENIED = [
  'documents', 'integration_api_keys', 'oauth_providers',
  'external_accounts', 'security_events', 'poll_votes', 'wcb_claims', 'member_employment', 'pending_profiles',
] as const

const OWN_ROWS_READ = ['grievances', 'claims', 'claim_deadlines'] as const

const READ_ONLY = [
  'organization_members', 'organizations', 'profiles', 'steward_assignments', 'per_capita_remittances', 'dues_transactions',
  'external_invoices', 'polls', 'federations', 'data_classification_policy',
] as const

const OPERATIONAL = [
  'analytics_metrics', 'anti_scab_violations', 'arbitration_decisions', 'arbitration_precedents', 'arbitrations', 'bargaining_notes',
  'bargaining_proposals', 'bargaining_units', 'break_policies', 'calendar_events', 'calendars', 'campaigns', 'case_studies',
  'cba_clauses', 'clc_sync_log', 'cms_media_library', 'cms_pages', 'cnesst_filings', 'committees', 'communication_preferences',
  'course_registrations', 'course_sessions', 'donation_campaigns', 'employers', 'external_calendar_connections', 'hazard_reports',
  'in_app_notifications', 'insight_recommendations', 'joint_hs_committees', 'kpi_configurations', 'meeting_rooms', 'member_breaks',
  'member_certifications', 'member_segments', 'message_templates', 'ml_predictions', 'negotiations', 'newsletter_distribution_lists',
  'notifications', 'organizer_tasks', 'organizing_campaigns', 'pay_equity_exercises', 'pilot_applications', 'ppe_equipment',
  'preventive_withdrawals', 'push_devices', 'push_notifications', 'reports', 'right_of_refusal_events', 'safety_inspections',
  'sms_campaigns', 'sms_conversations', 'sms_messages', 'survey_responses', 'surveys', 'testimonials', 'training_courses',
  'training_programs', 'trend_analyses', 'user_notification_preferences', 'wcb_employer_assessments', 'workplace_incidents', 'worksites',
] as const

const POLICY = new Map<string, CrudGovernanceClass>([
  ...DENIED.map((t) => [t, 'DENIED'] as const),
  ...SUBJECT_OWNED.map((t) => [t, 'SUBJECT_OWNED'] as const),
  ...OWN_ROWS_READ.map((t) => [t, 'OWN_ROWS_READ'] as const),
  ...READ_ONLY.map((t) => [t, 'READ_ONLY'] as const),
  ...OPERATIONAL.map((t) => [t, 'OPERATIONAL'] as const),
])

export const CRUD_GOVERNED_TABLES: ReadonlyMap<string, CrudGovernanceClass> = POLICY

export function crudGovernanceFor(table: PgTable): { name: string; class: CrudGovernanceClass } {
  const name = getTableName(table)
  return { name, class: POLICY.get(name) ?? 'DENIED' }
}

const REFUSAL = 'This record type is governed by a dedicated, authority-checked route and is not available through the generic interface.'

export interface CrudGate {
  class: CrudGovernanceClass
  /** The route scopes every read and write to the caller through an owner column. */
  hasOwnerColumn?: boolean
}

export function assertCrudRead(gate: CrudGate): void {
  if (gate.class === 'DENIED' || (gate.class === 'SUBJECT_OWNED' && !gate.hasOwnerColumn)) throw ApiError.forbidden(REFUSAL)
}

export function assertCrudWrite(gate: CrudGate): void {
  if (gate.class === 'SUBJECT_OWNED' && gate.hasOwnerColumn) return
  if (gate.class !== 'OPERATIONAL') throw ApiError.forbidden(REFUSAL)
}
