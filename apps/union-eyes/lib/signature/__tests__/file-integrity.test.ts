import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

const m = vi.hoisted(() => ({ read: vi.fn(), ownPath: vi.fn() }))

vi.mock('@/lib/blob-client', () => ({ readBlobBounded: m.read }))
vi.mock('@/lib/services/document-blob-integrity-service', () => ({ verifiedLegacyBlobPath: m.ownPath }))

import { verifySignatureDocumentFile } from '../file-integrity'

const BYTES = Buffer.from('the agreement as sent')
const HASH = createHash('sha256').update(BYTES).digest('hex')
const doc = (overrides: Record<string, unknown> = {}) => ({ organizationId: 'org-1', fileUrl: 'https://store/documents/org-1/a.pdf', fileHash: HASH, ...overrides })

describe('signature document file integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.ownPath.mockReturnValue('documents/org-1/a.pdf')
    m.read.mockResolvedValue(BYTES)
  })

  it('verifies a stored file whose recomputed hash equals the hash recorded when it was sent', async () => {
    expect(await verifySignatureDocumentFile(doc())).toEqual({ status: 'verified', sha256: HASH })
    expect(m.read).toHaveBeenCalledWith('documents/org-1/a.pdf', expect.any(Number))
  })

  it('compares the hash case-insensitively', async () => {
    expect((await verifySignatureDocumentFile(doc({ fileHash: HASH.toUpperCase() }))).status).toBe('verified')
  })

  it('reports a file that changed since it was sent, with both hashes', async () => {
    m.read.mockResolvedValue(Buffer.from('the agreement after an edit'))

    expect(await verifySignatureDocumentFile(doc())).toMatchObject({ status: 'mismatch', expected: HASH })
  })

  it.each([
    ['no hash was recorded', { fileHash: null }, 'no_stored_hash'],
    ['the stored address is not this organization\'s own storage', {}, 'not_own_storage'],
  ])('says the file is unverified, not verified, when %s', async (_label, overrides, reason) => {
    if (reason === 'not_own_storage') m.ownPath.mockReturnValue(null)

    expect(await verifySignatureDocumentFile(doc(overrides))).toEqual({ status: 'unverified', reason })
    expect(m.read).not.toHaveBeenCalled()
  })

  it('says the file is unverified when it cannot be read, and when it is over the bound', async () => {
    m.read.mockRejectedValueOnce(new Error('storage down'))
    expect(await verifySignatureDocumentFile(doc())).toEqual({ status: 'unverified', reason: 'unreadable' })

    m.read.mockRejectedValueOnce(Object.assign(new Error('too big'), { name: 'BlobTooLargeError' }))
    expect(await verifySignatureDocumentFile(doc())).toEqual({ status: 'unverified', reason: 'too_large' })
  })
})
