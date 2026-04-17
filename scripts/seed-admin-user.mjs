/**
 * One-shot script: seeds a platform_admin user for local console dev.
 * Run: node scripts/seed-admin-user.mjs
 */
import argon2 from 'argon2'
import pg from 'pg'

const { Client } = pg

const ADMIN_EMAIL = 'info@nzilaventures.com'
const ADMIN_PASSWORD = 'Nzila@Admin2026!'
const USER_ID = 'user_platform_admin_dev'

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
}

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    user: 'nzila',
    password: 'nzila_dev',
    database: 'nzila_automation',
  })

  await client.connect()

  // Check if already exists
  const existing = await client.query(
    `SELECT user_id, email FROM user_management.users WHERE email = $1`,
    [ADMIN_EMAIL],
  )

  if (existing.rows.length > 0) {
    console.log(`✓ Admin user already exists: ${existing.rows[0].email} (${existing.rows[0].user_id})`)
    console.log(`  Updating password hash...`)
    const hash = await argon2.hash(ADMIN_PASSWORD, ARGON2_OPTIONS)
    await client.query(
      `UPDATE user_management.users SET password_hash = $1, is_active = true, account_locked_until = NULL, failed_login_attempts = 0 WHERE email = $2`,
      [hash, ADMIN_EMAIL],
    )
    console.log(`✓ Password updated.`)
  } else {
    console.log(`Hashing password...`)
    const hash = await argon2.hash(ADMIN_PASSWORD, ARGON2_OPTIONS)

    await client.query(
      `INSERT INTO user_management.users
        (user_id, email, password_hash, first_name, last_name, is_active, failed_login_attempts, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, 0, NOW(), NOW())`,
      [USER_ID, ADMIN_EMAIL, hash, 'Platform', 'Admin'],
    )
    console.log(`✓ Created admin user: ${ADMIN_EMAIL}`)
  }

  console.log(`\nLogin credentials:`)
  console.log(`  Email:    ${ADMIN_EMAIL}`)
  console.log(`  Password: ${ADMIN_PASSWORD}`)
  console.log(`  Console:  http://localhost:3001`)

  await client.end()
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
