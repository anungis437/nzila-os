/**
 * Configuration and Environment Variable Management (PR #5)
 * 
 * SECURITY: Single source of truth for environment variable access
 * - Centralizes secret management
 * - Provides type-safe accessors
 * - Logs missing secrets for debugging
 * - Throws on missing required secrets (fail-fast)
 * 
 * Usage:
 * ```typescript
 * import { getRequiredSecret, getOptionalSecret } from '@/lib/config';
 * 
 * const apiKey = getRequiredSecret('API_KEY');  // Throws if missing
 * const feature = getOptionalSecret('FEATURE_FLAG', 'disabled');  // Uses default
 * ```
 */

import { logger } from '@/lib/logger';

/**
 * Get required environment variable (throws if missing)
 * 
 * @param name - Environment variable name
 * @returns The environment variable value
 * @throws Error if the environment variable is not set
 * 
 * @example
 * const dbUrl = getRequiredSecret('DATABASE_URL');
 */
export function getRequiredSecret(name: string): string {
  const value = process.env[name];
  
  if (!value) {
    const error = `Missing required environment variable: ${name}`;
    logger.error(error, { envVar: name, fatal: true });
    throw new Error(error);
  }
  
  return value;
}

/**
 * Get optional environment variable with default value
 * 
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The environment variable value or default
 * 
 * @example
 * const timeout = getOptionalSecret('API_TIMEOUT', '5000');
 */
export function getOptionalSecret(name: string, defaultValue: string): string {
  const value = process.env[name];
  
  if (!value) {
    logger.debug(`Using default value for optional environment variable: ${name}`, {
      envVar: name,
      default: defaultValue,
    });
    return defaultValue;
  }
  
  return value;
}

/**
 * Get required numeric environment variable
 * 
 * @param name - Environment variable name
 * @returns The parsed number value
 * @throws Error if the environment variable is not set or not a valid number
 * 
 * @example
 * const port = getRequiredNumber('PORT');
 */
export function getRequiredNumber(name: string): number {
  const value = getRequiredSecret(name);
  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed)) {
    const error = `Environment variable ${name} must be a valid number, got: ${value}`;
    logger.error(error, { envVar: name, value, fatal: true });
    throw new Error(error);
  }
  
  return parsed;
}

/**
 * Get optional numeric environment variable with default value
 * 
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The parsed number value or default
 * 
 * @example
 * const maxRetries = getOptionalNumber('MAX_RETRIES', 3);
 */
export function getOptionalNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  
  if (!value) {
    return defaultValue;
  }
  
  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed)) {
    logger.warn(`Invalid number for ${name}, using default`, {
      envVar: name,
      value,
      default: defaultValue,
    });
    return defaultValue;
  }
  
  return parsed;
}

/**
 * Get boolean environment variable
 * 
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns true if value is 'true', '1', 'yes', 'on' (case-insensitive)
 * 
 * @example
 * const debugMode = getBoolean('DEBUG_MODE', false);
 */
export function getBoolean(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name];
  
  if (!value) {
    return defaultValue;
  }
  
  const normalized = value.toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

/**
 * Validate that all required secrets are present
 * Call this during application startup to fail-fast if configuration is incorrect
 * 
 * @param requiredSecrets - Array of environment variable names that must be set
 * @throws Error if any required secrets are missing
 * 
 * @example
 * validateRequiredSecrets(['DATABASE_URL', 'API_KEY', 'JWT_SECRET']);
 */
export function validateRequiredSecrets(requiredSecrets: string[]): void {
  const missing: string[] = [];
  
  for (const name of requiredSecrets) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }
  
  if (missing.length > 0) {
    const error = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(error, { missing, fatal: true });
    throw new Error(error);
  }
  
  logger.info('All required secrets validated', { count: requiredSecrets.length });
}

/**
 * Get environment (development, staging, production)
 * 
 * @returns The current environment
 */
export function getEnvironment(): 'development' | 'staging' | 'production' | 'test' {
  const env = (
    process.env.UE_ENVIRONMENT
    || process.env.NEXT_PUBLIC_APP_ENV
    || process.env.NODE_ENV
    || 'development'
  ) as string;
  
  if (env === 'test' || env === 'staging' || env === 'production') {
    return env;
  }
  
  return 'development';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return getEnvironment() === 'test';
}

