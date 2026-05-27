#!/usr/bin/env tsx
/**
 * Nzila OS — Evidence Reproducibility Check
 *
 * Verifies that evidence packs are deterministically reproducible by:
 *   1. Regenerating a compliance snapshot
 *   2. Regenerating an evidence pack
 *   3. Regenerating a procurement pack
 *   4. Comparing hashes of the two independent runs
 *
 * If hashes match, evidence is reproducible. If not, a drift has occurred.
 *
 * Usage:
 *   pnpm exec tsx scripts/reproduce-evidence.ts
 *
 * Exit codes:
 *   0 — evidence reproducible
 *   1 — evidence mismatch detected
 *
 * @module scripts/reproduce-evidence
 */
import { createHash } from 'node:crypto'
import {
  collectProcurementPack,
  signProcurementPack,
  createRealPorts,
} from '@nzila/platform-procurement-proof'
import { nowISO } from '@nzila/platform-utils/time'

// ── Helpers ─────────────────────────────────────────────────────────────────

let passCount = 0
let failCount = 0

function ok(msg: string): void {
  passCount++
  process.stdout.write(`  \u2714 ${msg}\n`)
}

function fail(msg: string): void {
  failCount++
  process.stderr.write(`  \u2718 ${msg}\n`)
}

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex')
}

/**
 * Deterministically hash a procurement pack by hashing only its section data
 * (excluding packId, timestamps, and signatures which vary between runs).
 */
function hashPackSections(pack: Record<string, unknown>): string {
  const sections = pack.sections
  if (sections != null && typeof sections === 'object' && !Array.isArray(sections)) {
    // ProcurementPack.sections is an object with named keys
    // Hash only the section values, sorted by key for determinism
    const keys = Object.keys(sections as Record<string, unknown>).sort()
    const sectionData = keys.map((key) => ({
      key,
      data: stripVolatileFields((sections as Record<string, unknown>)[key]),
    }))
    return sha256(JSON.stringify(sectionData, null, 0))
  }

  if (Array.isArray(sections)) {
    const sectionData = (sections as Array<Record<string, unknown>>).map((s) => ({
      section: s.section,
      status: s.status,
      data: s.data,
    }))
    return sha256(JSON.stringify(sectionData, null, 0))
  }

  return sha256(JSON.stringify(pack))
}

/**
 * Recursively strip volatile fields (timestamps, UUIDs) from an object
 * so that hashes are reproducible across runs.
 */
function stripVolatileFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(stripVolatileFields)
  }

  const result: Record<string, unknown> = {}
  const volatileKeys = new Set([
    'attestationId', 'auditedAt', 'signedAt', 'lastScanAt',
    'lastPurgeAt', 'validatedAt', 'lastIncidentAt', 'lastEvidencePackAt',
  ])

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (volatileKeys.has(key)) continue
    result[key] = stripVolatileFields(value)
  }

  return result
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  process.stdout.write(`\n\u2501\u2501\u2501 Nzila OS \u2014 Evidence Reproducibility Check \u2501\u2501\u2501\n`)
  process.stdout.write(`Started: ${nowISO()}\n\n`)

  const orgId = 'reproducibility-check'
  const userId = 'reproduce-evidence-script'
  const ports = createRealPorts()

  // ── Run 1: Generate first pack ──────────────────────────────────────────
  process.stdout.write('[1/4] Generating first compliance snapshot + pack\u2026\n')
  let unsigned1: Awaited<ReturnType<typeof collectProcurementPack>>
  try {
    unsigned1 = await collectProcurementPack(orgId, userId, ports)
    ok('First pack generated')
  } catch (err) {
    fail(`First pack generation failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  // ── Run 2: Generate second pack ─────────────────────────────────────────
  process.stdout.write('\n[2/4] Generating second compliance snapshot + pack\u2026\n')
  let unsigned2: Awaited<ReturnType<typeof collectProcurementPack>>
  try {
    unsigned2 = await collectProcurementPack(orgId, userId, ports)
    ok('Second pack generated')
  } catch (err) {
    fail(`Second pack generation failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  // ── Run 3: Sign both packs ─────────────────────────────────────────────
  process.stdout.write('\n[3/4] Signing packs\u2026\n')
  const signed1 = await signProcurementPack(unsigned1, ports)
  const signed2 = await signProcurementPack(unsigned2, ports)
  ok('Both packs signed')

  // ── Run 4: Compare section-level hashes ─────────────────────────────────
  process.stdout.write('\n[4/4] Comparing evidence hashes\u2026\n')
  const hash1 = hashPackSections(signed1 as unknown as Record<string, unknown>)
  const hash2 = hashPackSections(signed2 as unknown as Record<string, unknown>)

  if (hash1 === hash2) {
    ok(`Evidence reproducible (hash: ${hash1.slice(0, 16)}\u2026)`)
  } else {
    fail(`Evidence mismatch`)
    process.stderr.write(`    Run 1 hash: ${hash1}\n`)
    process.stderr.write(`    Run 2 hash: ${hash2}\n`)
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  process.stdout.write(`\n  ${passCount} passed, ${failCount} failed\n\n`)

  if (failCount > 0) {
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
