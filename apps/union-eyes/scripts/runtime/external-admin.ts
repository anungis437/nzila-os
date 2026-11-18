/**
 * Runtime acceptance helper for the legacy external representation tables.
 *
 * There is NO HTTP surface that issues a representation authority or an external matter grant (finding R-41), so the
 * runtime suite cannot obtain one through the application. This script writes a clearly labelled SYNTHETIC fixture
 * straight to the QA database, with text principals (the shape migration 0033 makes possible), so the READ side of the
 * external representative routes can be exercised. It is not a counsel/WorkAid assertion or evidence that anyone can be granted access through the product.
 *
 *   tsx scripts/runtime/external-admin.ts seed            one grievance, one active authority, one matter grant (view only)
 *   tsx scripts/runtime/external-admin.ts revoke          revoke the matter grant and the authority
 *   tsx scripts/runtime/external-admin.ts expire          the matter grant expired a minute ago
 *   tsx scripts/runtime/external-admin.ts authority-lapse the authority expired but the matter grant is still active
 *
 * Dev tooling only. It refuses to run unless QA_TEST_ENV=true.
 */
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { ownedRuntimeOperatorUrl } from './fixture-auth'
import { UE_TEST_ORGS } from '@/tests/fixtures/test-orgs'
import { UE_TEST_USERS } from '@/tests/fixtures/test-users'

export const EXTERNAL_MATTER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'
const fixtureMarker = 'owned synthetic external representative READ only; issuance is not qualified'

async function main(): Promise<void> {
  const url = ownedRuntimeOperatorUrl()
  const command = process.argv[2]
  if (!['seed', 'revoke', 'expire', 'authority-lapse'].includes(command))
    throw new Error('usage: seed | revoke | expire | authority-lapse')
  const org = UE_TEST_ORGS.primary.id
  const representative = UE_TEST_USERS.externalCounsel
  const issuer = UE_TEST_USERS.adminPrimary.userId
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1,0))',
      [`owned-external-fixture:${EXTERNAL_MATTER_ID}`],
    )
    const prior = (
      await client.query(
        `SELECT organization_id,represented_member_user_id,created_by,title FROM public.grievances WHERE id=$1 FOR UPDATE`,
        [EXTERNAL_MATTER_ID],
      )
    ).rows
    if (
      prior.some(
        (row) =>
          row.organization_id !== org ||
          row.represented_member_user_id !== UE_TEST_USERS.memberPrimary.userId ||
          row.created_by !== issuer ||
          row.title !== 'Synthetic external-collaboration matter',
      )
    )
      throw new Error('Existing external fixture matter provenance differs')
    const authorityRows = (
      await client.query(
        `SELECT id,status,metadata FROM public.representation_authorities WHERE organization_id=$1 AND matter_type='grievance' AND matter_id=$2 AND representative_user_id=$3 AND representative_organization_id=$4 FOR UPDATE`,
        [org, EXTERNAL_MATTER_ID, representative.userId, representative.orgId],
      )
    ).rows
    if (authorityRows.some((row) => row.metadata?.fixture !== fixtureMarker))
      throw new Error('Existing external fixture authority provenance differs')
    const authorityIds = authorityRows.map((row) => row.id)
    const grants = (
      await client.query(
        `SELECT id,authority_id,status FROM public.external_matter_access_grants WHERE organization_id=$1 AND matter_type='grievance' AND matter_id=$2 AND user_id=$3 AND representative_organization_id=$4 FOR UPDATE`,
        [org, EXTERNAL_MATTER_ID, representative.userId, representative.orgId],
      )
    ).rows
    if (grants.some((row) => !authorityIds.includes(row.authority_id)))
      throw new Error('External fixture grant provenance differs')
    if (
      authorityRows.filter((row) => row.status === 'active').length > 1 ||
      grants.filter((row) => row.status === 'active').length > 1
    )
      throw new Error('Conflicting active external fixtures')
    if (command === 'seed') {
      // Append a new synthetic grant lifecycle. Earlier matters, revocations,
      // reads and grant rows survive every repeated fixture preparation.
      await client.query(
        `UPDATE public.external_matter_access_grants SET status='revoked',revoked_at=clock_timestamp(),revoked_by=$5 WHERE organization_id=$1 AND matter_id=$2 AND user_id=$3 AND representative_organization_id=$4 AND authority_id=ANY($6::uuid[]) AND status='active'`,
        [
          org,
          EXTERNAL_MATTER_ID,
          representative.userId,
          representative.orgId,
          issuer,
          authorityIds,
        ],
      )
      await client.query(
        `UPDATE public.representation_authorities SET status='revoked',revoked_at=clock_timestamp(),revoked_by=$5 WHERE organization_id=$1 AND matter_id=$2 AND representative_user_id=$3 AND representative_organization_id=$4 AND id=ANY($6::uuid[]) AND status='active'`,
        [
          org,
          EXTERNAL_MATTER_ID,
          representative.userId,
          representative.orgId,
          issuer,
          authorityIds,
        ],
      )
      const represented = (
        await client.query('SELECT id FROM public.profiles WHERE user_id=$1 AND email=$2', [
          UE_TEST_USERS.memberPrimary.userId,
          UE_TEST_USERS.memberPrimary.email,
        ])
      ).rows
      if (represented.length !== 1) throw new Error('Actual represented fixture entity required')
      // profiles.id is the represented entity reference, never an authority
      // principal. The canonical text principal is stored independently below.
      if (!prior.length)
        await client.query(
          `INSERT INTO public.grievances (id, organization_id, grievance_number, type, title, description, status, priority, filed_date, created_at, updated_at,represented_member_user_id,created_by,
                                 has_legal_implications, is_arbitration_eligible, is_confidential, is_group_grievance)
         VALUES ($1, $2, 'QA-EXT-0001', 'individual', 'Synthetic external-collaboration matter', 'PRIVATE internal description that must not reach representative', 'filed', 'medium',
                 now(), now(), now(),$3,$4, false, false, false, false)`,
          [EXTERNAL_MATTER_ID, org, UE_TEST_USERS.memberPrimary.userId, issuer],
        )
      const authorityId = randomUUID()
      await client.query(
        `INSERT INTO public.representation_authorities (id, organization_id, matter_type, matter_id, represented_person_id, representative_user_id,
                                                  representative_organization_id, scope, source, status, effective_at, created_by, metadata)
         VALUES ($1, $2, 'grievance', $3, $4, $5, $6, ARRAY['view'], 'recorded_authority', 'active', now() - interval '1 hour', $7,
                 $8::jsonb)`,
        [
          authorityId,
          org,
          EXTERNAL_MATTER_ID,
          represented[0].id,
          representative.userId,
          representative.orgId,
          issuer,
          JSON.stringify({ fixture: fixtureMarker }),
        ],
      )
      await client.query(
        `INSERT INTO public.external_matter_access_grants (id, authority_id, organization_id, matter_type, matter_id, user_id, representative_organization_id,
                                                    status, can_view, can_comment, can_upload_documents, can_view_documents, can_download_documents, granted_by)
         VALUES ($1, $2, $3, 'grievance', $4, $5, $6, 'active', true, false, false, false, false, $7)`,
        [
          randomUUID(),
          authorityId,
          org,
          EXTERNAL_MATTER_ID,
          representative.userId,
          representative.orgId,
          issuer,
        ],
      )
    } else if (command === 'revoke') {
      await client.query(
        `UPDATE public.external_matter_access_grants SET status='revoked',revoked_at=clock_timestamp(),revoked_by=$5 WHERE organization_id=$1 AND matter_id=$2 AND user_id=$3 AND representative_organization_id=$4 AND authority_id=ANY($6::uuid[]) AND status='active'`,
        [
          org,
          EXTERNAL_MATTER_ID,
          representative.userId,
          representative.orgId,
          issuer,
          authorityIds,
        ],
      )
      await client.query(
        `UPDATE public.representation_authorities SET status='revoked',revoked_at=clock_timestamp(),revoked_by=$5 WHERE organization_id=$1 AND matter_id=$2 AND representative_user_id=$3 AND representative_organization_id=$4 AND id=ANY($6::uuid[]) AND status='active'`,
        [
          org,
          EXTERNAL_MATTER_ID,
          representative.userId,
          representative.orgId,
          issuer,
          authorityIds,
        ],
      )
    } else if (command === 'expire') {
      await client.query(
        `UPDATE public.external_matter_access_grants SET expires_at=clock_timestamp()-interval '1 minute' WHERE organization_id=$1 AND matter_id=$2 AND user_id=$3 AND representative_organization_id=$4 AND authority_id=ANY($5::uuid[]) AND status='active'`,
        [org, EXTERNAL_MATTER_ID, representative.userId, representative.orgId, authorityIds],
      )
    } else if (command === 'authority-lapse') {
      await client.query(
        `UPDATE public.representation_authorities SET effective_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 minute' WHERE organization_id=$1 AND matter_id=$2 AND representative_user_id=$3 AND representative_organization_id=$4 AND id=ANY($5::uuid[]) AND status='active'`,
        [org, EXTERNAL_MATTER_ID, representative.userId, representative.orgId, authorityIds],
      )
    }
    await client.query('COMMIT')
    console.log('Committed owned synthetic external representative fixture operation:', command)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('Owned external fixture operation failed', { name: error?.name, code: error?.code })
  process.exit(1)
})
