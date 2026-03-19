/**
 * Secrets manager abstraction.
 *
 * Provides a uniform interface for loading secrets from environment variables,
 * a vault, or a config file — with lazy loading and caching.
 */

export interface SecretsProvider {
  get(key: string): Promise<string | undefined>;
  has(key: string): Promise<boolean>;
}

/**
 * Loads secrets from `process.env`.
 */
export class EnvSecretsProvider implements SecretsProvider {
  async get(key: string): Promise<string | undefined> {
    return process.env[key];
  }

  async has(key: string): Promise<boolean> {
    return key in process.env;
  }
}

/**
 * Caching wrapper: resolves each key once and caches the result.
 */
export class CachedSecretsProvider implements SecretsProvider {
  private readonly cache = new Map<string, string | undefined>();

  constructor(private readonly inner: SecretsProvider) {}

  async get(key: string): Promise<string | undefined> {
    if (this.cache.has(key)) return this.cache.get(key);
    const value = await this.inner.get(key);
    this.cache.set(key, value);
    return value;
  }

  async has(key: string): Promise<boolean> {
    if (this.cache.has(key)) return this.cache.get(key) !== undefined;
    return this.inner.has(key);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}

/**
 * Require a secret — throws if missing.
 */
export async function requireSecret(
  provider: SecretsProvider,
  key: string,
): Promise<string> {
  const value = await provider.get(key);
  if (value === undefined) {
    throw new Error(`Required secret "${key}" is not configured`);
  }
  return value;
}
