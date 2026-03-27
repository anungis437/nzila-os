/**
 * @nzila/ue-assistant — Role Capability System (Phase 1)
 *
 * Defines the capability matrix for each UE role. Every interaction is
 * filtered through role capabilities to enforce intent, tool, and data
 * access boundaries.
 */
import {
  UEAssistantRoles,
  RoleModes,
  IntentTypes,
  ToolNames,
  type UEAssistantRole,
  type RoleCapability,
  type IntentType,
  type ToolName,
} from './types'

// ── Role Capability Definitions ─────────────────────────────────────────────

const ROLE_CAPABILITIES: Record<UEAssistantRole, RoleCapability> = {
  [UEAssistantRoles.MEMBER]: {
    role: UEAssistantRoles.MEMBER,
    mode: RoleModes.GUIDED,
    allowedIntents: [
      IntentTypes.GRIEVANCE,
      IntentTypes.RIGHTS,
      IntentTypes.CONTRACT,
      IntentTypes.SAFETY,
      IntentTypes.BENEFITS,
      IntentTypes.NAVIGATION,
      IntentTypes.VOTING,
      IntentTypes.EDUCATION,
    ],
    allowedTools: [
      ToolNames.OPEN_GRIEVANCE_FORM,
      ToolNames.GET_CASE_STATUS,
      ToolNames.NAVIGATE_TO_PAGE,
      ToolNames.REPORT_SAFETY_ISSUE,
      ToolNames.EXPLAIN_AGREEMENT_SECTION,
    ],
    restrictions: [
      'no_multi_case_access',
      'no_legal_strategy',
      'no_other_user_data',
    ],
    permissions: ['own_cases_only'],
  },

  [UEAssistantRoles.STEWARD]: {
    role: UEAssistantRoles.STEWARD,
    mode: RoleModes.ANALYTICAL,
    allowedIntents: [
      IntentTypes.GRIEVANCE,
      IntentTypes.RIGHTS,
      IntentTypes.CONTRACT,
      IntentTypes.SAFETY,
      IntentTypes.BENEFITS,
      IntentTypes.NAVIGATION,
      IntentTypes.VOTING,
      IntentTypes.EDUCATION,
      IntentTypes.CASE_ANALYSIS,
      IntentTypes.DRAFTING,
    ],
    allowedTools: [
      ToolNames.OPEN_GRIEVANCE_FORM,
      ToolNames.GET_CASE_STATUS,
      ToolNames.NAVIGATE_TO_PAGE,
      ToolNames.ANALYZE_CASE,
      ToolNames.SUMMARIZE_CASE,
      ToolNames.MAP_TO_CONTRACT_CLAUSES,
      ToolNames.DRAFT_GRIEVANCE,
      ToolNames.SUGGEST_NEXT_STEPS,
      ToolNames.REPORT_SAFETY_ISSUE,
      ToolNames.EXPLAIN_AGREEMENT_SECTION,
    ],
    restrictions: [
      'must_cite_sources',
      'no_unverified_legal_claims',
    ],
    permissions: ['assigned_cases_only'],
  },

  [UEAssistantRoles.LOCAL_ADMIN]: {
    role: UEAssistantRoles.LOCAL_ADMIN,
    mode: RoleModes.OPERATIONAL,
    allowedIntents: [
      IntentTypes.GRIEVANCE,
      IntentTypes.RIGHTS,
      IntentTypes.CONTRACT,
      IntentTypes.SAFETY,
      IntentTypes.BENEFITS,
      IntentTypes.NAVIGATION,
      IntentTypes.VOTING,
      IntentTypes.EDUCATION,
      IntentTypes.CASE_ANALYSIS,
      IntentTypes.DRAFTING,
      IntentTypes.OVERSIGHT,
    ],
    allowedTools: [
      ToolNames.OPEN_GRIEVANCE_FORM,
      ToolNames.GET_CASE_STATUS,
      ToolNames.NAVIGATE_TO_PAGE,
      ToolNames.ANALYZE_CASE,
      ToolNames.SUMMARIZE_CASE,
      ToolNames.MAP_TO_CONTRACT_CLAUSES,
      ToolNames.DRAFT_GRIEVANCE,
      ToolNames.SUGGEST_NEXT_STEPS,
      ToolNames.REPORT_SAFETY_ISSUE,
      ToolNames.EXPLAIN_AGREEMENT_SECTION,
      ToolNames.CASE_DASHBOARD_INSIGHTS,
      ToolNames.WORKLOAD_ANALYSIS,
    ],
    restrictions: [
      'must_cite_sources',
      'no_unverified_legal_claims',
      'local_scope_only',
    ],
    permissions: ['local_cases_all', 'local_reporting'],
  },

  [UEAssistantRoles.PARENT_ADMIN]: {
    role: UEAssistantRoles.PARENT_ADMIN,
    mode: RoleModes.GOVERNANCE,
    allowedIntents: [
      IntentTypes.GRIEVANCE,
      IntentTypes.RIGHTS,
      IntentTypes.CONTRACT,
      IntentTypes.SAFETY,
      IntentTypes.BENEFITS,
      IntentTypes.NAVIGATION,
      IntentTypes.VOTING,
      IntentTypes.EDUCATION,
      IntentTypes.CASE_ANALYSIS,
      IntentTypes.DRAFTING,
      IntentTypes.OVERSIGHT,
    ],
    allowedTools: [
      ToolNames.OPEN_GRIEVANCE_FORM,
      ToolNames.GET_CASE_STATUS,
      ToolNames.NAVIGATE_TO_PAGE,
      ToolNames.ANALYZE_CASE,
      ToolNames.SUMMARIZE_CASE,
      ToolNames.MAP_TO_CONTRACT_CLAUSES,
      ToolNames.DRAFT_GRIEVANCE,
      ToolNames.SUGGEST_NEXT_STEPS,
      ToolNames.REPORT_SAFETY_ISSUE,
      ToolNames.EXPLAIN_AGREEMENT_SECTION,
      ToolNames.CASE_DASHBOARD_INSIGHTS,
      ToolNames.WORKLOAD_ANALYSIS,
      ToolNames.AGGREGATE_INSIGHTS,
      ToolNames.TREND_ANALYSIS,
    ],
    restrictions: [
      'must_cite_sources',
      'no_unverified_legal_claims',
    ],
    permissions: ['cross_local_access', 'governance_reporting'],
  },
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getRoleCapability(role: UEAssistantRole): RoleCapability {
  const capability = ROLE_CAPABILITIES[role]
  if (!capability) {
    throw new Error(`Unknown role: ${role}`)
  }
  return capability
}

export function isIntentAllowed(
  role: UEAssistantRole,
  intent: IntentType,
): boolean {
  const capability = getRoleCapability(role)
  return capability.allowedIntents.includes(intent)
}

export function isToolAllowed(
  role: UEAssistantRole,
  tool: ToolName,
): boolean {
  const capability = getRoleCapability(role)
  return capability.allowedTools.includes(tool)
}

export function getRoleMode(role: UEAssistantRole): string {
  return getRoleCapability(role).mode
}

export function getRoleRestrictions(role: UEAssistantRole): readonly string[] {
  return getRoleCapability(role).restrictions
}

export function hasPermission(
  role: UEAssistantRole,
  permission: string,
): boolean {
  return getRoleCapability(role).permissions.includes(permission)
}

export function getAllRoleCapabilities(): Record<
  UEAssistantRole,
  RoleCapability
> {
  return { ...ROLE_CAPABILITIES }
}
