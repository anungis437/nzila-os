/**
 * Seed test accounts for email/password authentication.
 *
 * Sets Argon2id-hashed passwords on existing seed-master users from client orgs,
 * and creates matching user_management.organization_users rows so login sessions
 * are properly org-scoped.
 *
 * Client orgs seeded (3 accounts each):
 *   - CUPE Local 123  (local)    — alice.johnson, bob.smith, grace.lee
 *   - CAPE-ACEP        (union)    — g.phillips, a.moreau, a.hassan
 *   - CLC              (congress) — h.yussuff, f.alrashid, a.varga
 *   - CUPE National    (union)    — m.hancock, f.hahn, d.bhullar
 *
 * Password for all: Test1234!
 *
 * Prerequisites: seed-master.sql must be applied first.
 * Usage: node scripts/seed-test-auth-accounts.mjs
 */
import argon2 from 'argon2'
import postgres from 'postgres'

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://nzila:nzila_dev@localhost:5433/nzila_automation'

const sql = postgres(DATABASE_URL)

const TEST_PASSWORD = 'Test1234!'

// Authoritative org UUIDs from seed-master.sql
const ORGS = {
  CUPE_L123:    '9210418f-6a4f-4dab-a7d2-4450d581dc81',
  CAPE_ACEP:    '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6',
  CLC:          '9588c826-a543-4d43-9c22-2e477e532649',
  CUPE_NATIONAL:'7bc67951-0cd1-40eb-b0bf-da84452cf345',
}

const ACCOUNTS = [
  // ── CUPE Local 123 ──────────────────────────────────────────
  {
    userId: 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8',
    email: 'alice.johnson@city.toronto.ca',
    orgId: ORGS.CUPE_L123,
    role: 'president',
  },
  {
    userId: 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV',
    email: 'bob.smith@city.toronto.ca',
    orgId: ORGS.CUPE_L123,
    role: 'steward',
  },
  {
    userId: 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv',
    email: 'grace.lee@city.toronto.ca',
    orgId: ORGS.CUPE_L123,
    role: 'member',
  },
  // ── CAPE-ACEP ───────────────────────────────────────────────
  {
    userId: 'user_3BSyETlaLS6t8wuol22bVECjPFM',
    email: 'g.phillips@acep-cape.ca',
    orgId: ORGS.CAPE_ACEP,
    role: 'president',
  },
  {
    userId: 'user_3BSzE5AtIbImjHukqc0yM9EXQdu',
    email: 'a.moreau@acep-cape.ca',
    orgId: ORGS.CAPE_ACEP,
    role: 'steward',
  },
  {
    userId: 'user_3BSzEIf1ARXNRQOs3d5Qju58yNZ',
    email: 'a.hassan@acep-cape.ca',
    orgId: ORGS.CAPE_ACEP,
    role: 'member',
  },
  // ── CLC ─────────────────────────────────────────────────────
  {
    userId: 'user_3BSyEWUb0cnQ56CSS0W0fK8g35a',
    email: 'h.yussuff@clc-ctc.ca',
    orgId: ORGS.CLC,
    role: 'clc_executive',
  },
  {
    userId: 'user_3BSzDtwjg8WXJf36fw9wjVTu8yX',
    email: 'f.alrashid@clc-ctc.ca',
    orgId: ORGS.CLC,
    role: 'secretary_treasurer',
  },
  {
    userId: 'user_3BSzDiXRbv3kAsmbUqzOjvVv7o7',
    email: 'a.varga@clc-ctc.ca',
    orgId: ORGS.CLC,
    role: 'member',
  },
  // ── CUPE National ──────────────────────────────────────────
  {
    userId: 'user_3BnpKGiePftiVYeaYF24EIplB8S',
    email: 'm.hancock@cupe.ca',
    orgId: ORGS.CUPE_NATIONAL,
    role: 'president',
  },
  {
    userId: 'user_3BnpKX2MbXVFmlOSguGMnHX6Riq',
    email: 'f.hahn@cupe.ca',
    orgId: ORGS.CUPE_NATIONAL,
    role: 'vice_president',
  },
  {
    userId: 'user_3BnpKjP8KVVfFGSEozJifxfgJZQ',
    email: 'd.bhullar@cupe.ca',
    orgId: ORGS.CUPE_NATIONAL,
    role: 'member',
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

  for (const acct of ACCOUNTS) {
    // Set password on existing user_management.users row
    await sql`
      UPDATE user_management.users
      SET password_hash = ${hash},
          email_verified = true,
          email_verified_at = NOW(),
          updated_at = NOW()
      WHERE user_id = ${acct.userId}
    `

    // Upsert organization_users for login session scoping
    await sql`
      INSERT INTO user_management.organization_users (
        user_id, organization_id, role, is_primary, is_active
      ) VALUES (
        ${acct.userId}, ${acct.orgId}, ${acct.role}, true, true
      )
      ON CONFLICT (user_id, organization_id) DO UPDATE SET
        role = ${acct.role},
        is_primary = true,
        is_active = true,
        updated_at = NOW()
    `

    console.log(`  ${acct.email} (${acct.role})`)
  }

  await sql.end()
  console.log(`\n${ACCOUNTS.length} accounts ready. Password: ${TEST_PASSWORD}`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
