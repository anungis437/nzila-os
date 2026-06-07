import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';

const mocks = vi.hoisted(() => ({
  mockRandomBytes: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('crypto', () => ({
  default: {
    randomBytes: mocks.mockRandomBytes,
  },
}));

describe('DocumentStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.mockRandomBytes.mockReturnValue(Buffer.from('deadbeef', 'hex'));

    // Clear env vars
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.AZURE_STORAGE_CONTAINER;
    delete process.env.CLOUDFLARE_R2_ENDPOINT;
    delete process.env.CLOUDFLARE_R2_BUCKET;
    delete process.env.AWS_SIGNATURES_BUCKET;
  });

  // ── Constructor / getBackendInfo ─────────────────────────────────────────
  describe('constructor', () => {
    it('defaults to s3 backend when no env vars set', async () => {
      const mod = await import('../document-storage-service');
      const service = new mod.default() as ReturnType<typeof mod.getDocumentStorageService>;
      const info = service.getBackendInfo();
      expect(info.backend).toBe('s3');
      expect(info.bucket).toBe('union-eyes-signatures');
      expect(info.endpoint).toBeUndefined();
    });

    it('selects azure backend when AZURE_STORAGE_CONNECTION_STRING is set', async () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;AccountName=test';
      process.env.AZURE_STORAGE_CONTAINER = 'my-container';
      const mod = await import('../document-storage-service');
      const service = new mod.default();
      const info = service.getBackendInfo();
      expect(info.backend).toBe('azure');
      expect(info.bucket).toBe('my-container');
    });

    it('selects r2 backend when CLOUDFLARE_R2_ENDPOINT is set', async () => {
      process.env.CLOUDFLARE_R2_ENDPOINT = 'https://r2.example.com';
      process.env.CLOUDFLARE_R2_BUCKET = 'r2-bucket';
      const mod = await import('../document-storage-service');
      const service = new mod.default();
      const info = service.getBackendInfo();
      expect(info.backend).toBe('r2');
      expect(info.bucket).toBe('r2-bucket');
      expect(info.endpoint).toBe('https://r2.example.com');
    });

    it('azure takes priority over r2', async () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'conn';
      process.env.CLOUDFLARE_R2_ENDPOINT = 'https://r2.example.com';
      const mod = await import('../document-storage-service');
      const service = new mod.default();
      expect(service.getBackendInfo().backend).toBe('azure');
    });
  });

  describe('getDocumentStorageService singleton', () => {
    it('returns same instance on repeated calls', async () => {
      const mod = await import('../document-storage-service');
      const a = mod.getDocumentStorageService();
      const b = mod.getDocumentStorageService();
      expect(a).toBe(b);
    });
  });

  // ── uploadDocument ──────────────────────────────────────────────────────
  describe('uploadDocument — S3', () => {
    it('uploads to S3 and returns signed URL', async () => {
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as unknown;

      const mockSend = vi.fn().mockResolvedValue({});
      service.s3Client = { send: mockSend };
      service.s3Sdk = {
        PutObjectCommand: vi.fn(),
        GetObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
        getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.com/doc'),
      };

      const result = await service.uploadDocument({
        organizationId: 'org-1',
        documentName: 'test.pdf',
        documentBuffer: Buffer.from('file-content'),
        documentType: 'signed_agreement',
      });

      expect(result.url).toBe('https://signed-url.com/doc');
      expect(result.key).toContain('organization/org-1/');
      expect(result.key).toContain('test.pdf');
      expect(result.bucket).toBe('union-eyes-signatures');
      expect(result.size).toBe(12);
      expect(result.uploadedAt).toBeInstanceOf(Date);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('throws and logs on upload error', async () => {
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as unknown;
      service.s3Client = { send: vi.fn().mockRejectedValue(new Error('S3 fail')) };
      service.s3Sdk = {
        PutObjectCommand: vi.fn(),
        GetObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
        getSignedUrl: vi.fn(),
      };

      await expect(
        service.uploadDocument({
          organizationId: 'org-1',
          documentName: 'x.pdf',
          documentBuffer: Buffer.from('data'),
          documentType: 'contract',
        }),
      ).rejects.toThrow('S3 fail');
    });
  });

  describe('uploadDocument — Azure', () => {
    it('uploads to Azure blob and returns URL', async () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'conn';
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as unknown;

      const mockUpload = vi.fn().mockResolvedValue(undefined);
      const mockGetBlockBlobClient = vi.fn().mockReturnValue({ upload: mockUpload });
      const mockGetContainerClient = vi.fn().mockReturnValue({ getBlockBlobClient: mockGetBlockBlobClient });
      service.blobServiceClient = { getContainerClient: mockGetContainerClient, url: 'https://test.blob.core.windows.net/' };

      const result = await service.uploadDocument({
        organizationId: 'org-1',
        documentName: 'doc.pdf',
        documentBuffer: Buffer.from('azure-data'),
        documentType: 'signed_agreement',
      });

      expect(result.url).toContain('https://test.blob.core.windows.net/');
      expect(result.size).toBe(10);
      expect(mockUpload).toHaveBeenCalledTimes(1);
    });
  });

  // ── downloadDocument ────────────────────────────────────────────────────
  describe('downloadDocument — S3', () => {
    it('downloads from S3 and returns buffer', async () => {
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as unknown;
      const fileData = Buffer.from('downloaded-content');
      const mockStream = Readable.from([fileData]);

      service.s3Client = { send: vi.fn().mockResolvedValue({ Body: mockStream }) };
      service.s3Sdk = {
        PutObjectCommand: vi.fn(),
        GetObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
        getSignedUrl: vi.fn(),
      };

      const result = await service.downloadDocument('org/test.pdf');
      expect(result.toString()).toBe('downloaded-content');
    });

    it('throws on download error', async () => {
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as unknown;
      service.s3Client = { send: vi.fn().mockRejectedValue(new Error('Download fail')) };
      service.s3Sdk = {
        PutObjectCommand: vi.fn(),
        GetObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
        getSignedUrl: vi.fn(),
      };

      await expect(service.downloadDocument('key')).rejects.toThrow('Download fail');
    });
  });

  describe('downloadDocument — Azure', () => {
    it('downloads from Azure blob and returns buffer', async () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'conn';
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as unknown;
      const fileData = Buffer.from('azure-file-data');
      const mockStream = Readable.from([fileData]);

      const mockDownload = vi.fn().mockResolvedValue({ readableStreamBody: mockStream });
      const mockGetBlockBlobClient = vi.fn().mockReturnValue({ download: mockDownload });
      const mockGetContainerClient = vi.fn().mockReturnValue({ getBlockBlobClient: mockGetBlockBlobClient });
      service.blobServiceClient = { getContainerClient: mockGetContainerClient };

      const result = await service.downloadDocument('org/azure-doc.pdf');
      expect(result.toString()).toBe('azure-file-data');
    });
  });

  // ── deleteDocument ──────────────────────────────────────────────────────
  describe('deleteDocument — S3', () => {
    it('deletes from S3', async () => {
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as unknown;
      const mockSend = vi.fn().mockResolvedValue({});
      service.s3Client = { send: mockSend };
      service.s3Sdk = {
        PutObjectCommand: vi.fn(),
        GetObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
        getSignedUrl: vi.fn(),
      };

      await service.deleteDocument('org/to-delete.pdf');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('throws on delete error', async () => {
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as unknown;
      service.s3Client = { send: vi.fn().mockRejectedValue(new Error('Delete fail')) };
      service.s3Sdk = {
        PutObjectCommand: vi.fn(),
        GetObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
        getSignedUrl: vi.fn(),
      };

      await expect(service.deleteDocument('key')).rejects.toThrow('Delete fail');
    });
  });

  describe('deleteDocument — Azure', () => {
    it('deletes from Azure blob', async () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'conn';
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as unknown;

      const mockDeleteBlob = vi.fn().mockResolvedValue(undefined);
      const mockGetContainerClient = vi.fn().mockReturnValue({ deleteBlob: mockDeleteBlob });
      service.blobServiceClient = { getContainerClient: mockGetContainerClient };

      await service.deleteDocument('org/azure-delete.pdf');
      expect(mockDeleteBlob).toHaveBeenCalledWith('org/azure-delete.pdf');
    });
  });
});
