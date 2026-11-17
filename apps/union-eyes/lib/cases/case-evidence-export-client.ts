/** Browser verification of the authorized export envelope. The server verifies its HMAC; the browser checks context and every artifact digest. */
export const CASE_EXPORT_MAX_BYTES = 20 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA = /^[0-9a-f]{64}$/
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const sameId = (value: unknown, expected: string) => typeof value === 'string' && UUID.test(value) && value.toLowerCase() === expected.toLowerCase()
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('')

export async function readBoundedCaseExport(response: Response, signal: AbortSignal, mimeType = 'application/json'): Promise<Uint8Array> {
  if (!response.headers.get('content-type')?.toLowerCase().includes(mimeType) || !response.body) throw new Error('invalid')
  const declared = response.headers.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > CASE_EXPORT_MAX_BYTES)) throw new Error('oversize')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      if (signal.aborted) throw new Error('aborted')
      const part = await reader.read()
      if (part.done) break
      length += part.value.byteLength
      if (length > CASE_EXPORT_MAX_BYTES) throw new Error('oversize')
      chunks.push(part.value)
    }
  } finally { try { await reader.cancel() } catch { /* Preserve the original read/size failure. */ } finally { reader.releaseLock() } }
  if (signal.aborted || length === 0) throw new Error('invalid')
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

/** Verify the PDF's server-attested context/seal and the digest of the exact delivered PDF bytes. */
export async function verifyCasePdf(bytes: Uint8Array, headers: Headers, expected: { caseId: string; organizationId: string; actorId: string; locale: 'en-CA' | 'fr-CA' }) {
  if (bytes.byteLength > CASE_EXPORT_MAX_BYTES || bytes.byteLength < 8 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-' ||
    !headers.get('content-type')?.toLowerCase().includes('application/pdf') ||
    !sameId(headers.get('x-evidence-case-id'), expected.caseId) || !sameId(headers.get('x-evidence-organization-id'), expected.organizationId) ||
    !sameId(headers.get('x-evidence-actor-id'), expected.actorId) || headers.get('x-evidence-locale') !== expected.locale ||
    headers.get('x-evidence-seal-verified') !== 'true' || !SHA.test(headers.get('x-evidence-seal') ?? '')) throw new Error('invalid')
  const declared = headers.get('content-digest')?.match(/^sha-256=:([A-Za-z0-9+/]{43}=):$/)?.[1]
  if (!declared) throw new Error('invalid')
  const actual = hex(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))
  const claimed = Array.from(atob(declared), character => character.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  if (claimed !== actual) throw new Error('invalid')
  return { bytes: bytes.byteLength, sha256: actual, serverSealVerified: true as const }
}

export async function verifyCaseExport(bytes: Uint8Array, expected: { caseId: string; organizationId: string; actorId: string }) {
  if (bytes.byteLength > CASE_EXPORT_MAX_BYTES || !Object.values(expected).every(id => UUID.test(id))) throw new Error('invalid')
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  if (!isRecord(parsed) || !isRecord(parsed.manifest) || !isRecord(parsed.pack) || !isRecord(parsed.verification)) throw new Error('invalid')
  const { manifest, pack, verification } = parsed
  if (manifest.schemaVersion !== '1.0' || manifest.algorithm !== 'hmac-sha256' || pack.version !== '1.0' || verification.sealValid !== true ||
    !sameId(pack.caseId, expected.caseId) || !sameId(manifest.caseId, expected.caseId) ||
    !sameId(pack.organizationId, expected.organizationId) || !sameId(manifest.organizationId, expected.organizationId) ||
    !sameId(pack.exportedBy, expected.actorId) || !sameId(manifest.exportedBy, expected.actorId) ||
    typeof pack.seal !== 'string' || !SHA.test(pack.seal) || typeof pack.exportedAt !== 'string' || !Number.isFinite(Date.parse(pack.exportedAt)) ||
    manifest.generatedAt !== pack.exportedAt || typeof verification.verifiedAt !== 'string' || !Number.isFinite(Date.parse(verification.verifiedAt)) ||
    !isRecord(pack.caseRecord) ||
    !sameId(pack.caseRecord.claimId, expected.caseId) || !sameId(pack.caseRecord.organizationId, expected.organizationId) ||
    !Array.isArray(pack.notes) || !Array.isArray(pack.auditTrail) || !Array.isArray(manifest.artifacts) || manifest.artifacts.length !== 4) throw new Error('invalid')
  const values: Record<string, unknown> = { caseRecord: pack.caseRecord, notes: pack.notes, auditTrail: pack.auditTrail, evidencePack: pack }
  const expectedCounts: Record<string, number> = { caseRecord: 1, notes: pack.notes.length, auditTrail: pack.auditTrail.length, evidencePack: 1 }
  const seen = new Set<string>()
  for (const item of manifest.artifacts) {
    if (!isRecord(item) || typeof item.name !== 'string' || !Object.hasOwn(values, item.name) || seen.has(item.name) ||
      typeof item.sha256 !== 'string' || !SHA.test(item.sha256) || item.count !== expectedCounts[item.name]) throw new Error('invalid')
    seen.add(item.name)
    const serialized = new TextEncoder().encode(JSON.stringify(values[item.name]))
    if (item.bytes !== serialized.byteLength || hex(await crypto.subtle.digest('SHA-256', serialized)) !== item.sha256) throw new Error('invalid')
  }
  return { bytes: bytes.byteLength, sha256: hex(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), serverSealVerified: true as const }
}
