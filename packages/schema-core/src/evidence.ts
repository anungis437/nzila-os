import { z } from 'zod'

/**
 * Evidence artifact schemas — canonical evidence export contracts.
 */

export const EVIDENCE_FORMAT_VALUES = ['json', 'pdf', 'csv'] as const
export type EvidenceFormat = (typeof EVIDENCE_FORMAT_VALUES)[number]

export const evidenceArtifactSchema = z.object({
  artifactId: z.string().min(1),
  type: z.string().min(1),
  format: z.enum(EVIDENCE_FORMAT_VALUES),
  sizeBytes: z.number().int().nonnegative(),
  hash: z.string().min(1),
  generatedAt: z.string().datetime(),
})
export type EvidenceArtifact = z.infer<typeof evidenceArtifactSchema>

export const evidenceExportSchema = z.object({
  app: z.string().min(1),
  orgId: z.string().min(1),
  exportId: z.string().min(1),
  artifacts: z.array(evidenceArtifactSchema),
  chainHash: z.string().min(1),
  exportedAt: z.string().datetime(),
})
export type EvidenceExport = z.infer<typeof evidenceExportSchema>
