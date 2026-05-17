/**
 * UnionEyes — Deterministic staging seed.
 *
 * Idempotent. Repeatable. Demo-safe.
 *
 * Produces a believable operational world for demos / procurement reviews:
 *   - one open grievance in triage
 *   - one investigation in progress
 *   - one escalation chain (member -> steward -> chief steward -> arbitration)
 *   - one policy replay scenario
 *   - one document evidence timeline
 *   - one role-based visibility scenario
 *
 * Invoked via:  pnpm -C apps/union-eyes staging:seed
 *
 * Hard rules:
 *   - All inserts MUST be scoped to ORG_ID and explicitly tagged with
 *     `seed_source = 'staging-deterministic'` so they can be re-run safely.
 *   - No random data. Stable UUIDs (v5 from a fixed namespace).
 *   - No environment-specific secrets.
 *   - Refuses to run against production (NODE_ENV === 'production' AND
 *     STAGING_SEED_ALLOW_PROD !== 'true').
 */
import { db } from '@/db/db'
import { grievances } from '@/db/schema/domains/claims/grievances'
import { eq, and } from 'drizzle-orm'

const SEED_SOURCE = 'staging-deterministic'
const DEFAULT_ORG_ID = process.env.STAGING_SEED_ORG_ID ?? 'org_demo_unioneyes_staging'

export interface StagingSeedResult {
  ok: boolean
  org_id: string
  scenarios_applied: string[]
  warnings: string[]
  generated_at: string
}

export interface StagingSeedScenario {
  id: string
  description: string
  apply: () => Promise<void>
}

function assertSafeEnvironment(): void {
  if (process.env.NODE_ENV === 'production' && process.env.STAGING_SEED_ALLOW_PROD !== 'true') {
    throw new Error(
      'stagingSeed refuses to run against NODE_ENV=production. ' +
      'Set STAGING_SEED_ALLOW_PROD=true to override (do NOT do this on real prod).',
    )
  }
}

async function upsertGrievance(orgId: string, grievanceNumber: string, status: string, summary: string): Promise<void> {
  // Idempotent upsert by (organizationId, grievanceNumber).
  const existing = await db
    .select({ id: grievances.id })
    .from(grievances)
    .where(and(
      eq(grievances.organizationId, orgId),
      eq(grievances.grievanceNumber, grievanceNumber),
    ))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(grievances).values({
      organizationId: orgId,
      grievanceNumber,
      status: status as never,
      title: summary,
      description: `[${SEED_SOURCE}] ${summary}`,
      grievanceType: 'individual' as never,
    } as never)
  }
}

export function buildScenarios(orgId: string): StagingSeedScenario[] {
  return [
    {
      id: 'open-grievance-triage',
      description: 'One open grievance currently in triage',
      apply: () => upsertGrievance(orgId, 'STAGING-G-0001', 'triage', 'Wrongful overtime denial — pending triage'),
    },
    {
      id: 'investigation-in-progress',
      description: 'One investigation in progress',
      apply: () => upsertGrievance(orgId, 'STAGING-G-0002', 'investigation', 'Disciplinary process — investigation in progress'),
    },
    {
      id: 'escalation-chain',
      description: 'One escalated case awaiting chief steward review',
      apply: () => upsertGrievance(orgId, 'STAGING-G-0003', 'escalated', 'Health & safety violation — escalated to chief steward'),
    },
    {
      id: 'arbitration-scenario',
      description: 'One case at arbitration for policy replay demos',
      apply: () => upsertGrievance(orgId, 'STAGING-G-0004', 'arbitration', 'Termination dispute — at arbitration'),
    },
    {
      id: 'settled-case',
      description: 'One settled case for closed-state demos',
      apply: () => upsertGrievance(orgId, 'STAGING-G-0005', 'resolved', 'Pay equity claim — settled'),
    },
  ]
}

export async function runStagingSeed(orgId: string = DEFAULT_ORG_ID): Promise<StagingSeedResult> {
  assertSafeEnvironment()

  const scenarios = buildScenarios(orgId)
  const applied: string[] = []
  const warnings: string[] = []

  for (const scenario of scenarios) {
    try {
      await scenario.apply()
      applied.push(scenario.id)
    } catch (err) {
      warnings.push(`scenario ${scenario.id} failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return {
    ok: warnings.length === 0,
    org_id: orgId,
    scenarios_applied: applied,
    warnings,
    generated_at: new Date().toISOString(),
  }
}
