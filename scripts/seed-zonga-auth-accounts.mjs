/**
 * Seed test accounts for Zonga email/password authentication.
 *
 * Creates password-auth entries for existing Zonga Entra test users
 * and ensures matching organization_users rows exist for session scoping.
 *
 * Accounts seeded:
 *   - Kofi Mensah   (kofi@afrobeatsrecords.com)   — admin
 *   - Ama Adjei     (ama@afrobeatsrecords.com)     — manager
 *   - Kwame Asante  (kwame@afrobeatsrecords.com)   — creator
 *   - Adwoa Boateng (adwoa@afrobeatsrecords.com)   — viewer
 *
 * Password for all: Test1234!
 *
 * Prerequisites: organizations table must have the Zonga org row.
 * Usage: node scripts/seed-zonga-auth-accounts.mjs
 */
import argon2 from 'argon2'
import postgres from 'postgres'

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://nzila:nzila_dev@localhost:5433/nzila_automation'

const sql = postgres(DATABASE_URL)

const TEST_PASSWORD = 'Test1234!'

// Zonga org UUID (from provision-all-test-users.mjs)
const ZONGA_ORG_ID = '33333333-3333-3333-3333-333333333333'

// Zonga test users — Entra OIDs as user_ids
const ACCOUNTS = [
  {
    userId: '50b6a38a-f37d-40ae-b2cf-67e0886ebfe4',
    firstName: 'Kofi',
    lastName: 'Mensah',
    email: 'kofi@afrobeatsrecords.com',
    role: 'admin',
  },
  {
    userId: 'fc4b6b30-5c39-489e-a0a1-4bf7e00c9fd2',
    firstName: 'Ama',
    lastName: 'Adjei',
    email: 'ama@afrobeatsrecords.com',
    role: 'manager',
  },
  {
    userId: '2f9fbe39-cd27-4647-b70c-749a9b8eb91e',
    firstName: 'Kwame',
    lastName: 'Asante',
    email: 'kwame@afrobeatsrecords.com',
    role: 'creator',
  },
  {
    userId: '4adcdb6d-43aa-4fb0-8583-11c862e387d8',
    firstName: 'Adwoa',
    lastName: 'Boateng',
    email: 'adwoa@afrobeatsrecords.com',
    role: 'viewer',
  },
]

async function main() {
  const hash = await argon2.hash(TEST_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })

  console.log('Generated Argon2id hash for test password\n')

  // Ensure Zonga org exists in organizations table
  await sql`
    INSERT INTO organizations (id, name, slug, display_name, organization_type, status, created_at, updated_at)
    VALUES (${ZONGA_ORG_ID}, 'Afrobeats Records', 'afrobeats-records', 'Afrobeats Records', 'label', 'active', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
  console.log('✓ Zonga organization ensured\n')

  console.log('Seeding Zonga auth accounts:')
  for (const acct of ACCOUNTS) {
    // Upsert user in user_management.users
    await sql`
      INSERT INTO user_management.users (
        user_id, email, email_verified, email_verified_at,
        password_hash, first_name, last_name, display_name,
        is_active, created_at, updated_at
      ) VALUES (
        ${acct.userId}, ${acct.email}, true, NOW(),
        ${hash}, ${acct.firstName}, ${acct.lastName},
        ${acct.firstName + ' ' + acct.lastName},
        true, NOW(), NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        password_hash = ${hash},
        email_verified = true,
        email_verified_at = NOW(),
        updated_at = NOW()
    `

    // Upsert organization_users for login session scoping
    await sql`
      INSERT INTO user_management.organization_users (
        user_id, organization_id, role, is_primary, is_active
      ) VALUES (
        ${acct.userId}, ${ZONGA_ORG_ID}, ${acct.role}, true, true
      )
      ON CONFLICT (user_id, organization_id) DO UPDATE SET
        role = ${acct.role},
        is_primary = true,
        is_active = true,
        updated_at = NOW()
    `

    // Also seed organization_members (used by getUserRole / rbac-server)
    await sql`
      INSERT INTO organization_members (id, user_id, organization_id, name, email, role, status, created_at, updated_at)
      VALUES (
        gen_random_uuid(), ${acct.userId}, ${ZONGA_ORG_ID},
        ${acct.firstName + ' ' + acct.lastName}, ${acct.email},
        ${acct.role}, 'active', NOW(), NOW()
      )
      ON CONFLICT DO NOTHING
    `

    console.log(`  ✓ ${acct.email} (${acct.role})`)
  }

  await sql.end()
  console.log(`\n${ACCOUNTS.length} Zonga accounts ready. Password: ${TEST_PASSWORD}`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
