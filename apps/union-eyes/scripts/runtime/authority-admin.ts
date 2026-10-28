/**
 * Runtime acceptance helper: ends or restores the QA coordinator's supervisory mandate through the application's own authority
 * store (never raw SQL), so a revocation test exercises the real mandate-state path and its audit.
 *
 *   tsx scripts/runtime/authority-admin.ts revoke-mandate <principalUserId>
 *   tsx scripts/runtime/authority-admin.ts restore-fixtures
 *
 * Dev tooling only. It refuses to run unless QA_TEST_ENV=true, and it only touches supervisory mandates in the QA organization.
 */
import pg from 'pg'
import { runAuthorityTransaction, type SqlExecutor } from '@/lib/authority/store/executor'
import { changeMandateState } from '@/lib/authority/store/mutations'
import { UE_TEST_USERS } from '@/tests/fixtures/test-users'
import { seedQaCaseAssignments } from './../seed-test-env-kernel'

async function main(): Promise<void> {
  if (process.env.QA_TEST_ENV !== 'true') throw new Error('authority-admin only runs with QA_TEST_ENV=true')
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const [command, principal] = process.argv.slice(2)
  const organizationId = UE_TEST_USERS.adminPrimary.orgId

  if (command === 'restore-fixtures') {
    console.log(`restored ${await seedQaCaseAssignments(url)} fixture record(s)`)
    return
  }
  if (command !== 'revoke-mandate' || !principal) throw new Error('usage: revoke-mandate <principalUserId> | restore-fixtures')

  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const exec = client as unknown as SqlExecutor
    const live = await client.query(
      `SELECT id::text AS id FROM ue_authority_mandates
        WHERE organization_id = $1 AND principal_user_id = $2 AND kind = 'supervisory' AND status = 'active' AND revoked_at IS NULL`,
      [organizationId, principal],
    )
    for (const row of live.rows) {
      await runAuthorityTransaction(exec, { organizationId, userId: UE_TEST_USERS.adminPrimary.userId }, (tx) =>
        changeMandateState(tx, organizationId, String(row.id), 'revoke', UE_TEST_USERS.adminPrimary.userId),
      )
    }
    console.log(`revoked ${live.rows.length} mandate(s) for ${principal}`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
