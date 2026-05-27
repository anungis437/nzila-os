/**
 * Staging Seed — generates deterministic seed data for the staging environment.
 * Ensures staging always starts from a reproducible, known-good state.
 *
 * Usage: pnpm exec tsx scripts/staging-seed.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const SEED_DIR = path.join(ROOT, 'ops', 'seed')

interface SeedManifest {
  environment: 'STAGING'
  generated_at: string
  tables: SeedTable[]
}

interface SeedTable {
  name: string
  rows: number
  file: string
}

// ── Deterministic seed data generators ────────────────

function deterministicId(prefix: string, index: number): string {
  return `${prefix}-seed-${String(index).padStart(4, '0')}`
}

function generateOrganizations(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: deterministicId('org', i),
    name: `Seed Organization ${i + 1}`,
    region: i % 2 === 0 ? 'eastus' : 'westeurope',
    tier: i < 3 ? 'enterprise' : 'standard',
    active: true,
    created_at: '2025-01-01T00:00:00Z',
  }))
}

function generateUsers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: deterministicId('user', i),
    email: `seed-user-${i + 1}@nzila-staging.example.com`,
    org_id: deterministicId('org', i % 5),
    role: i < 2 ? 'admin' : 'member',
    active: true,
    created_at: '2025-01-01T00:00:00Z',
  }))
}

function generatePolicies(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: deterministicId('policy', i),
    name: `Seed Policy ${i + 1}`,
    category: ['governance', 'security', 'compliance', 'operational'][i % 4],
    status: 'active',
    version: 1,
    created_at: '2025-01-01T00:00:00Z',
  }))
}

// ── Write seed files ──────────────────────────────────

function writeSeedFile(name: string, data: unknown[]): SeedTable {
  const filePath = path.join(SEED_DIR, `${name}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  return { name, rows: data.length, file: `${name}.json` }
}

// ── Main ──────────────────────────────────────────────

function main() {
  console.log('Staging Seed — generating deterministic seed data...\n')

  // Ensure seed directory
  fs.mkdirSync(SEED_DIR, { recursive: true })

  const tables: SeedTable[] = []

  tables.push(writeSeedFile('organizations', generateOrganizations(5)))
  tables.push(writeSeedFile('users', generateUsers(10)))
  tables.push(writeSeedFile('policies', generatePolicies(8)))

  const manifest: SeedManifest = {
    environment: 'STAGING',
    generated_at: new Date().toISOString(),
    tables,
  }

  const manifestPath = path.join(SEED_DIR, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

  console.log('Seed files generated:')
  for (const t of tables) {
    console.log(`  ✓ ${t.name}: ${t.rows} rows → ops/seed/${t.file}`)
  }
  console.log(`\nManifest: ops/seed/manifest.json`)
  console.log('Done.')
}

main()
