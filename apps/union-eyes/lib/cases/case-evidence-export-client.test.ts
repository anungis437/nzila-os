import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, webcrypto } from 'node:crypto'
import { buildEvidencePackage, buildEvidencePdf } from '@/lib/evidence-export'
import { CASE_EXPORT_MAX_BYTES, readBoundedCaseExport, verifyCaseExport, verifyCasePdf } from './case-evidence-export-client'

const CASE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ORG = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ACTOR = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const context = { caseId: CASE, organizationId: ORG, actorId: ACTOR }
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))
function fixture(expected = context) {
  return buildEvidencePackage({ caseId: expected.caseId, organizationId: expected.organizationId, exportedBy: expected.actorId,
    caseRecord: { claimId: expected.caseId, organizationId: expected.organizationId, description: 'Synthetic case', createdAt: new Date('2026-11-16T12:00:00Z') },
    notes: [{ message: 'Synthetic note' }], auditTrail: [] })
}
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); vi.stubEnv('EVIDENCE_SEAL_KEY', 'synthetic-client-export-contract-test-key') })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('authorized case export browser integrity', () => {
  it('accepts an actual server-built sealed envelope and recomputes all artifact checksums after JSON transport', async () => {
    const bytes = encode(fixture())
    await expect(verifyCaseExport(bytes, context)).resolves.toMatchObject({ bytes: bytes.byteLength, sha256: expect.stringMatching(/^[a-f0-9]{64}$/), serverSealVerified: true })
  })
  it('checks the actual rendered PDF bytes, expected context and the server seal attestation', async () => {
    const pkg = fixture(), bytes = new Uint8Array(await buildEvidencePdf(pkg, 'fr-CA'))
    const headers = new Headers({ 'content-type': 'application/pdf', 'content-digest': `sha-256=:${createHash('sha256').update(bytes).digest('base64')}:`,
      'x-evidence-case-id': CASE, 'x-evidence-organization-id': ORG, 'x-evidence-actor-id': ACTOR, 'x-evidence-locale': 'fr-CA', 'x-evidence-seal': pkg.pack.seal, 'x-evidence-seal-verified': 'true' })
    await expect(verifyCasePdf(bytes, headers, { ...context, locale: 'fr-CA' })).resolves.toMatchObject({ bytes: bytes.byteLength, serverSealVerified: true })
    const tampered = new Uint8Array(bytes); tampered[15] ^= 1
    await expect(verifyCasePdf(tampered, headers, { ...context, locale: 'fr-CA' })).rejects.toThrow('invalid')
    await expect(verifyCasePdf(bytes, headers, { ...context, organizationId: OTHER, locale: 'fr-CA' })).rejects.toThrow('invalid')
    await expect(verifyCasePdf(bytes, headers, { ...context, locale: 'en-CA' })).rejects.toThrow('invalid')
    headers.set('x-evidence-seal-verified', 'false')
    await expect(verifyCasePdf(bytes, headers, { ...context, locale: 'fr-CA' })).rejects.toThrow('invalid')
  })
  it.each(['caseId', 'organizationId', 'actorId'] as const)('rejects a valid server-built export from a different %s', async field => {
    await expect(verifyCaseExport(encode(fixture({ ...context, [field]: OTHER })), context)).rejects.toThrow('invalid')
  })
  it('rejects tampered notes, duplicate or missing artifacts and a negative server seal result', async () => {
    const changed = fixture(); changed.pack.notes.push({ message: 'Unrecorded edit' })
    const duplicate = fixture(); duplicate.manifest.artifacts[1] = duplicate.manifest.artifacts[0]
    const missing = fixture(); missing.manifest.artifacts.pop()
    const unverified = fixture(); unverified.verification.sealValid = false
    for (const value of [changed, duplicate, missing, unverified]) await expect(verifyCaseExport(encode(value), context)).rejects.toThrow('invalid')
  })
  it('rejects a pack whose nested case identity or manifest byte count disagrees', async () => {
    const caseMismatch = fixture(); caseMismatch.pack.caseRecord.claimId = OTHER
    const bytesMismatch = fixture(); bytesMismatch.manifest.artifacts[0].bytes += 1
    for (const value of [caseMismatch, bytesMismatch]) await expect(verifyCaseExport(encode(value), context)).rejects.toThrow('invalid')
  })
  it('rejects malformed UTF-8 and non-JSON content', async () => {
    await expect(verifyCaseExport(new Uint8Array([255]), context)).rejects.toThrow()
    await expect(readBoundedCaseExport(new Response('html', { headers: { 'content-type': 'text/html' } }), new AbortController().signal)).rejects.toThrow('invalid')
  })
  it('bounds streamed bytes even when the server declares no length', async () => {
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(CASE_EXPORT_MAX_BYTES)); controller.enqueue(new Uint8Array(1)) }, cancel() { cancelled = true } })
    const response = new Response(stream, { headers: { 'content-type': 'application/json' } })
    await expect(readBoundedCaseExport(response, new AbortController().signal)).rejects.toThrow('oversize')
    expect(cancelled).toBe(true)
  })
  it('cancels reading after a scope change and rejects declared oversize before consuming the body', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(readBoundedCaseExport(new Response(encode(fixture()), { headers: { 'content-type': 'application/json' } }), controller.signal)).rejects.toThrow('aborted')
    const response = new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': String(CASE_EXPORT_MAX_BYTES + 1) } })
    await expect(readBoundedCaseExport(response, new AbortController().signal)).rejects.toThrow('oversize')
  })
})
