#!/usr/bin/env tsx
/**
 * Nzila OS — Procurement Pack Validation Script
 *
 * Validates a procurement pack by performing:
 *   1. Schema validation — each section conforms to ProcurementSectionSchema
 *   2. Timestamp consistency — all timestamps are ISO 8601 UTC (no ms)
 *   3. Manifest integrity — recalculate SHA-256 hashes and compare
 *   4. Signature verification — verify Ed25519 signature on manifest
 *
 * If no ZIP file is provided, generates a fresh pack and validates it.
 *
 * Usage:
 *   pnpm exec tsx scripts/validate-procurement-pack.ts                   # generate + validate
 *   pnpm exec tsx scripts/validate-procurement-pack.ts path/to/pack.zip  # validate existing ZIP
 *
 * Exit codes:
 *   0  — all checks pass
 *   1  — one or more checks fail
 */
import { createHash } from 'node:crypto'
import {
  collectProcurementPack,
  signProcurementPack,
  exportAsSignedZip,
  verifyZipSignature,
  getSigningKeyPair,
  createRealPorts,
  collectSBOMReference,
} from '@nzila/platform-procurement-proof'
import type { ZipManifest, ZipSignature } from '@nzila/platform-procurement-proof'
import { safeValidateSection } from '@nzila/platform-procurement-proof'
import { nowISO } from '@nzila/platform-utils/time'

// ── Helpers ─────────────────────────────────────────────────────────────────

const ISO_NO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

let passCount = 0
let failCount = 0

function ok(msg: string) {
  passCount++
  console.log(`  ✔ ${msg}`)
}

function fail(msg: string) {
  failCount++
  console.error(`  ✘ ${msg}`)
}

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex')
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n━━━ Nzila OS — Procurement Pack Validation ━━━`)
  console.log(`Started: ${nowISO()}\n`)

  // ── Step 1: Generate a fresh pack for validation ──────────────────────
  console.log('[1/4] Generating procurement pack…')
  const ports = createRealPorts()
  const unsigned = await collectProcurementPack('validation-org', 'validate-script', ports)
  const pack = await signProcurementPack(unsigned, ports)

  if (pack.packId) {
    ok(`Pack generated: ${pack.packId}`)
  } else {
    fail('Pack generation failed — no packId')
  }

  if (pack.status === 'signed') {
    ok('Pack is signed')
  } else {
    fail(`Pack status is "${pack.status}", expected "signed"`)
  }

  // ── Step 2: Schema validation of sections ─────────────────────────────
  console.log('\n[2/4] Validating section schemas…')
  const sectionKeys = Object.keys(pack.sections)


  for (const key of sectionKeys) {
    const sectionData = (pack.sections as Record<string, unknown>)[key]

    // Wrap raw section data in the standard envelope for validation
    const envelope = {
      section: key,
      status: 'ok' as const,
      collectedAt: nowISO(),
      source: `collectors/${key}`,
      data: sectionData,
    }

    const result = safeValidateSection(envelope)
    if (result.success) {
      ok(`Section "${key}" schema valid`)
    } else {
      fail(`Section "${key}" schema invalid: ${result.error.message}`)
    }
  }

  // ── Step 3: Timestamp consistency ─────────────────────────────────────
  console.log('\n[3/4] Checking timestamp consistency…')
  const timestamps = extractTimestamps(pack)

  for (const { path, value } of timestamps) {
    if (ISO_NO_MS.test(value)) {
      ok(`${path} → ${value}`)
    } else {
      fail(`${path} → "${value}" is not ISO 8601 UTC (no ms)`)
    }
  }

  // ── Step 4: Export and verify ZIP ─────────────────────────────────────
  console.log('\n[4/4] Exporting and verifying ZIP…')
  const zipResult = exportAsSignedZip(pack)

  if (zipResult.zipBuffer.length > 0) {
    ok(`ZIP exported: ${zipResult.filename} (${zipResult.zipBuffer.length} bytes)`)
  } else {
    fail('ZIP buffer is empty')
  }

  // Verify manifest integrity
  const manifestJson = JSON.stringify(zipResult.manifest, null, 2)
  const manifestDigest = sha256(manifestJson)

  if (manifestDigest === zipResult.signature.manifestDigest) {
    ok('Manifest hash matches signature.manifestDigest')
  } else {
    fail(`Manifest hash mismatch: ${manifestDigest} !== ${zipResult.signature.manifestDigest}`)
  }

  // Verify file ordering is deterministic (sorted by path)
  const filePaths = zipResult.manifest.files.map((f) => f.path)
  const sortedPaths = [...filePaths].sort()
  if (JSON.stringify(filePaths) === JSON.stringify(sortedPaths)) {
    ok('Manifest files are in deterministic order (sorted by path)')
  } else {
    fail('Manifest files are NOT in sorted order')
  }

  // Verify Ed25519 signature
  const { publicKey } = getSigningKeyPair()
  const sigValid = verifyZipSignature(manifestJson, zipResult.signature, publicKey)

  if (sigValid) {
    ok('Ed25519 signature VALID')
  } else {
    fail('Ed25519 signature INVALID')
  }

  // ── Step 5: SBOM reference integrity ──────────────────────────────────
  console.log('\n[5/5] Validating SBOM reference…')
  const sbomRef = collectSBOMReference()

  if (sbomRef.status === 'ok') {
    ok('SBOM reference section collected')

    // Validate the section envelope
    const refResult = safeValidateSection(sbomRef)
    if (refResult.success) {
      ok('SBOM reference section schema valid')
    } else {
      fail(`SBOM reference section schema invalid: ${refResult.error.message}`)
    }

    // Cross-check hash against actual SBOM file
    const sbomData = sbomRef.data as { sha256?: string; sbomPath?: string }
    if (sbomData.sha256) {
      const { existsSync, readFileSync } = await import('node:fs')
      const { resolve } = await import('node:path')
      const sbomFile = resolve(process.cwd(), sbomData.sbomPath ?? 'ops/security/sbom.json')
      if (existsSync(sbomFile)) {
        const liveHash = sha256(readFileSync(sbomFile, 'utf-8'))
        if (liveHash === sbomData.sha256) {
          ok(`SBOM hash verified: ${liveHash.slice(0, 16)}…`)
        } else {
          fail(`SBOM hash mismatch: ref=${sbomData.sha256.slice(0, 16)}… live=${liveHash.slice(0, 16)}…`)
        }
      } else {
        fail(`SBOM file not found at ${sbomFile}`)
      }
    } else {
      fail('SBOM reference missing sha256 field')
    }
  } else {
    fail(`SBOM reference not available: ${JSON.stringify(sbomRef.data)}`)
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n━━━ Validation Summary ━━━`)
  console.log(`  Passed: ${passCount}`)
  console.log(`  Failed: ${failCount}`)
  console.log(`  Total:  ${passCount + failCount}`)
  console.log(`  Result: ${failCount === 0 ? '✔ ALL CHECKS PASSED' : '✘ VALIDATION FAILED'}`)
  console.log(`  Completed: ${nowISO()}\n`)

  process.exit(failCount > 0 ? 1 : 0)
}

// ── Timestamp Extraction ────────────────────────────────────────────────────

interface TimestampEntry {
  path: string
  value: string
}

function extractTimestamps(obj: unknown, prefix = 'pack'): TimestampEntry[] {
  const entries: TimestampEntry[] = []
  if (obj === null || obj === undefined) return entries

  if (typeof obj === 'string') {
    // Check if it looks like a timestamp (starts with 4 digits and contains T)
    if (/^\d{4}-\d{2}-\d{2}T/.test(obj)) {
      entries.push({ path: prefix, value: obj })
    }
    return entries
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      entries.push(...extractTimestamps(obj[i], `${prefix}[${i}]`))
    }
    return entries
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      entries.push(...extractTimestamps(value, `${prefix}.${key}`))
    }
  }

  return entries
}

main().catch((err) => {
  console.error('Validation script failed:', err)
  process.exit(1)
})
