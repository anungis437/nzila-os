/**
 * Nzila HQ canonical data model (Phase 15).
 *
 * These types are the contract between the data layer (`apps/nzila-hq/server/*`),
 * the domain engines (`dependency-engine`, `automations`, `reports`), and any
 * future persistence adapters (Drizzle, external service).
 *
 * They are intentionally framework-free.
 */
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Identity & enumerations
// ─────────────────────────────────────────────────────────────────────────────

export const VentureStageSchema = z.enum([
  'incubating',
  'pilot',
  'go-to-market',
  'scaling',
  'mature',
  'sunset',
])
export type VentureStage = z.infer<typeof VentureStageSchema>

export const ConfidenceSchema = z.enum(['low', 'medium', 'high'])
export type Confidence = z.infer<typeof ConfidenceSchema>

export const HealthSignalSchema = z.enum(['green', 'amber', 'red'])
export type HealthSignal = z.infer<typeof HealthSignalSchema>

export const PipelineStageSchema = z.enum([
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'pilot',
  'won',
  'lost',
  'expansion',
])
export type PipelineStage = z.infer<typeof PipelineStageSchema>

export const TaskQueueSchema = z.enum([
  'founder-decisions',
  'operator-actions',
  'partner-followups',
  'finance-review',
  'product-escalations',
])
export type TaskQueue = z.infer<typeof TaskQueueSchema>

export const TaskStatusSchema = z.enum(['open', 'in-progress', 'blocked', 'done', 'snoozed'])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const RelationshipKindSchema = z.enum([
  'partner',
  'investor',
  'buyer',
  'advisor',
  'customer',
  'prospect',
  'other',
])
export type RelationshipKind = z.infer<typeof RelationshipKindSchema>

export const HqRoleSchema = z.enum([
  'founder',
  'president',
  'ops-lead',
  'partnerships',
  'finance',
  'board-viewer',
])
export type HqRole = z.infer<typeof HqRoleSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Core entities
// ─────────────────────────────────────────────────────────────────────────────

export const VentureSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  mission: z.string(),
  icp: z.string(),
  ownerUserId: z.string(),
  secondOwnerUserId: z.string().nullable(),
  stage: VentureStageSchema,
  monthlyRecurringRevenueCents: z.number().int().nonnegative(),
  pipelineValueCents: z.number().int().nonnegative(),
  weightedPipelineCents: z.number().int().nonnegative(),
  pilotsLive: z.number().int().nonnegative(),
  blockers: z.array(z.string()),
  next30Days: z.array(z.string()),
  confidence: ConfidenceSchema,
  consoleAppId: z.string().nullable(),
  externalLinks: z.record(z.string(), z.string().url()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Venture = z.infer<typeof VentureSchema>

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: RelationshipKindSchema,
  ventureRelevance: z.array(z.string()), // venture slugs
  ownerUserId: z.string(),
  trustScore: z.number().min(0).max(100),
  notes: z.string().default(''),
  createdAt: z.string().datetime(),
})
export type Organization = z.infer<typeof OrganizationSchema>

export const ContactSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  fullName: z.string(),
  title: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  ownerUserId: z.string(),
  warmIntroPath: z.array(z.string()).default([]),
  lastInteractionAt: z.string().datetime().nullable(),
  nextStep: z.string().nullable(),
})
export type Contact = z.infer<typeof ContactSchema>

export const OpportunitySchema = z.object({
  id: z.string(),
  ventureSlug: z.string(),
  organizationId: z.string(),
  name: z.string(),
  stage: PipelineStageSchema,
  estimatedValueCents: z.number().int().nonnegative(),
  probability: z.number().min(0).max(1),
  ownerUserId: z.string(),
  nextAction: z.string(),
  daysStale: z.number().int().nonnegative(),
  blockers: z.array(z.string()).default([]),
  expectedCloseAt: z.string().datetime().nullable(),
  founderTouchRequired: z.boolean().default(false),
})
export type Opportunity = z.infer<typeof OpportunitySchema>

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  context: z.string(),
  queue: TaskQueueSchema,
  ownerUserId: z.string(),
  dueAt: z.string().datetime().nullable(),
  status: TaskStatusSchema,
  ventureSlug: z.string().nullable(),
  opportunityId: z.string().nullable(),
})
export type Task = z.infer<typeof TaskSchema>

export const DocumentSchema = z.object({
  id: z.string(),
  ventureSlug: z.string().nullable(),
  title: z.string(),
  category: z.enum([
    'deck',
    'proposal',
    'pricing',
    'one-pager',
    'term-sheet',
    'legal',
    'partnership-memo',
    'investor',
  ]),
  url: z.string().url(),
  ownerUserId: z.string(),
  updatedAt: z.string().datetime(),
})
export type Document = z.infer<typeof DocumentSchema>

export const MeetingSchema = z.object({
  id: z.string(),
  title: z.string(),
  startsAt: z.string().datetime(),
  ventureSlug: z.string().nullable(),
  organizationId: z.string().nullable(),
  attendees: z.array(z.string()),
  briefingNotes: z.string().default(''),
})
export type Meeting = z.infer<typeof MeetingSchema>

export const StrategicEventSchema = z.object({
  id: z.string(),
  kind: z.enum(['meeting', 'renewal', 'launch', 'review', 'board']),
  title: z.string(),
  occursAt: z.string().datetime(),
  ventureSlug: z.string().nullable(),
})
export type StrategicEvent = z.infer<typeof StrategicEventSchema>

export const HqUserSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  role: HqRoleSchema,
  email: z.string().email(),
})
export type HqUser = z.infer<typeof HqUserSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Derived / computed types
// ─────────────────────────────────────────────────────────────────────────────

export interface DependencyScore {
  ventureSlug: string
  score: number // 0..100, higher = more dependent on founder
  signal: HealthSignal
  reasons: string[]
  computedAt: string
}

export interface PortfolioSnapshot {
  activeVentures: number
  totalMrrCents: number
  totalPipelineCents: number
  weightedPipelineCents: number
  pilotsLive: number
  strategicAlerts: number
  founderBottleneckScore: number // 0..100, higher = worse
  founderBottleneckSignal: HealthSignal
}

export interface FinanceSnapshot {
  totalMrrCents: number
  arrRunRateCents: number
  pipelineValueCents: number
  weightedPipelineCents: number
  cacProxyCents: number | null
  paybackMonths: number | null
  cashRunwayMonths: number | null
  topVentureRevenueShare: number // 0..1, concentration metric
  marginByVentureCents: Record<string, number | null>
}
