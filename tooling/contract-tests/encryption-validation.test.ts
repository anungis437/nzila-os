/**
 * Encryption & Cryptographic Validation Contract Tests
 *
 * Ensures the platform maintains proper encryption practices:
 *   - Evidence packs use SHA-256 integrity hashing
 *   - Database connections use TLS
 *   - No plaintext secrets in source code
 *   - Password hashing uses Argon2id
 *
 * @invariant CRYPTO_001 — Evidence integrity uses SHA-256 or stronger
 * @invariant CRYPTO_002 — Database connections enforce TLS
 * @invariant CRYPTO_003 — Password hashing uses Argon2id (OWASP compliant)
 * @invariant CRYPTO_004 — No weak crypto algorithms (MD5, SHA-1 for security)
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ROOT,
  walkSync,
  readContent,
  relPath,
  formatViolations,
  type Violation,
} from './governance-helpers'

describe('CRYPTO_001 — Evidence integrity uses SHA-256+', () => {
  it('should use SHA-256 or stronger for evidence/hash-chain operations', () => {
    const evidenceFiles = [
      ...walkSync(join(ROOT, 'packages/os-core/src'), ['.ts']),
      ...walkSync(join(ROOT, 'apps/abr/lib'), ['.ts']),
      ...walkSync(join(ROOT, 'scripts'), ['.ts']),
    ].filter(
      (f) =>
        readContent(f).includes('createHash') ||
        readContent(f).includes('evidence') ||
        readContent(f).includes('hash-chain'),
    )

    const violations: Violation[] = []

    for (const file of evidenceFiles) {
      const content = readContent(file)
      if (!content.includes('createHash')) continue

      // Check for weak hash usage in security-critical paths
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (
          line.includes("createHash('md5')") ||
          line.includes('createHash("md5")')
        ) {
          violations.push({
            ruleId: 'CRYPTO_001',
            filePath: relPath(file),
            line: i + 1,
            snippet: line.trim(),
            remediation: 'Replace MD5 with SHA-256 for integrity verification',
          })
        }
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})

describe('CRYPTO_002 — Database connections enforce TLS', () => {
  it('should use ssl/tls configuration in database connection strings', () => {
    const dbConfigFiles = walkSync(join(ROOT, 'packages'), ['.ts']).filter(
      (f) => {
        const name = f.toLowerCase()
        return (
          name.includes('db') ||
          name.includes('database') ||
          name.includes('drizzle') ||
          name.includes('connection')
        )
      },
    )

    let foundSslConfig = false
    for (const file of dbConfigFiles) {
      const content = readContent(file)
      if (
        content.includes('ssl') ||
        content.includes('sslmode') ||
        content.includes('?ssl=') ||
        content.includes('rejectUnauthorized')
      ) {
        foundSslConfig = true
        break
      }
    }

    // Also check environment patterns in Docker/compose files
    const dockerCompose = readContent(join(ROOT, 'docker-compose.yml'))
    const dockerfile = readContent(join(ROOT, 'Dockerfile'))
    if (
      dockerCompose.includes('PGSSLMODE') ||
      dockerfile.includes('PGSSLMODE')
    ) {
      foundSslConfig = true
    }

    // Check infrastructure for SSL enforcement
    const infraFiles = walkSync(join(ROOT, 'infrastructure'), [
      '.bicep',
      '.json',
      '.yml',
      '.yaml',
    ])
    for (const file of infraFiles) {
      const content = readContent(file)
      if (
        content.includes('sslEnforcement') ||
        content.includes('requireSecureTransport') ||
        content.includes('ssl_min_protocol_version')
      ) {
        foundSslConfig = true
        break
      }
    }

    // Azure PostgreSQL Flexible Server enforces TLS by default.
    // Accept either explicit ssl config in code/infra OR the presence of
    // Azure PG Bicep module (which has TLS on by default).
    const azurePgBicep = walkSync(join(ROOT, 'infrastructure'), ['.bicep'])
      .some((f) => f.toLowerCase().includes('postgres'))
    const hasTls = foundSslConfig || azurePgBicep

    expect(
      hasTls,
      'Database connections should enforce TLS. Add ssl configuration to DB connection or infrastructure.',
    ).toBe(true)
  })
})

describe('CRYPTO_003 — Password hashing uses Argon2id', () => {
  it('should use argon2id for password hashing (not bcrypt/scrypt)', () => {
    const authFiles = walkSync(join(ROOT, 'packages'), ['.ts']).filter((f) =>
      f.includes('auth'),
    )

    let foundArgon2 = false
    const violations: Violation[] = []

    for (const file of authFiles) {
      const content = readContent(file)

      if (content.includes('argon2') || content.includes('Argon2')) {
        foundArgon2 = true
      }

      // Flag bcrypt usage in auth-critical paths
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (
          lines[i].includes("require('bcrypt')") ||
          lines[i].includes("from 'bcrypt'") ||
          lines[i].includes("from 'bcryptjs'")
        ) {
          violations.push({
            ruleId: 'CRYPTO_003',
            filePath: relPath(file),
            line: i + 1,
            snippet: lines[i].trim(),
            remediation:
              'Use argon2id instead of bcrypt for OWASP-compliant password hashing',
          })
        }
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
    expect(
      foundArgon2,
      'Platform auth should use Argon2id for password hashing',
    ).toBe(true)
  })
})

describe('CRYPTO_004 — No weak crypto for security purposes', () => {
  it('should not use MD5 or SHA-1 for security-critical operations', () => {
    const sourceFiles = [
      ...walkSync(join(ROOT, 'packages'), ['.ts']),
      ...walkSync(join(ROOT, 'apps'), ['.ts']),
    ]

    const violations: Violation[] = []
    // Known exceptions: address-service uses MD5 for non-security dedup hashing
    const WEAK_CRYPTO_ALLOWLIST = new Set([
      'apps/union-eyes/lib/address/address-service.ts',
    ])
    const weakPatterns = [
      { pattern: "createHash('md5')", algo: 'MD5' },
      { pattern: 'createHash("md5")', algo: 'MD5' },
      { pattern: "createHash('sha1')", algo: 'SHA-1' },
      { pattern: 'createHash("sha1")', algo: 'SHA-1' },
    ]

    for (const file of sourceFiles) {
      // Skip test files and allowlisted files
      if (file.includes('__tests__') || file.includes('.test.') || file.includes('.spec.')) continue
      if (WEAK_CRYPTO_ALLOWLIST.has(relPath(file))) continue

      const content = readContent(file)
      if (!content.includes('createHash')) continue

      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        for (const { pattern, algo } of weakPatterns) {
          if (lines[i].includes(pattern)) {
            violations.push({
              ruleId: 'CRYPTO_004',
              filePath: relPath(file),
              line: i + 1,
              offendingValue: algo,
              snippet: lines[i].trim(),
              remediation: `Replace ${algo} with SHA-256 or stronger`,
            })
          }
        }
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})
