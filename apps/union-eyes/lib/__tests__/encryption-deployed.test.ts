/**
 * TEST_ENCRYPTION_KEY and FALLBACK_ENCRYPTION_KEY are for a developer's machine and a test run (UE-CONV-H-024). A deployed runtime encrypts with Azure Key Vault or
 * does not encrypt: it does not take a key from its environment, and labelling a deployed container `test` or `development` does not change that.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@azure/identity', () => ({ DefaultAzureCredential: class {} }));
vi.mock('@azure/keyvault-keys', () => ({ KeyClient: class {}, CryptographyClient: class {} }));
vi.mock('../logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const KEY = Buffer.alloc(32, 7).toString('base64');
const CLEARED = ['AZURE_KEY_VAULT_URL', 'FALLBACK_ENCRYPTION_KEY', 'TEST_ENCRYPTION_KEY', 'UE_ENVIRONMENT', 'NEXT_PUBLIC_APP_ENV', 'TARGET_ENVIRONMENT', 'NZILA_MODE'];

const DEPLOYED: ReadonlyArray<Record<string, string>> = [
  { NODE_ENV: 'production' },
  { NODE_ENV: 'production', UE_ENVIRONMENT: 'staging' },
  // A deployed container labelled test or development.
  { NODE_ENV: 'test', UE_ENVIRONMENT: 'production' },
  { NODE_ENV: 'test', UE_ENVIRONMENT: 'staging' },
  { NODE_ENV: 'test', NEXT_PUBLIC_APP_ENV: 'production' },
  { NODE_ENV: 'development', UE_ENVIRONMENT: 'pilot' },
  { NODE_ENV: 'development', NZILA_MODE: 'production' },
];

async function loadService(env: Record<string, string>) {
  vi.resetModules();
  for (const name of CLEARED) vi.stubEnv(name, '');
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return (await import('../encryption')).encryptionService;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the environment keys of the encryption service', () => {
  it('encrypts with the test key on a test run', async () => {
    const service = await loadService({ NODE_ENV: 'test', TEST_ENCRYPTION_KEY: KEY });
    const encrypted = await service.encrypt('a social insurance number');
    expect(await service.decrypt(encrypted)).toBe('a social insurance number');
  });

  it('encrypts with the fallback key on a developer machine', async () => {
    const service = await loadService({ NODE_ENV: 'development', FALLBACK_ENCRYPTION_KEY: KEY });
    expect(await service.decrypt(await service.encrypt('local'))).toBe('local');
  });

  it.each(DEPLOYED)('refuses the test key on a deployed runtime: %o', async (identity) => {
    const service = await loadService({ ...identity, TEST_ENCRYPTION_KEY: KEY });
    await expect(service.encrypt('a social insurance number')).rejects.toThrow(/Key Vault/);
  });

  it.each(DEPLOYED)('refuses the fallback key on a deployed runtime: %o', async (identity) => {
    const service = await loadService({ ...identity, FALLBACK_ENCRYPTION_KEY: KEY });
    await expect(service.encrypt('a social insurance number')).rejects.toThrow(/Key Vault|Fallback encryption keys are not permitted/);
  });
});
