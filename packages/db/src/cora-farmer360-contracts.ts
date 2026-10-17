import { z } from 'zod'
import type { DbContext } from '@nzila/org/context'

export const farmer360SourceRefSchema = z
  .object({
    system: z.string().min(1),
    recordId: z.string().min(1),
    evidenceId: z.string().uuid().optional(),
    payloadSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    uri: z.string().url().optional(),
  })
  .strict()
  .refine((source) => Boolean(source.evidenceId) === Boolean(source.payloadSha256), {
    message: 'Evidence ID and payload hash must be provided together',
  })

export const farmer360FarmReferenceSchema = z
  .object({
    system: z.string().min(1),
    recordId: z.string().min(1),
    kind: z.enum(['farm', 'producer', 'other']),
  })
  .strict()

export const coraEnterpriseContextSchema = z
  .object({
    enterpriseName: z.string().min(1).max(240),
    operatingModel: z.enum([
      'independent',
      'cooperative-member',
      'cooperative',
      'contracted',
      'mixed',
      'unknown',
    ]),
    geography: z
      .object({
        countryCode: z.string().length(2).optional(),
        region: z.string().min(1).optional(),
        district: z.string().min(1).optional(),
      })
      .strict(),
    farmReferences: z.array(farmer360FarmReferenceSchema),
    activeFrom: z.string().datetime().optional(),
    activeTo: z.string().datetime().optional(),
  })
  .strict()
  .refine(
    (context) =>
      !context.activeFrom ||
      !context.activeTo ||
      Date.parse(context.activeFrom) <= Date.parse(context.activeTo),
    { message: 'activeFrom must not be later than activeTo' },
  )

export const coraEnterpriseContextInputSchema = z
  .object({
    profileId: z.string().uuid().optional(),
    subjectRef: farmer360SourceRefSchema,
    context: coraEnterpriseContextSchema,
    effectiveFrom: z.string().datetime(),
    effectiveTo: z.string().datetime().optional(),
  })
  .strict()
  .refine(
    (input) =>
      !input.effectiveTo || Date.parse(input.effectiveFrom) <= Date.parse(input.effectiveTo),
    { message: 'effectiveFrom must not be later than effectiveTo' },
  )

export const farmerAssertionInputSchema = z
  .object({
    profileId: z.string().uuid(),
    subject: z.string().min(1),
    statement: z.string().min(1),
    purpose: z.string().min(1),
    consentRef: z.string().min(1),
    source: farmer360SourceRefSchema,
    observedAt: z.string().datetime(),
  })
  .strict()

export type Farmer360SourceRef = z.infer<typeof farmer360SourceRefSchema>
export type CoraEnterpriseContext = z.infer<typeof coraEnterpriseContextSchema>
export type CoraEnterpriseContextInput = z.infer<typeof coraEnterpriseContextInputSchema>
export type FarmerAssertionInput = z.infer<typeof farmerAssertionInputSchema>

export interface Farmer360Profile {
  readonly id: string
  readonly orgId: string
  readonly subjectRef: Farmer360SourceRef
  readonly context: CoraEnterpriseContext | null
  readonly contextEffectiveFrom: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface Farmer360Assertion {
  readonly id: string
  readonly orgId: string
  readonly profileId: string
  readonly subject: string
  readonly statement: string
  readonly evidence: Farmer360SourceRef
  readonly verificationState: 'unverified'
  readonly assertedBy: string
  readonly assertedAt: string
}

export type Farmer360WriteAction = 'enterprise-context.write' | 'farmer-assertion.record'

export interface Farmer360AuditIntent {
  readonly action: Farmer360WriteAction
  readonly orgId: string
  readonly actorId: string
  readonly requestId: string
  readonly resourceId: string
  readonly authorization: {
    readonly policyEvaluationIds: readonly string[]
    readonly consentRef?: string
    readonly consentEvaluatedAt?: string
  }
}

export interface Farmer360PersistencePort {
  readonly getProfile: (context: DbContext, profileId: string) => Promise<Farmer360Profile | null>
  readonly getProfileBySubject: (
    context: DbContext,
    subjectRef: CoraEnterpriseContextInput['subjectRef'],
  ) => Promise<Farmer360Profile | null>
  readonly appendEnterpriseContextVersion: (
    context: DbContext,
    input: CoraEnterpriseContextInput,
    audit: Farmer360AuditIntent,
  ) => Promise<Farmer360Profile>
  // Persistence must atomically append Cora evidence, the assertion, and audit intent.
  readonly appendFarmerAssertion: (
    context: DbContext,
    assertion: Omit<
      Farmer360Assertion,
      'id' | 'orgId' | 'evidence' | 'verificationState' | 'assertedBy' | 'assertedAt'
    > & {
      readonly purpose: string
      readonly consentRef: string
      readonly source: FarmerAssertionInput['source']
      readonly observedAt: string
    },
    audit: Farmer360AuditIntent,
  ) => Promise<Farmer360Assertion>
  readonly listFarmerAssertions: (
    context: DbContext,
    profileId: string,
  ) => Promise<readonly Farmer360Assertion[]>
}
