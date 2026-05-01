#!/usr/bin/env tsx
/**
 * validate-release-ledger.ts
 *
 * Validates every entry in reports/releases/release-ledger.jsonl against the
 * canonical ReleaseLedgerEntry schema. For non-bootstrap production entries,
 * checks that a linked release manifest exists in ops/releases/.
 *
 * Exit 0 = all entries valid
 * Exit 1 = schema violations or missing manifests detected
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { releaseLedgerEntrySchema } from '../../packages/platform-contracts/src/runtime-evidence'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', '..').replace(/\\/g, '/')

const LEDGER_PATH = join(ROOT, 'reports', 'releases', 'release-ledger.jsonl')

async function main(): Promise<void> {
  if (!existsSync(LEDGER_PATH)) {
    console.error(`[validate-release-ledger] MISSING ledger: ${LEDGER_PATH}`)
    process.exit(1)
  }

  const content = await readFile(LEDGER_PATH, 'utf-8')
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    console.error('[validate-release-ledger] Ledger is empty')
    process.exit(1)
  }

  const failures: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    let raw: unknown

    try {
      raw = JSON.parse(lines[i])
    } catch {
      failures.push(`Line ${lineNum}: invalid JSON`)
      continue
    }

    const result = releaseLedgerEntrySchema.safeParse(raw)
    if (!result.success) {
      const issues = result.error.issues
        .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
        .join('; ')
      failures.push(`Line ${lineNum}: schema violation — ${issues}`)
      continue
    }

    const entry = result.data
    const isBootstrap =
      entry.releaseId.startsWith('bootstrap') ||
      entry.notes?.toLowerCase().includes('bootstrap')

    // Non-bootstrap production entries must have a corresponding release manifest
    if (!isBootstrap && entry.environment === 'staging') {
      const manifestPath = join(
        ROOT,
        'ops',
        'releases',
        `release-v${entry.version}.json`,
      )
      if (!existsSync(manifestPath)) {
        failures.push(
          `Line ${lineNum}: version=${entry.version} is non-bootstrap staging entry but missing manifest: ${manifestPath}`,
        )
      }
    }

    console.log(
      `[validate-release-ledger] ✓ Line ${lineNum}: ${entry.releaseId} (${entry.version}) — ${entry.status}${isBootstrap ? ' [bootstrap]' : ''}`,
    )
  }

  if (failures.length > 0) {
    console.error('\n[validate-release-ledger] FAILURES:')
    for (const f of failures) {
      console.error(`  ✗ ${f}`)
    }
    process.exit(1)
  }

  console.log(
    `\n[validate-release-ledger] PASS — ${lines.length} entries validated`,
  )
  process.exit(0)
}

main().catch((err: unknown) => {
  console.error('[validate-release-ledger] Fatal error:', err)
  process.exit(1)
})
