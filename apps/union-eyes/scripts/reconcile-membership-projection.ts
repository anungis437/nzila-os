#!/usr/bin/env tsx
/**
 * ue:membership:reconcile — READ-ONLY drift check between the compatibility membership projection
 * (user_management.organization_users + users, read by the authority kernel and the v2 predicates) and the canonical
 * table (public.platform_organization_memberships). UE-CONV-A-005. It moves no reader and writes nothing: the
 * connection is a READ ONLY transaction that is rolled back.
 *
 * Usage (a credentialed role that can read both relations, e.g. the auth owner or a reporting role):
 *   MEMBERSHIP_RECONCILE_DATABASE_URL=postgres://... pnpm tsx scripts/reconcile-membership-projection.ts [--organization=<uuid>] [--json]
 *
 * Exit codes: 0 consistent, 1 drift found, 2 the check could not run. Drift where the projection grants what the
 * canonical record does not ("stale grants") is listed first, because the kernel reads the projection.
 */
import postgres from 'postgres'
import { reconcileMembershipsFromDatabase } from '../lib/authority/store/membership-reconciliation'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function main(): Promise<number> {
  const url = process.env.MEMBERSHIP_RECONCILE_DATABASE_URL
  if (!url) {
    console.error('MEMBERSHIP_RECONCILE_DATABASE_URL is required (no application credential is read implicitly).')
    return 2
  }
  const organizationArg = process.argv.find((a) => a.startsWith('--organization='))?.slice('--organization='.length)
  if (organizationArg !== undefined && !UUID.test(organizationArg)) {
    console.error('--organization must be a uuid')
    return 2
  }
  const json = process.argv.includes('--json')
  const sql = postgres(url, { max: 1, onnotice: () => undefined })
  try {
    const report = await sql.begin('READ ONLY', async (tx) =>
      reconcileMembershipsFromDatabase(
        { query: async (text, params) => ({ rows: (await tx.unsafe(text, (params ?? []) as never[])) as never }) },
        { organizationId: organizationArg },
      ),
    )
    const ordered = [...report.drifts].sort((a, b) => Number(b.risk === 'PROJECTION_GRANTS_CANONICAL_DENIES') - Number(a.risk === 'PROJECTION_GRANTS_CANONICAL_DENIES'))
    if (json) {
      console.log(JSON.stringify({ ...report, drifts: ordered }, null, 2))
    } else {
      console.log(`projection rows: ${report.projectionRows}, canonical rows: ${report.canonicalRows}, stale grants: ${report.staleGrants}`)
      console.log(JSON.stringify(report.summary))
      for (const d of ordered) console.log(`${d.risk}\t${d.kind}\torg=${d.organizationId}\tuser=${d.userId}\t${d.detail}`)
      console.log(report.consistent ? 'CONSISTENT' : 'DRIFT FOUND')
    }
    return report.consistent ? 0 : 1
  } catch (error) {
    console.error(`membership reconciliation could not run: ${error instanceof Error ? error.message : 'unknown error'}`)
    return 2
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().then((code) => process.exit(code))
