#!/usr/bin/env node
/** Clone-only, verified-TLS, memory-only credential custody. Never reads a credential file. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { planClone, readBaseline, reconcileClone, recoveryContext, validateTarget } from './lib/ue-staging-historical-lineage.mjs'
import { qualifiedTargetFromArgs } from './lib/ue-staging-clone-qualification.mjs'

export async function main(args = process.argv.slice(2)) {
  const mode = args[0]
  if (!['--plan', '--check', '--apply'].includes(mode) || ![5,11].includes(args.length) || args[1] !== '--snapshot' || args[3] !== '--receipt' ||
      (args.length === 11 && (args[5] !== '--qualified-clone-receipt' || args[7] !== '--qualified-clone-signature' || args[9] !== '--qualified-clone-sha256'))) {
    throw new Error('Usage: ue-staging-reconcile-lineage.mjs --plan|--check|--apply --snapshot <baseline.json> --receipt <new-output.json>')
  }
  const snapshot = readBaseline(args[2])
  if (fs.existsSync(args[4])) throw new Error('Receipt output already exists; preserve prior evidence')
  const url = process.env.RLS_MIGRATION_ADMIN_DATABASE_URL
  if (!url) throw new Error('RLS_MIGRATION_ADMIN_DATABASE_URL required in process memory')
  const qualifiedTarget = qualifiedTargetFromArgs(args, args[2])
  const config = validateTarget(url, qualifiedTarget)
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  const migrationsDir = path.join(root, 'apps/union-eyes/db/migrations-cache')
  const options = { snapshot, migrationsDir, journalPath: path.join(migrationsDir, 'meta/_journal.json'), qualifiedTarget }
  const { default: pg } = await import('pg')
  const client = new pg.Client({ ...config, connectionTimeoutMillis: 15000 })
  try {
    await client.connect()
    if (mode === '--plan') await client.query('BEGIN READ ONLY')
    let result
    try {
      result = mode === '--plan' ? await planClone(client, options)
        : mode === '--apply' ? await reconcileClone(client, options) : await recoveryContext(client, options)
    } finally { if (mode === '--plan') await client.query('ROLLBACK') }
    fs.writeFileSync(args[4], JSON.stringify(mode === '--check' ? result.receipt : result, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    console.log(mode === '--plan' ? 'Clone reconciliation plan verified; no database writes.'
      : mode === '--apply' ? 'Clone historical DDL reconciliation recorded; runtime qualification still required.' : 'Clone recovery receipt validated.')
  } finally {
    await client.end()
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const code = /^[A-Z0-9_]{1,40}$/.test(String(error.code ?? '')) ? error.code : 'RECOVERY_REFUSED'
    console.error(`Staging lineage recovery failed (${code}); no credentials logged.`)
    process.exitCode = 1
  })
}
