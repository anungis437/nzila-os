import { readFileSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { bootstrapFirstAdmin, FirstAdminError, type BootstrapDb } from './first-admin-bootstrap'

/**
 * Operator CLI for the one-time first-administrator bootstrap. Never deployed with the application.
 *
 *   BOOTSTRAP_DATABASE_URL   operator connection (temporary, in-VNet, never an application role)
 *   FIRST_ADMIN_PASSWORD     the initial password (or FIRST_ADMIN_PASSWORD_FILE); never a CLI argument
 *   AUTH_MFA_ENCRYPTION_KEY  the production MFA key (the same value the application uses)
 *
 *   tsx scripts/production/first-admin-cli.ts --operator <id> --user-id <id> --email <addr> \
 *     --organization-id <uuid> [--organization-name <n> --organization-slug <s>] \
 *     [--role admin|executive] [--platform-admin]
 *
 * Output is JSON. On CREATED it contains a one-time TOTP provisioning URI: treat stdout as secret and
 * do not capture it in CI logs.
 */
function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  const url = process.env.BOOTSTRAP_DATABASE_URL
  if (!url) throw new FirstAdminError('INVALID_INPUT', 'BOOTSTRAP_DATABASE_URL is required')
  const password = process.env.FIRST_ADMIN_PASSWORD_FILE
    ? readFileSync(process.env.FIRST_ADMIN_PASSWORD_FILE, 'utf8').trim()
    : process.env.FIRST_ADMIN_PASSWORD
  if (!password) throw new FirstAdminError('INVALID_INPUT', 'FIRST_ADMIN_PASSWORD is required')
  const client = postgres(url, { max: 1, onnotice: () => undefined })
  try {
    const db = drizzle(client) as unknown as BootstrapDb
    const result = await bootstrapFirstAdmin(db, {
      userId: argument('user-id') ?? '',
      email: argument('email') ?? '',
      password,
      organizationId: argument('organization-id') ?? '',
      organizationName: argument('organization-name'),
      organizationSlug: argument('organization-slug'),
      role: (argument('role') ?? 'admin') as 'admin' | 'executive',
      platformAdmin: process.argv.includes('--platform-admin'),
      operator: argument('operator') ?? '',
    })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch((error: unknown) => {
  const code = error instanceof FirstAdminError ? error.code : 'ERROR'
  process.stderr.write(
    `${JSON.stringify({ result: 'REFUSED', code, message: String(error instanceof Error ? error.message : error) })}\n`,
  )
  process.exitCode = error instanceof FirstAdminError ? 2 : 1
})
