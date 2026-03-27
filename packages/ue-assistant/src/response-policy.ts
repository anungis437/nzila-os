/**
 * @nzila/ue-assistant — Response Policy Engine (Phase 6)
 *
 * Determines the appropriate response type for each (role + intent)
 * combination. Ensures members get guided responses, stewards get
 * analytical outputs, and escalation is triggered when needed.
 */
import {
  ResponseTypes,
  type ResponseType,
  type UEAssistantRole,
  type IntentType,
  UEAssistantRoles,
  IntentTypes,
} from './types'

// ── Response Policy Matrix ──────────────────────────────────────────────────

type PolicyKey = `${UEAssistantRole}:${IntentType}`

const RESPONSE_POLICIES: Record<string, ResponseType> = {
  // Member policies — guided mode
  [`${UEAssistantRoles.MEMBER}:${IntentTypes.GRIEVANCE}`]: ResponseTypes.GUIDED_STEPS,
  [`${UEAssistantRoles.MEMBER}:${IntentTypes.RIGHTS}`]: ResponseTypes.CITED_EXPLANATION,
  [`${UEAssistantRoles.MEMBER}:${IntentTypes.CONTRACT}`]: ResponseTypes.CITED_EXPLANATION,
  [`${UEAssistantRoles.MEMBER}:${IntentTypes.SAFETY}`]: ResponseTypes.GUIDED_STEPS,
  [`${UEAssistantRoles.MEMBER}:${IntentTypes.BENEFITS}`]: ResponseTypes.DIRECT_ANSWER,
  [`${UEAssistantRoles.MEMBER}:${IntentTypes.VOTING}`]: ResponseTypes.GUIDED_STEPS,
  [`${UEAssistantRoles.MEMBER}:${IntentTypes.EDUCATION}`]: ResponseTypes.DIRECT_ANSWER,
  [`${UEAssistantRoles.MEMBER}:${IntentTypes.NAVIGATION}`]: ResponseTypes.DIRECT_ANSWER,
  [`${UEAssistantRoles.MEMBER}:${IntentTypes.UNKNOWN}`]: ResponseTypes.CLARIFICATION_REQUIRED,

  // Steward policies — analytical mode
  [`${UEAssistantRoles.STEWARD}:${IntentTypes.GRIEVANCE}`]: ResponseTypes.ANALYTICAL_OUTPUT,
  [`${UEAssistantRoles.STEWARD}:${IntentTypes.RIGHTS}`]: ResponseTypes.CITED_EXPLANATION,
  [`${UEAssistantRoles.STEWARD}:${IntentTypes.CONTRACT}`]: ResponseTypes.CITED_EXPLANATION,
  [`${UEAssistantRoles.STEWARD}:${IntentTypes.SAFETY}`]: ResponseTypes.GUIDED_STEPS,
  [`${UEAssistantRoles.STEWARD}:${IntentTypes.BENEFITS}`]: ResponseTypes.CITED_EXPLANATION,
  [`${UEAssistantRoles.STEWARD}:${IntentTypes.VOTING}`]: ResponseTypes.DIRECT_ANSWER,
  [`${UEAssistantRoles.STEWARD}:${IntentTypes.EDUCATION}`]: ResponseTypes.DIRECT_ANSWER,
  [`${UEAssistantRoles.STEWARD}:${IntentTypes.NAVIGATION}`]: ResponseTypes.DIRECT_ANSWER,
  [`${UEAssistantRoles.STEWARD}:${IntentTypes.CASE_ANALYSIS}`]: ResponseTypes.ANALYTICAL_OUTPUT,
  [`${UEAssistantRoles.STEWARD}:${IntentTypes.DRAFTING}`]: ResponseTypes.ANALYTICAL_OUTPUT,
  [`${UEAssistantRoles.STEWARD}:${IntentTypes.UNKNOWN}`]: ResponseTypes.CLARIFICATION_REQUIRED,

  // Local admin policies — operational mode
  [`${UEAssistantRoles.LOCAL_ADMIN}:${IntentTypes.GRIEVANCE}`]: ResponseTypes.ANALYTICAL_OUTPUT,
  [`${UEAssistantRoles.LOCAL_ADMIN}:${IntentTypes.RIGHTS}`]: ResponseTypes.CITED_EXPLANATION,
  [`${UEAssistantRoles.LOCAL_ADMIN}:${IntentTypes.CONTRACT}`]: ResponseTypes.CITED_EXPLANATION,
  [`${UEAssistantRoles.LOCAL_ADMIN}:${IntentTypes.SAFETY}`]: ResponseTypes.GUIDED_STEPS,
  [`${UEAssistantRoles.LOCAL_ADMIN}:${IntentTypes.BENEFITS}`]: ResponseTypes.CITED_EXPLANATION,
  [`${UEAssistantRoles.LOCAL_ADMIN}:${IntentTypes.VOTING}`]: ResponseTypes.DIRECT_ANSWER,
  [`${UEAssistantRoles.LOCAL_ADMIN}:${IntentTypes.EDUCATION}`]: ResponseTypes.DIRECT_ANSWER,
  [`${UEAssistantRoles.LOCAL_ADMIN}:${IntentTypes.NAVIGATION}`]: ResponseTypes.DIRECT_ANSWER,
  [`${UEAssistantRoles.LOCAL_ADMIN}:${IntentTypes.CASE_ANALYSIS}`]: ResponseTypes.ANALYTICAL_OUTPUT,
  [`${UEAssistantRoles.LOCAL_ADMIN}:${IntentTypes.DRAFTING}`]: ResponseTypes.ANALYTICAL_OUTPUT,
  [`${UEAssistantRoles.LOCAL_ADMIN}:${IntentTypes.OVERSIGHT}`]: ResponseTypes.ANALYTICAL_OUTPUT,
  [`${UEAssistantRoles.LOCAL_ADMIN}:${IntentTypes.UNKNOWN}`]: ResponseTypes.CLARIFICATION_REQUIRED,

  // Parent admin policies — governance mode
  [`${UEAssistantRoles.PARENT_ADMIN}:${IntentTypes.GRIEVANCE}`]: ResponseTypes.ANALYTICAL_OUTPUT,
  [`${UEAssistantRoles.PARENT_ADMIN}:${IntentTypes.RIGHTS}`]: ResponseTypes.CITED_EXPLANATION,
  [`${UEAssistantRoles.PARENT_ADMIN}:${IntentTypes.CONTRACT}`]: ResponseTypes.CITED_EXPLANATION,
  [`${UEAssistantRoles.PARENT_ADMIN}:${IntentTypes.SAFETY}`]: ResponseTypes.GUIDED_STEPS,
  [`${UEAssistantRoles.PARENT_ADMIN}:${IntentTypes.BENEFITS}`]: ResponseTypes.CITED_EXPLANATION,
  [`${UEAssistantRoles.PARENT_ADMIN}:${IntentTypes.VOTING}`]: ResponseTypes.DIRECT_ANSWER,
  [`${UEAssistantRoles.PARENT_ADMIN}:${IntentTypes.EDUCATION}`]: ResponseTypes.DIRECT_ANSWER,
  [`${UEAssistantRoles.PARENT_ADMIN}:${IntentTypes.NAVIGATION}`]: ResponseTypes.DIRECT_ANSWER,
  [`${UEAssistantRoles.PARENT_ADMIN}:${IntentTypes.CASE_ANALYSIS}`]: ResponseTypes.ANALYTICAL_OUTPUT,
  [`${UEAssistantRoles.PARENT_ADMIN}:${IntentTypes.DRAFTING}`]: ResponseTypes.ANALYTICAL_OUTPUT,
  [`${UEAssistantRoles.PARENT_ADMIN}:${IntentTypes.OVERSIGHT}`]: ResponseTypes.ANALYTICAL_OUTPUT,
  [`${UEAssistantRoles.PARENT_ADMIN}:${IntentTypes.UNKNOWN}`]: ResponseTypes.CLARIFICATION_REQUIRED,
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Determine the response type for a given role and intent.
 */
export function determineResponseType(
  role: UEAssistantRole,
  intent: IntentType,
): ResponseType {
  const key: PolicyKey = `${role}:${intent}`
  return RESPONSE_POLICIES[key] ?? ResponseTypes.CLARIFICATION_REQUIRED
}

/**
 * Check if a response type requires citations.
 */
export function requiresCitations(responseType: ResponseType): boolean {
  return (
    responseType === ResponseTypes.CITED_EXPLANATION ||
    responseType === ResponseTypes.ANALYTICAL_OUTPUT
  )
}

/**
 * Check if the response should include actionable steps.
 */
export function includesSteps(responseType: ResponseType): boolean {
  return responseType === ResponseTypes.GUIDED_STEPS
}

/**
 * Check if the response is analytical (steward/admin level).
 */
export function isAnalytical(responseType: ResponseType): boolean {
  return responseType === ResponseTypes.ANALYTICAL_OUTPUT
}
