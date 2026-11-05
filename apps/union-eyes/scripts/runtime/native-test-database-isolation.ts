/**
 * Runs before every native test file. When UE_NATIVE_TEMPLATE_URL names the pristine converged database, the file gets its
 * own clone of it (CREATE DATABASE ... TEMPLATE) and UE_AUTHORITY_COMBINED_URL / UE_CENSUS_URL point at that clone, so no
 * file sees another file's append-only authority records, leftover fault triggers or earlier runs. The clone is dropped
 * when the file finishes. Without the variable the files run against the database they are given, as before.
 *
 * The connection used to clone must not be a session on the template itself: PostgreSQL refuses to copy a database that
 * is in use, so it connects to the maintenance database `postgres` on the same server.
 */
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { afterAll } from 'vitest'

const templateUrl = process.env.UE_NATIVE_TEMPLATE_URL

if (templateUrl) {
  const template = new URL(templateUrl)
  const templateName = decodeURIComponent(template.pathname.slice(1))
  if (!/^[A-Za-z0-9_]+$/.test(templateName)) throw new Error('UE_NATIVE_TEMPLATE_URL must name a database with a plain identifier')

  const cloneName = `ue_native_${process.pid}_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`
  const maintenance = new URL(templateUrl)
  maintenance.pathname = '/postgres'
  const clone = new URL(templateUrl)
  clone.pathname = `/${cloneName}`

  const admin = new pg.Client({ connectionString: maintenance.toString() })
  await admin.connect()
  try {
    await admin.query(`CREATE DATABASE ${cloneName} TEMPLATE ${templateName}`)
  } finally {
    await admin.end()
  }
  process.env.UE_AUTHORITY_COMBINED_URL = clone.toString()
  process.env.UE_CENSUS_URL = clone.toString()

  afterAll(async () => {
    const cleaner = new pg.Client({ connectionString: maintenance.toString() })
    await cleaner.connect()
    try {
      await cleaner.query(`DROP DATABASE IF EXISTS ${cloneName} WITH (FORCE)`)
    } finally {
      await cleaner.end()
    }
  })
}
