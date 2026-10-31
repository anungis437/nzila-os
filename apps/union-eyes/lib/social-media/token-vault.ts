/**
 * Provider access and refresh tokens are credentials to post as the organization, so they are stored sealed with the
 * Key-Vault-backed secret service, never as plaintext. A stored value carries the marker below; a value without it is a
 * token written before sealing existed and is returned as it is, then sealed the next time it is rewritten (refresh or reconnect).
 */
const SEALED_PREFIX = 'enc:v1:';

export async function sealToken(plaintext: string): Promise<string> {
  if (plaintext.startsWith(SEALED_PREFIX)) return plaintext;
  return SEALED_PREFIX + (await (await import('@/lib/encryption')).encryptSecret(plaintext));
}

export async function sealOptionalToken(plaintext: string | null | undefined): Promise<string | null> {
  return plaintext ? sealToken(plaintext) : null;
}

export async function openToken(stored: string): Promise<string> {
  if (!stored.startsWith(SEALED_PREFIX)) return stored;
  return (await import('@/lib/encryption')).decryptSecret(stored.slice(SEALED_PREFIX.length));
}

export async function openOptionalToken(stored: string | null | undefined): Promise<string | undefined> {
  return stored ? openToken(stored) : undefined;
}
