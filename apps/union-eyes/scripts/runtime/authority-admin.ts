/** Owned fixture setup/revocation through actual canonical bearer-bound governance. */
import pg from 'pg'
import { UE_TEST_USERS } from '@/tests/fixtures/test-users'
import { changeMandate } from '@/lib/authority/store/lifecycle'
import { activeMembershipSource } from '@/lib/authority/store/active-membership-source'
import { runtimeFixtureAuthorityContext } from './fixture-auth'
import {
  seedQaCaseAssignments,
  ensureQaCaseSupervision,
  runQaAuthorityActor,
} from '../seed-test-env-kernel'

async function main() {
  const context = runtimeFixtureAuthorityContext()
  const [command, principal, kind = 'supervisory'] = process.argv.slice(2)
  if (command === 'restore-fixtures') {
    await seedQaCaseAssignments(context.operatorUrl, context)
    for (const caseId of process.argv.slice(3))
      await ensureQaCaseSupervision(context.operatorUrl, context, [caseId])
    console.log('Verified current base case fixture governance')
    return
  }
  if (command === 'scope-case') {
    if (!principal) throw new Error('Exact returned fixture case required')
    await ensureQaCaseSupervision(context.operatorUrl, context, [principal])
    console.log('Recorded exact-case synthetic supervision through independent approval')
    return
  }
  if (
    command !== 'revoke-mandate' ||
    kind !== 'supervisory' ||
    !principal ||
    ![UE_TEST_USERS.chiefStewardPrimary.userId, UE_TEST_USERS.supervisorPrimary.userId].some(
      (id) => id === principal,
    )
  )
    throw new Error('Only known base supervisory fixture revocation is supported')
  const operator = new pg.Client({ connectionString: context.operatorUrl })
  await operator.connect()
  try {
    const live = (
      await operator.query(
        `SELECT id::text FROM public.ue_authority_mandates WHERE organization_id=$1 AND principal_user_id=$2 AND kind='supervisory' AND status='active' AND revoked_at IS NULL`,
        [UE_TEST_USERS.executivePrimary.orgId, principal],
      )
    ).rows
    for (const row of live)
      await runQaAuthorityActor(context, UE_TEST_USERS.executivePrimary.userId, (tx) =>
        changeMandate(
          tx,
          { memberships: activeMembershipSource },
          {
            organizationId: UE_TEST_USERS.executivePrimary.orgId,
            mandateId: row.id,
            issuerUserId: UE_TEST_USERS.executivePrimary.userId,
            change: 'revoke',
          },
        ),
      )
    console.log(`Revoked ${live.length} governed supervisory fixture mandate(s)`)
  } finally {
    await operator.end()
  }
}
main().catch((error) => {
  console.error('Owned fixture authority operation failed', {
    name: error?.name,
    code: error?.code,
  })
  process.exitCode = 1
})
