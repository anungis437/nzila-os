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
 *   pnpm exec tsx scripts/generate-sbom.ts
 *
 * @module scripts/generate-sbom
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { nowISO } from '@nzila/platform-utils/time'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

// ── Types ───────────────────────────────────────────────────────────────────

interface CycloneDXComponent {
  type: 'library'
  name: string
  version: string
  purl: string
  licenses: Array<{ license: { name: string } }>
  hashes: Array<{ alg: string; content: string }>
  properties?: Array<{ name: string; value: string }>
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
    properties: Array<{ name: string; value: string }>
  }
  components: CycloneDXComponent[]
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname ?? __dirname, '..')
const LOCKFILE_PATH = resolve(ROOT, 'pnpm-lock.yaml')
const OUTPUT_DIR = resolve(ROOT, 'ops', 'security')
const OUTPUT_PATH = join(OUTPUT_DIR, 'sbom.json')
const METADATA_PATH = join(OUTPUT_DIR, 'npm-package-metadata.json')

interface RegistryEvidence {
  integrity: string
  license: string
  sourceUrl: string
  licenseProvenance?: RegistryLicenseProvenance
}

interface RegistryLicenseProvenance {
  field: 'license' | 'license.type' | 'licenses[0].type' | null
  declaration: { license?: unknown; licenses?: unknown }
}

/** Read declarations only; this does not approve or infer a license. */
export function readRegistryLicense(metadata: { license?: unknown; licenses?: unknown }): {
  license: string
  licenseProvenance: RegistryLicenseProvenance
} {
  const declaration: RegistryLicenseProvenance['declaration'] = {}
  if (Object.hasOwn(metadata, 'license')) declaration.license = metadata.license
  if (Object.hasOwn(metadata, 'licenses')) declaration.licenses = metadata.licenses

  const result = (license = 'NOASSERTION', field: RegistryLicenseProvenance['field'] = null) => ({
    license,
    licenseProvenance: { field, declaration },
  })
  const validType = (value: unknown): value is string =>
    typeof value === 'string' &&
    !!value &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/.test(value)
  const objectType = (value: unknown): string | null => {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !Object.hasOwn(value, 'type') ||
      Object.keys(value).some((key) => key !== 'type' && key !== 'url')
    )
      return null
    const candidate = value as { type?: unknown; url?: unknown }
    if (
      !validType(candidate.type) ||
      (Object.hasOwn(candidate, 'url') && !validType(candidate.url))
    )
      return null
    return candidate.type
  }

  const hasPrimary = Object.hasOwn(declaration, 'license')
  const hasLegacy = Object.hasOwn(declaration, 'licenses')
  const primary =
    typeof declaration.license === 'string'
      ? validType(declaration.license)
        ? declaration.license
        : null
      : objectType(declaration.license)
  const legacy =
    Array.isArray(declaration.licenses) && declaration.licenses.length === 1
      ? objectType(declaration.licenses[0])
      : null
  // Never choose the first item from multiple declarations, or let one valid
  // field mask an invalid/conflicting one. An explicit null/empty primary is
  // not an absent primary and cannot be replaced with a more permissive value.
  if (
    (hasPrimary && !primary) ||
    (hasLegacy && !legacy) ||
    (hasPrimary && hasLegacy && primary !== legacy)
  )
    return result()
  if (hasPrimary && primary)
    return result(primary, typeof declaration.license === 'string' ? 'license' : 'license.type')
  if (hasLegacy && legacy) return result(legacy, 'licenses[0].type')
  return result()
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex')
}

/**
 * Parse pnpm-lock.yaml to extract dependency entries.
 * Uses simple line-based parsing to avoid external YAML dependency in this script.
 */
export function extractDependencies(
  lockContent: string,
  registry: Record<string, RegistryEvidence> = {},
): CycloneDXComponent[] {
  const components: CycloneDXComponent[] = []
  const lock = parse(lockContent, { uniqueKeys: true, maxAliasCount: 0 }) as {
    lockfileVersion?: string | number
    packages?: Record<string, { resolution?: { integrity?: string }; license?: string }>
    snapshots?: Record<string, unknown>
    patchedDependencies?: Record<string, { hash?: string; path?: string }>
  }
  if (!lock || !String(lock.lockfileVersion).startsWith('9') || !lock.packages || !lock.snapshots)
    throw new Error('SBOM requires a complete pnpm v9 lockfile')
  const entries = Object.entries(lock.packages)
  if (!entries.length) throw new Error('SBOM cannot certify an empty package inventory')
  for (const [key, metadata] of entries) {
    // Inventory package identities, never peer or patch suffixes from snapshots.
    const match =
      /^(@[^/\s]+\/[^@\s]+|[^@/\s]+)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/.exec(
        key,
      )
    if (!match || !metadata || typeof metadata !== 'object')
      throw new Error(`Invalid SBOM package identity: ${key}`)
    const [, name, version] = match
    if (!name || !version) throw new Error(`Invalid SBOM package identity: ${key}`)
    const integrity = metadata.resolution?.integrity
    if (typeof integrity !== 'string') throw new Error(`Missing package integrity: ${key}`)
    const sri = /^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})$/.exec(integrity)
    if (!sri) throw new Error(`Invalid package integrity: ${key}`)
    const bytes = Buffer.from(sri[2]!, 'base64')
    const bits = Number(sri[1]!.slice(3))
    if (bytes.length !== bits / 8 || bytes.toString('base64') !== sri[2])
      throw new Error(`Invalid package integrity digest: ${key}`)
    const patch = lock.patchedDependencies?.[key]
    const evidence = registry[key]
    if (
      evidence &&
      (evidence.integrity !== integrity ||
        evidence.sourceUrl !==
          `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}` ||
        typeof evidence.license !== 'string' ||
        !evidence.license.trim())
    )
      throw new Error(`Stale or invalid registry metadata: ${key}`)
    const provenance = evidence?.licenseProvenance
    if (provenance !== undefined) {
      if (
        !provenance ||
        typeof provenance !== 'object' ||
        Array.isArray(provenance) ||
        Object.keys(provenance).some((field) => field !== 'field' && field !== 'declaration') ||
        !provenance.declaration ||
        typeof provenance.declaration !== 'object' ||
        Array.isArray(provenance.declaration) ||
        Object.keys(provenance.declaration).some(
          (field) => field !== 'license' && field !== 'licenses',
        )
      )
        throw new Error(`Stale or invalid registry license provenance: ${key}`)
      const observed = readRegistryLicense(provenance.declaration)
      if (
        observed.license !== evidence?.license ||
        observed.licenseProvenance.field !== provenance.field
      )
        throw new Error(`Stale or invalid registry license provenance: ${key}`)
    }
    components.push({
      type: 'library',
      name,
      version,
      purl: `pkg:npm/${name.startsWith('@') ? `%40${name.slice(1)}` : name}@${version}`,
      // npm includes descriptive/non-SPDX declarations. Preserve these as names
      // instead of falsely claiming they are standardized SPDX identifiers.
      licenses: [{ license: { name: evidence?.license ?? metadata.license ?? 'NOASSERTION' } }],
      // These hashes identify the registry tarball, not the patched installed tree.
      hashes: [{ alg: `SHA-${bits}`, content: bytes.toString('hex') }],
      properties: [
        { name: 'nzila:hash-subject', value: 'upstream-registry-tarball' },
        ...(evidence ? [{ name: 'nzila:license-source', value: evidence.sourceUrl }] : []),
        ...(provenance
          ? [
              { name: 'nzila:license-field', value: provenance.field ?? 'UNRESOLVED' },
              { name: 'nzila:license-declaration', value: JSON.stringify(provenance.declaration) },
            ]
          : []),
        ...(patch
          ? [
              { name: 'pnpm:patch-path', value: String(patch.path) },
              { name: 'pnpm:patch-hash', value: String(patch.hash) },
            ]
          : []),
      ],
    })
  }
  for (const snapshot of Object.keys(lock.snapshots)) {
    const base = snapshot.split('(')[0]!
    if (!Object.hasOwn(lock.packages, base))
      throw new Error(`Snapshot lacks package evidence: ${snapshot}`)
  }
  return components
}

// ── Main ────────────────────────────────────────────────────────────────────

async function refreshMetadata(lockContent: string): Promise<void> {
  const packages = extractDependencies(lockContent)
  const evidence: Record<string, RegistryEvidence> = {}
  let cursor = 0
  await Promise.all(
    Array.from({ length: 12 }, async () => {
      while (cursor < packages.length) {
        const component = packages[cursor++]!
        const key = `${component.name}@${component.version}`
        const sourceUrl = `https://registry.npmjs.org/${encodeURIComponent(component.name)}/${component.version}`
        let lastError: unknown
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) })
            if (!response.ok) throw new Error(`Registry metadata HTTP ${response.status}: ${key}`)
            const metadata = (await response.json()) as {
              name?: string
              version?: string
              license?: unknown
              licenses?: unknown
              dist?: { integrity?: string; tarball?: string }
            }
            if (metadata.name !== component.name || metadata.version !== component.version)
              throw new Error(`Registry package substitution: ${key}`)
            const expected = component.hashes[0]!
            const algorithm = expected.alg.replace('-', '').toLowerCase()
            const sri = `${algorithm}-${Buffer.from(expected.content, 'hex').toString('base64')}`
            if (metadata.dist?.integrity !== sri) {
              // Older npm records may lack SRI. Verify the actual tarball against
              // the lockfile instead of guessing or accepting a weaker identity.
              const tarballUrl = new URL(metadata.dist?.tarball ?? '')
              if (tarballUrl.protocol !== 'https:' || tarballUrl.hostname !== 'registry.npmjs.org')
                throw new Error(`Untrusted registry tarball: ${key}`)
              const tarball = await fetch(tarballUrl, { signal: AbortSignal.timeout(60000) })
              if (!tarball.ok || !tarball.body)
                throw new Error(`Registry tarball unavailable: ${key}`)
              const hash = createHash(algorithm)
              for await (const chunk of tarball.body) hash.update(chunk)
              if (hash.digest('hex') !== expected.content)
                throw new Error(`Registry integrity mismatch: ${key}`)
            }
            evidence[key] = { integrity: sri, sourceUrl, ...readRegistryLicense(metadata) }
            lastError = undefined
            break
          } catch (error) {
            lastError = error
            if (attempt < 2)
              await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
          }
        }
        if (lastError) throw lastError
      }
    }),
  )
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const bytes =
    JSON.stringify(
      {
        schemaVersion: 1,
        recordedAt: nowISO(),
        lockfileSha256: sha256(lockContent),
        packages: Object.fromEntries(
          Object.entries(evidence).sort(([a], [b]) => a.localeCompare(b)),
        ),
      },
      null,
      2,
    ) + '\n'
  const temporary = `${METADATA_PATH}.tmp`
  writeFileSync(temporary, bytes)
  renameSync(temporary, METADATA_PATH)
}

async function main(): Promise<void> {
  process.stdout.write(
    '\n\u2501\u2501\u2501 Nzila OS \u2014 SBOM Generation (CycloneDX) \u2501\u2501\u2501\n\n',
  )

  if (!existsSync(LOCKFILE_PATH)) {
    process.stderr.write('  \u2718 pnpm-lock.yaml not found\n')
    process.exit(1)
  }

  const lockContent = readFileSync(LOCKFILE_PATH, 'utf-8')
  if (process.argv.includes('--refresh-metadata')) await refreshMetadata(lockContent)
  const lock = parse(lockContent, { uniqueKeys: true, maxAliasCount: 0 }) as {
    patchedDependencies?: Record<string, { path?: string; hash?: string }>
  }
  for (const [key, patch] of Object.entries(lock.patchedDependencies ?? {})) {
    if (
      !patch.path ||
      !/^patches\/[A-Za-z0-9@_.+-]+\.patch$/.test(patch.path) ||
      !patch.hash ||
      !/^[a-f0-9]{64}$/.test(patch.hash) ||
      sha256(readFileSync(resolve(ROOT, patch.path), 'utf8')) !== patch.hash
    )
      throw new Error(`Local patch integrity mismatch: ${key}`)
  }
  const pkgJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8')) as {
    name: string
    version: string
  }

  if (!existsSync(METADATA_PATH))
    throw new Error('SBOM registry metadata missing: rerun with --refresh-metadata')
  const metadata = JSON.parse(readFileSync(METADATA_PATH, 'utf8')) as {
    lockfileSha256?: string
    packages?: Record<string, RegistryEvidence>
  }
  if (metadata.lockfileSha256 !== sha256(lockContent) || !metadata.packages)
    throw new Error('SBOM registry metadata is stale: rerun with --refresh-metadata')
  const components = extractDependencies(lockContent, metadata.packages)
  if (components.some((component) => !metadata.packages![`${component.name}@${component.version}`]))
    throw new Error('SBOM registry metadata is incomplete')

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
      properties: [
        { name: 'nzila:lockfile-sha256', value: sha256(lockContent) },
        {
          name: 'nzila:registry-metadata-sha256',
          value: sha256(readFileSync(METADATA_PATH, 'utf8')),
        },
      ],
    },
    components,
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })
  const bytes = JSON.stringify(bom, null, 2) + '\n'
  writeFileSync(OUTPUT_PATH, bytes, 'utf-8')

  const sbomHash = sha256(bytes)

  process.stdout.write(`  \u2714 SBOM generated: ${OUTPUT_PATH}\n`)
  process.stdout.write(`  \u2714 Components: ${components.length}\n`)
  process.stdout.write(`  \u2714 SBOM hash: ${sbomHash.slice(0, 16)}\u2026\n`)
  process.stdout.write(`  \u2714 Format: CycloneDX 1.5\n\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
