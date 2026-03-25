/**
 * Audit Logging Service
 * 
 * Comprehensive audit logging for security-sensitive operations.
 * Provides centralized logging for compliance (PIPEDA, GDPR, SOC 2).
 * 
 * Usage:
 * ```typescript
 * import { auditLog, AuditEventType } from '@/lib/audit-logger';
 * 
 * await auditLog({
 *   eventType: AuditEventType.DATA_ACCESS,
 *   userId: user.id,
 *   organizationId: org.id,
 *   resource: 'claims',
 *   action: 'read',
 *   details: { claimId: claim.id },
 * });
 * ```
 */

import { db } from '@/db';
import { logger } from './logger';
import { withRLSContext } from './db/with-rls-context';

/**
 * Standard audit event types
 */
export enum AuditEventType {
  // Authentication & Authorization
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_FAILED = 'auth.failed',
  AUTH_MFA_ENABLED = 'auth.mfa_enabled',
  AUTH_MFA_DISABLED = 'auth.mfa_disabled',
  AUTH_PASSWORD_CHANGED = 'auth.password_changed',
  
  // Data Access
  DATA_ACCESS = 'data.access',
  DATA_EXPORT = 'data.export',
  PII_ACCESS = 'pii.access',
  PII_DECRYPTED = 'pii.decrypted',
  
  // Data Modifications
  DATA_CREATE = 'data.create',
  DATA_UPDATE = 'data.update',
  DATA_DELETE = 'data.delete',
  DATA_BULK_UPDATE = 'data.bulk_update',
  DATA_BULK_DELETE = 'data.bulk_delete',
  
  // Financial Operations
  PAYMENT_CREATED = 'payment.created',
  PAYMENT_PROCESSED = 'payment.processed',
  PAYMENT_FAILED = 'payment.failed',
  BILLING_UPDATE = 'billing.update',
  DUES_PAID = 'dues.paid',
  STRIKE_FUND_DISBURSEMENT = 'strike_fund.disbursement',
  
  // Administrative Actions
  ADMIN_USER_CREATED = 'admin.user_created',
  ADMIN_USER_DELETED = 'admin.user_deleted',
  ADMIN_ROLE_CHANGED = 'admin.role_changed',
  ADMIN_PERMISSION_GRANTED = 'admin.permission_granted',
  ADMIN_PERMISSION_REVOKED = 'admin.permission_revoked',
  ADMIN_CONFIG_CHANGED = 'admin.config_changed',
  
  // Privacy & Compliance
  PRIVACY_CONSENT_GRANTED = 'privacy.consent_granted',
  PRIVACY_CONSENT_REVOKED = 'privacy.consent_revoked',
  PRIVACY_DATA_REQUESTED = 'privacy.data_requested',
  PRIVACY_DATA_ERASED = 'privacy.data_erased',
  PRIVACY_BREACH_DETECTED = 'privacy.breach_detected',
  
  // System Events
  SYSTEM_ERROR = 'system.error',
  SYSTEM_RATE_LIMIT = 'system.rate_limit',
  SYSTEM_SECURITY_ALERT = 'system.security_alert',
  
  // API Events
  API_KEY_CREATED = 'api.key_created',
  API_KEY_REVOKED = 'api.key_revoked',
  API_WEBHOOK_RECEIVED = 'api.webhook_received',
  API_WEBHOOK_FAILED = 'api.webhook_failed',
}

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  eventType: AuditEventType | string;
  severity?: AuditSeverity;
  userId?: string;
  organizationId?: string;
  resource?: string;
  resourceId?: string;
  action?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  outcome?: 'success' | 'failure' | 'denied';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Main audit logging function
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  const timestamp = new Date();
  
  try {
    // Log to structured logger first (always succeeds)
    logger.info('Audit Event', {
      ...entry,
      timestamp: timestamp.toISOString(),
      source: 'audit-logger',
    });

    // If organizationId is provided, store in database with RLS context
    if (entry.organizationId) {
      try {
        // Import schema dynamically to avoid circular dependencies
        const { auditLogs } = await import('@/db/schema');
        
        await withRLSContext(async () => {
          return db.insert(auditLogs).values({
            action: entry.action || entry.eventType, // Map eventType to action
            resourceType: entry.resource || 'unknown', // Map resource to resourceType
            resourceId: entry.resourceId,
            userId: entry.userId,
            organizationId: entry.organizationId!,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
            severity: (entry.severity || AuditSeverity.MEDIUM).toLowerCase(), // Ensure lowercase
            outcome: entry.outcome || 'success',
            errorMessage: entry.errorMessage,
            metadata: {
              ...entry.metadata,
              eventType: entry.eventType, // Preserve original eventType in metadata
              details: entry.details,
              timestamp: timestamp.toISOString(),
            },
          });
        });
      } catch (dbError) {
        // If database logging fails, log the error but don&apos;t throw
        logger.error('Failed to store audit log in database', dbError as Error, {
          eventType: entry.eventType,
          organizationId: entry.organizationId,
        });
      }
    }
  } catch (error) {
    // Critical: audit logging should never crash the application
    logger.error('Audit logging failed', error as Error, {
      eventType: entry.eventType,
      entry,
    });
  }
}

/**
 * Audit log for data access operations
 */
export async function auditDataAccess(params: {
  userId: string;
  organizationId: string;
  resource: string;
  resourceId?: string;
  action: 'read' | 'list' | 'search';
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  return auditLog({
    eventType: AuditEventType.DATA_ACCESS,
    severity: AuditSeverity.LOW,
    ...params,
    outcome: 'success',
  });
}

/**
 * Audit log for data mutations (create/update/delete)
 */
export async function auditDataMutation(params: {
  userId: string;
  organizationId: string;
  resource: string;
  resourceId?: string;
  action: 'create' | 'update' | 'delete';
  details?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  const eventTypeMap = {
    create: AuditEventType.DATA_CREATE,
    update: AuditEventType.DATA_UPDATE,
    delete: AuditEventType.DATA_DELETE,
  };

  return auditLog({
    eventType: eventTypeMap[params.action],
    severity: params.action === 'delete' ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
    userId: params.userId,
    organizationId: params.organizationId,
    resource: params.resource,
    resourceId: params.resourceId,
    action: params.action,
    details: {
      ...params.details,
      previousState: params.previousState,
      newState: params.newState,
    },
    ipAddress: params.ipAddress,
    outcome: 'success',
  });
}

/**
 * Audit log for PII access (special handling for sensitive data)
 */
export async function auditPIIAccess(params: {
  userId: string;
  organizationId: string;
  resource: string;
  resourceId: string;
  fields: string[];
  reason?: string;
  ipAddress?: string;
}): Promise<void> {
  return auditLog({
    eventType: AuditEventType.PII_ACCESS,
    severity: AuditSeverity.HIGH,
    userId: params.userId,
    organizationId: params.organizationId,
    resource: params.resource,
    resourceId: params.resourceId,
    action: 'access_pii',
    details: {
      fields: params.fields,
      reason: params.reason,
    },
    ipAddress: params.ipAddress,
    outcome: 'success',
  });
}

/**
 * Audit log for security events
 */
export async function auditSecurityEvent(params: {
  eventType: AuditEventType | string;
  userId?: string;
  organizationId?: string;
  severity?: AuditSeverity;
  details: Record<string, unknown>;
  ipAddress?: string;
  outcome?: 'success' | 'failure' | 'denied';
}): Promise<void> {
  return auditLog({
    severity: AuditSeverity.HIGH,
    ...params,
  });
}

/**
 * Audit log for administrative actions
 */
export async function auditAdminAction(params: {
  eventType: AuditEventType | string;
  userId: string;
  organizationId: string;
  action: string;
  targetUserId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  return auditLog({
    severity: AuditSeverity.HIGH,
    ...params,
    resource: 'admin',
    outcome: 'success',
  });
}

/**
 * Helper to extract IP address from Next.js request
 */
export function getClientIp(request: Request): string | undefined {
  const headers = new Headers(request.headers);
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    undefined
  );
}

/**
 * Helper to extract user agent from Next.js request
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * Batch audit logging for bulk operations
 */
export async function auditBulkOperation(params: {
  userId: string;
  organizationId: string;
  resource: string;
  action: 'bulk_update' | 'bulk_delete' | 'bulk_export';
  affectedCount: number;
  resourceIds?: string[];
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  const eventTypeMap = {
    bulk_update: AuditEventType.DATA_BULK_UPDATE,
    bulk_delete: AuditEventType.DATA_BULK_DELETE,
    bulk_export: AuditEventType.DATA_EXPORT,
  };

  return auditLog({
    eventType: eventTypeMap[params.action],
    severity: params.action === 'bulk_delete' ? AuditSeverity.CRITICAL : AuditSeverity.HIGH,
    userId: params.userId,
    organizationId: params.organizationId,
    resource: params.resource,
    action: params.action,
    details: {
      affectedCount: params.affectedCount,
      resourceIds: params.resourceIds?.slice(0, 100), // Limit to first 100 IDs
      ...params.details,
    },
    ipAddress: params.ipAddress,
    outcome: 'success',
  });
}

