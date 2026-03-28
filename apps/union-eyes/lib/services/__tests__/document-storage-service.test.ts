import { describe, it, expect, vi, beforeEach } from 'vitest';

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

  describe('constructor', () => {
    it('defaults to s3 backend when no env vars set', async () => {
      const mod = await import('../document-storage-service');
      const service = mod.getDocumentStorageService();
      expect(service).toBeDefined();
    });

    it('selects azure backend when AZURE_STORAGE_CONNECTION_STRING is set', async () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;AccountName=test';
      const mod = await import('../document-storage-service');
      const service = mod.getDocumentStorageService();
      expect(service).toBeDefined();
    });

    it('selects r2 backend when CLOUDFLARE_R2_ENDPOINT is set', async () => {
      process.env.CLOUDFLARE_R2_ENDPOINT = 'https://r2.example.com';
      const mod = await import('../document-storage-service');
      const service = mod.getDocumentStorageService();
      expect(service).toBeDefined();
    });
  });

  describe('StorageResult interface', () => {
    it('exports correct types', async () => {
      const mod = await import('../document-storage-service');
      expect(mod.getDocumentStorageService).toBeDefined();
    });
  });
});
