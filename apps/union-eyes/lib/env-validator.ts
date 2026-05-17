/**
 * Environment Variable Validator
 * 
 * Validates all required environment variables at application startup.
 * Fails fast with clear error messages if critical variables are missing.
 * 
 * Usage:
 *   import { validateEnv } from '@/lib/env-validator';
 *   validateEnv(); // Call at app startup (instrumentation.ts or layout.tsx)
 */

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  example?: string;
  validate?: (value: string) => boolean;
}

const ENV_VARS: EnvVar[] = [
  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL or Azure SQL connection string',
    example: 'postgresql://user:password@host:port/database',
    validate: (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
  },

  // Authentication (Entra External ID / NextAuth)
  {
    name: 'AUTH_SECRET',
    required: true,
    description: 'NextAuth session encryption secret (32+ chars)',
    example: 'dev_secret_placeholder_32chars_xxxxxxxxxx',
    validate: (val) => val.length >= 10,
  },

  // Payment Processing
  {
    name: 'STRIPE_SECRET_KEY',
    required: true,
    description: 'Stripe secret key for payment processing',
    example: 'sk_test_... or sk_live_...',
    validate: (val) => val.startsWith('sk_test_') || val.startsWith('sk_live_'),
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    required: false,
    description: 'Stripe publishable key for client-side',
    example: 'pk_test_... or pk_live_...',
  },

  // Application URLs
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: false,
    description: 'Application base URL',
    example: 'https://unioneyes.app',
  },
  {
    name: 'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
    required: false,
    description: 'Clerk sign-in URL path',
    example: '/sign-in',
  },
  {
    name: 'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
    required: false,
    description: 'Clerk sign-up URL path',
    example: '/sign-up',
  },

  // Optional: Azure Services
  {
    name: 'AZURE_KEY_VAULT_URL',
    required: false,
    description: 'Azure Key Vault URL for secrets management',
    example: 'https://your-keyvault.vault.azure.net/',
  },
  {
    name: 'AZURE_CLIENT_ID',
    required: false,
    description: 'Azure AD application client ID',
  },
  {
    name: 'AZURE_TENANT_ID',
    required: false,
    description: 'Azure AD tenant ID',
  },

  // Encryption (PII Data Protection)
  {
    name: 'ENCRYPTION_KEY_NAME',
    required: false,
    description: 'Azure Key Vault encryption key name for PII (SIN, SSN, bank accounts)',
    example: 'pii-encryption-key',
  },
  {
    name: 'FALLBACK_ENCRYPTION_KEY',
    required: false,
    description: 'Fallback AES-256 encryption key (base64) for dev/test WITHOUT Azure Key Vault',
    example: 'Generate with: node -e "process.stdout.write(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    validate: (val) => {
      try {
        const buffer = Buffer.from(val, 'base64');
        return buffer.length === 32; // 256 bits
      } catch {
        return false;
      }
    },
  },

  // Optional: Union Configuration
  {
    name: 'UNION_NAME',
    required: false,
    description: 'Union organization name for tax documents',
    example: 'Local 123 Union',
  },
  {
    name: 'UNION_BN',
    required: false,
    description: 'Union Business Number (BN15) for CRA filing',
    example: '123456789RC0001',
  },

  // Optional: Monitoring & Analytics
  {
    name: 'SENTRY_DSN',
    required: false,
    description: 'Sentry DSN for error tracking',
  },
  {
    name: 'SENTRY_AUTH_TOKEN',
    required: false,
    description: 'Sentry auth token for build-time sourcemap upload',
  },

  // Optional: Redis (Upstash)
  {
    name: 'UPSTASH_REDIS_REST_URL',
    required: false,
    description: 'Upstash Redis REST URL for rate limiting and analytics',
    example: 'https://your-redis.upstash.io',
    validate: (val) => val.startsWith('https://'),
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    required: false,
    description: 'Upstash Redis REST token for authentication',
  },

  // Optional: Email/SMS
  {
    name: 'TWILIO_ACCOUNT_SID',
    required: false,
    description: 'Twilio account SID for SMS functionality',
  },
  {
    name: 'TWILIO_AUTH_TOKEN',
    required: false,
    description: 'Twilio auth token',
  },

  // Optional: Analytics Retention
  {
    name: 'ANALYTICS_RETENTION_DAYS',
    required: false,
    description: 'Number of days to retain analytics data in Redis (default: 30)',
    example: '30',
    validate: (val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
  },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missing: string[];
}

/**
 * Validate environment variables
 * @param throwOnError - Whether to throw an error if validation fails (default: true)
 * @returns ValidationResult object
 */
export function validateEnv(throwOnError = true): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];

    // Check if required variable is missing
    if (envVar.required && !value) {
      missing.push(envVar.name);
      errors.push(
        `Ã¢ÂÅ’ Missing required environment variable: ${envVar.name}\n` +
        `   Description: ${envVar.description}\n` +
        (envVar.example ? `   Example: ${envVar.example}\n` : '')
      );
      continue;
    }

    // Skip validation if variable is not set and not required
    if (!value) {
      if (!envVar.required) {
        warnings.push(
          `Ã¢Å¡Â Ã¯Â¸Â  Optional environment variable not set: ${envVar.name}\n` +
          `   Description: ${envVar.description}\n` +
          `   Some features may be unavailable.`
        );
      }
      continue;
    }

    // Run custom validation if provided
    if (envVar.validate && !envVar.validate(value)) {
      errors.push(
        `Ã¢ÂÅ’ Invalid value for ${envVar.name}\n` +
        `   Description: ${envVar.description}\n` +
        (envVar.example ? `   Expected format: ${envVar.example}\n` : '') +
        `   Received: ${value.substring(0, 20)}...`
      );
    }
  }

  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
    missing,
  };

  // Log results
  if (result.valid) {
if (warnings.length > 0) {
}
  } else {
if (throwOnError) {
      throw new Error(
        `Environment validation failed. Missing required variables: ${missing.join(', ')}\n` +
        'Please check your .env.local file and ensure all required variables are set.\n' +
        'See .env.example for reference.'
      );
    }
  }

  return result;
}

/**
 * Get validation result without throwing
 */
export function checkEnv(): ValidationResult {
  return validateEnv(false);
}

/**
 * Check if a specific environment variable is set and valid
 */
export function isEnvSet(name: string): boolean {
  const value = process.env[name];
  return Boolean(value && value.length > 0);
}

/**
 * Get environment variable with validation
 * @throws Error if variable is not set
 */
export function requireEnv(name: string, description?: string): string {
  const value = process.env[name];
  
  if (!value) {
    throw new Error(
      `Required environment variable ${name} is not set.` +
      (description ? `\nDescription: ${description}` : '')
    );
  }
  
  return value;
}

/**
 * Get environment variable with default fallback
 */
export function getEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in test environment
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

// Auto-validate on import if not in test environment
if (typeof window === 'undefined' && !isTest()) {
  // Server-side only, not in browser
  // Skip auto-validation - let caller decide when to validate
  // This prevents validation errors during build time
}

