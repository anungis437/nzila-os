import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetSecret: vi.fn(),
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
  mockDebug: vi.fn(),
}));

vi.mock('@azure/keyvault-secrets', () => ({
  SecretClient: class {
    getSecret = mocks.mockGetSecret;
  },
}));

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: class {},
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.mockInfo,
    warn: mocks.mockWarn,
    error: mocks.mockError,
    debug: mocks.mockDebug,
  },
}));

describe('azure-keyvault', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.AZURE_KEY_VAULT_NAME = 'test-vault';
    process.env.AZURE_KEY_VAULT_SECRET_NAME = 'test-key';
  });

  it('getEncryptionKey retrieves secret from key vault', async () => {
    mocks.mockGetSecret.mockResolvedValue({
      value: 'test-encryption-key-base64',
      properties: { id: 'https://test-vault.vault.azure.net/secrets/test-key/v1' },
    });

    const { getEncryptionKey } = await import('../azure-keyvault');
    const key = await getEncryptionKey();

    expect(key).toBe('test-encryption-key-base64');
    expect(mocks.mockGetSecret).toHaveBeenCalledWith('test-key');
  });

  it('getEncryptionKey throws when secret value is empty', async () => {
    mocks.mockGetSecret.mockResolvedValue({
      value: null,
      properties: { id: 'some-id' },
    });

    const { getEncryptionKey } = await import('../azure-keyvault');
    await expect(getEncryptionKey()).rejects.toThrow('Secret value is empty');
  });

  it('getEncryptionKey throws on client error', async () => {
    mocks.mockGetSecret.mockRejectedValue(new Error('Forbidden'));

    const { getEncryptionKey } = await import('../azure-keyvault');
    await expect(getEncryptionKey()).rejects.toThrow('Failed to retrieve encryption key');
  });

  it('getEncryptionKeyVersion returns null when no key cached', async () => {
    const { getEncryptionKeyVersion } = await import('../azure-keyvault');
    expect(getEncryptionKeyVersion()).toBeNull();
  });

  it('getEncryptionKeyMetadata returns null when no key cached', async () => {
    const { getEncryptionKeyMetadata } = await import('../azure-keyvault');
    expect(getEncryptionKeyMetadata()).toBeNull();
  });

  it('getEncryptionKeyVersion returns version after key retrieval', async () => {
    mocks.mockGetSecret.mockResolvedValue({
      value: 'my-key',
      properties: { id: 'https://vault/secrets/key/abc123' },
    });

    const { getEncryptionKey, getEncryptionKeyVersion } = await import('../azure-keyvault');
    await getEncryptionKey();
    expect(getEncryptionKeyVersion()).toBe('abc123');
  });
});
