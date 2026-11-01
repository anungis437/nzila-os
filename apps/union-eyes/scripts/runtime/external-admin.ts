/**
 * Runtime acceptance helper for the legacy external representation tables.
 *
 * There is NO HTTP surface that issues a representation authority or an external matter grant (finding R-41), so the
 * runtime suite cannot obtain one through the application. This script writes a clearly labelled SYNTHETIC fixture
 * straight to the QA database, with text principals (the shape migration 0033 makes possible), so the READ side of the
 * external routes can be exercised. It is not evidence that anyone can be granted access through the product.
 *
 *   tsx scripts/runtime/external-admin.ts seed            one grievance, one active authority, one matter grant (view only)
 *   tsx scripts/runtime/external-admin.ts revoke          revoke the matter grant and the authority
 *   tsx scripts/runtime/external-admin.ts expire          the matter grant expired a minute ago
 *   tsx scripts/runtime/external-admin.ts authority-lapse the authority expired but the matter grant is still active
 *
 * Dev tooling only. It refuses to run unless QA_TEST_ENV=true.
 */
import pg from 'pg'
import { UE_TEST_ORGS } from '@/tests/fixtures/test-orgs'
import { UE_TEST_USERS } from '@/tests/fixtures/test-users'

export const EXTERNAL_MATTER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'
const AUTHORITY_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02'
const GRANT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03'
const PERSON_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee04'

async function main(): Promise<void> {
  if (process.env.QA_TEST_ENV !== 'true') throw new Error('external-admin only runs with QA_TEST_ENV=true')
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const command = process.argv[2]
  const org = UE_TEST_ORGS.primary.id
  const counsel = UE_TEST_USERS.externalCounsel
  const issuer = UE_TEST_USERS.adminPrimary.userId
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    if (command === 'seed') {
      await client.query(`DELETE FROM external_matter_access_grants WHERE id = $1`, [GRANT_ID])
      await client.query(`DELETE FROM representation_authorities WHERE id = $1`, [AUTHORITY_ID])
      await client.query(`DELETE FROM grievances WHERE id = $1`, [EXTERNAL_MATTER_ID])
      await client.query(
        `INSERT INTO grievances (id, organization_id, grievance_number, title, description, status, priority, filed_date, created_at, updated_at,
                                 has_legal_implications, is_arbitration_eligible, is_confidential, is_group_grievance)
         VALUES ($1, $2, 'QA-EXT-0001', 'Synthetic external-collaboration matter', 'PRIVATE internal description that must not reach counsel', 'filed', 'medium',
                 now(), now(), now(), false, false, false, false)`,
        [EXTERNAL_MATTER_ID, org],
      )
      await client.query(
        `INSERT INTO representation_authorities (id, organization_id, matter_type, matter_id, represented_person_id, representative_user_id,
                                                  representative_organization_id, scope, source, status, effective_at, created_by, metadata)
         VALUES ($1, $2, 'grievance', $3, $4, $5, $6, ARRAY['view'], 'recorded_authority', 'active', now() - interval '1 hour', $7,
                 '{"fixture":"synthetic runtime acceptance"}'::jsonb)`,
        [AUTHORITY_ID, org, EXTERNAL_MATTER_ID, PERSON_ID, counsel.userId, counsel.orgId, issuer],
      )
      await client.query(
        `INSERT INTO external_matter_access_grants (id, authority_id, organization_id, matter_type, matter_id, user_id, representative_organization_id,
                                                    status, can_view, can_comment, can_upload_documents, can_view_documents, can_download_documents, granted_by)
         VALUES ($1, $2, $3, 'grievance', $4, $5, $6, 'active', true, false, false, false, false, $7)`,
        [GRANT_ID, AUTHORITY_ID, org, EXTERNAL_MATTER_ID, counsel.userId, counsel.orgId, issuer],
      )
      console.log('seeded the synthetic external fixture')
    } else if (command === 'revoke') {
      await client.query(`UPDATE external_matter_access_grants SET status = 'revoked', revoked_at = now(), revoked_by = $2 WHERE id = $1`, [GRANT_ID, issuer])
      await client.query(`UPDATE representation_authorities SET status = 'revoked', revoked_at = now(), revoked_by = $2 WHERE id = $1`, [AUTHORITY_ID, issuer])
      console.log('revoked the synthetic external fixture')
    } else if (command === 'expire') {
      await client.query(`UPDATE external_matter_access_grants SET expires_at = now() - interval '1 minute' WHERE id = $1`, [GRANT_ID])
      console.log('expired the matter grant')
    } else if (command === 'authority-lapse') {
      await client.query(`UPDATE representation_authorities SET effective_at = now() - interval '2 hours', expires_at = now() - interval '1 minute' WHERE id = $1`, [AUTHORITY_ID])
      console.log('lapsed the authority')
    } else {
      throw new Error('usage: seed | revoke | expire | authority-lapse')
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
