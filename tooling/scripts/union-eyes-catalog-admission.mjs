#!/usr/bin/env node
/**
 * Release admission for the Union Eyes catalog.
 *
 * The default path is read-only. It exits 1 when the live database does not
 * match the storage-authority manifest and it does not revoke privileges.
 * `--enforce` is the isolated remediation path and requires
 * UE_PRIVILEGE_ENFORCEMENT=1.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import {
  diagnoseCatalogAuthority,
  formatCatalogDiagnostic,
  remediateCatalogAuthority,
} from './lib/union-eyes-catalog-authority.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const enforce = process.argv.includes('--enforce')
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const client = new pg.Client({ connectionString })
await client.connect()
try {
  if (enforce) {
    await remediateCatalogAuthority(client, { repoRoot })
  }
  const report = await diagnoseCatalogAuthority(client, {
    repoRoot,
    environment: process.env.UE_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
  })
  const diagnostic = formatCatalogDiagnostic(report)
  if (!report.ok) {
    console.error(diagnostic)
    process.exit(1)
  }
  process.stdout.write(`${diagnostic}\n`)
} finally {
  await client.end()
}
