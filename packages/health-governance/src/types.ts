import { z } from 'zod'

export enum ControlStatus {
  IMPLEMENTED = 'IMPLEMENTED',
  PARTIAL = 'PARTIAL',
  PLANNED = 'PLANNED',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export const ControlStatusSchema = z.nativeEnum(ControlStatus)

export const ControlRow = z.object({
  control: z.string(),
  description: z.string(),
  evidenceSource: z.string(),
  cadence: z.string(),
  ownerRole: z.string(),
  status: ControlStatusSchema,
})

export const ReleaseEvidenceSchema = z.object({
  releaseId: z.string(),
  app: z.string(),
  environment: z.enum(['staging', 'production']),
  date: z.string(),
  controls: z.array(ControlRow),
  approvedBy: z.string().optional(),
  notes: z.string().optional(),
})

export const PilotReadinessItem = z.object({
  item: z.string(),
  status: z.enum(['ready', 'partial', 'not-ready']),
  notes: z.string().optional(),
})

export const PilotReadinessReport = z.object({
  organizationId: z.string(),
  siteId: z.string(),
  generatedAt: z.string(),
  items: z.array(PilotReadinessItem),
  overallReady: z.boolean(),
})

export type ControlRow = z.infer<typeof ControlRow>
export type ReleaseEvidence = z.infer<typeof ReleaseEvidenceSchema>
export type PilotReadinessItem = z.infer<typeof PilotReadinessItem>
export type PilotReadinessReport = z.infer<typeof PilotReadinessReport>
