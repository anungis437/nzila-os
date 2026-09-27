/**
 * Enforceable TREASURER schemas.
 *
 * Zod is the runtime contract. JSON Schema documents under schemas/ are the
 * governed artifacts and are checked against these required fields by the verifier.
 */
import { z } from 'zod'

import { EPISTEMIC_CLASSES, LIFECYCLE_STAGES } from './kernel'

export const SOURCE_TYPES = [
  'CUSTODIAN_STATEMENT',
  'BROKER_CONFIRMATION',
  'MARKET_DATA_VENDOR',
  'PRINCIPAL_ATTESTATION',
  'VALUATION_MODEL',
  'FX_RATE',
  'BENCHMARK_SERIES',
] as const

export type SourceType = (typeof SOURCE_TYPES)[number]

export const MARKET_FACT_SOURCES = [
  'CUSTODIAN_STATEMENT',
  'BROKER_CONFIRMATION',
  'MARKET_DATA_VENDOR',
] as const

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
export const currencySchema = z.string().regex(/^[A-Z]{3}$/, 'currency must be ISO 4217')
export const idSchema = z.string().min(1)

export const evidenceSchema = z
  .object({
    id: idSchema,
    epistemicClass: z.enum(EPISTEMIC_CLASSES),
    sourceType: z.enum(SOURCE_TYPES),
    sourceName: z.string().min(1),
    observedAt: isoDateSchema,
    origin: z.enum(['EXTERNAL', 'PRINCIPAL', 'TREASURER', 'ANALYSIS', 'MODEL']),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  })
  .strict()

export type EvidenceRef = z.infer<typeof evidenceSchema>

export const positionSchema = z
  .object({
    id: idSchema,
    instrumentId: idSchema,
    accountId: idSchema,
    capitalDomain: z.literal('PERSONAL'),
    ownerPrincipalId: idSchema,
    quantity: z.number().int().nonnegative(),
    marketValueMinor: z.number().int().nonnegative(),
    currency: currencySchema,
    exposureGroupId: idSchema,
    priceEvidenceId: idSchema,
    issuerEvidenceId: idSchema.optional(),
    asOf: isoDateSchema,
  })
  .strict()

export type Position = z.infer<typeof positionSchema>

export const portfolioSnapshotSchema = z
  .object({
    id: idSchema,
    asOf: isoDateSchema,
    capitalDomain: z.literal('PERSONAL'),
    ownerPrincipalId: idSchema,
    baseCurrency: currencySchema,
    positions: z.array(positionSchema),
    cashMinor: z.number().int().nonnegative(),
    cashCurrency: currencySchema,
    cashEvidenceId: idSchema,
    evidence: z.array(evidenceSchema),
  })
  .strict()

export type PortfolioSnapshot = z.infer<typeof portfolioSnapshotSchema>

export const thesisSchema = z
  .object({
    id: idSchema,
    version: z.number().int().positive(),
    epistemicClass: z.literal('THESIS'),
    statement: z.string().min(1),
    sourceIds: z.array(idSchema).min(1),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    priorHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  })
  .strict()

export type Thesis = z.infer<typeof thesisSchema>

export const capitalEnvelopeSchema = z
  .object({
    id: idSchema,
    epistemicClass: z.literal('ASSUMPTION'),
    capitalDomain: z.literal('PERSONAL'),
    ownerPrincipalId: idSchema,
    currency: currencySchema,
    ceilingMinor: z.number().int().nonnegative(),
    releasedMinor: z.number().int().nonnegative(),
    unreleasedMinor: z.number().int().nonnegative(),
    committedMinor: z.literal(0),
    investmentAuthorized: z.literal(false),
    transactionExecuted: z.literal(false),
    benchmarkAlternativeId: idSchema,
    evidenceGateIds: z.array(idSchema),
    thesisId: idSchema,
    downsideCaseIds: z.array(idSchema).min(1),
    impairmentScenarioIds: z.array(idSchema).min(1),
    liquidityNote: z.string().min(1),
    concentrationNote: z.string().min(1),
    status: z.enum(['PLANNING', 'RELEASED_FOR_CONSIDERATION', 'CLOSED']),
    decisionIds: z.array(idSchema),
  })
  .strict()

export type CapitalEnvelope = z.infer<typeof capitalEnvelopeSchema>

export const riskConstraintsSchema = z
  .object({
    id: idSchema,
    version: z.number().int().positive(),
    maxPositionWeightBps: z.number().int().min(0).max(10_000),
    maxGroupWeightBps: z.number().int().min(0).max(10_000),
    minLiquidityMinor: z.number().int().nonnegative(),
    currency: currencySchema,
    maxDrawdownBps: z.number().int().min(0).max(10_000),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export type RiskConstraints = z.infer<typeof riskConstraintsSchema>

export const benchmarkSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    epistemicClass: z.enum(['FACT', 'ESTIMATE', 'ASSUMPTION']),
    returnBps: z.number().int(),
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
    currency: currencySchema,
    evidenceId: idSchema,
  })
  .strict()

export type BenchmarkRef = z.infer<typeof benchmarkSchema>

export const humanAuthorizationSchema = z
  .object({
    id: idSchema,
    epistemicClass: z.literal('AUTHORIZATION'),
    principalId: idSchema,
    principalName: z.string().min(1),
    purpose: z.enum([
      'INVESTMENT',
      'INVESTMENT_REJECT',
      'INVESTMENT_DEFER',
      'RISK_CONSTRAINT_CHANGE',
      'THESIS_REVIEW',
    ]),
    decisionId: idSchema,
    statement: z.string().min(1),
    decidedAt: isoDateSchema,
    riskConstraintsHash: z.string().regex(/^[a-f0-9]{64}$/),
    amountMinor: z.number().int().nonnegative().optional(),
    currency: currencySchema.optional(),
  })
  .strict()

export type HumanAuthorization = z.infer<typeof humanAuthorizationSchema>

export const decisionCaseSchema = z
  .object({
    id: idSchema,
    stage: z.enum(LIFECYCLE_STAGES),
    thesisId: idSchema.optional(),
    envelopeId: idSchema.optional(),
    analysisComplete: z.boolean(),
    decisionReady: z.boolean(),
    humanAuthorized: z.boolean(),
    transactionExternallyConfirmed: z.boolean(),
    investmentAuthorized: z.boolean(),
    transactionExecuted: z.literal(false),
    amountMinor: z.number().int().nonnegative(),
    currency: currencySchema.optional(),
    benchmarkId: idSchema.optional(),
    benchmarkHash: z.string().optional(),
    riskConstraintsHash: z.string().optional(),
    authorizationId: idSchema.optional(),
    externalConfirmationId: idSchema.optional(),
  })
  .strict()

export type DecisionCase = z.infer<typeof decisionCaseSchema>

export const SCENARIO_SCHEMA_NOTE = 'SCENARIO is the only legal class for a scenario record'

export const scenarioSchema = z
  .object({
    id: idSchema,
    epistemicClass: z.literal('SCENARIO'),
    name: z.string().min(1),
    returnBps: z.number().int(),
    includesFailedPaths: z.boolean(),
    droppedPathIds: z.array(idSchema),
  })
  .strict()

export type Scenario = z.infer<typeof scenarioSchema>

export const northstarAmbitionSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    fundingNeedMinor: z.number().int().nonnegative(),
    currency: currencySchema,
    asOf: isoDateSchema,
  })
  .strict()

export type NorthstarAmbition = z.infer<typeof northstarAmbitionSchema>

export const SCHEMA_REQUIRED_FIELDS = {
  'personal-capital-ledger.schema.json': [
    'id',
    'asOf',
    'capitalDomain',
    'ownerPrincipalId',
    'baseCurrency',
    'positions',
    'cashMinor',
    'cashCurrency',
    'cashEvidenceId',
    'evidence',
  ],
  'investment-thesis-register.schema.json': [
    'id',
    'version',
    'epistemicClass',
    'statement',
    'sourceIds',
    'contentHash',
    'priorHash',
  ],
  'capital-envelope.schema.json': [
    'id',
    'epistemicClass',
    'ceilingMinor',
    'releasedMinor',
    'unreleasedMinor',
    'committedMinor',
    'investmentAuthorized',
    'transactionExecuted',
    'benchmarkAlternativeId',
    'evidenceGateIds',
    'thesisId',
    'downsideCaseIds',
    'impairmentScenarioIds',
    'liquidityNote',
    'concentrationNote',
    'status',
    'decisionIds',
  ],
  'investment-decision-record.schema.json': [
    'id',
    'stage',
    'analysisComplete',
    'decisionReady',
    'humanAuthorized',
    'transactionExternallyConfirmed',
    'investmentAuthorized',
    'transactionExecuted',
    'amountMinor',
  ],
  'portfolio-snapshot.schema.json': [
    'id',
    'asOf',
    'capitalDomain',
    'ownerPrincipalId',
    'baseCurrency',
    'positions',
    'cashMinor',
    'evidence',
  ],
} as const
