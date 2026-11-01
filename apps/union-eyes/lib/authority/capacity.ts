/**
 * Role → Capacity mapping for the Authority Kernel.
 *
 * This is an EXPLICIT table. It deliberately does not consult ROLE_HIERARCHY or
 * any numeric level: a higher role does not imply a lower role's capacity, and
 * no role implies authority. A capacity only makes a principal ELIGIBLE to hold
 * an authority; the authority itself must come from a relationship, mandate,
 * delegation, consent or emergency grant.
 *
 * Platform (Nzila), federation and national roles map to NO customer-organization
 * capacity. Federation and national officials act in a customer organization only
 * through an explicit mandate scoped to that organization (UE-GOVERNANCE-OFFICER
 * §XII: seniority never authorizes raw access to local records).
 *
 * Unknown roles map to no capacity (fail closed).
 */
import type { Capacity } from './ontology'

const MEMBER: Capacity[] = ['member']

/**
 * Customer-organization role names, as stored in organization_members.role.
 * Each lists ONLY the capacities that role is eligible for. Note that `admin`
 * (organization administrator) is an operations role, not a representation,
 * financial or governance capacity.
 */
export const ROLE_CAPACITIES: Readonly<Record<string, readonly Capacity[]>> = {
  member: MEMBER,
  health_safety_rep: ['member', 'steward'],
  bargaining_committee: ['member', 'steward'],
  steward: ['member', 'steward'],
  officer: ['member', 'officer'],
  chief_steward: ['member', 'steward', 'chief_steward'],
  secretary_treasurer: ['member', 'officer', 'executive', 'financial_officer'],
  vice_president: ['member', 'officer', 'executive'],
  president: ['member', 'officer', 'executive'],
  // Organization administrator: administers the tenant; no case, money or
  // governance capacity by virtue of the title.
  admin: ['member'],
}

/**
 * Roles that belong to the platform operator, federations or national bodies.
 * They are listed (not merely absent) so a test can assert they confer nothing
 * inside a customer organization.
 */
export const NON_CUSTOMER_AUTHORITY_ROLES: readonly string[] = [
  'app_owner',
  'coo',
  'cto',
  'platform_lead',
  'customer_success_director',
  'support_manager',
  'data_analytics_manager',
  'billing_manager',
  'integration_manager',
  'compliance_manager',
  'security_manager',
  'support_agent',
  'data_analyst',
  'billing_specialist',
  'integration_specialist',
  'content_manager',
  'training_coordinator',
  'system_admin',
  'clc_executive',
  'clc_staff',
  'fed_executive',
  'fed_staff',
  'national_officer',
]

/** Capacities for a stored role. Unknown or non-customer roles yield none. */
export function capacitiesForRole(role: string | null | undefined): readonly Capacity[] {
  if (!role) return []
  const key = role.toLowerCase()
  return Object.prototype.hasOwnProperty.call(ROLE_CAPACITIES, key) ? ROLE_CAPACITIES[key] : []
}

/**
 * Capacities that may read, reply, close, or archive a conversation they are assigned to.
 * An organization administrator has only `member` and is absent. Assignment is the relationship;
 * the capacity is eligibility, not a tenant-wide read.
 */
export const CONVERSATION_ASSIGNEE_CAPACITIES: readonly Capacity[] = ['steward', 'chief_steward', 'officer', 'executive']

/** True when the stored role carries one of the conversation-assignee capacities. */
export function conversationAssigneeEligible(role: string | null | undefined): boolean {
  const capacities = capacitiesForRole(role)
  return CONVERSATION_ASSIGNEE_CAPACITIES.some((capacity) => capacities.includes(capacity))
}

/**
 * Stored role names that conversationAssigneeEligible accepts, sorted for a stable SQL predicate.
 * health_safety_rep and bargaining_committee are included because the capacity table gives them
 * steward. union_rep, staff_rep, national_officer, executive, ceo, governance, and business_agent
 * are absent: they are not in ROLE_CAPACITIES, so they confer nothing.
 */
export const CONVERSATION_ASSIGNEE_ROLES: readonly string[] = Object.keys(ROLE_CAPACITIES)
  .filter((role) => conversationAssigneeEligible(role))
  .sort()

/**
 * Capacities that may be earned only by a recorded appointment, never by role.
 * `auditor`, `trustee`, `governance_reviewer` and `privacy_officer` are bestowed
 * by a mandate; the loader adds them from the mandate's source instrument.
 */
export const APPOINTMENT_ONLY_CAPACITIES: readonly Capacity[] = [
  'auditor',
  'trustee',
  'governance_reviewer',
  'privacy_officer',
]
