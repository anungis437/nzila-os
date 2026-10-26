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
 * Exit codes: 0 no drift (every legacy owner is aligned with a kernel assignee), 1 drift found, 2 the check could not run.
 */
import postgres from 'postgres'
import { reconcileCaseOwnership, type OwnershipReport } from '../lib/authority/store/case-ownership'
import { canonicalMembershipSource } from '../lib/authority/store/identity'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseArguments(argv: readonly string[]): { organizationId: string; limit?: number; json: boolean } | { error: string } {
  const value = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  const organizationId = value('organization')
  if (!organizationId || !UUID.test(organizationId)) return { error: '--organization=<uuid> is required' }
  const limitText = value('limit')
  const limit = limitText === undefined ? undefined : Number(limitText)
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 5000)) return { error: '--limit must be an integer from 1 to 5000' }
  return { organizationId, limit, json: argv.includes('--json') }
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
    const report = await sql.begin('READ ONLY', async (tx) => {
      const exec = { query: async (text: string, params?: unknown[]) => ({ rows: (await tx.unsafe(text, (params ?? []) as never[])) as never }) }
      return reconcileCaseOwnership(exec as never, canonicalMembershipSource, args.organizationId, { limit: args.limit })
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log(`organization ${report.organizationId}: ${report.casesExamined} case(s) examined${report.truncated ? ' (truncated; raise --limit)' : ''}`)
      for (const [kind, count] of Object.entries(report.counts)) console.log(`  ${kind}: ${count}`)
      for (const f of report.findings) console.log(`  ${f.kind} case ${f.caseId} legacy=${f.legacyOwner ?? '-'} kernel=[${f.kernelAssignees.join(',')}] ${f.detail}`)
    }
    return exitCodeFor(report)
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
