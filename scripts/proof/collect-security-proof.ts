#!/usr/bin/env tsx
/**
 * collect-security-proof.ts
 *
 * Scans reports/security/ for known artifact types:
 *   - SBOM files (*.sbom.json, *sbom*.json, *bom*.json)
 *   - Trivy scan results (*trivy*.json)
 *   - Gitleaks reports (*gitleaks*.json)
 *   - npm/pnpm audit reports (*audit*.json)
 *
 * If none found: produces a bootstrap-labelled unknown record.
 * Output: reports/runtime/security-proof-latest.json
 */
import { writeFile, stat, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, relative, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', '..').replace(/\\/g, '/')

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
}

function canonicalPath(value: string): string {
  const normalized = normalizePath(value)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function isWithinBase(candidate: string, base: string): boolean {
  const candidateCanonical = canonicalPath(candidate)
  const baseCanonical = canonicalPath(base)
  return candidateCanonical === baseCanonical || candidateCanonical.startsWith(`${baseCanonical}/`)
}

function safeJoinUnder(base: string, ...parts: string[]): string | null {
  if (parts.some((part) => part.includes('\0') || /(^|[\\/])\.\.([\\/]|$)/.test(part))) return null
  const candidate = normalizePath([base, ...parts].join('/'))
  return isWithinBase(candidate, base) ? candidate : null
}

const SECURITY_DIR = join(ROOT, 'reports', 'security')
const OUTPUT_DIR = join(ROOT, 'reports', 'runtime')
const OUTPUT_FILE = join(OUTPUT_DIR, 'security-proof-latest.json')

type ArtifactKind = 'sbom' | 'trivy' | 'gitleaks' | 'audit' | 'unknown'

interface SecurityArtifact {
  kind: ArtifactKind
  path: string
  relativePath: string
  sizeBytes: number
  sha256: string
  modifiedAt: string
  bootstrapEvidence: boolean
  status: 'present' | 'missing'
}

interface SecurityProofSnapshot {
  generatedAt: string
  securityDir: string
  artifacts: SecurityArtifact[]
  artifactCount: number
  overallStatus: 'pass' | 'warn' | 'unknown'
  bootstrapEvidence: boolean
  notes: string[]
}

function detectKind(filename: string): ArtifactKind {
  const lower = filename.toLowerCase()
  if (lower.includes('sbom') || lower.includes('bom')) return 'sbom'
  if (lower.includes('trivy')) return 'trivy'
  if (lower.includes('gitleaks')) return 'gitleaks'
  if (lower.includes('audit')) return 'audit'
  return 'unknown'
}

async function hashFile(filePath: string): Promise<string> {
  if (!isWithinBase(filePath, ROOT)) {
    throw new Error(`Unsafe path outside repository root: ${filePath}`)
  }
  return execFileSync(
    process.execPath,
    [
      '-e',
      'const fs=require("node:fs");const crypto=require("node:crypto");const b=fs.readFileSync(process.argv[1]);process.stdout.write(crypto.createHash("sha256").update(b).digest("hex"));',
      filePath,
    ],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  ).trim()
}

// glob is available in Node 22+; fall back to manual pattern match for Node 20
async function findJsonFiles(dir: string): Promise<string[]> {
  const found: string[] = []
  try {
    // Use glob if available (Node 22+)
    const g = glob as (pattern: string, opts: { cwd: string }) => AsyncIterable<string>
    for await (const f of g('**/*.json', { cwd: dir })) {
      const fullPath = safeJoinUnder(dir, f)
      if (fullPath) found.push(fullPath)
    }
  } catch {
    // Fallback: walk only top-level directory
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.json')) {
        const fullPath = safeJoinUnder(dir, e.name)
        if (fullPath) found.push(fullPath)
      }
    }
  }
  return found
}

async function main(): Promise<void> {
  console.log('[collect-security-proof] Scanning for security artifacts...')

  if (!existsSync(SECURITY_DIR)) {
    console.warn(
      `[collect-security-proof] No security dir found: ${SECURITY_DIR} — writing bootstrap record`,
    )
    const snapshot: SecurityProofSnapshot = {
      generatedAt: new Date().toISOString(),
      securityDir: SECURITY_DIR,
      artifacts: [],
      artifactCount: 0,
      overallStatus: 'unknown',
      bootstrapEvidence: true,
      notes: ['reports/security directory does not exist — no scans available'],
    }
    await mkdir(OUTPUT_DIR, { recursive: true })
    await writeFile(OUTPUT_FILE, JSON.stringify(snapshot, null, 2), 'utf-8')
    console.log(`[collect-security-proof] Written bootstrap record: ${OUTPUT_FILE}`)
    process.exit(0)
  }

  const allFiles = await findJsonFiles(SECURITY_DIR)
  const securityFiles = allFiles.filter((f) => {
    const name = basename(f).toLowerCase()
    return (
      name.includes('sbom') ||
      name.includes('bom') ||
      name.includes('trivy') ||
      name.includes('gitleaks') ||
      name.includes('audit')
    )
  })

  const artifacts: SecurityArtifact[] = []
  const notes: string[] = []

  for (const filePath of securityFiles) {
    try {
      const info = await stat(filePath)
      const sha256 = await hashFile(filePath)
      const kind = detectKind(basename(filePath))
      const relPath = relative(ROOT, filePath).replace(/\\/g, '/')

      artifacts.push({
        kind,
        path: filePath,
        relativePath: relPath,
        sizeBytes: info.size,
        sha256: sha256.slice(0, 16),
        modifiedAt: info.mtime.toISOString(),
        bootstrapEvidence: false,
        status: 'present',
      })

      console.log(`  ✓ ${kind}: ${relPath} (${info.size} bytes)`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      notes.push(`Could not read ${filePath}: ${msg}`)
      console.warn(`  ✗ ${filePath}: ${msg}`)
    }
  }

  const isBootstrap = artifacts.length === 0
  if (isBootstrap) {
    notes.push(
      'No recognized security artifacts found in reports/security/ — bootstrap placeholder',
    )
  }

  const overallStatus: 'pass' | 'warn' | 'unknown' = isBootstrap
    ? 'unknown'
    : artifacts.length >= 2
      ? 'pass'
      : 'warn'

  const snapshot: SecurityProofSnapshot = {
    generatedAt: new Date().toISOString(),
    securityDir: SECURITY_DIR,
    artifacts,
    artifactCount: artifacts.length,
    overallStatus,
    bootstrapEvidence: isBootstrap,
    notes,
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(OUTPUT_FILE, JSON.stringify(snapshot, null, 2), 'utf-8')

  console.log(`[collect-security-proof] Written: ${OUTPUT_FILE}`)
  console.log(
    `  artifacts=${artifacts.length}, status=${overallStatus}${isBootstrap ? ' [bootstrap]' : ''}`,
  )
  process.exit(0)
}

main().catch((err: unknown) => {
  console.error('[collect-security-proof] Fatal error:', err)
  process.exit(1)
})
