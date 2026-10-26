#!/usr/bin/env tsx
/**
 * ue:case-ownership:reconcile — READ-ONLY report of how the legacy `grievances.union_rep_id` column and the authority
 * kernel's governed case assignments differ (UE-CONV-B-001 historical assignment migration). The legacy value is never
 * treated as authority: a case whose only owner is the legacy column is reported as `backfill_candidate` (eligible, but
 * needs an explicit governed assignCase through the plan/approve/execute backfill) or as one of the deferred kinds
 * (invalid principal, no active membership, no representation capacity). It writes nothing: the connection is a READ
 * ONLY transaction that is rolled back.
 *
 * Usage (a credentialed role that can read grievances, the authority relationships and membership):
 *   CASE_OWNERSHIP_RECONCILE_DATABASE_URL=postgres://... pnpm tsx scripts/reconcile-case-ownership.ts --organization=<uuid> [--limit=500] [--json]
 *
 * The default is a read-only plan. Deferred findings (invalid principal, inactive member, no representation capacity,
 * kernel assignee differs) are quarantined in the report and are never assigned. `--execute` writes only the approved
 * `backfill_candidate` set, through assignCase, and only when the issuer, the approved plan hash and a decision
 * reference are all present. It does not invent a representative relationship.
 *
 *   ... --execute --issuer=<uuid> --approved-plan-hash=<64 hex> --approved-source-revision=<64 hex> --decision-reference=<minute or resolution>
 *
 * Exit codes: 0 no drift (every legacy owner is aligned with a kernel assignee), 1 drift found, 2 the check could not run.
 * An executed backfill that assigns rows exits 0. A refused execute exits 2 and writes nothing.
 */
import postgres from 'postgres'
import { reconcileCaseOwnership, type OwnershipReport } from '../lib/authority/store/case-ownership'
import { executeOwnershipBackfill, planOwnershipBackfill } from '../lib/authority/store/case-ownership-backfill'
import { canonicalMembershipSource } from '../lib/authority/store/identity'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PLAN_HASH = /^[0-9a-f]{64}$/

export interface ReconcileArguments {
  organizationId: string
  limit?: number
  json: boolean
  execute: boolean
  issuerUserId?: string
  approvedPlanHash?: string
  approvedSourceRevision?: string
  decisionReference?: string
}

export function parseArguments(argv: readonly string[]): ReconcileArguments | { error: string } {
  const value = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  const organizationId = value('organization')
  if (!organizationId || !UUID.test(organizationId)) return { error: '--organization=<uuid> is required' }
  const limitText = value('limit')
  const limit = limitText === undefined ? undefined : Number(limitText)
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 5000)) return { error: '--limit must be an integer from 1 to 5000' }
  const execute = argv.includes('--execute')
  const issuerUserId = value('issuer')
  const approvedPlanHash = value('approved-plan-hash')
  const approvedSourceRevision = value('approved-source-revision')
  const decisionReference = value('decision-reference')
  if (execute) {
    if (!issuerUserId || !UUID.test(issuerUserId)) return { error: '--execute requires --issuer=<uuid>' }
    if (!approvedPlanHash || !PLAN_HASH.test(approvedPlanHash)) return { error: '--execute requires --approved-plan-hash=<64 hex characters>' }
    if (!approvedSourceRevision || !PLAN_HASH.test(approvedSourceRevision)) return { error: '--execute requires --approved-source-revision=<64 hex characters>' }
    const reference = decisionReference?.trim() ?? ''
    if (reference.length === 0 || reference.length > 200) return { error: '--execute requires --decision-reference of 1 to 200 characters' }
    return { organizationId, limit, json: argv.includes('--json'), execute: true, issuerUserId, approvedPlanHash, approvedSourceRevision, decisionReference: reference }
  }
  return { organizationId, limit, json: argv.includes('--json'), execute: false }
}

export function exitCodeFor(report: OwnershipReport): 0 | 1 {
  return report.findings.length === 0 ? 0 : 1
}

async function main(): Promise<number> {
  const url = process.env.CASE_OWNERSHIP_RECONCILE_DATABASE_URL
  if (!url) {
    console.error('CASE_OWNERSHIP_RECONCILE_DATABASE_URL is required (no application credential is read implicitly).')
    return 2
  }
  const args = parseArguments(process.argv.slice(2))
  if ('error' in args) {
    console.error(args.error)
    return 2
  }
  const sql = postgres(url, { max: 1, onnotice: () => undefined })
  try {
    const execFor = (tx: { unsafe: (text: string, params: never[]) => Promise<unknown> }) => ({
      query: async (text: string, params?: unknown[]) => ({ rows: (await tx.unsafe(text, (params ?? []) as never[])) as never }),
    })
    if (args.execute) {
      const executed = await sql.begin(async (tx) => {
        const exec = execFor(tx)
        const plan = await planOwnershipBackfill(exec as never, canonicalMembershipSource, args.organizationId, { limit: args.limit })
        const result = await executeOwnershipBackfill(exec as never, { memberships: canonicalMembershipSource }, {
          organizationId: args.organizationId,
          issuerUserId: args.issuerUserId!,
          approvedPlanHash: args.approvedPlanHash!,
          approvedSourceRevision: args.approvedSourceRevision!,
          decisionReference: args.decisionReference!,
          effectiveAt: new Date(),
          limit: args.limit,
        })
        return { plan, result }
      })
      const quarantine = executed.plan.deferred
      const payload = {
        assigned: executed.result.assigned,
        planHash: executed.result.planHash,
        sourceRevision: executed.result.sourceRevision,
        replayed: executed.result.replayed,
        quarantine,
      }
      if (args.json) console.log(JSON.stringify(payload, null, 2))
      else {
        console.log(`assigned ${payload.assigned.length} case(s); plan ${payload.planHash}`)
        console.log(`quarantine ${quarantine.length} deferred finding(s); none of these were assigned`)
        for (const f of quarantine) console.log(`  quarantine ${f.kind} case ${f.caseId} legacy=${f.legacyOwner ?? '-'} ${f.detail}`)
      }
      return 0
    }
    const report = await sql.begin('READ ONLY', async (tx) => {
      const exec = execFor(tx)
      const reconciled = await reconcileCaseOwnership(exec as never, canonicalMembershipSource, args.organizationId, { limit: args.limit })
      const plan = await planOwnershipBackfill(exec as never, canonicalMembershipSource, args.organizationId, { limit: args.limit })
      return { reconciled, plan }
    })
    const quarantine = report.plan.deferred
    if (args.json) {
      console.log(JSON.stringify({ ...report.reconciled, planHash: report.plan.planHash, sourceRevision: report.plan.sourceRevision, candidates: report.plan.candidates, quarantine }, null, 2))
    } else {
      const body = report.reconciled
      console.log(`organization ${body.organizationId}: ${body.casesExamined} case(s) examined${body.truncated ? ' (truncated; raise --limit)' : ''}`)
      console.log(`plan ${report.plan.planHash}; source ${report.plan.sourceRevision}; ${report.plan.candidates.length} backfill candidate(s); quarantine ${quarantine.length} deferred finding(s)`)
      for (const [kind, count] of Object.entries(body.counts)) console.log(`  ${kind}: ${count}`)
      for (const f of body.findings) console.log(`  ${f.kind} case ${f.caseId} legacy=${f.legacyOwner ?? '-'} kernel=[${f.kernelAssignees.join(',')}] ${f.detail}`)
      for (const f of quarantine) console.log(`  quarantine ${f.kind} case ${f.caseId}`)
    }
    return exitCodeFor(report.reconciled)
  } catch (error) {
    console.error(`case ownership reconciliation could not run: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  } finally {
    await sql.end({ timeout: 5 })
  }
}

if (process.argv[1] && /reconcile-case-ownership\.ts$/.test(process.argv[1].replace(/\\/g, '/'))) {
  main().then((code) => process.exit(code))
}
