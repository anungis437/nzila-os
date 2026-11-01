import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('F06 batch 6 (A6): signature evidence is chained, checked and not self-asserted', () => {
  it('every audit event is chained to the one before it under a per-document lock, and the table is append-only for the application roles', () => {
    const service = src('lib/signature/signature-service.ts')
    expect(service).toContain('await nextChainLink(chainTx, data.documentId)')
    expect(service).toContain('chainHash(previousHash, { ...data, metadata }, seq)')
    expect(src('lib/signature/audit-chain-store.ts')).toContain('pg_advisory_xact_lock')
    expect(src('db/__tests__/signature-audit-trail-append-only.postgres.test.ts')).toContain("'UPDATE'")
    expect(src('db/rls-storage-authority/health-safety.ts')).toMatch(/table: "signature_audit_trail"[\s\S]*?requiredRuntimePrivileges: \["SELECT","INSERT"\]/)
  })

  it('completion seals the trail: the verified head is the last chained event and is repeated in the platform audit log', () => {
    const service = src('lib/signature/signature-service.ts')
    expect(service).toContain('await AuditTrailService.seal(documentId, organizationId, tx)')
    expect(service).toContain('"signature.document.sealed"')
    expect(service).toContain('if (!verification.ok || verification.head === null) return { sealed: false as const }')
  })

  it('the audit report states what verification found and no longer a constant', () => {
    const service = src('lib/signature/signature-service.ts')
    expect(service).not.toContain('hashChained: false')
    expect(service).toContain('integrity: await this.integrityStatement(documentId, auditLog)')
    expect(service).toContain('the signer address and any signer-supplied field are as recorded, not independently verified')
  })

  it('signing recomputes the stored file hash and refuses a mismatch, saying so when it cannot be checked', () => {
    const service = src('lib/signature/signature-service.ts')
    expect(service).toContain('verifySignatureDocumentFile({')
    expect(service.indexOf('verifySignatureDocumentFile({')).toBeLessThan(service.indexOf('return await withRLSContext({ organizationId: document.organizationId }'))
    expect(service).toContain('fileHashCheck:')
  })

  it('the stored expiry and second-factor terms are honoured or refused, never ignored', () => {
    const service = src('lib/signature/signature-service.ts')
    expect(service).toContain('private static async markExpired(')
    expect(service).toContain('error.reason === "expired"')
    expect(service).toContain('if (document.requireAuthentication) {')
    expect(service).toContain('if (data.requireAuthentication) {')
  })

  it('the signer address comes from the trusted end of the proxy chain, the image is inline, and a browser-reported position is not stored', () => {
    const route = src('app/api/signatures/sign/route.ts')
    expect(route).toContain('signerNetworkAddress(req.headers)')
    expect(route).not.toContain('x-forwarded-for')
    expect(route).toContain('data:image\\/(png|jpeg);base64')
    expect(route).not.toMatch(/geolocation,\n\s+\}\);/)
  })

  it('a signer sees their own rows of the report and no other signer\'s address, description or network data', () => {
    const service = src('lib/signature/signature-service.ts')
    expect(service).toContain('actorUserId: entry.actorUserId')
    expect(service).not.toContain('actor: entry.actorEmail || entry.actorUserId')
    expect(src('lib/signature/signer-privacy.ts')).toContain('ACTOR_CONTACT_KEYS')
  })
})
