import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import { computeSha256, container, uploadBuffer, generateSasUrl, downloadBuffer } from './index'

// ── computeSha256 (pure function) ───────────────────────────────────────────

describe('computeSha256', () => {
  it('returns correct SHA-256 hex digest', () => {
    const data = Buffer.from('hello world')
    const expected = createHash('sha256').update(data).digest('hex')
    expect(computeSha256(data)).toBe(expected)
  })

  it('returns different hash for different input', () => {
    const a = computeSha256(Buffer.from('alpha'))
    const b = computeSha256(Buffer.from('bravo'))
    expect(a).not.toBe(b)
  })

  it('returns 64-char hex string', () => {
    const hash = computeSha256(Buffer.from('test'))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('handles empty buffer', () => {
    const hash = computeSha256(Buffer.alloc(0))
    const expected = createHash('sha256').update(Buffer.alloc(0)).digest('hex')
    expect(hash).toBe(expected)
  })
})

// ── Environment guard ───────────────────────────────────────────────────────

describe('requiredEnv guard', () => {
  beforeEach(() => {
    // Clear cached singletons between tests
    vi.resetModules()
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY
  })

  afterEach(() => {
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY
  })

  it('container() throws when AZURE_STORAGE_ACCOUNT_NAME is missing', async () => {
    const mod = await import('./index')
    expect(() => mod.container('test')).toThrow('Missing env: AZURE_STORAGE_ACCOUNT_NAME')
  })

  it('container() throws when AZURE_STORAGE_ACCOUNT_KEY is missing', async () => {
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'teststorage'
    const mod = await import('./index')
    expect(() => mod.container('test')).toThrow('Missing env: AZURE_STORAGE_ACCOUNT_KEY')
  })
})

// ── Azure SDK integration (mocked) ─────────────────────────────────────────

describe('uploadBuffer', () => {
  const mockUploadData = vi.fn().mockResolvedValue({})

  beforeEach(() => {
    vi.resetModules()
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'teststorage'
    process.env.AZURE_STORAGE_ACCOUNT_KEY = Buffer.from('fakekey12345678901234567890123456789012345678901234567890123456789012345678901234567890==').toString('base64')

    vi.doMock('@azure/storage-blob', () => {
      class MockBlobServiceClient {
        getContainerClient() {
          return {
            getBlockBlobClient: () => ({
              uploadData: mockUploadData,
            }),
          }
        }
      }
      class MockStorageSharedKeyCredential {}
      return {
        StorageSharedKeyCredential: MockStorageSharedKeyCredential,
        BlobServiceClient: MockBlobServiceClient,
        generateBlobSASQueryParameters: vi.fn().mockReturnValue({ toString: () => 'sig=mock' }),
        BlobSASPermissions: { parse: vi.fn().mockReturnValue({}) },
        ContainerClient: vi.fn(),
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY
  })

  it('returns blobPath, sha256, and sizeBytes', async () => {
    const mod = await import('./index')
    const buf = Buffer.from('pdf-content')
    const result = await mod.uploadBuffer({
      container: 'documents',
      blobPath: 'uploads/doc.pdf',
      buffer: buf,
      contentType: 'application/pdf',
    })

    expect(result.blobPath).toBe('uploads/doc.pdf')
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(result.sizeBytes).toBe(buf.length)
    expect(mockUploadData).toHaveBeenCalledOnce()
  })
})

describe('generateSasUrl', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'teststorage'
    process.env.AZURE_STORAGE_ACCOUNT_KEY = Buffer.from('fakekey12345678901234567890123456789012345678901234567890123456789012345678901234567890==').toString('base64')

    vi.doMock('@azure/storage-blob', () => {
      class MockBlobServiceClient {
        getContainerClient() {
          return {}
        }
      }
      class MockStorageSharedKeyCredential {}
      return {
        StorageSharedKeyCredential: MockStorageSharedKeyCredential,
        BlobServiceClient: MockBlobServiceClient,
        generateBlobSASQueryParameters: vi.fn().mockReturnValue({ toString: () => 'sig=mock' }),
        BlobSASPermissions: { parse: vi.fn().mockReturnValue({}) },
        ContainerClient: vi.fn(),
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY
  })

  it('returns a URL with SAS token', async () => {
    const mod = await import('./index')
    const url = mod.generateSasUrl('docs', 'file.pdf', 30)
    expect(url).toContain('teststorage.blob.core.windows.net')
    expect(url).toContain('docs/file.pdf')
    expect(url).toContain('sig=mock')
  })
})

describe('AZURE_STORAGE_BLOB_ENDPOINT (emulator override)', () => {
  const mockSdk = () =>
    vi.doMock('@azure/storage-blob', () => {
      class MockBlobServiceClient {
        constructor(public url: string) {}
        getContainerClient() {
          return {}
        }
      }
      class MockStorageSharedKeyCredential {}
      return {
        StorageSharedKeyCredential: MockStorageSharedKeyCredential,
        BlobServiceClient: MockBlobServiceClient,
        generateBlobSASQueryParameters: vi.fn().mockReturnValue({ toString: () => 'sig=mock' }),
        BlobSASPermissions: { parse: vi.fn().mockReturnValue({}) },
        ContainerClient: vi.fn(),
      }
    })

  beforeEach(() => {
    vi.resetModules()
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'devstoreaccount1'
    process.env.AZURE_STORAGE_ACCOUNT_KEY = Buffer.from('emulatorkey').toString('base64')
    process.env.AZURE_STORAGE_BLOB_ENDPOINT = 'http://127.0.0.1:10000/devstoreaccount1/'
    mockSdk()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY
    delete process.env.AZURE_STORAGE_BLOB_ENDPOINT
  })

  it('builds SAS URLs against the emulator endpoint outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const mod = await import('./index')
    expect(mod.generateSasUrl('docs', 'file.pdf')).toBe(
      'http://127.0.0.1:10000/devstoreaccount1/docs/file.pdf?sig=mock',
    )
  })

  it('refuses the override in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const mod = await import('./index')
    expect(() => mod.generateSasUrl('docs', 'file.pdf')).toThrow('not permitted in production')
    expect(() => mod.container('docs')).toThrow('not permitted in production')
  })
})
