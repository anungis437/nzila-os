#!/usr/bin/env npx tsx
/**
 * Clean Proof Artifacts — removes the proof-artifacts/ directory.
 *
 * Usage:
 *   npx tsx scripts/proof/clean-proof-artifacts.ts
 */
import { rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname2 = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname2, '..', '..')
const ARTIFACT_DIR = join(ROOT, 'proof-artifacts')

if (existsSync(ARTIFACT_DIR)) {
  rmSync(ARTIFACT_DIR, { recursive: true })
  console.log('✓ Removed proof-artifacts/')
} else {
  console.log('ℹ proof-artifacts/ does not exist — nothing to clean')
}
