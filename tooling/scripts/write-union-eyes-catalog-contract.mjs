#!/usr/bin/env node
/**
 * Regenerates the packaged catalog contract from the reviewed storage-authority
 * source. The Next.js app imports the JSON. It does not read this script.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SCOPED_NONPUBLIC_PRIVILEGES,
  RUNTIME_SCHEMA_USAGE,
  SYSTEM_SCHEMA_USAGE,
  RLS_REQUIRED_CLASSIFICATIONS,
} from './lib/union-eyes-catalog-authority.mjs'
import { catalogContractDigest, privilegesInOrder } from '../../apps/union-eyes/lib/operations/catalog-admission-core.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const destination = path.join(repoRoot, 'apps/union-eyes/lib/operations/catalog-authority-contract.json')
const exporter = path.join(repoRoot, 'tooling/scripts/export-union-eyes-authority-contract.ts')
const result = spawnSync('pnpm', ['exec', 'tsx', exporter], {
  cwd: path.join(repoRoot, 'apps', 'union-eyes'),
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
})
if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout)
}
const rows = JSON.parse(result.stdout)
const entries = rows
  .map((row) => ({
    table: row.table,
    classification: row.classification,
    runtime: privilegesInOrder(row.runtime),
    system: privilegesInOrder(row.system),
  }))
  .sort((left, right) => left.table.localeCompare(right.table))
const payload = {
  entries,
  nonPublic: SCOPED_NONPUBLIC_PRIVILEGES.map((entry) => ({
    schema: entry.schema,
    table: entry.table,
    runtime: privilegesInOrder(entry.runtime),
    system: privilegesInOrder(entry.system),
  })),
  runtimeSchemaUsage: [...RUNTIME_SCHEMA_USAGE],
  systemSchemaUsage: [...SYSTEM_SCHEMA_USAGE],
  rlsRequired: [...RLS_REQUIRED_CLASSIFICATIONS],
}
const contract = { digest: catalogContractDigest(payload), payload }
fs.writeFileSync(destination, `${JSON.stringify(contract)}\n`)
process.stdout.write(`${destination} ${entries.length} entries ${contract.digest}\n`)
