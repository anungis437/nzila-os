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
    vi.doUnmock('module');
    mocks.mockRandomBytes.mockReturnValue(Buffer.from('deadbeef', 'hex'));

    // Clear env vars
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.AZURE_STORAGE_CONTAINER;
    delete process.env.CLOUDFLARE_R2_ENDPOINT;
    delete process.env.CLOUDFLARE_R2_BUCKET;
    delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    delete process.env.AWS_SIGNATURES_BUCKET;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
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

    it('selects r2 backend and preserves endpoint info', async () => {
      process.env.CLOUDFLARE_R2_ENDPOINT = 'https://r2.example.com';
      process.env.CLOUDFLARE_R2_BUCKET = 'r2-bucket';
      const mod = await import('../document-storage-service');
      const service = new mod.default();
      expect(service.getBackendInfo()).toEqual({
        backend: 'r2',
        bucket: 'r2-bucket',
        endpoint: 'https://r2.example.com',
      });
    });

    it('uses default r2 bucket name when CLOUDFLARE_R2_BUCKET is not set', async () => {
      process.env.CLOUDFLARE_R2_ENDPOINT = 'https://r2.example.com';
      // no CLOUDFLARE_R2_BUCKET set
      const mod = await import('../document-storage-service');
      const service = new mod.default();
      expect(service.getBackendInfo().bucket).toBe('union-eyes-signatures');
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

  describe('internal client initialization', () => {
    it('initializes and caches Azure Blob client via dynamic module require', async () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';

      const fakeBlobClient = { getContainerClient: vi.fn(), url: 'https://blob.test/' };
      const fromConnectionString = vi.fn().mockReturnValue(fakeBlobClient);
      const createRequire = vi.fn().mockReturnValue((id: string) => {
        if (id === '@azure/storage-blob') {
          return {
            BlobServiceClient: { fromConnectionString },
          };
        }
        throw new Error(`unexpected require: ${id}`);
      });

      vi.doMock('module', () => ({ createRequire }));

      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;

      const first = await service.ensureAzureClient();
      const second = await service.ensureAzureClient();

      expect(first).toBe(fakeBlobClient);
      expect(second).toBe(fakeBlobClient);
      expect(fromConnectionString).toHaveBeenCalledTimes(1);
    });

    it('initializes S3 client with AWS credentials', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'aws-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret';
      process.env.AWS_REGION = 'us-west-2';

      const S3Client = vi.fn(function S3Client(this: { send: ReturnType<typeof vi.fn>; config: unknown }, config: unknown) {
        this.config = config;
        this.send = vi.fn();
      });
      const PutObjectCommand = vi.fn();
      const GetObjectCommand = vi.fn();
      const DeleteObjectCommand = vi.fn();
      const getSignedUrl = vi.fn();
      const createRequire = vi.fn().mockReturnValue((id: string) => {
        if (id === '@aws-sdk/client-s3') {
          return { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
        }
        if (id === '@aws-sdk/s3-request-presigner') {
          return { getSignedUrl };
        }
        throw new Error(`unexpected require: ${id}`);
      });

      vi.doMock('module', () => ({ createRequire }));

      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;

      const sdk = await service.ensureS3Client();

      expect(sdk.getSignedUrl).toBe(getSignedUrl);
      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-west-2',
        credentials: {
          accessKeyId: 'aws-key',
          secretAccessKey: 'aws-secret',
        },
      });
    });

    it('defaults AWS region to us-east-1 when AWS_REGION is unset', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'aws-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret';
      delete process.env.AWS_REGION;

      const S3Client = vi.fn(function S3Client(this: { send: ReturnType<typeof vi.fn>; config: unknown }, config: unknown) {
        this.config = config;
        this.send = vi.fn();
      });
      const PutObjectCommand = vi.fn();
      const GetObjectCommand = vi.fn();
      const DeleteObjectCommand = vi.fn();
      const getSignedUrl = vi.fn();
      const createRequire = vi.fn().mockReturnValue((id: string) => {
        if (id === '@aws-sdk/client-s3') {
          return { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
        }
        if (id === '@aws-sdk/s3-request-presigner') {
          return { getSignedUrl };
        }
        throw new Error(`unexpected require: ${id}`);
      });

      vi.doMock('module', () => ({ createRequire }));

      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;

      await service.ensureS3Client();

      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'aws-key',
          secretAccessKey: 'aws-secret',
        },
      });
    });

    it('initializes S3 client in R2 mode with endpoint credentials', async () => {
      process.env.CLOUDFLARE_R2_ENDPOINT = 'https://r2.example.com';
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'r2-key';
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'r2-secret';

      const S3Client = vi.fn(function S3Client(this: { send: ReturnType<typeof vi.fn>; config: unknown }, config: unknown) {
        this.config = config;
        this.send = vi.fn();
      });
      const PutObjectCommand = vi.fn();
      const GetObjectCommand = vi.fn();
      const DeleteObjectCommand = vi.fn();
      const getSignedUrl = vi.fn();
      const createRequire = vi.fn().mockReturnValue((id: string) => {
        if (id === '@aws-sdk/client-s3') {
          return { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
        }
        if (id === '@aws-sdk/s3-request-presigner') {
          return { getSignedUrl };
        }
        throw new Error(`unexpected require: ${id}`);
      });

      vi.doMock('module', () => ({ createRequire }));

      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;

      await service.ensureS3Client();

      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
        endpoint: 'https://r2.example.com',
        credentials: {
          accessKeyId: 'r2-key',
          secretAccessKey: 'r2-secret',
        },
      });
    });
  });

  // ── uploadDocument ──────────────────────────────────────────────────────
  describe('uploadDocument — S3', () => {
    it('uploads to S3 and returns signed URL', async () => {
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;

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
      const service = new mod.default() as any;
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

    it('throws when AWS credentials are missing', async () => {
      process.env.AWS_SIGNATURES_BUCKET = 'bucket';
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;

      await expect(service.uploadDocument({
        organizationId: 'org-1',
        documentName: 'x.pdf',
        documentBuffer: Buffer.from('data'),
        documentType: 'contract',
      })).rejects.toThrow('Missing required environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    });
  });

  describe('uploadDocument — Azure', () => {
    it('uploads to Azure blob and returns URL', async () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'conn';
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;

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

  describe('uploadDocument — R2', () => {
    it('throws when R2 credentials are missing', async () => {
      process.env.CLOUDFLARE_R2_ENDPOINT = 'https://r2.example.com';
      process.env.CLOUDFLARE_R2_BUCKET = 'r2-bucket';
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;

      await expect(service.uploadDocument({
        organizationId: 'org-1',
        documentName: 'r2.pdf',
        documentBuffer: Buffer.from('r2-data'),
        documentType: 'contract',
      })).rejects.toThrow('Missing required environment variables: CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    });
  });

  // ── downloadDocument ────────────────────────────────────────────────────
  describe('downloadDocument — S3', () => {
    it('downloads from S3 and returns buffer', async () => {
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;
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
      const service = new mod.default() as any;
      service.s3Client = { send: vi.fn().mockRejectedValue(new Error('Download fail')) };
      service.s3Sdk = {
        PutObjectCommand: vi.fn(),
        GetObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
        getSignedUrl: vi.fn(),
      };

      await expect(service.downloadDocument('key')).rejects.toThrow('Download fail');
    });

    it('supports transformToByteArray body objects', async () => {
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;

      service.s3Client = {
        send: vi.fn().mockResolvedValue({
          Body: {
            transformToByteArray: async () => new Uint8Array(Buffer.from('typed-body')),
          },
        }),
      };
      service.s3Sdk = {
        PutObjectCommand: vi.fn(),
        GetObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
        getSignedUrl: vi.fn(),
      };

      const result = await service.downloadDocument('key');
      expect(result.toString()).toBe('typed-body');
    });

    it('throws for unsupported body objects', async () => {
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;

      service.s3Client = { send: vi.fn().mockResolvedValue({ Body: {} }) };
      service.s3Sdk = {
        PutObjectCommand: vi.fn(),
        GetObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
        getSignedUrl: vi.fn(),
      };

      await expect(service.downloadDocument('key')).rejects.toThrow('Unsupported object body stream type');
    });

    it('handles Uint8Array body', async () => {
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;

      service.s3Client = {
        send: vi.fn().mockResolvedValue({ Body: new Uint8Array([72, 101, 108, 108, 111]) }),
      };
      service.s3Sdk = {
        PutObjectCommand: vi.fn(),
        GetObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
        getSignedUrl: vi.fn(),
      };

      const result = await service.downloadDocument('key');
      expect(result.toString()).toBe('Hello');
    });

    it('handles ArrayBuffer body', async () => {
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;
      const ab = new TextEncoder().encode('World').buffer;

      service.s3Client = {
        send: vi.fn().mockResolvedValue({ Body: ab }),
      };
      service.s3Sdk = {
        PutObjectCommand: vi.fn(),
        GetObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
        getSignedUrl: vi.fn(),
      };

      const result = await service.downloadDocument('key');
      expect(result.toString()).toBe('World');
    });
  });

  describe('downloadDocument — Azure', () => {
    it('downloads from Azure blob and returns buffer', async () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'conn';
      const mod = await import('../document-storage-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new mod.default() as any;
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
      const service = new mod.default() as any;
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
      const service = new mod.default() as any;
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
      const service = new mod.default() as any;

      const mockDeleteBlob = vi.fn().mockResolvedValue(undefined);
      const mockGetContainerClient = vi.fn().mockReturnValue({ deleteBlob: mockDeleteBlob });
      service.blobServiceClient = { getContainerClient: mockGetContainerClient };

      await service.deleteDocument('org/azure-delete.pdf');
      expect(mockDeleteBlob).toHaveBeenCalledWith('org/azure-delete.pdf');
    });
  });
});
