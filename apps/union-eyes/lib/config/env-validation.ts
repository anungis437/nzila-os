/**
 * Environment Variable Validation & Type Safety
 * 
 * Centralized management of all environment variables with:
 * - Type-safe schema definition using Zod
 * - Required vs optional distinction
 * - Production fail-fast on missing critical vars
 * - Audit logging of all env access
 * - Development-friendly error messages
 * 
 * Usage:
 *   import { env } from '@/lib/config/env-validation';
 *   const dbUrl = env.DATABASE_URL; // Type-safe, guaranteed to exist
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

/**
 * Environment variable schema definition
 * This serves as the single source of truth for all required and optional vars
 */
const envSchema = z.object({
  // ============== CRITICAL - App Configuration ==============
  NODE_ENV: z.enum(['development', 'production', 'staging', 'test'])
    .default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url('Invalid APP_URL'),
  NEXT_RUNTIME: z.string().optional(),
  NEXT_PHASE: z.string().optional(),
  NEXT_TELEMETRY_DISABLED: z.string().optional(),

  // ============== CRITICAL - Database ==============
  DATABASE_TYPE: z.enum(['postgresql', 'azure-sql', 'mssql']).default('postgresql').optional(),
  DATABASE_URL: z.string()
    .startsWith('postgresql://', 'Database must be PostgreSQL')
    .describe('PostgreSQL connection string (required in all environments)'),
  DB_POOL_MAX: z.string()
    .transform((val) => parseInt(val || '20'))
    .refine((val) => val >= 1 && val <= 200, 'DB_POOL_MAX must be between 1 and 200')
    .default('20')
    .optional()
    .describe('Maximum database connection pool size (default: 20, production: 50-100)'),
  DB_IDLE_TIMEOUT: z.string()
    .transform((val) => parseInt(val || '30'))
    .refine((val) => val >= 5 && val <= 300, 'DB_IDLE_TIMEOUT must be between 5 and 300 seconds')
    .default('30')
    .optional()
    .describe('Connection idle timeout in seconds (default: 30)'),
  DB_CONNECTION_TIMEOUT: z.string()
    .transform((val) => parseInt(val || '10'))
    .refine((val) => val >= 1 && val <= 60, 'DB_CONNECTION_TIMEOUT must be between 1 and 60 seconds')
    .default('10')
    .optional()
    .describe('Connection timeout in seconds (default: 10)'),
  DB_QUERY_TIMEOUT: z.string()
    .transform((val) => parseInt(val || '30000'))
    .refine((val) => val >= 1000 && val <= 300000, 'DB_QUERY_TIMEOUT must be between 1000 and 300000 ms')
    .default('30000')
    .optional()
    .describe('Query timeout in milliseconds (default: 30000ms / 30s)'),
  DB_SSL: z.string()
    .transform((val) => val === 'true')
    .default('false')
    .optional()
    .describe('Enable SSL for database connection (required for production)'),
  
  // ============== CRITICAL - Authentication ==============
  CLERK_SECRET_KEY: z.string()
    .min(10, 'CLERK_SECRET_KEY must be at least 10 characters'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string()
    .min(10, 'CLERK_PUBLISHABLE_KEY must be at least 10 characters'),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/login').optional(),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/signup').optional(),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/dashboard').optional(),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default('/dashboard').optional(),
  CLERK_COOKIE_DOMAIN: z.string().optional(),
  CLERK_SESSION_TOKEN_LEEWAY: z.string().optional(),
  CLERK_ROTATE_SESSION_INTERVAL: z.string().optional(),

  // ============== HIGH - Supabase (Alternative Database/Auth) ==============
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid SUPABASE_URL').optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // ============== CRITICAL - Voting System ==============
  VOTING_SECRET: z.string()
    .min(32, 'VOTING_SECRET must be at least 32 characters for HMAC-SHA256')
    .describe('Cryptographic secret for vote signing and verification'),

  // ============== HIGH - Webhooks & Payments ==============
  STRIPE_WEBHOOK_SECRET: z.string()
    .min(10, 'STRIPE_WEBHOOK_SECRET is required')
    .optional(),
  WHOP_WEBHOOK_SECRET: z.string()
    .min(10, 'WHOP_WEBHOOK_SECRET is required')
    .optional(),
  WHOP_WEBHOOK_KEY: z.string().optional(),
  
  // ============== HIGH - Stripe Integration ==============
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),

  // ============== HIGH - WHOP Payment Provider ==============
  WHOP_PLAN_ID_MONTHLY: z.string().optional(),
  WHOP_PLAN_ID_YEARLY: z.string().optional(),
  WHOP_API_KEY: z.string().optional(),
  NEXT_PUBLIC_WHOP_REDIRECT_URL: z.string().url('Invalid WHOP_REDIRECT_URL').optional(),
  NEXT_PUBLIC_WHOP_PORTAL_LINK: z.string().url('Invalid WHOP_PORTAL_LINK').optional(),
  ACTIVE_PAYMENT_PROVIDER: z.enum(['stripe', 'whop']).default('whop').optional(),

  // ============== HIGH - Notification Services ==============
  SENDGRID_API_KEY: z.string()
    .min(10, 'SENDGRID_API_KEY must be provided')
    .optional(),
  SENDGRID_FROM_EMAIL: z.string()
    .email('Invalid SENDGRID_FROM_EMAIL')
    .optional(),
  SENDGRID_FROM_NAME: z.string().optional(),

  // ============== HIGH - Email Delivery (Resend/SendGrid) ==============
  EMAIL_PROVIDER: z.enum(['resend', 'sendgrid', 'console']).default('resend'),
  EMAIL_FROM: z.string().email('Invalid EMAIL_FROM').optional(),
  EMAIL_REPLY_TO: z.string().email('Invalid EMAIL_REPLY_TO').optional(),
  RESEND_API_KEY: z.string().optional(),
  
  // ============== MEDIUM - SMS Notifications (Optional) ==============
  TWILIO_ACCOUNT_SID: z.string()
    .min(34, 'TWILIO_ACCOUNT_SID must be at least 34 characters')
    .optional()
    .describe('Twilio Account SID for SMS notifications'),
  TWILIO_AUTH_TOKEN: z.string()
    .min(32, 'TWILIO_AUTH_TOKEN must be at least 32 characters')
    .optional()
    .describe('Twilio Auth Token for SMS notifications'),
  TWILIO_PHONE_NUMBER: z.string()
    .regex(/^\+\d{1,15}$/, 'TWILIO_PHONE_NUMBER must be in E.164 format (+1234567890)')
    .optional()
    .describe('Twilio phone number in E.164 format for SMS sending'),

  // ============== HIGH - Document Storage ==============
  STORAGE_TYPE: z.enum(['s3', 'r2', 'azure', 'disk'])
    .default('disk')
    .describe('Document storage backend: s3, r2, azure, or disk'),

  // AWS S3
  AWS_REGION: z.string().default('us-east-1').optional(),
  AWS_SIGNATURES_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // Cloudflare R2
  CLOUDFLARE_R2_BUCKET: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_SECRET_ACCESS_KEY: z.string().optional(),

  // Azure Storage
  AZURE_STORAGE_ACCOUNT_NAME: z.string().optional(),
  AZURE_STORAGE_ACCOUNT_KEY: z.string().optional(),
  AZURE_STORAGE_CONTAINER: z.string().optional(),

  // ============== HIGH - Document Signing ==============
  DOCUSIGN_INTEGRATION_KEY: z.string().optional(),
  DOCUSIGN_SECRET_KEY: z.string().optional(),
  DOCUSIGN_ACCOUNT_ID: z.string().optional(),
  DOCUSIGN_API_ACCOUNT_ID: z.string().optional(),
  DOCUSIGN_USER_ID: z.string().optional(),
  DOCUSIGN_PRIVATE_KEY: z.string().optional(),
  DOCUSIGN_BASE_URL: z.string().url('Invalid DOCUSIGN_BASE_URL').optional(),

  HELLOSIGN_API_KEY: z.string().optional(),

  ADOBE_CLIENT_ID: z.string().optional(),
  ADOBE_CLIENT_SECRET: z.string().optional(),

  // ============== MEDIUM - Redis Cache ==============
  REDIS_HOST: z.string().default('localhost').optional(),
  REDIS_PORT: z.string().default('6379').optional(),
  REDIS_PASSWORD: z.string().optional(),

  // ============== HIGH - Upstash Redis (Required for Rate Limiting) ==============
  UPSTASH_REDIS_REST_URL: z.string().url('Invalid UPSTASH_REDIS_REST_URL').optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // ============== HIGH - Vercel Blob Storage ==============
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // ============== HIGH - Scheduled Reports Security ==============
  CRON_SECRET: z.string()
    .min(32, 'CRON_SECRET should be at least 32 characters')
    .optional()
    .describe('Secret for authenticating cron job requests'),

  // ============== MEDIUM - Reporting & Storage ==============
  REPORTS_DIR: z.string().default('./reports').optional(),
  TEMP_DIR: z.string().default('./temp').optional(),

  // ============== MEDIUM - Email Templates ==============
  ORGANIZATION_NAME: z.string().default('Union Eyes').optional(),
  RESEND_FROM_EMAIL: z.string().optional(),

  // ============== MEDIUM - Analytics & Monitoring ==============
  SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),

  // ============== MEDIUM - Azure Services ==============
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_KEY_VAULT_NAME: z.string().optional(),
  AZURE_KEY_VAULT_SECRET_NAME: z.string().optional(),

  // Azure AI Services
  AZURE_SPEECH_KEY: z.string().optional(),
  AZURE_SPEECH_REGION: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.string().optional(),
  AZURE_OPENAI_KEY: z.string().optional(),
  AZURE_COMPUTER_VISION_KEY: z.string().optional(),
  AZURE_COMPUTER_VISION_ENDPOINT: z.string().url('Invalid AZURE_COMPUTER_VISION_ENDPOINT').optional(),

  // Azure SQL Server
  AZURE_SQL_SERVER: z.string().optional(),
  AZURE_SQL_DB: z.string().optional(),
  AZURE_SQL_USER: z.string().optional(),
  AZURE_SQL_PASSWORD: z.string().optional(),

  // ============== MEDIUM - Calendar Sync ==============
  GRAPH_API_ENDPOINT: z.string().optional(),
  GRAPH_API_CLIENT_ID: z.string().optional(),
  GRAPH_API_CLIENT_SECRET: z.string().optional(),
  GRAPH_API_TENANT_ID: z.string().optional(),

  // ============== MEDIUM - Firebase ==============
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),

  // ============== CRITICAL - Canadian Compliance ==============
  // Provincial Privacy Laws (Quebec Law 25, BC PIPA, etc.)
  PROVINCIAL_PRIVACY_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),
  QUEBEC_PRIVACY_LEVEL: z.enum(['strict', 'moderate', 'minimal']).default('strict').optional(),
  QUEBEC_DATA_RESIDENCY_REQUIRED: z.string().transform(val => val === 'true').default('true').optional(),
  BC_PRIVACY_LEVEL: z.enum(['strict', 'moderate', 'minimal']).default('strict').optional(),
  ALBERTA_PRIVACY_LEVEL: z.enum(['strict', 'moderate', 'minimal']).default('moderate').optional(),

  // Indigenous Data Sovereignty (FNIGC OCAP® Principles)
  INDIGENOUS_DATA_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),
  BAND_COUNCIL_CONSENT_REQUIRED: z.string().transform(val => val === 'true').default('true').optional(),
  TRADITIONAL_KNOWLEDGE_PROTECTION: z.string().transform(val => val === 'true').default('true').optional(),
  FNIGC_COMPLIANCE_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),

  // Strike Fund Tax Reporting (CRA T4A, Quebec RL-1)
  STRIKE_FUND_TAX_REPORTING_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),
  T4A_REPORTING_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),
  T4A_THRESHOLD: z.string().transform(val => parseInt(val, 10)).default('500').optional(),
  RL1_REPORTING_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),
  TAX_YEAR_END: z.string().default('12-31').optional(),
  UNION_BN: z.string()
    .regex(/^\d{9}RC\d{4}$/, 'UNION_BN must be in format 123456789RC0001')
    .optional()
    .describe('Union Business Number for CRA filing'),

  // Break Glass / Emergency Access
  BREAK_GLASS_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),
  BREAK_GLASS_MAX_DURATION: z.string().transform(val => parseInt(val, 10)).default('24').optional(),
  FORCE_MAJEURE_48H_COMMITMENT: z.string().transform(val => val === 'true').default('true').optional(),

  // Swiss Cold Storage for Force Majeure
  SWISS_COLD_STORAGE_ENABLED: z.string().transform(val => val === 'true').optional(),
  SWISS_COLD_STORAGE_BUCKET: z.string().optional(),
  SWISS_COLD_STORAGE_REGION: z.string().optional(),
  SWISS_COLD_STORAGE_ACCESS_KEY_ID: z.string().optional(),
  SWISS_COLD_STORAGE_SECRET_KEY: z.string().optional(),

  // ============== HIGH - AI Provider Keys ==============
  OPENAI_API_KEY: z.string()
    .startsWith('sk-', 'OPENAI_API_KEY must start with sk-')
    .optional()
    .describe('OpenAI API key for GPT-4/ChatGPT features'),
  ANTHROPIC_API_KEY: z.string()
    .startsWith('sk-ant-', 'ANTHROPIC_API_KEY must start with sk-ant-')
    .optional()
    .describe('Anthropic API key for Claude features'),
  GOOGLE_AI_API_KEY: z.string().optional(),
  AI_CHATBOT_DEFAULT_PROVIDER: z.enum(['openai', 'anthropic', 'google']).default('openai').optional(),
  AI_CHATBOT_DEFAULT_MODEL: z.string().default('gpt-4').optional(),
  AI_CHATBOT_TEMPERATURE: z.string().transform(val => parseFloat(val)).default('0.7').optional(),
  CHATBOT_RAG_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),
  CONTENT_SAFETY_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),

  // LLM Observability (Langfuse)
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_HOST: z.string().url('Invalid LANGFUSE_HOST').optional(),
  LANGFUSE_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),

  // ============== MEDIUM - Feature Flags ==============
  REWARDS_ENABLED: z.string().transform(val => val === 'true').default('false').optional(),
  SHOPIFY_ENABLED: z.string().transform(val => val === 'true').default('false').optional(),
  GEOFENCE_PRIVACY_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),
  LOCATION_TRACKING_ENABLED: z.string().transform(val => val === 'true').default('false').optional(),
  LOCATION_TRACKING_CONSENT_REQUIRED: z.string().transform(val => val === 'true').default('true').optional(),
  CURRENCY_ENFORCEMENT_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),
  DEFAULT_CURRENCY: z.enum(['CAD', 'USD']).default('CAD').optional(),
  
  // GDPR Compliance
  NEXT_PUBLIC_GDPR_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),
  NEXT_PUBLIC_COOKIE_POLICY_URL: z.string().default('/cookie-policy').optional(),
  NEXT_PUBLIC_PRIVACY_POLICY_URL: z.string().default('/privacy-policy').optional(),
  GDPR_DPO_EMAIL: z.string().email('Invalid GDPR_DPO_EMAIL').optional(),
  GDPR_DPO_NAME: z.string().optional(),

  // Address Validation
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  ADDRESS_VALIDATION_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),

  // Shopify Integration
  SHOPIFY_SHOP_DOMAIN: z.string().optional(),
  SHOPIFY_STOREFRONT_TOKEN: z.string().optional(),
  SHOPIFY_ADMIN_TOKEN: z.string().optional(),
  SHOPIFY_WEBHOOK_SECRET: z.string().optional(),

  // Accessibility Testing
  ACCESSIBILITY_AXE_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),
  ACCESSIBILITY_LIGHTHOUSE_ENABLED: z.string().transform(val => val === 'true').default('true').optional(),
  ACCESSIBILITY_MIN_SCORE: z.string().transform(val => parseInt(val, 10)).default('80').optional(),

  // ============== HIGH - OpenTelemetry Distributed Tracing ==============
  OTEL_ENABLED: z.string().transform(val => val === 'true').default('true').optional()
    .describe('Enable/disable OpenTelemetry distributed tracing'),
  OTEL_SERVICE_NAME: z.string().default('unioneyes').optional()
    .describe('Service name for tracing'),
  OTEL_EXPORTER_OTLP_PROTOCOL: z.enum(['grpc', 'http/protobuf', 'http/json'])
    .default('http/protobuf').optional()
    .describe('OTLP export protocol (http/protobuf for Honeycomb)'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url('Invalid OTLP endpoint').optional()
    .describe('OTLP exporter endpoint (e.g., https://api.honeycomb.io)'),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional()
    .describe('OTLP headers for authentication (format: key1=value1,key2=value2)'),
  OTEL_TRACES_SAMPLER: z.enum([
    'always_on',
    'always_off',
    'traceidratio',
    'parentbased_always_on',
    'parentbased_always_off',
    'parentbased_traceidratio'
  ]).default('parentbased_always_on').optional()
    .describe('OpenTelemetry sampling strategy'),
  OTEL_TRACES_SAMPLER_ARG: z.string().optional()
    .describe('Sampling rate for probabilistic sampling (0.0 to 1.0)'),

  // ============== LOW - Testing ==============
  TEST_ORGANIZATION_ID: z.string().optional(),
  TEST_COURSE_ID: z.string().optional(),
  TEST_MEMBER_ID: z.string().optional(),
  SKIP_DB_STARTUP_CHECK: z.string().optional(),
});

export type Environment = z.infer<typeof envSchema>;

/**
 * Validation errors collection for detailed error reporting
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  environment: Partial<Environment>;
}

/**
 * Audit event for security logging
 */
interface AuditEvent {
  timestamp: Date;
  eventType: 'ENV_VALIDATION' | 'ENV_ACCESS' | 'ENV_ERROR';
  variable: string;
  status: 'PASSED' | 'FAILED' | 'ACCESSED';
  details?: Record<string, unknown>;
}

/**
 * Environment validation and access control
 */
class EnvironmentManager {
  private environment: Partial<Environment> = {};
  private validationResult: ValidationResult | null = null;
  private auditLog: AuditEvent[] = [];
  private accessLog: Map<string, number> = new Map();

  /**
   * Initialize and validate environment variables on startup
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const normalizedEnv = Object.fromEntries(
        Object.entries(process.env).map(([key, value]) => [
          key,
          value === '' ? undefined : value,
        ])
      );
      const result = envSchema.safeParse(normalizedEnv);

      if (!result.success) {
        const zodErrors = result.error.flatten();

        // Collect required field errors
        if (zodErrors.fieldErrors) {
          Object.entries(zodErrors.fieldErrors).forEach(([field, msgs]) => {
            if (msgs && msgs.length > 0) {
              msgs.forEach(msg => {
                errors.push(`${field}: ${msg}`);
              });
            }
          });
        }

        // Log validation error
        this.logAudit({
          eventType: 'ENV_VALIDATION',
          variable: 'all',
          status: 'FAILED',
          details: { errorCount: errors.length }
        });
      } else {
        this.environment = result.data;

        // Log validation success
        this.logAudit({
          eventType: 'ENV_VALIDATION',
          variable: 'all',
          status: 'PASSED',
          details: { validCount: Object.keys(result.data).length }
        });

        // Check for potentially unsafe configurations
        if (this.environment.NODE_ENV === 'production') {
          if (!this.environment.SENTRY_DSN) {
            warnings.push('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â SENTRY_DSN not configured - error tracking disabled');
          }
          if (!this.environment.STRIPE_SECRET_KEY && !this.environment.WHOP_WEBHOOK_SECRET) {
            warnings.push('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Neither STRIPE nor WHOP webhook secrets configured');
          }
          if (this.environment.EMAIL_PROVIDER === 'resend' && !this.environment.RESEND_API_KEY) {
            warnings.push('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â RESEND_API_KEY missing for EMAIL_PROVIDER=resend');
          }
          if (this.environment.EMAIL_PROVIDER === 'resend' && !this.environment.EMAIL_FROM) {
            warnings.push('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â EMAIL_FROM missing for Resend delivery');
          }
        }
      }

      this.validationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        environment: this.environment
      };

      return this.validationResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown validation error';
      errors.push(`Validation exception: ${errorMsg}`);

      this.logAudit({
        eventType: 'ENV_ERROR',
        variable: 'all',
        status: 'FAILED',
        details: { error: errorMsg }
      });

      this.validationResult = {
        isValid: false,
        errors,
        warnings,
        environment: this.environment
      };

      return this.validationResult;
    }
  }

  /**
   * Get validated environment variable with audit trail
   */
  get<K extends keyof Environment>(key: K): Environment[K] | undefined {
    if (!this.validationResult) {
      throw new Error('Environment not validated. Call validate() first');
    }

    // Increment access count
    const count = (this.accessLog.get(key as string) || 0) + 1;
    this.accessLog.set(key as string, count);

    // Log access
    this.logAudit({
      eventType: 'ENV_ACCESS',
      variable: key as string,
      status: 'ACCESSED',
      details: { accessCount: count }
    });

    return this.environment[key];
  }

  /**
   * Get all validated environment variables
   */
  getAll(): Partial<Environment> {
    if (!this.validationResult) {
      throw new Error('Environment not validated. Call validate() first');
    }
    return { ...this.environment };
  }

  /**
   * Get validation result
   */
  getValidationResult(): ValidationResult {
    if (!this.validationResult) {
      throw new Error('Environment not validated. Call validate() first');
    }
    return this.validationResult;
  }

  /**
   * Get audit log entries
   */
  getAuditLog(filter?: { eventType?: AuditEvent['eventType']; status?: AuditEvent['status'] }): AuditEvent[] {
    if (!filter) {
      return [...this.auditLog];
    }

    return this.auditLog.filter(event =>
      (!filter.eventType || event.eventType === filter.eventType) &&
      (!filter.status || event.status === filter.status)
    );
  }

  /**
   * Log an audit event
   */
  private logAudit(event: Omit<AuditEvent, 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      ...event,
      timestamp: new Date()
    };

    this.auditLog.push(auditEvent);

    // Log to structured logger in development
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Environment audit event', {
        eventType: event.eventType,
        variable: event.variable,
        status: event.status,
        details: event.details,
      });
    }
  }

  /**
   * Print validation report
   */
  printReport(): void {
    if (!this.validationResult) {
      return;
    }

    const { isValid, errors, warnings } = this.validationResult;

    if (isValid) {
      logger.info('Environment validation passed', {
        errorCount: errors.length,
        warningCount: warnings.length,
      });
    } else {
      logger.error('Environment validation failed', {
        errorCount: errors.length,
        warningCount: warnings.length,
      });
    }

    if (errors.length > 0) {
      errors.forEach((err) => logger.error('Env validation error', { error: err }));
    }

    if (warnings.length > 0) {
      warnings.forEach((warn) => logger.warn('Env validation warning', { warning: warn }));
    }
  }

  /**
   * Export configuration metrics for monitoring
   */
  getMetrics(): Record<string, unknown> {
    const accessStats = Array.from(this.accessLog.entries()).map(([key, count]) => ({
      variable: key,
      accessCount: count
    }));

    return {
      isValid: this.validationResult?.isValid ?? false,
      errorCount: this.validationResult?.errors.length ?? 0,
      warningCount: this.validationResult?.warnings.length ?? 0,
      totalVariables: Object.keys(this.environment).length,
      uniqueAccesses: this.accessLog.size,
      totalAccesses: Array.from(this.accessLog.values()).reduce((a, b) => a + b, 0),
      auditEventCount: this.auditLog.length,
      mostAccessedVariables: accessStats
        .sort((a, b) => (b.accessCount as number) - (a.accessCount as number))
        .slice(0, 10)
    };
  }
}

/**
 * Singleton instance of environment manager
 */
const envManager = new EnvironmentManager();

/**
 * Public interface for environment validation
 */
export function validateEnvironment(): ValidationResult {
  return envManager.validate();
}

/**
 * Type-safe environment variable access
 * Usage: const url = env.DATABASE_URL;
 */
export const env = new Proxy({} as Environment, {
  get(_target, key: string | symbol) {
    if (typeof key !== 'string') return undefined;
    return envManager.get(key as keyof Environment);
  }
});

/**
 * Get environment audit log
 */
export function getEnvironmentAuditLog(filter?: { eventType?: AuditEvent['eventType']; status?: AuditEvent['status'] }) {
  return envManager.getAuditLog(filter);
}

/**
 * Get environment configuration metrics
 */
export function getEnvironmentMetrics() {
  return envManager.getMetrics();
}

/**
 * Print environment validation report to console
 */
export function printEnvironmentReport() {
  envManager.printReport();
}

/**
 * Get full validation result with all details
 */
export function getEnvironmentValidationResult(): ValidationResult {
  return envManager.getValidationResult();
}

/**
 * Export manager for advanced use cases (testing, etc.)
 */
export { EnvironmentManager };

