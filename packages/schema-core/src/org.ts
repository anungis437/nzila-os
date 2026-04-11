import { z } from 'zod'

/**
 * Org scope schemas — canonical multi-tenancy primitives.
 */

export const ORG_STATUS_VALUES = ['active', 'suspended', 'deactivated', 'pending_setup'] as const
export type OrgStatus = (typeof ORG_STATUS_VALUES)[number]

export const ORG_TIER_VALUES = ['free', 'starter', 'professional', 'enterprise'] as const
export type OrgTier = (typeof ORG_TIER_VALUES)[number]

export const orgScopeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  status: z.enum(ORG_STATUS_VALUES),
  tier: z.enum(ORG_TIER_VALUES).optional(),
  enabledModules: z.array(z.string()).default([]),
  jurisdiction: z.string().optional(),
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
})
export type OrgScope = z.infer<typeof orgScopeSchema>

export const orgMembershipSchema = z.object({
  userId: z.string().min(1),
  orgId: z.string().min(1),
  role: z.string().min(1),
  status: z.enum(['active', 'suspended', 'removed']),
  joinedAt: z.string().datetime(),
})
export type OrgMembership = z.infer<typeof orgMembershipSchema>

export const orgRoleAssignmentSchema = z.object({
  userId: z.string().min(1),
  orgId: z.string().min(1),
  role: z.string().min(1),
  assignedBy: z.string().min(1),
  assignedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
})
export type OrgRoleAssignment = z.infer<typeof orgRoleAssignmentSchema>

export const orgScopedRequestContextSchema = z.object({
  orgId: z.string().min(1),
  actorId: z.string().min(1),
  appId: z.string().optional(),
  role: z.string().min(1),
  permissions: z.array(z.string()),
  requestId: z.string().min(1),
  correlationId: z.string().optional(),
  timestamp: z.string().datetime(),
  moduleId: z.string().min(1),
  clientIp: z.string().optional(),
  userAgent: z.string().optional(),
})
export type OrgScopedRequestContext = z.infer<typeof orgScopedRequestContextSchema>
