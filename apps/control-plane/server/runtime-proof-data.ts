import 'server-only'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { z } from 'zod'

// Minimal Zod schema — enough to type-check the data the dashboard needs.
// Full schema lives in @nzila/platform-contracts but we keep this file
// self-contained to avoid an unnecessary package dep.

const ScoringDimensionSchema = z.object({
  dimension: z.string(),
  weight: z.number(),
  earned: z.number(),
  rationale: z.string(),
  bootstrapEvidence: z.boolean(),
})

const RuntimeMetricSchema = z.object({
  name: z.string(),
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
  unit: z.string(),
  status: z.enum(['healthy', 'degraded', 'critical', 'unknown']),
  collectedAt: z.string().optional(),
})

const RuntimeProofV2Schema = z.object({
  schemaVersion: z.literal(2),
  proofId: z.string(),
  timestamp: z.string(),
  period: z.string(),
  score: z.number(),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  overallHealth: z.string(),
  bootstrapSources: z.array(z.string()),
  blockingFindings: z.array(z.string()),
  advisoryFindings: z.array(z.string()),
  nextRequiredEvidence: z.array(z.string()),
  scoringBreakdown: z.array(ScoringDimensionSchema),
  metrics: z.array(RuntimeMetricSchema),
  generatedBy: z.string(),
})

export type RuntimeProofV2 = z.infer<typeof RuntimeProofV2Schema>

const PROOF_PATH = path.resolve(process.cwd(), 'reports/runtime/runtime-latest.json')

/**
 * Read the latest runtime proof document.
 * Returns null on any read/parse/validation failure (dashboard renders
 * gracefully with no data rather than throwing).
 */
export async function getRuntimeProofData(): Promise<RuntimeProofV2 | null> {
  try {
    const raw = fs.readFileSync(PROOF_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    const result = RuntimeProofV2Schema.safeParse(parsed)
    if (!result.success) {
      return null
    }
    return result.data
  } catch {
    return null
  }
}
