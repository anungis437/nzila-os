import { z } from 'zod'
import { sourceDisclosureProvenanceSchema } from '@nzila/platform-auth/source-disclosure'

export const farmer360SectionStatusSchema = z.enum([
  'KNOWN',
  'PARTIAL',
  'ESTIMATED',
  'UNKNOWN',
  'NOT_APPLICABLE',
])

export const farmer360SectionNameSchema = z.enum([
  'production',
  'assets-capacity',
  'economics',
  'markets-exposure',
  'labour-capacity',
  'risk-resilience',
  'sustainability-standards',
  'historical-decisions',
  'evidence-confidence',
  'data-gaps',
])

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

export const farmer360FactSchema = z
  .object({
    orgId: z.string().uuid(),
    profileId: z.string().uuid(),
    key: z.string().min(1),
    label: z.string().min(1),
    value: z.union([
      z.string(),
      z.number().finite(),
      z.boolean(),
      z.record(z.string(), z.unknown()),
      z.array(z.unknown()),
    ]),
    valueKind: z.enum(['observed', 'estimated', 'derived', 'farmer-asserted']),
    unit: z.string().min(1).optional(),
    period: z
      .object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .strict()
      .optional(),
    source: farmer360SourceRefSchema,
    provenance: sourceDisclosureProvenanceSchema.optional(),
    contractVersion: z.string().min(1).optional(),
    observedAt: z.string().datetime().optional(),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().optional(),
    freshness: z.enum(['current', 'stale', 'unknown']),
    confidence: z
      .object({
        level: z.enum(['high', 'medium', 'low', 'unknown']),
        basis: z.string().min(1),
      })
      .strict(),
    quality: z
      .object({
        completeness: z.enum(['complete', 'partial', 'estimated', 'unknown']),
        traceability: z.enum(['direct', 'derived', 'unknown']),
        limitations: z.array(z.string().min(1)),
      })
      .strict(),
    methodology: z
      .object({
        authorityId: z.string().min(1),
        methodologyId: z.string().min(1),
        version: z.string().min(1),
        definitionSha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .optional(),
    economic: z
      .object({
        kind: z.enum([
          'revenue-stream',
          'material-cost-category',
          'production-volume',
          'realized-price',
          'estimated-price',
          'margin-input',
          'working-capital',
          'concentration',
          'seasonality',
          'capacity-utilization',
        ]),
        priceBasis: z.enum(['realized', 'modeled']).optional(),
      })
      .strict()
      .optional(),
    assetCapacity: z
      .object({
        kind: z.enum([
          'land',
          'facility',
          'storage',
          'processing',
          'equipment',
          'utilities',
          'logistics',
          'labour',
        ]),
      })
      .strict()
      .optional(),
    marketExposure: z
      .object({
        kind: z.enum([
          'commodity',
          'product',
          'channel',
          'buyer-concentration',
          'geography',
          'currency',
          'contract-offtake',
          'realized-price',
          'modeled-price',
        ]),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((fact) => fact.valueKind !== 'estimated' || Boolean(fact.methodology), {
    message: 'Estimated facts require an explicit methodology reference',
  })
  .refine((fact) => fact.valueKind !== 'derived' || Boolean(fact.methodology), {
    message: 'Derived facts require an explicit methodology reference',
  })
  .refine(
    (fact) =>
      fact.economic?.kind !== 'estimated-price' ||
      (fact.valueKind === 'estimated' && fact.economic.priceBasis === 'modeled'),
    { message: 'Estimated prices must be labeled modeled and estimated' },
  )
  .refine(
    (fact) =>
      fact.economic?.kind !== 'realized-price' ||
      (fact.valueKind === 'observed' && fact.economic.priceBasis === 'realized'),
    { message: 'Realized prices must retain their observed source value' },
  )
  .refine(
    (fact) =>
      !fact.validFrom || !fact.validTo || Date.parse(fact.validFrom) <= Date.parse(fact.validTo),
    { message: 'validFrom must not be later than validTo' },
  )

export const farmer360ConflictSchema = z
  .object({
    key: z.string().min(1),
    description: z.string().min(1),
    competingFacts: z.array(farmer360FactSchema).min(2),
  })
  .strict()

export const farmer360SectionSchema = z
  .object({
    name: farmer360SectionNameSchema,
    status: farmer360SectionStatusSchema,
    facts: z.array(farmer360FactSchema),
    conflicts: z.array(farmer360ConflictSchema),
  })
  .strict()
  .superRefine((section, ctx) => {
    if (section.status === 'UNKNOWN' && section.facts.length > 0) {
      ctx.addIssue({ code: 'custom', message: 'A section with facts cannot be UNKNOWN' })
    }
    if (section.status === 'NOT_APPLICABLE' && section.facts.length > 0) {
      ctx.addIssue({ code: 'custom', message: 'A NOT_APPLICABLE section cannot contain facts' })
    }
    if (section.status === 'KNOWN' && section.facts.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'A KNOWN section must have evidence-backed facts' })
    }
  })

export const farmer360DataGapSchema = z
  .object({
    orgId: z.string().uuid(),
    profileId: z.string().uuid(),
    id: z.string().min(1),
    subject: z.string().min(1),
    missingOrWeakEvidence: z.array(farmer360SourceRefSchema),
    impact: z.string().min(1),
    importance: z.enum(['low', 'medium', 'high']),
    affectedCapability: z.string().min(1),
    candidateResolution: z.string().min(1).optional(),
  })
  .strict()

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

export type Farmer360SectionName = z.infer<typeof farmer360SectionNameSchema>
export type Farmer360SectionStatus = z.infer<typeof farmer360SectionStatusSchema>
export type Farmer360SourceRef = z.infer<typeof farmer360SourceRefSchema>
export type Farmer360Fact = z.infer<typeof farmer360FactSchema>
export type Farmer360Conflict = z.infer<typeof farmer360ConflictSchema>
export type Farmer360Section = z.infer<typeof farmer360SectionSchema>
export type Farmer360DataGap = z.infer<typeof farmer360DataGapSchema>
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

export interface Farmer360ReadModel {
  readonly profile: Farmer360Profile
  readonly sections: Readonly<Record<Farmer360SectionName, Farmer360Section>>
  readonly gaps: readonly Farmer360DataGap[]
  readonly conflicts: readonly Farmer360Conflict[]
}

export function emptyFarmer360Sections(): Record<Farmer360SectionName, Farmer360Section> {
  return {
    production: { name: 'production', status: 'UNKNOWN', facts: [], conflicts: [] },
    'assets-capacity': { name: 'assets-capacity', status: 'UNKNOWN', facts: [], conflicts: [] },
    economics: { name: 'economics', status: 'UNKNOWN', facts: [], conflicts: [] },
    'markets-exposure': { name: 'markets-exposure', status: 'UNKNOWN', facts: [], conflicts: [] },
    'labour-capacity': { name: 'labour-capacity', status: 'UNKNOWN', facts: [], conflicts: [] },
    'risk-resilience': { name: 'risk-resilience', status: 'UNKNOWN', facts: [], conflicts: [] },
    'sustainability-standards': {
      name: 'sustainability-standards',
      status: 'UNKNOWN',
      facts: [],
      conflicts: [],
    },
    'historical-decisions': {
      name: 'historical-decisions',
      status: 'UNKNOWN',
      facts: [],
      conflicts: [],
    },
    'evidence-confidence': {
      name: 'evidence-confidence',
      status: 'UNKNOWN',
      facts: [],
      conflicts: [],
    },
    'data-gaps': { name: 'data-gaps', status: 'UNKNOWN', facts: [], conflicts: [] },
  }
}
