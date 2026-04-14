import { z } from 'zod'

export interface NaturalLanguageQuery {
  id: string
  query: string
  orgId: string
  actor: string
  timestamp: string
  context?: Record<string, unknown>
}

export const naturalLanguageQuerySchema = z.object({
  id: z.string().uuid(),
  query: z.string().min(1),
  orgId: z.string(),
  actor: z.string(),
  timestamp: z.string().datetime(),
  context: z.record(z.unknown()).optional(),
})

export interface QueryResult {
  id: string
  queryId: string
  answer: string
  confidence: number
  evidenceRefs: EvidenceReference[]
  intent?: QueryIntent
  plan?: QueryExecutionPlan
  timestamp: string
}

export interface EvidenceReference {
  source: string
  type: 'event' | 'metric' | 'policy' | 'audit'
  id: string
  summary: string
}

export const evidenceReferenceSchema = z.object({
  source: z.string(),
  type: z.enum(['event', 'metric', 'policy', 'audit']),
  id: z.string(),
  summary: z.string(),
})

export const queryResultSchema = z.object({
  id: z.string().uuid(),
  queryId: z.string().uuid(),
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(evidenceReferenceSchema),
  timestamp: z.string().datetime(),
})

export type QueryIntent =
  | 'status'
  | 'comparison'
  | 'trend'
  | 'anomaly'
  | 'compliance'
  | 'unknown'

export interface IntentPrototype {
  intent: QueryIntent
  description: string
  examples: string[]
}

export interface IntentClassificationResult {
  intent: QueryIntent
  confidence: number
  scores: Record<QueryIntent, number>
}

export interface QueryPlanStep {
  id: string
  objective: string
  source: 'events' | 'metrics' | 'policy' | 'audit' | 'context'
}

export interface QueryExecutionPlan {
  intent: QueryIntent
  steps: QueryPlanStep[]
  strategy: 'direct' | 'comparative' | 'time_series' | 'forensic'
}
