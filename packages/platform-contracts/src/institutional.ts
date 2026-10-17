import { z } from 'zod'

const explicitId = z.string().min(1).max(200).refine(
  value => value.trim() === value && !value.includes('*'),
  'Identity must be explicit, nonblank and not a wildcard',
)
const scopeShape = { id: explicitId }

export const institutionalScopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PLATFORM_INSTITUTION'), ...scopeShape }).strict(),
  z.object({ type: z.literal('ORGANIZATION'), id: z.string().uuid() }).strict(),
  z.object({ type: z.literal('SYSTEM'), ...scopeShape }).strict(),
])
export type InstitutionalScope = z.infer<typeof institutionalScopeSchema>

export const institutionalReferenceSchema = z.object({
  scope: institutionalScopeSchema,
  kind: explicitId,
  namespace: explicitId,
  sourceId: explicitId,
  revision: z.number().int().positive(),
  mappingVersion: z.number().int().positive().optional(),
}).strict()
export type InstitutionalReference = z.infer<typeof institutionalReferenceSchema>

export const institutionBindingSchema = z.object({
  institutionId: explicitId,
  governanceOrgId: z.string().uuid(),
  status: z.enum(['EFFECTIVE', 'REVOKED']),
  version: z.number().int().positive(),
  approvedBy: explicitId,
  authorityRef: explicitId,
  effectiveAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
}).strict().refine(
  binding => binding.status === 'REVOKED' ? binding.revokedAt !== null : binding.revokedAt === null,
  'Binding status must agree with revocation',
)
export type InstitutionBinding = z.infer<typeof institutionBindingSchema>

export const sourceScopeBindingSchema = z.object({
  namespace: explicitId,
  legacyIdentityKind: z.enum(['tenant_id', 'org_id', 'organization_id']),
  legacyIdentityValue: explicitId,
  canonicalScope: institutionalScopeSchema,
  mappingVersion: z.number().int().positive(),
  authorityRef: explicitId,
  effectiveAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
}).strict()
export type SourceScopeBinding = z.infer<typeof sourceScopeBindingSchema>

export const institutionalActorSchema = z.object({
  id: explicitId,
  classification: z.enum(['INTERNAL_HUMAN', 'AGENT', 'EXTERNAL_HUMAN', 'EXTERNAL_AI', 'SYSTEM']),
  internalAffiliation: z.boolean(),
}).strict()
export type InstitutionalActor = z.infer<typeof institutionalActorSchema>

export const institutionalMutationContextSchema = z.object({
  actor: institutionalActorSchema,
  actingScope: institutionalScopeSchema,
  target: institutionalReferenceSchema,
  governanceOrgId: z.string().uuid(),
  bindingVersion: z.number().int().positive(),
  requestId: z.string().uuid(),
  authorityRef: explicitId,
  policyVersion: explicitId,
  action: explicitId,
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().min(1),
  source: explicitId,
  occurredAt: z.string().datetime(),
}).strict()
export type InstitutionalMutationContext = Readonly<z.infer<typeof institutionalMutationContextSchema>>

export function sameInstitutionalScope(left: InstitutionalScope, right: InstitutionalScope): boolean {
  return left.type === right.type && left.id === right.id
}
