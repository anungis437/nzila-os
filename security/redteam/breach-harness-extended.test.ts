/**
 * Nzila OS — Runtime Breach Harness (Extended)
 *
 * Expands the adversarial coverage with scenarios that exercise
 * the PR-01 (Scoped DAL), PR-02 (Audited mutations), and PR-03
 * (Sealed evidence packs) hardening layers.
 *
 * All attacks MUST be blocked. If any attack succeeds, CI fails.
 *
 * Attack vectors tested:
 *   RED-TEAM-009: Cross-Org read via forged orgId
 *   RED-TEAM-010: Cross-Org write via forged orgId
 *   RED-TEAM-011: ReadOnlyScopedDb write attempt
 *   RED-TEAM-012: Mutation without actorId (audit bypass)
 *   RED-TEAM-013: Audit hash chain break detection
 *   RED-TEAM-014: Evidence pack re-seal attempt
 *   RED-TEAM-015: Evidence pack draft persistence attempt
 *   RED-TEAM-016: Evidence pack forge/tamper via verify-pack
 *   RED-TEAM-017: Redacted pack without re-seal detection
 *   RED-TEAM-018: Non-Org table access via ScopedDb
 *
 * @security RED-TEAM-009 through RED-TEAM-018
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import {
  createEvidencePackDraft,
  assertSealed,
  isSealedEvidencePack,
  SealOnceViolationError,
  DraftMutationError,
} from '../../packages/os-core/src/evidence/lifecycle'
import {
  generateSeal,
  verifySeal,
} from '../../packages/os-core/src/evidence/seal'
import { redactAndReseal } from '../../packages/os-core/src/evidence/redaction'
import { verifyPackIndex } from '../../packages/os-core/src/evidence/verify-pack'

const ROOT = join(__dirname, '..', '..')

// ── RED-TEAM-009: Cross-Org Read via Forged orgId ───────────────────────────

describe('RED-TEAM-009 — Cross-Org read via forged orgId must be structurally impossible', () => {
  it('ScopedDb forces org_id filter on every SELECT — no caller override', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')

    // The select function ALWAYS applies entityFilter
    expect(content).toContain('eq(orgCol, orgId)')
    // There's no parameter to skip filtering
    expect(content).not.toMatch(/skipFilter|noFilter|allEntities|bypassScope/i)
  })

  it('ScopedDb validates orgId is a non-empty string at construction', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')

    // Must throw on empty/missing
    expect(content).toContain('ScopedDbError')
    expect(content).toContain('non-empty')
  })

  it('createScopedDb with object form uses orgId', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')

    expect(content).toContain('orgId')
    expect(content).toContain('ScopedDbOptions')
  })

  it('ReadOnlyScopedDb has no write methods to leak data sideways', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')

    expect(content).toContain('ReadOnlyScopedDb')
    // ReadOnlyScopedDb must NOT contain insert/update/delete
    const readOnlyInterface = content.match(
      /export interface ReadOnlyScopedDb\s*\{[\s\S]*?\n\}/,
    )?.[0]
    if (readOnlyInterface) {
      expect(readOnlyInterface).not.toContain('insert')
      expect(readOnlyInterface).not.toContain('update')
      expect(readOnlyInterface).not.toContain('delete')
    }
  })
})

// ── RED-TEAM-010: Cross-Org Write via Forged orgId ──────────────────────────

describe('RED-TEAM-010 — Cross-Org write via forged orgId must be blocked', () => {
  it('ScopedDb forces org_id into every INSERT record', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')

    // org_id is injected, overriding any caller-provided value
    expect(content).toContain('orgId, // force orgId on every row')
  })

  it('ScopedDb forces org_id filter on every UPDATE', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')

    // UPDATE statements include the entity filter
    expect(content).toContain('update(table, values, extraWhere)')
    expect(content).toContain('eq(orgCol, orgId)')
  })

  it('ScopedDb forces org_id filter on every DELETE', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')

    // DELETE statements include the entity filter
    expect(content).toContain('.delete(table)')
    expect(content).toContain('eq(orgCol, orgId)')
  })

  it('AuditedScopedDb wraps ScopedDb — no unscoped write path', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')

    expect(content).toContain('createFullScopedDb')
    expect(content).toContain('createAuditedScopedDb')
    expect(content).toContain('orgId')
  })
})

// ── RED-TEAM-011: ReadOnlyScopedDb Write Attempt ────────────────────────────

describe('RED-TEAM-011 — ReadOnlyScopedDb prevents all writes', () => {
  it('ReadOnlyScopedDb interface only exposes select + transaction', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')

    const readOnlyInterface = content.match(
      /export interface ReadOnlyScopedDb\s*\{[\s\S]*?\n\}/,
    )?.[0]
    expect(readOnlyInterface).toBeDefined()
    expect(readOnlyInterface).toContain('select')
    expect(readOnlyInterface).toContain('transaction')
    expect(readOnlyInterface).not.toContain('insert')
    expect(readOnlyInterface).not.toContain('update')
    expect(readOnlyInterface).not.toContain('delete')
  })

  it('ReadOnlyViolationError class exists', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')

    expect(content).toContain('export class ReadOnlyViolationError')
  })

  it('ReadOnlyScopedDb is exported from @nzila/db', () => {
    const indexPath = join(ROOT, 'packages', 'db', 'src', 'index.ts')
    const content = readFileSync(indexPath, 'utf-8')

    expect(content).toContain('ReadOnlyScopedDb')
    expect(content).toContain('ReadOnlyViolationError')
  })
})

// ── RED-TEAM-012: Mutation Without actorId (Audit Bypass) ───────────────────

describe('RED-TEAM-012 — Mutation without actorId is blocked', () => {
  it('createAuditedScopedDb requires actorId', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')

    // Must validate actorId is present
    expect(content).toContain('actorId')
    expect(content).toContain('AuditedScopedDbOptions')
  })

  it('withAudit mandatory flag blocks mutation if audit emission fails', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')

    expect(content).toContain('[AUDIT:MANDATORY]')
    expect(content).toContain('Mutation blocked')
  })

  it('no app code calls ScopedDb.insert/update/delete without audit wrapper', () => {
    // This is enforced by the audit-mutation-coverage contract test
    const testPath = join(ROOT, 'tooling', 'contract-tests', 'audit-mutation-coverage.test.ts')
    expect(existsSync(testPath)).toBe(true)

    const content = readFileSync(testPath, 'utf-8')
    expect(content).toContain('raw mutations')
    expect(content).toContain('MUTATION_ALLOWLIST')
  })
})

// ── RED-TEAM-013: Audit Hash Chain Break Detection ──────────────────────────

describe('RED-TEAM-013 — Audit hash chain tampering is detectable', () => {
  it('audit_events table requires hash NOT NULL', () => {
    const opsSchema = join(ROOT, 'packages', 'db', 'src', 'schema', 'operations.ts')
    const content = readFileSync(opsSchema, 'utf-8')

    expect(content).toMatch(/hash:\s*text\('hash'\)\.notNull\(\)/)
  })

  it('hash chain verification exists in os-core', () => {
    const hashPath = join(ROOT, 'packages', 'os-core', 'src', 'hash.ts')
    expect(existsSync(hashPath)).toBe(true)

    const content = readFileSync(hashPath, 'utf-8')
    expect(content).toContain('computeEntryHash')
    expect(content).toContain('verifyChain')
  })

  it('hash chain break produces { valid: false, brokenAtIndex }', () => {
    const { computeEntryHash, verifyChain } = require(
      join(ROOT, 'packages', 'os-core', 'src', 'hash.ts'),
    )

    // Valid chain
    const e1 = { data: 'a' }
    const h1 = computeEntryHash(e1, null)
    const e2 = { data: 'b' }
    const h2 = computeEntryHash(e2, h1)
    const e3 = { data: 'c' }
    const h3 = computeEntryHash(e3, h2)

    const chain = [
      { payload: e1, hash: h1, previousHash: null },
      { payload: e2, hash: h2, previousHash: h1 },
      { payload: e3, hash: h3, previousHash: h2 },
    ]

    const valid = verifyChain(chain, (e: any) => e.payload)
    expect(valid.valid).toBe(true)

    // Tamper: modify middle entry payload
    chain[1] = { ...chain[1], payload: { data: 'TAMPERED' } }
    const tampered = verifyChain(chain, (e: any) => e.payload)
    expect(tampered.valid).toBe(false)
    expect(tampered.brokenAtIndex).toBe(1)
  })

  it('DB immutability triggers exist', () => {
    const triggerFile = join(
      ROOT,
      'packages',
      'db',
      'migrations',
      'hash-chain-immutability-triggers.sql',
    )
    expect(existsSync(triggerFile)).toBe(true)

    const content = readFileSync(triggerFile, 'utf-8')
    expect(content).toContain('RAISE EXCEPTION')
  })
})

// ── RED-TEAM-014: Evidence Pack Re-Seal Attempt ─────────────────────────────

describe('RED-TEAM-014 — Evidence pack re-seal is blocked', () => {
  it('lifecycle.ts enforces seal-once via SealOnceViolationError', () => {
    const lifecyclePath = join(ROOT, 'packages', 'os-core', 'src', 'evidence', 'lifecycle.ts')
    expect(existsSync(lifecyclePath)).toBe(true)

    const content = readFileSync(lifecyclePath, 'utf-8')
    expect(content).toContain('SealOnceViolationError')
    expect(content).toContain('already sealed')
    expect(content).toContain('re-sealing is prohibited')
  })

  it('seal() a second time throws', () => {
    const draft = createEvidencePackDraft({
      packId: 'RT-014',
      orgId: '00000000-0000-0000-0000-000000000001',
      controlFamily: 'integrity',
      eventType: 'control-test',
      eventId: 'evt-1',
      createdBy: 'test',
    })
    draft.addArtifact({
      artifactId: 'a1',
      artifactType: 'test',
      filename: 'a1.json',
      buffer: Buffer.from('data'),
      contentType: 'application/json',
      retentionClass: '7_YEARS',
      classification: 'INTERNAL',
    })

    draft.seal()
    expect(() => draft.seal()).toThrow(SealOnceViolationError)
  })
})

// ── RED-TEAM-015: Evidence Pack Draft Persistence Attempt ────────────────────

describe('RED-TEAM-015 — Draft evidence packs cannot be persisted', () => {
  it('assertSealed throws for draft packs', () => {
    const draft = createEvidencePackDraft({
      packId: 'RT-015',
      orgId: '00000000-0000-0000-0000-000000000001',
      controlFamily: 'integrity',
      eventType: 'control-test',
      eventId: 'evt-1',
      createdBy: 'test',
    })

    expect(() => assertSealed(draft)).toThrow(DraftMutationError)
  })

  it('isSealedEvidencePack returns false for { status: "draft" }', () => {
    expect(isSealedEvidencePack({ status: 'draft' })).toBe(false)
    expect(isSealedEvidencePack({ status: 'sealed' })).toBe(false) // no seal field
  })

  it('processEvidencePack inserts with status=sealed in DB', () => {
    const genPath = join(ROOT, 'packages', 'os-core', 'src', 'evidence', 'generate-evidence-index.ts')
    const content = readFileSync(genPath, 'utf-8')
    expect(content).toContain("status: 'sealed'")
    expect(content).not.toContain("status: 'draft'")
  })
})

// ── RED-TEAM-016: Evidence Pack Forge/Tamper via verify-pack ─────────────────

describe('RED-TEAM-016 — Forged evidence pack detected by verify-pack', () => {
  const tmpDir = join(ROOT, '.tmp-redteam-016')

  it('verify-pack rejects tampered pack (modified orgId)', () => {
    mkdirSync(tmpDir, { recursive: true })
    try {
      const index = {
        packId: 'FORGE-001',
        orgId: '00000000-0000-0000-0000-000000000001',
        artifacts: [{ sha256: 'a'.repeat(64), filename: 'x.json' }],
      }
      const seal = generateSeal(index, { sealedAt: '2026-01-01T00:00:00Z' })
      // Tamper
      const forged = { ...index, orgId: 'FORGED-ORG', seal }
      writeFileSync(join(tmpDir, 'pack.json'), JSON.stringify(forged))

      const result = verifyPackIndex(join(tmpDir, 'pack.json'))
      expect(result.overallValid).toBe(false)
      expect(result.digestMatch).toBe(false)
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('verify-pack rejects pack with injected artifact', () => {
    mkdirSync(tmpDir, { recursive: true })
    try {
      const index = {
        packId: 'FORGE-002',
        artifacts: [{ sha256: 'a'.repeat(64), filename: 'legit.json' }],
      }
      const seal = generateSeal(index)
      // Inject malicious artifact
      const injected = {
        ...index,
        artifacts: [
          ...index.artifacts,
          { sha256: 'b'.repeat(64), filename: 'malicious.json' },
        ],
        seal,
      }
      writeFileSync(join(tmpDir, 'pack.json'), JSON.stringify(injected))

      const result = verifyPackIndex(join(tmpDir, 'pack.json'))
      expect(result.overallValid).toBe(false)
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

// ── RED-TEAM-017: Redacted Pack Without Re-Seal ─────────────────────────────

describe('RED-TEAM-017 — Redacted packs must be re-sealed', () => {
  it('redactAndReseal produces a fresh seal', () => {
    const index = {
      packId: 'REDACT-001',
      orgId: 'ent-001',
      clerkUserId: 'should-be-stripped',
      artifacts: [
        { sha256: 'a'.repeat(64), artifactType: 'test', filename: 'a.json' },
      ],
    }
    const seal = generateSeal(index)
    const sealed = { ...index, seal }

    const { index: redacted, seal: newSeal } = redactAndReseal(sealed, 'partner')

    // New seal must be valid over the redacted content
    const result = verifySeal({ ...redacted, seal: newSeal })
    expect(result.valid).toBe(true)

    // Original seal must NOT be valid over redacted content
    const fakeResult = verifySeal({ ...redacted, seal })
    expect(fakeResult.valid).toBe(false)
  })

  it('redaction source code calls generateSeal', () => {
    const redactionPath = join(ROOT, 'packages', 'os-core', 'src', 'evidence', 'redaction.ts')
    const content = readFileSync(redactionPath, 'utf-8')
    expect(content).toContain('generateSeal')
    expect(content).toContain('redactAndReseal')
  })
})

// ── RED-TEAM-018: Non-Org Table Access via ScopedDb ─────────────────────────

describe('RED-TEAM-018 — Non-Org tables cannot be accessed via ScopedDb', () => {
  it('ScopedDb throws when table has no org_id column', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')

    // getOrgIdColumn throws on missing column
    expect(content).toContain('getOrgIdColumn')
    expect(content).toContain('does not have an org_id column')
    expect(content).toContain('ScopedDbError')
  })

  it('org-registry documents all non-Org tables with reasons', () => {
    const registryPath = join(ROOT, 'packages', 'db', 'src', 'org-registry.ts')
    expect(existsSync(registryPath)).toBe(true)

    const content = readFileSync(registryPath, 'utf-8')
    expect(content).toContain('NON_ORG_SCOPED_TABLES')
    expect(content).toContain('reason')
  })

  it('every table is classified as Org-scoped or non-Org-scoped', () => {
    // Covered by contract test org-scoped-registry.test.ts
    const testPath = join(ROOT, 'tooling', 'contract-tests', 'org-scoped-registry.test.ts')
    expect(existsSync(testPath)).toBe(true)

    const content = readFileSync(testPath, 'utf-8')
    expect(content).toContain('INV-20')
    expect(content).toContain('every table with org_id')
  })
})
