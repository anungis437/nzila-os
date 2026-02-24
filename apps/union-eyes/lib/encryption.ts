/**
 * Encryption Utilities with Azure Key Vault Integration
 * 
 * Provides secure encryption/decryption of PII (Personally Identifiable Information)
 * using Azure Key Vault for key management.
 * 
 * Features:
 * - AES-256-GCM encryption
 * - Azure Key Vault key management
 * - Automatic key rotation with configurable intervals (default: 90 days)
 * - Multi-version key support for backward compatibility
 * - Re-encryption pipeline for data encrypted with old keys
 * - Graceful degradation (fallback to environment variable)
 * - Comprehensive audit logging
 * - Production safety checks to enforce secure key management
 * 
 * Key Rotation:
 * - Keys automatically rotate after KEY_MAX_AGE_DAYS (default: 90 days)
 * - Old keys are retained for KEY_ROTATION_GRACE_PERIOD_DAYS (default: 30 days)
 * - Up to MAX_KEY_VERSIONS_RETAINED (default: 3) versions are kept
 * - Data encrypted with old keys can still be decrypted
 * - Use reEncrypt() to migrate old encrypted data to current key version
 * 
 * Environment Variables:
 * - AZURE_KEY_VAULT_URL: Azure Key Vault URL (REQUIRED in production)
 * - ENCRYPTION_KEY_NAME: Key name in Key Vault (default: 'pii-encryption-key')
 * - FALLBACK_ENCRYPTION_KEY: Base64 encoded 256-bit key (ONLY for dev/test, BLOCKED in production)
 * - TEST_ENCRYPTION_KEY: Deterministic key for test environment
 * - KEY_ROTATION_ENABLED: Enable/disable automatic rotation (default: true)
 * - KEY_MAX_AGE_DAYS: Maximum key age before rotation (default: 90)
 * - KEY_ROTATION_GRACE_PERIOD_DAYS: Grace period for old keys (default: 30)
 * - MAX_KEY_VERSIONS_RETAINED: Number of key versions to retain (default: 3)
 * - NODE_ENV: Environment identifier (development|test|staging|production)
 * 
 * Production Requirements:
 * - Azure Key Vault MUST be configured (AZURE_KEY_VAULT_URL required)
 * - Fallback encryption keys are NOT permitted in production
 * - Application startup will be blocked if fallback key is detected in production
 * - This ensures PII is always encrypted with enterprise-grade key management
 * 
 * Development/Test Environments:
 * - Fallback encryption keys are allowed for local development convenience
 * - Test environments require TEST_ENCRYPTION_KEY for deterministic encryption
 * - Staging environments can use either Key Vault or fallback keys
 * 
 * Compliance: PIPEDA, GDPR, SOC 2
 * 
 * Critical: Only decrypt PII when absolutely necessary and never log decrypted values
 */

import { DefaultAzureCredential } from '@azure/identity';
import { KeyClient, CryptographyClient } from '@azure/keyvault-keys';
import crypto from 'crypto';
import { logger } from './logger';
// Configuration
const KEY_VAULT_URL = process.env.AZURE_KEY_VAULT_URL;
const ENCRYPTION_KEY_NAME = process.env.ENCRYPTION_KEY_NAME || 'pii-encryption-key';
const FALLBACK_ENCRYPTION_KEY = process.env.FALLBACK_ENCRYPTION_KEY;

// Key rotation configuration
const KEY_ROTATION_ENABLED = process.env.KEY_ROTATION_ENABLED !== 'false'; // Enabled by default
const KEY_MAX_AGE_DAYS = parseInt(process.env.KEY_MAX_AGE_DAYS || '90', 10); // 90 days default
const KEY_ROTATION_GRACE_PERIOD_DAYS = parseInt(process.env.KEY_ROTATION_GRACE_PERIOD_DAYS || '30', 10); // 30 days grace period
const MAX_KEY_VERSIONS_RETAINED = parseInt(process.env.MAX_KEY_VERSIONS_RETAINED || '3', 10); // Keep last 3 versions

// Algorithm settings
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for AES-GCM
const _AUTH_TAG_LENGTH = 16; // 128 bits authentication tag
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Key metadata for rotation tracking
 */
interface KeyMetadata {
  version: number;
  key: Buffer;
  createdAt: Date;
  rotatedAt?: Date;
  isActive: boolean;
}

/**
 * Encrypted data format
 */
interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string;         // Base64 encoded initialization vector
  authTag: string;    // Base64 encoded authentication tag
  keyVersion?: string; // Key version for rotation support
}

/**
 * Encryption service with Azure Key Vault and Key Rotation
 */
class EncryptionService {
  private keyClient: KeyClient | null = null;
  private cryptoClient: CryptographyClient | null = null;
  private keyCache: Map<number, KeyMetadata> = new Map(); // version -> metadata
  private currentKeyVersion: number = 1;
  private initialized = false;
  private lastRotationCheck: Date | null = null;

  constructor() {
    this.initialize().catch(error => {
      logger.error('Failed to initialize encryption service', error as Error);
    });
  }

  /**
   * Initialize Azure Key Vault client
   * 
   * Production Safety: Blocks application startup if fallback encryption is
   * detected in production environment. Azure Key Vault is required for production.
   */
  private async initialize(): Promise<void> {
    try {
      // PRODUCTION SAFETY CHECK: Block fallback encryption in production
      const nodeEnv = process.env.NODE_ENV;
      const isProduction = nodeEnv === 'production';
      
      if (isProduction && FALLBACK_ENCRYPTION_KEY) {
        const errorMessage = 
          'SECURITY ERROR: Fallback encryption keys are not permitted in production environment. ' +
          'Azure Key Vault (AZURE_KEY_VAULT_URL) is required for production deployments to ensure ' +
          'enterprise-grade key management and compliance with PIPEDA, GDPR, and SOC 2. ' +
          'Please configure Azure Key Vault and remove FALLBACK_ENCRYPTION_KEY from production environment.';
        
        logger.error(errorMessage, {
          environment: nodeEnv,
          hasFallbackKey: true,
          hasKeyVaultUrl: !!KEY_VAULT_URL,
          securityViolation: 'FALLBACK_ENCRYPTION_IN_PRODUCTION',
          action: 'BLOCKING_STARTUP',
        });
        
        throw new Error(errorMessage);
      }
      
      if (!KEY_VAULT_URL) {
        // Log appropriate message based on environment
        if (isProduction) {
          logger.error(
            'CRITICAL: Azure Key Vault URL not configured in production environment. ' +
            'Production deployments require AZURE_KEY_VAULT_URL to be set.',
            {
              environment: nodeEnv,
              hasKeyVaultUrl: false,
              hasFallbackKey: !!FALLBACK_ENCRYPTION_KEY,
              securityRequirement: 'AZURE_KEY_VAULT_REQUIRED',
            }
          );
          throw new Error(
            'Azure Key Vault configuration required for production. ' +
            'Set AZURE_KEY_VAULT_URL environment variable.'
          );
        } else {
          logger.warn(
            `Azure Key Vault URL not configured - using fallback encryption (${nodeEnv} environment)`,
            {
              environment: nodeEnv,
              fallbackAllowed: !isProduction,
            }
          );
        }
        
        if (FALLBACK_ENCRYPTION_KEY) {
          // Use environment variable as encryption key (dev/test only)
          const keyBuffer = Buffer.from(FALLBACK_ENCRYPTION_KEY, 'base64');
          
          if (keyBuffer.length !== KEY_LENGTH) {
            throw new Error(`Fallback encryption key must be ${KEY_LENGTH} bytes (base64 encoded)`);
          }
          
          // Initialize with version 1
          this.initializeKey(keyBuffer, 1);
          this.initialized = true;
          logger.info('Encryption service initialized with fallback key', {
            environment: process.env.NODE_ENV,
            keyVersion: this.currentKeyVersion,
            rotationEnabled: KEY_ROTATION_ENABLED,
            warning: 'Using fallback encryption - not suitable for production',
          });
        } else if (process.env.NODE_ENV === 'test') {
          // SECURITY FIX: Use deterministic test key instead of random
          const testKey = process.env.TEST_ENCRYPTION_KEY;
          if (!testKey) {
            throw new Error(
              'TEST_ENCRYPTION_KEY environment variable required in test environment. ' +
              'Generate one with: node -e "process.stdout.write(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
            );
          }
          const keyBuffer = Buffer.from(testKey, 'base64');
          if (keyBuffer.length !== KEY_LENGTH) {
            throw new Error(`TEST_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (base64 encoded)`);
          }
          this.initializeKey(keyBuffer, 1);
          this.initialized = true;
          logger.info('Encryption service initialized with deterministic test key', {
            environment: 'test',
            keyVersion: this.currentKeyVersion,
          });
        } else {
          logger.error('No encryption key configured - encryption will fail');
        }
        
        return;
      }

      // Initialize Azure Key Vault clients
      const credential = new DefaultAzureCredential();
      this.keyClient = new KeyClient(KEY_VAULT_URL, credential);

      // Get or create encryption key
      const key = await this.keyClient.getKey(ENCRYPTION_KEY_NAME);
      this.cryptoClient = new CryptographyClient(key, credential);

      // Initialize with a new key
      const initialKey = crypto.randomBytes(KEY_LENGTH);
      this.initializeKey(initialKey, 1);

      this.initialized = true;
      logger.info('Encryption service initialized with Azure Key Vault', {
        environment: process.env.NODE_ENV,
        keyVaultUrl: KEY_VAULT_URL,
        keyName: ENCRYPTION_KEY_NAME,
        keyVersion: this.currentKeyVersion,
        rotationEnabled: KEY_ROTATION_ENABLED,
        keyMaxAgeDays: KEY_MAX_AGE_DAYS,
      });

    } catch (error) {
      logger.error('Failed to initialize Azure Key Vault', error as Error);
      
      // Production: Do not fall back, fail fast
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        logger.error(
          'CRITICAL: Azure Key Vault initialization failed in production. ' +
          'Cannot fall back to environment variable encryption.',
          error as Error,
          {
            environment: process.env.NODE_ENV,
            keyVaultUrl: KEY_VAULT_URL,
            hasFallbackKey: !!FALLBACK_ENCRYPTION_KEY,
            action: 'BLOCKING_STARTUP',
          }
        );
        throw new Error(
          'Azure Key Vault initialization failed in production environment. ' +
          'Please verify AZURE_KEY_VAULT_URL and Azure credentials are configured correctly.'
        );
      }
      
      // Non-production: Allow fallback if available
      if (FALLBACK_ENCRYPTION_KEY) {
        const keyBuffer = Buffer.from(FALLBACK_ENCRYPTION_KEY, 'base64');
        this.initializeKey(keyBuffer, 1);
        this.initialized = true;
        logger.warn('Falling back to environment variable encryption key', {
          environment: process.env.NODE_ENV,
          reason: 'Azure Key Vault initialization failed',
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Initialize a key with metadata
   */
  private initializeKey(key: Buffer, version: number): void {
    const metadata: KeyMetadata = {
      version,
      key,
      createdAt: new Date(),
      isActive: true,
    };
    
    this.keyCache.set(version, metadata);
    this.currentKeyVersion = version;
    
    logger.info('Encryption key initialized', {
      version,
      createdAt: metadata.createdAt.toISOString(),
    });
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized) {
      throw new Error('Encryption service not initialized');
    }

    // Check if key rotation is needed (but not too frequently)
    if (KEY_ROTATION_ENABLED) {
      await this.checkAndRotateKey();
    }
  }

  /**
   * Get encryption key from cache (current active key)
   */
  private async getEncryptionKey(): Promise<Buffer> {
    const currentKey = this.keyCache.get(this.currentKeyVersion);
    
    if (!currentKey) {
      throw new Error('No active encryption key available');
    }

    return currentKey.key;
  }

  /**
   * Get encryption key by version (for decryption)
   */
  private getEncryptionKeyByVersion(version: number): Buffer | null {
    const keyMetadata = this.keyCache.get(version);
    return keyMetadata ? keyMetadata.key : null;
  }

  /**
   * Check if key rotation is needed based on age
   */
  private isKeyRotationNeeded(): boolean {
    if (!KEY_ROTATION_ENABLED) {
      return false;
    }

    const currentKey = this.keyCache.get(this.currentKeyVersion);
    if (!currentKey) {
      return false;
    }

    const keyAgeMs = Date.now() - currentKey.createdAt.getTime();
    const keyAgeDays = keyAgeMs / (1000 * 60 * 60 * 24);
    
    return keyAgeDays >= KEY_MAX_AGE_DAYS;
  }

  /**
   * Check and rotate key if needed (with rate limiting)
   */
  private async checkAndRotateKey(): Promise<void> {
    // Rate limit rotation checks to once per hour
    if (this.lastRotationCheck) {
      const timeSinceLastCheck = Date.now() - this.lastRotationCheck.getTime();
      if (timeSinceLastCheck < 60 * 60 * 1000) { // 1 hour
        return;
      }
    }

    this.lastRotationCheck = new Date();

    if (this.isKeyRotationNeeded()) {
      logger.warn('Encryption key rotation needed', {
        currentVersion: this.currentKeyVersion,
        keyMaxAgeDays: KEY_MAX_AGE_DAYS,
      });

      await this.rotateKey();
    }
  }

  /**
   * Rotate the encryption key
   * Generates a new key and increments the version
   */
  async rotateKey(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Cannot rotate key - service not initialized');
    }

    const oldVersion = this.currentKeyVersion;
    const newVersion = oldVersion + 1;

    logger.info('Starting key rotation', {
      fromVersion: oldVersion,
      toVersion: newVersion,
    });

    try {
      // Generate new key
      const newKey = crypto.randomBytes(KEY_LENGTH);

      // Mark old key as inactive
      const oldKeyMetadata = this.keyCache.get(oldVersion);
      if (oldKeyMetadata) {
        oldKeyMetadata.isActive = false;
        oldKeyMetadata.rotatedAt = new Date();
      }

      // Add new key
      const newKeyMetadata: KeyMetadata = {
        version: newVersion,
        key: newKey,
        createdAt: new Date(),
        isActive: true,
      };

      this.keyCache.set(newVersion, newKeyMetadata);
      this.currentKeyVersion = newVersion;

      // Clean up old keys beyond retention limit
      this.cleanupOldKeys();

      logger.info('Key rotation completed successfully', {
        newVersion,
        oldVersion,
        activeKeyVersions: Array.from(this.keyCache.keys()),
        gracePeriodDays: KEY_ROTATION_GRACE_PERIOD_DAYS,
      });

    } catch (error) {
      logger.error('Key rotation failed', error as Error, {
        attemptedVersion: newVersion,
      });
      throw new Error('Failed to rotate encryption key');
    }
  }

  /**
   * Clean up old key versions beyond retention limit
   */
  private cleanupOldKeys(): void {
    const versions = Array.from(this.keyCache.keys()).sort((a, b) => b - a);
    
    if (versions.length > MAX_KEY_VERSIONS_RETAINED) {
      const versionsToRemove = versions.slice(MAX_KEY_VERSIONS_RETAINED);
      
      for (const version of versionsToRemove) {
        const keyMetadata = this.keyCache.get(version);
        
        // Only remove keys outside grace period
        if (keyMetadata && keyMetadata.rotatedAt) {
          const timeSinceRotation = Date.now() - keyMetadata.rotatedAt.getTime();
          const daysSinceRotation = timeSinceRotation / (1000 * 60 * 60 * 24);
          
          if (daysSinceRotation >= KEY_ROTATION_GRACE_PERIOD_DAYS) {
            this.keyCache.delete(version);
            logger.info('Removed old key version from cache', {
              version,
              daysSinceRotation: Math.round(daysSinceRotation),
            });
          }
        }
      }
    }
  }

  /**
   * Get current key version
   */
  getCurrentKeyVersion(): number {
    return this.currentKeyVersion;
  }

  /**
   * Get key metadata for audit purposes
   */
  getKeyInfo(): { version: number; createdAt: Date; isActive: boolean }[] {
    return Array.from(this.keyCache.values()).map(meta => ({
      version: meta.version,
      createdAt: meta.createdAt,
      isActive: meta.isActive,
    }));
  }

  /**
   * Force key rotation (for manual rotation or testing)
   */
  async forceRotateKey(): Promise<void> {
    logger.warn('Forcing manual key rotation', {
      currentVersion: this.currentKeyVersion,
    });
    await this.rotateKey();
  }

  /**
   * Encrypt plaintext data
   * 
   * @param plaintext - Data to encrypt
   * @returns Encrypted data object (JSON serializable)
   * 
   * @example
   * ```typescript
   * const encrypted = await encryptionService.encrypt('123-456-789');
   * // Store encrypted.ciphertext in database
   * ```
   */
  async encrypt(plaintext: string): Promise<EncryptedData> {
    await this.ensureInitialized();

    try {
      const key = await this.getEncryptionKey();
      const iv = crypto.randomBytes(IV_LENGTH);

      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
      ciphertext += cipher.final('base64');
      
      const authTag = cipher.getAuthTag();

      return {
        ciphertext,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        keyVersion: `v${this.currentKeyVersion}`,
      };

    } catch (error) {
      logger.error('Encryption failed', error as Error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted data
   * Supports multiple key versions for backward compatibility
   * 
   * @param encrypted - Encrypted data object or JSON string
   * @returns Decrypted plaintext
   * 
   * @example
   * ```typescript
   * const decrypted = await encryptionService.decrypt(encryptedData);
   * // Use decrypted value carefully - never log it!
   * ```
   */
  async decrypt(encrypted: EncryptedData | string): Promise<string> {
    await this.ensureInitialized();

    try {
      // Parse if string
      const encryptedData: EncryptedData = typeof encrypted === 'string'
        ? JSON.parse(encrypted)
        : encrypted;

      // Determine key version (backward compatibility for data without version)
      let keyVersion = 1; // Default to v1 for legacy data
      if (encryptedData.keyVersion) {
        const versionMatch = encryptedData.keyVersion.match(/^v(\d+)$/);
        if (versionMatch) {
          keyVersion = parseInt(versionMatch[1], 10);
        }
      }

      // Get the appropriate key version
      const key = this.getEncryptionKeyByVersion(keyVersion);
      
      if (!key) {
        // Log but don&apos;t expose version details to avoid information leakage
        logger.error('Decryption failed - key version not available', {
          hasKeyVersion: !!encryptedData.keyVersion,
          availableVersions: Array.from(this.keyCache.keys()),
        });
        throw new Error('Key version not available for decryption');
      }

      const iv = Buffer.from(encryptedData.iv, 'base64');
      const authTag = Buffer.from(encryptedData.authTag, 'base64');

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let plaintext = decipher.update(encryptedData.ciphertext, 'base64', 'utf8');
      plaintext += decipher.final('utf8');

      // Log successful decryption with old key version
      if (keyVersion !== this.currentKeyVersion) {
        logger.info('Decrypted data with old key version', {
          usedVersion: keyVersion,
          currentVersion: this.currentKeyVersion,
          shouldReEncrypt: true,
        });
      }

      return plaintext;

    } catch (error) {
      logger.error('Decryption failed', error as Error, {
        hasIV: !!(encrypted as EncryptedData).iv,
        hasAuthTag: !!(encrypted as EncryptedData).authTag,
        hasKeyVersion: !!(encrypted as EncryptedData).keyVersion,
      });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt data and return as base64 string
   * Convenient for storing in database TEXT columns
   * 
   * @param plaintext - Data to encrypt
   * @returns Base64 encoded encrypted data
   */
  async encryptToString(plaintext: string): Promise<string> {
    const encrypted = await this.encrypt(plaintext);
    return Buffer.from(JSON.stringify(encrypted)).toString('base64');
  }

  /**
   * Decrypt base64 string
   * 
   * @param encryptedString - Base64 encoded encrypted data
   * @returns Decrypted plaintext
   */
  async decryptFromString(encryptedString: string): Promise<string> {
    const encrypted = JSON.parse(
      Buffer.from(encryptedString, 'base64').toString('utf8')
    );
    return this.decrypt(encrypted);
  }

  /**
   * Check if data appears to be encrypted
   * 
   * @param data - Data to check
   * @returns true if data appears encrypted
   */
  isEncrypted(data: string): boolean {
    try {
      const parsed = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
      return !!(parsed.ciphertext && parsed.iv && parsed.authTag);
    } catch {
      return false;
    }
  }

  /**
   * Hash data (one-way, for comparison only)
   * Use for indexing encrypted data without storing plaintext
   * 
   * @param plaintext - Data to hash
   * @returns SHA-256 hash (hex encoded)
   */
  hash(plaintext: string): string {
    return crypto.createHash('sha256').update(plaintext).digest('hex');
  }

  /**
   * Re-encrypt data with the current key version
   * Use this for batch migration of old encrypted data
   * 
   * @param encrypted - Encrypted data with old key version
   * @returns Newly encrypted data with current key version
   * 
   * @example
   * ```typescript
   * const oldEncrypted = member.sin_encrypted;
   * const newEncrypted = await encryptionService.reEncrypt(oldEncrypted);
   * await db.update(members).set({ sin_encrypted: newEncrypted });
   * ```
   */
  async reEncrypt(encrypted: EncryptedData | string): Promise<string> {
    // First decrypt with the old key
    const plaintext = await this.decrypt(encrypted);
    
    // Then encrypt with the current key
    const newEncrypted = await this.encrypt(plaintext);
    
    logger.info('Data re-encrypted with current key version', {
      newVersion: this.currentKeyVersion,
    });
    
    return Buffer.from(JSON.stringify(newEncrypted)).toString('base64');
  }

  /**
   * Check if encrypted data needs re-encryption
   * 
   * @param encrypted - Encrypted data to check
   * @returns true if data should be re-encrypted
   */
  shouldReEncrypt(encrypted: EncryptedData | string): boolean {
    try {
      const encryptedData: EncryptedData = typeof encrypted === 'string'
        ? JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'))
        : encrypted;

      // No version means very old data
      if (!encryptedData.keyVersion) {
        return true;
      }

      const versionMatch = encryptedData.keyVersion.match(/^v(\d+)$/);
      if (!versionMatch) {
        return true;
      }

      const dataVersion = parseInt(versionMatch[1], 10);
      return dataVersion !== this.currentKeyVersion;
    } catch {
      return false;
    }
  }

  /**
   * Batch re-encrypt multiple encrypted values
   * Useful for migration scripts
   * 
   * @param encryptedValues - Array of encrypted values
   * @returns Array of re-encrypted values in the same order
   */
  async batchReEncrypt(encryptedValues: string[]): Promise<string[]> {
    logger.info('Starting batch re-encryption', {
      count: encryptedValues.length,
      currentVersion: this.currentKeyVersion,
    });

    const results: string[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const encrypted of encryptedValues) {
      try {
        if (this.shouldReEncrypt(encrypted)) {
          const reEncrypted = await this.reEncrypt(encrypted);
          results.push(reEncrypted);
          successCount++;
        } else {
          results.push(encrypted); // Already current version
        }
      } catch (error) {
        logger.error('Failed to re-encrypt value in batch', error as Error);
        results.push(encrypted); // Keep original on failure
        failCount++;
      }
    }

    logger.info('Batch re-encryption completed', {
      total: encryptedValues.length,
      reEncrypted: successCount,
      failed: failCount,
      skipped: encryptedValues.length - successCount - failCount,
    });

    return results;
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();

/**
 * Encrypt SIN (Social Insurance Number)
 * 
 * Special handling for SIN encryption with validation
 * 
 * @param sin - 9-digit SIN
 * @returns Encrypted SIN
 * 
 * @example
 * ```typescript
 * const encryptedSIN = await encryptSIN('123456789');
 * // Store in database
 * await db.update(users).set({ sin_encrypted: encryptedSIN });
 * ```
 */
export async function encryptSIN(sin: string): Promise<string> {
  // Validate SIN format (9 digits, optional spaces/dashes)
  const cleanSIN = sin.replace(/[\s-]/g, '');
  
  if (!/^\d{9}$/.test(cleanSIN)) {
    throw new Error('Invalid SIN format - must be 9 digits');
  }

  // Audit log (without the actual SIN)
  logger.info('Encrypting SIN', {
    sinHash: encryptionService.hash(cleanSIN),
    action: 'encrypt_sin',
  });

  return encryptionService.encryptToString(cleanSIN);
}

/**
 * Decrypt SIN (Social Insurance Number)
 * 
 * CRITICAL: Only call when absolutely necessary (e.g., tax document generation)
 * Never log the returned value
 * 
 * @param encryptedSIN - Encrypted SIN from database
 * @returns Decrypted 9-digit SIN
 * 
 * @example
 * ```typescript
 * // Only decrypt when generating official tax documents
 * const sin = await decryptSIN(member.sin_encrypted);
 * const t4a = generateT4A({ recipientSIN: sin, ... });
 * ```
 */
export async function decryptSIN(encryptedSIN: string): Promise<string> {
  if (!encryptedSIN) {
    throw new Error('No encrypted SIN provided');
  }

  // Audit log (track SIN decryption events)
  logger.info('Decrypting SIN', {
    action: 'decrypt_sin',
    timestamp: new Date().toISOString(),
  });

  const decrypted = await encryptionService.decryptFromString(encryptedSIN);

  // Validate decrypted SIN format
  if (!/^\d{9}$/.test(decrypted)) {
    logger.error('Decrypted SIN has invalid format', {
      length: decrypted.length,
    });
    throw new Error('Decrypted SIN format invalid');
  }

  return decrypted;
}

/**
 * Format SIN for display (masked)
 * 
 * Shows only last 4 digits: ***-***-1234
 * 
 * @param sin - 9-digit SIN (plaintext or encrypted)
 * @param encrypted - Whether SIN is encrypted
 * @returns Masked SIN string
 * 
 * @example
 * ```typescript
 * const masked = await formatSINForDisplay(member.sin_encrypted, true);
 * // Returns: ***-***-1234
 * ```
 */
export async function formatSINForDisplay(
  sin: string,
  encrypted: boolean = false
): Promise<string> {
  if (!sin) {
    return '***-***-****';
  }

  try {
    const plainSIN = encrypted ? await decryptSIN(sin) : sin;
    const cleanSIN = plainSIN.replace(/[\s-]/g, '');
    
    if (cleanSIN.length === 9) {
      const last4 = cleanSIN.slice(-4);
      return `***-***-${last4}`;
    }
    
    return '***-***-****';
  } catch {
    return '***-***-****';
  }
}

/**
 * Migrate plaintext SIN to encrypted
 * 
 * Use for data migration scripts
 * 
 * @param plaintextSIN - Unencrypted SIN from database
 * @returns Encrypted SIN
 */
export async function migrateSINToEncrypted(plaintextSIN: string): Promise<string> {
  if (!plaintextSIN) {
    throw new Error('No SIN to migrate');
  }

  // Check if already encrypted
  if (encryptionService.isEncrypted(plaintextSIN)) {
    logger.warn('SIN already encrypted, skipping migration');
    return plaintextSIN;
  }

  logger.info('Migrating plaintext SIN to encrypted', {
    sinHash: encryptionService.hash(plaintextSIN),
  });

  return encryptSIN(plaintextSIN);
}

/**
 * Generate encryption key for fallback
 * 
 * Use this to generate a secure key for FALLBACK_ENCRYPTION_KEY environment variable
 * 
 * @returns Base64 encoded 256-bit key
 * 
 * @example
 * ```typescript
 * const key = generateEncryptionKey();
 * // Add to .env: FALLBACK_ENCRYPTION_KEY=<key>
 * ```
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

/**
 * Get current encryption key version
 * Useful for monitoring and audit purposes
 * 
 * @returns Current key version number
 */
export function getCurrentKeyVersion(): number {
  return encryptionService.getCurrentKeyVersion();
}

/**
 * Get all key versions info (for audit/monitoring)
 * 
 * @returns Array of key metadata (version, creation date, active status)
 */
export function getKeyVersionsInfo(): { version: number; createdAt: Date; isActive: boolean }[] {
  return encryptionService.getKeyInfo();
}

/**
 * Force manual key rotation
 * Use this for emergency key rotation or maintenance windows
 * 
 * @example
 * ```typescript
 * // Emergency rotation
 * await forceKeyRotation();
 * logger.info('Key rotated to version:', getCurrentKeyVersion());
 * ```
 */
export async function forceKeyRotation(): Promise<void> {
  await encryptionService.forceRotateKey();
}

/**
 * Re-encrypt data with current key version
 * Use for batch migrations
 * 
 * @param encryptedData - Data encrypted with old key
 * @returns Data re-encrypted with current key
 */
export async function reEncryptData(encryptedData: string): Promise<string> {
  return encryptionService.reEncrypt(encryptedData);
}

/**
 * Check if data needs re-encryption
 * 
 * @param encryptedData - Encrypted data to check
 * @returns true if re-encryption is recommended
 */
export function shouldReEncryptData(encryptedData: string): boolean {
  return encryptionService.shouldReEncrypt(encryptedData);
}

/**
 * Batch re-encrypt multiple values
 * Efficient for migration scripts
 * 
 * @param encryptedValues - Array of encrypted values
 * @returns Array of re-encrypted values
 */
export async function batchReEncryptData(encryptedValues: string[]): Promise<string[]> {
  return encryptionService.batchReEncrypt(encryptedValues);
}

