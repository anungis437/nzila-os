/**
 * Azure Key Vault Integration for PII Encryption
 * 
 * This module provides secure encryption key management using Azure Key Vault.
 * Keys are retrieved from Key Vault using managed identity authentication and
 * cached for performance (with automatic refresh on expiration).
 * 
 * Features:
 * - Secure key retrieval from Azure Key Vault
 * - Automatic key caching with TTL
 * - Key rotation support
 * - Comprehensive error handling
 * - Audit logging for all key access
 * 
 * Usage:
 * ```typescript
 * import { getEncryptionKey, setEncryptionKeyInSession } from '@/lib/azure-keyvault';
 * 
 * // In API route or server action:
 * const key = await getEncryptionKey();
 * await setEncryptionKeyInSession(db, key);
 * 
 * // Now database functions can use the key
 * const encrypted = await db.query('SELECT encrypt_pii($1)', ['sensitive data']);
 * ```
 */

// eslint-disable-next-line no-restricted-imports -- TODO(platform-migration): migrate to @nzila/ wrapper
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { logger } from '@/lib/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const KEY_VAULT_NAME = process.env.AZURE_KEY_VAULT_NAME || 'unioneyes-keyvault';
const KEY_VAULT_URL = `https://${KEY_VAULT_NAME}.vault.azure.net`;
const SECRET_NAME = process.env.AZURE_KEY_VAULT_SECRET_NAME || 'pii-master-key';

// Key cache configuration
const KEY_CACHE_TTL_MS = 3600000; // 1 hour (keys are cached for performance)
const KEY_REFRESH_THRESHOLD_MS = 300000; // 5 minutes (refresh when 5min remaining)

// ============================================================================
// TYPES
// ============================================================================

interface EncryptionKey {
  value: string;
  version: string;
  expiresAt: Date;
  retrievedAt: Date;
}

interface KeyVaultAccessLog {
  secretName: string;
  accessType: 'retrieve' | 'refresh' | 'error';
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
}

// ============================================================================
// KEY CACHE
// ============================================================================

let cachedKey: EncryptionKey | null = null;
const accessLogs: KeyVaultAccessLog[] = [];

/**
 * Check if cached key is still valid
 */
function isCachedKeyValid(): boolean {
  if (!cachedKey) {
    return false;
  }

  const now = new Date();
  const timeUntilExpiry = cachedKey.expiresAt.getTime() - now.getTime();

  // Key is valid if it hasn&apos;t expired and has more than refresh threshold remaining
  return timeUntilExpiry > KEY_REFRESH_THRESHOLD_MS;
}

/**
 * Log Key Vault access for audit trail
 */
function logKeyVaultAccess(log: KeyVaultAccessLog): void {
  accessLogs.push(log);
  
  // Keep only last 1000 logs in memory
  if (accessLogs.length > 1000) {
    accessLogs.shift();
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    logger.info('Key Vault Access', {
      secretName: log.secretName,
      accessType: log.accessType,
      success: log.success,
      error: log.errorMessage,
      timestamp: log.timestamp.toISOString()
    });
  }
}

// ============================================================================
// KEY VAULT CLIENT
// ============================================================================

let keyVaultClient: SecretClient | null = null;

/**
 * Initialize Key Vault client (lazy initialization)
 */
function getKeyVaultClient(): SecretClient {
  if (!keyVaultClient) {
    try {
      // Use DefaultAzureCredential which supports:
      // 1. Managed Identity (production)
      // 2. Azure CLI (local development)
      // 3. Environment variables
      const credential = new DefaultAzureCredential();
      keyVaultClient = new SecretClient(KEY_VAULT_URL, credential);
      
      logger.info(`[Key Vault] Initialized client for ${KEY_VAULT_URL}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Key Vault] Failed to initialize client', { error: errorMessage });
      throw new Error(`Failed to initialize Key Vault client: ${errorMessage}`);
    }
  }

  return keyVaultClient;
}

// ============================================================================
// KEY RETRIEVAL
// ============================================================================

/**
 * Retrieve encryption key from Azure Key Vault
 * 
 * @returns Encryption key value (base64 string)
 * @throws Error if key retrieval fails
 */
export async function getEncryptionKey(): Promise<string> {
  // Return cached key if still valid
  if (isCachedKeyValid()) {
    logger.info('[Key Vault] Using cached encryption key');
    return cachedKey!.value;
  }

  try {
    const client = getKeyVaultClient();
    
    logger.info(`[Key Vault] Retrieving secret: ${SECRET_NAME}`);
    const secret = await client.getSecret(SECRET_NAME);

    if (!secret.value) {
      throw new Error('Secret value is empty');
    }

    // Extract version from secret ID
    const version = secret.properties.id?.split('/').pop() || 'unknown';

    // Cache the key
    cachedKey = {
      value: secret.value,
      version: version,
      expiresAt: new Date(Date.now() + KEY_CACHE_TTL_MS),
      retrievedAt: new Date()
    };

    // Log successful access
    logKeyVaultAccess({
      secretName: SECRET_NAME,
      accessType: 'retrieve',
      success: true,
      timestamp: new Date()
    });

    logger.info(`[Key Vault] Encryption key retrieved successfully (version: ${version})`);
    return secret.value;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failed access
    logKeyVaultAccess({
      secretName: SECRET_NAME,
      accessType: 'error',
      success: false,
      errorMessage: errorMessage,
      timestamp: new Date()
    });

    logger.error('[Key Vault] Failed to retrieve encryption key', { error: errorMessage });
    throw new Error(`Failed to retrieve encryption key from Key Vault: ${errorMessage}`);
  }
}

/**
 * Get encryption key version (for audit purposes)
 */
export function getEncryptionKeyVersion(): string | null {
  return cachedKey?.version || null;
}

/**
 * Get encryption key metadata
 */
export function getEncryptionKeyMetadata(): Omit<EncryptionKey, 'value'> | null {
  if (!cachedKey) {
    return null;
  }

  return {
    version: cachedKey.version,
    expiresAt: cachedKey.expiresAt,
    retrievedAt: cachedKey.retrievedAt
  };
}

// ============================================================================
// DATABASE SESSION INTEGRATION
// ============================================================================

/**
 * Set encryption key in database session variable
 * 
 * This makes the key available to PostgreSQL encryption/decryption functions
 * via `current_setting('app.encryption_key')`
 * 
 * @param db Database connection (postgres client or Drizzle db)
 * @param key Encryption key to set (if not provided, retrieved from Key Vault)
 */
export async function setEncryptionKeyInSession(
  db: unknown, // Accept any DB client type
  key?: string
): Promise<void> {
  try {
    // Retrieve key if not provided
    const encryptionKey = key || await getEncryptionKey();

    // Set session variable (works with both postgres and Drizzle)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((db as any).execute) {
      // Drizzle db - SECURITY FIX: Use proper parameterization instead of string interpolation
      const { sql } = await import('drizzle-orm');
      // Use parameterized query to safely set the encryption key
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).execute(sql`SET LOCAL app.encryption_key = ${encryptionKey}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } else if ((db as any).query) {
      // postgres client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).query(`SET LOCAL app.encryption_key = $1`, [encryptionKey]);
    } else {
      throw new Error('Unsupported database client type');
    }

    logger.info('[Key Vault] Encryption key set in database session');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Key Vault] Failed to set encryption key in session', { error: errorMessage });
    throw new Error(`Failed to set encryption key in database session: ${errorMessage}`);
  }
}

// ============================================================================
// KEY ROTATION SUPPORT
// ============================================================================

/**
 * Invalidate cached key (force refresh on next access)
 * Use this after key rotation to ensure new key is retrieved
 */
export function invalidateKeyCache(): void {
  cachedKey = null;
  logger.info('[Key Vault] Encryption key cache invalidated');
}

/**
 * Rotate encryption key to new version
 * 
 * Note: This only invalidates cache. Actual key rotation must be done in Azure Key Vault.
 * After rotating in Azure, call this function to force applications to retrieve new key.
 */
export async function rotateEncryptionKey(): Promise<void> {
  logger.info('[Key Vault] Rotating encryption key...');
  
  // Invalidate cache
  invalidateKeyCache();
  
  // Retrieve new key
  const _newKey = await getEncryptionKey();
  
  logger.info(`[Key Vault] Encryption key rotated successfully (version: ${cachedKey?.version})`);
  
  // Return new key for database migration if needed
  return;
}

// ============================================================================
// AUDIT LOG ACCESS
// ============================================================================

/**
 * Get Key Vault access logs (for monitoring/debugging)
 */
export function getKeyVaultAccessLogs(): KeyVaultAccessLog[] {
  return [...accessLogs];
}

/**
 * Get Key Vault access statistics
 */
export function getKeyVaultAccessStats(): {
  totalAccesses: number;
  successfulAccesses: number;
  failedAccesses: number;
  lastAccessTime: Date | null;
} {
  return {
    totalAccesses: accessLogs.length,
    successfulAccesses: accessLogs.filter(log => log.success).length,
    failedAccesses: accessLogs.filter(log => !log.success).length,
    lastAccessTime: accessLogs.length > 0 ? accessLogs[accessLogs.length - 1].timestamp : null
  };
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Health check - verify Key Vault connectivity and key accessibility
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  keyVaultAccessible: boolean;
  secretAccessible: boolean;
  cachedKeyValid: boolean;
  error?: string;
}> {
  try {
    // Test Key Vault connectivity
    const client = getKeyVaultClient();
    
    // Try to retrieve secret
    await client.getSecret(SECRET_NAME);
    
    return {
      healthy: true,
      keyVaultAccessible: true,
      secretAccessible: true,
      cachedKeyValid: isCachedKeyValid()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      healthy: false,
      keyVaultAccessible: false,
      secretAccessible: false,
      cachedKeyValid: isCachedKeyValid(),
      error: errorMessage
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  getEncryptionKey,
  getEncryptionKeyVersion,
  getEncryptionKeyMetadata,
  setEncryptionKeyInSession,
  invalidateKeyCache,
  rotateEncryptionKey,
  getKeyVaultAccessLogs,
  getKeyVaultAccessStats,
  healthCheck
};

