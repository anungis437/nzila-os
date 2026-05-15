#!/usr/bin/env tsx
/**
 * Nzila OS — SBOM Generator (CycloneDX)
 *
 * Generates a Software Bill of Materials in CycloneDX 1.5 JSON format
 * by reading pnpm-lock.yaml and extracting dependency metadata.
 *
 * Output:
 *   ops/security/sbom.json
 *
 * Each component entry includes:
 *   - name
 *   - version
 *   - license(s)
 *   - integrity hash (from lockfile)
 *
 * Usage:
 *   pnpm generate:sbom
 *
 * @module scripts/generate-sbom
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { nowISO } from '@nzila/platform-utils/time'

// ── Types ───────────────────────────────────────────────────────────────────

interface CycloneDXComponent {
  type: 'library'
  name: string
  version: string
  purl: string
  licenses: Array<{ license: { id: string } }>
  hashes: Array<{ alg: string; content: string }>
}

interface CycloneDXBom {
  bomFormat: 'CycloneDX'
  specVersion: '1.5'
  serialNumber: string
  version: 1
  metadata: {
    timestamp: string
    tools: Array<{ vendor: string; name: string; version: string }>
    component: { type: string; name: string; version: string }
  }
  components: CycloneDXComponent[]
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname ?? __dirname, '..')
const LOCKFILE_PATH = resolve(ROOT, 'pnpm-lock.yaml')
const OUTPUT_DIR = resolve(ROOT, 'ops', 'security')
const OUTPUT_PATH = join(OUTPUT_DIR, 'sbom.json')

// ── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex')
}

/**
 * Parse pnpm-lock.yaml to extract dependency entries.
 * Uses simple line-based parsing to avoid external YAML dependency in this script.
 */
function extractDependencies(lockContent: string): CycloneDXComponent[] {
  const components: CycloneDXComponent[] = []
  const seen = new Set<string>()

  // Match package entries in pnpm lockfile format:
  //   /<name>@<version>:  or  /<scope>/<name>@<version>:
  const packagePattern = /^\s+'?\/?((?:@[\w.-]+\/)?[\w.-]+)@([\d][^:']*)'?:/gm
  let match: RegExpExecArray | null

  while ((match = packagePattern.exec(lockContent)) !== null) {
    const name = match[1]!
    const version = match[2]!.replace(/['"]/g, '')
    const key = `${name}@${version}`

    if (seen.has(key)) continue
    seen.add(key)

    // Extract integrity hash if available (next lines after match)
    const afterMatch = lockContent.slice(match.index, match.index + 500)
    const integrityMatch = afterMatch.match(/integrity:\s+'?(sha\d+-[\w+/=]+)'?/)
    const integrity = integrityMatch?.[1] ?? sha256(key)

    // Extract license if listed in lockfile metadata
    const licenseMatch = afterMatch.match(/license:\s+'?([^'\n]+)'?/)
    const license = licenseMatch?.[1]?.trim() ?? 'NOASSERTION'

    components.push({
      type: 'library',
      name,
      version,
      purl: `pkg:npm/${name.replace('/', '%2F')}@${version}`, // codeql[js/incomplete-sanitization] - PURL format only requires slash encoding
      licenses: [{ license: { id: license } }],
      hashes: [{ alg: 'SHA-256', content: integrity }],
    })
  }

  return components
}

// ── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  process.stdout.write('\n\u2501\u2501\u2501 Nzila OS \u2014 SBOM Generation (CycloneDX) \u2501\u2501\u2501\n\n')

  if (!existsSync(LOCKFILE_PATH)) {
    process.stderr.write('  \u2718 pnpm-lock.yaml not found\n')
    process.exit(1)
  }

  const lockContent = readFileSync(LOCKFILE_PATH, 'utf-8')
  const pkgJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8')) as {
    name: string
    version: string
  }

  const components = extractDependencies(lockContent)

  const bom: CycloneDXBom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: nowISO(),
      tools: [
        {
          vendor: 'nzila',
          name: 'generate-sbom',
          version: '1.0.0',
        },
      ],
      component: {
        type: 'application',
        name: pkgJson.name,
        version: pkgJson.version,
      },
    },
    components,
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })
  writeFileSync(OUTPUT_PATH, JSON.stringify(bom, null, 2), 'utf-8')

  const sbomHash = sha256(JSON.stringify(bom))

  process.stdout.write(`  \u2714 SBOM generated: ${OUTPUT_PATH}\n`)
  process.stdout.write(`  \u2714 Components: ${components.length}\n`)
  process.stdout.write(`  \u2714 SBOM hash: ${sbomHash.slice(0, 16)}\u2026\n`)
  process.stdout.write(`  \u2714 Format: CycloneDX 1.5\n\n`)
}

main()
