import { z } from 'zod'

export enum ConsentRole {
  CLINICIAN = 'CLINICIAN',
  SPECIALIST = 'SPECIALIST',
  NURSE = 'NURSE',
  ADMIN = 'ADMIN',
  PRIVACY_OFFICER = 'PRIVACY_OFFICER',
  AUDITOR = 'AUDITOR',
}

export enum ConsentScope {
  READ_TIMELINE = 'READ_TIMELINE',
  READ_LABS = 'READ_LABS',
  READ_MEDICATIONS = 'READ_MEDICATIONS',
  READ_REFERRALS = 'READ_REFERRALS',
  WRITE_NOTES = 'WRITE_NOTES',
  BREAK_GLASS = 'BREAK_GLASS',
  FULL_ACCESS = 'FULL_ACCESS',
}

export const ConsentRoleSchema = z.nativeEnum(ConsentRole)
export const ConsentScopeSchema = z.nativeEnum(ConsentScope)

export const AccessDecisionInput = z.object({
  actorId: z.string(),
  role: ConsentRoleSchema,
  patientId: z.string(),
  organizationId: z.string(),
  siteId: z.string(),
  requestedScope: ConsentScopeSchema,
  reason: z.string().optional(),
})

export const AccessDecision = z.object({
  allowed: z.boolean(),
  reason: z.string(),
  requiresBreakGlass: z.boolean(),
})

export const AuditEvent = z.object({
  actorId: z.string(),
  role: ConsentRoleSchema,
  tenantId: z.string(),
  siteId: z.string(),
  patientId: z.string(),
  action: z.string(),
  reason: z.string().optional(),
  timestamp: z.string(),
  sessionId: z.string().optional(),
  source: z.string().optional(),
})

export type AccessDecisionInput = z.infer<typeof AccessDecisionInput>
export type AccessDecision = z.infer<typeof AccessDecision>
export type AuditEvent = z.infer<typeof AuditEvent>
