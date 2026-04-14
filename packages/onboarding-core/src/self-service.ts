/**
 * @nzila/onboarding-core — Self-Service Onboarding
 *
 * Self-service organisation creation, invite flows, and progressive profiling.
 * Pure functions — no I/O, no DB, no side effects.
 *
 * Closes the "onboarding automation" gap:
 *   - Self-service org creation flow
 *   - Invite-link generation & validation
 *   - Progressive profiling (collect data in phases)
 *   - Viral invite tracking for CAC reduction
 *
 * @module @nzila/onboarding-core/self-service
 */

// ── Org Creation Request ────────────────────────────────────────────────────

export interface OrgCreationRequest {
  /** Display name for the new organisation. */
  readonly name: string
  /** Organisation type from the hierarchy model. */
  readonly type: OrgType
  /** Sector classification (e.g., labour, agriculture, finance). */
  readonly sector: string
  /** Jurisdiction (e.g., 'CA-ON', 'CA-BC'). */
  readonly jurisdiction?: string
  /** Optional parent org ID for hierarchical structures. */
  readonly parentOrgId?: string
  /** Actor who initiated the creation. */
  readonly createdBy: string
}

export type OrgType =
  | 'platform'
  | 'congress'
  | 'federation'
  | 'union'
  | 'local'
  | 'region'
  | 'district'

export interface OrgCreationResult {
  readonly orgId: string
  readonly name: string
  readonly type: OrgType
  readonly onboardingFlowId: string
  readonly createdAt: string
}

/**
 * Derive the appropriate onboarding flow ID for an org type.
 *
 * Enterprise orgs get the full flow; locals/districts get a simplified flow.
 */
export function resolveOnboardingFlow(orgType: OrgType): string {
  switch (orgType) {
    case 'congress':
    case 'federation':
      return 'enterprise'
    case 'union':
    case 'region':
      return 'standard'
    case 'local':
    case 'district':
      return 'simplified'
    case 'platform':
      return 'platform-admin'
    default:
      return 'standard'
  }
}

/**
 * Validate an org creation request. Returns error messages or empty array.
 */
export function validateOrgCreation(
  request: OrgCreationRequest,
): readonly string[] {
  const errors: string[] = []

  if (!request.name || request.name.trim().length < 2) {
    errors.push('Organisation name must be at least 2 characters')
  }
  if (request.name && request.name.trim().length > 200) {
    errors.push('Organisation name must be at most 200 characters')
  }
  if (!request.type) {
    errors.push('Organisation type is required')
  }
  if (!request.sector || request.sector.trim().length === 0) {
    errors.push('Sector is required')
  }
  if (!request.createdBy) {
    errors.push('Creator ID is required')
  }

  return errors
}

/**
 * Build an OrgCreationResult from a request (pure computation — caller persists).
 */
export function buildOrgCreation(
  request: OrgCreationRequest,
  generatedOrgId: string,
): OrgCreationResult {
  return {
    orgId: generatedOrgId,
    name: request.name.trim(),
    type: request.type,
    onboardingFlowId: resolveOnboardingFlow(request.type),
    createdAt: new Date().toISOString(),
  }
}

// ── Invite Links ────────────────────────────────────────────────────────────

export type InviteRole = 'admin' | 'member' | 'viewer' | 'contributor'

export interface InviteLink {
  /** Unique invite token. */
  readonly token: string
  /** Organisation being invited to. */
  readonly orgId: string
  /** Role assigned on acceptance. */
  readonly role: InviteRole
  /** Email of the invitee (optional — omit for open links). */
  readonly email?: string
  /** Actor who created the invite. */
  readonly invitedBy: string
  /** ISO-8601 expiration timestamp. */
  readonly expiresAt: string
  /** Max number of uses (0 = unlimited for open links). */
  readonly maxUses: number
  /** Current usage count. */
  readonly usedCount: number
}

export interface CreateInviteInput {
  readonly orgId: string
  readonly role: InviteRole
  readonly email?: string
  readonly invitedBy: string
  /** TTL in hours (default: 72). */
  readonly ttlHours?: number
  readonly maxUses?: number
}

/**
 * Build an invite link structure (pure — caller generates token & persists).
 */
export function buildInviteLink(
  input: CreateInviteInput,
  generatedToken: string,
): InviteLink {
  const ttlHours = input.ttlHours ?? 72
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString()

  return {
    token: generatedToken,
    orgId: input.orgId,
    role: input.role,
    email: input.email,
    invitedBy: input.invitedBy,
    expiresAt,
    maxUses: input.maxUses ?? (input.email ? 1 : 0),
    usedCount: 0,
  }
}

/**
 * Validate whether an invite link can be consumed.
 */
export function validateInviteConsumption(
  invite: InviteLink,
  consumerEmail?: string,
): { valid: true } | { valid: false; reason: string } {
  const now = new Date().toISOString()

  if (invite.expiresAt < now) {
    return { valid: false, reason: 'Invite has expired' }
  }

  if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses) {
    return { valid: false, reason: 'Invite has reached its maximum uses' }
  }

  if (invite.email && consumerEmail && invite.email !== consumerEmail) {
    return { valid: false, reason: 'Invite is restricted to a different email' }
  }

  return { valid: true }
}

// ── Progressive Profiling ───────────────────────────────────────────────────

export type ProfilePhase = 'essential' | 'operational' | 'advanced'

export interface ProfileField {
  readonly key: string
  readonly label: string
  readonly phase: ProfilePhase
  readonly required: boolean
}

/**
 * Default progressive profiling fields.
 * Phase 1 (essential): collected at signup.
 * Phase 2 (operational): collected post-signup, pre-first-use.
 * Phase 3 (advanced): collected after first use (optional, for better experience).
 */
export const DEFAULT_PROFILE_FIELDS: readonly ProfileField[] = [
  // Phase 1: Essential (during signup)
  { key: 'org_name', label: 'Organisation Name', phase: 'essential', required: true },
  { key: 'org_type', label: 'Organisation Type', phase: 'essential', required: true },
  { key: 'admin_email', label: 'Admin Email', phase: 'essential', required: true },
  { key: 'admin_name', label: 'Admin Full Name', phase: 'essential', required: true },

  // Phase 2: Operational (post-signup, before first real use)
  { key: 'sector', label: 'Sector', phase: 'operational', required: true },
  { key: 'jurisdiction', label: 'Jurisdiction', phase: 'operational', required: true },
  { key: 'member_count_estimate', label: 'Estimated Member Count', phase: 'operational', required: false },
  { key: 'primary_use_case', label: 'Primary Use Case', phase: 'operational', required: true },

  // Phase 3: Advanced (after first use, for better experience)
  { key: 'billing_contact', label: 'Billing Contact', phase: 'advanced', required: false },
  { key: 'preferred_apps', label: 'Preferred Apps', phase: 'advanced', required: false },
  { key: 'integration_needs', label: 'Integration Needs', phase: 'advanced', required: false },
  { key: 'referral_source', label: 'How did you hear about us?', phase: 'advanced', required: false },
] as const

/**
 * Get fields for a specific profiling phase.
 */
export function getFieldsForPhase(
  phase: ProfilePhase,
  fields: readonly ProfileField[] = DEFAULT_PROFILE_FIELDS,
): readonly ProfileField[] {
  return fields.filter((f) => f.phase === phase)
}

/**
 * Compute profiling completeness for an org.
 */
export function computeProfileCompleteness(
  collectedKeys: readonly string[],
  fields: readonly ProfileField[] = DEFAULT_PROFILE_FIELDS,
): {
  phase: ProfilePhase
  totalFields: number
  completedFields: number
  percentComplete: number
  nextPhase: ProfilePhase | null
  missingRequired: readonly string[]
} {
  const collected = new Set(collectedKeys)
  const totalFields = fields.length
  const completedFields = fields.filter((f) => collected.has(f.key)).length
  const percentComplete = totalFields > 0
    ? Math.round((completedFields / totalFields) * 100)
    : 100

  const missingRequired = fields
    .filter((f) => f.required && !collected.has(f.key))
    .map((f) => f.key)

  // Determine current phase based on what's filled
  const essentialDone = getFieldsForPhase('essential', fields)
    .filter((f) => f.required)
    .every((f) => collected.has(f.key))

  const operationalDone = getFieldsForPhase('operational', fields)
    .filter((f) => f.required)
    .every((f) => collected.has(f.key))

  let phase: ProfilePhase = 'essential'
  let nextPhase: ProfilePhase | null = 'operational'

  if (essentialDone) {
    phase = 'operational'
    nextPhase = 'advanced'
  }
  if (essentialDone && operationalDone) {
    phase = 'advanced'
    nextPhase = null
  }

  return { phase, totalFields, completedFields, percentComplete, nextPhase, missingRequired }
}

// ── Viral / Referral Tracking ───────────────────────────────────────────────

export interface ReferralAttribution {
  /** New org that was created via referral. */
  readonly newOrgId: string
  /** Org that referred (source of the invite). */
  readonly referringOrgId: string
  /** User who sent the invite. */
  readonly referringUserId: string
  /** Invite token used. */
  readonly inviteToken: string
  /** Timestamp of the referral conversion. */
  readonly convertedAt: string
}

/**
 * Build a referral attribution record (pure — caller persists).
 */
export function buildReferralAttribution(
  newOrgId: string,
  invite: InviteLink,
): ReferralAttribution {
  return {
    newOrgId,
    referringOrgId: invite.orgId,
    referringUserId: invite.invitedBy,
    inviteToken: invite.token,
    convertedAt: new Date().toISOString(),
  }
}

// ── Self-Service Flow Definition ────────────────────────────────────────────

/**
 * Build the default self-service onboarding flow for a given org type.
 * Used with `registerFlow()` from the registry module.
 */
export function buildSelfServiceFlow(orgType: OrgType): {
  readonly id: string
  readonly displayName: string
  readonly steps: readonly {
    readonly name: string
    readonly displayName: string
    readonly required: boolean
    readonly dependsOn?: readonly string[]
  }[]
} {
  const flowId = resolveOnboardingFlow(orgType)

  const essentialSteps = [
    { name: 'create-org', displayName: 'Create Organisation', required: true },
    { name: 'verify-email', displayName: 'Verify Admin Email', required: true, dependsOn: ['create-org'] as readonly string[] },
    { name: 'set-password', displayName: 'Set Admin Password', required: true, dependsOn: ['verify-email'] as readonly string[] },
  ] as const

  const operationalSteps = [
    { name: 'org-profile', displayName: 'Complete Organisation Profile', required: true, dependsOn: ['set-password'] as readonly string[] },
    { name: 'invite-members', displayName: 'Invite Team Members', required: false, dependsOn: ['org-profile'] as readonly string[] },
    { name: 'select-apps', displayName: 'Select Platform Apps', required: false, dependsOn: ['org-profile'] as readonly string[] },
  ] as const

  const enterpriseSteps = [
    { name: 'configure-sso', displayName: 'Configure SSO (Entra ID)', required: false, dependsOn: ['org-profile'] as readonly string[] },
    { name: 'set-policies', displayName: 'Define Governance Policies', required: false, dependsOn: ['org-profile'] as readonly string[] },
    { name: 'billing-setup', displayName: 'Billing & Subscription Setup', required: true, dependsOn: ['org-profile'] as readonly string[] },
  ] as const

  const isEnterprise = orgType === 'congress' || orgType === 'federation'

  return {
    id: flowId,
    displayName: `Self-Service Onboarding (${orgType})`,
    steps: [
      ...essentialSteps,
      ...operationalSteps,
      ...(isEnterprise ? enterpriseSteps : []),
    ],
  }
}
