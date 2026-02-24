/**
 * Comprehensive Audit Trail Service
 * 
 * Immutable audit logging for all financial transactions with compliance support.
 * Provides detailed change tracking, approval workflows, and regulatory reporting.
 */

import { db } from '@/db';
import { financialAuditLog } from '@/db/schema/domains/infrastructure';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'sync' | 'approve' | 'reject' | 'void' | 'reverse';
  userId: string;
  userName: string;
  changes?: Array<{
    field: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oldValue: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newValue: any;
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface AuditQueryOptions {
  organizationId: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditTrailService {
  /**
   * Log a financial transaction action
   */
  static async logAction(params: {
    organizationId: string;
    entityType: string;
    entityId: string;
    action: AuditLogEntry['action'];
    userId: string;
    userName: string;
    changes?: AuditLogEntry['changes'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLogEntry> {
    const [entry] = await db.insert(financialAuditLog).values({
      organizationId: params.organizationId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId,
      userName: params.userName,
      changes: params.changes,
      metadata: params.metadata,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      timestamp: new Date(),
    }).returning();

    return {
      ...(entry as AuditLogEntry),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      organizationId: (entry as any).organizationId || params.organizationId,
    } as AuditLogEntry;
  }

  /**
   * Log journal entry creation
   */
  static async logJournalEntryCreated(params: {
    organizationId: string;
    entryId: string;
    userId: string;
    userName: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entry: any;
    ipAddress?: string;
  }): Promise<void> {
    await this.logAction({
      organizationId: params.organizationId,
      entityType: 'journal_entry',
      entityId: params.entryId,
      action: 'create',
      userId: params.userId,
      userName: params.userName,
      metadata: {
        entryNumber: params.entry.entryNumber,
        totalDebit: params.entry.totalDebit.toString(),
        totalCredit: params.entry.totalCredit.toString(),
        description: params.entry.description,
        lineCount: params.entry.lines.length,
      },
      ipAddress: params.ipAddress,
    });
  }

  /**
   * Log journal entry approval
   */
  static async logJournalEntryApproved(params: {
    organizationId: string;
    entryId: string;
    userId: string;
    userName: string;
    comments?: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.logAction({
      organizationId: params.organizationId,
      entityType: 'journal_entry',
      entityId: params.entryId,
      action: 'approve',
      userId: params.userId,
      userName: params.userName,
      metadata: {
        comments: params.comments,
        approvalTimestamp: new Date().toISOString(),
      },
      ipAddress: params.ipAddress,
    });
  }

  /**
   * Log journal entry reversal
   */
  static async logJournalEntryReversed(params: {
    organizationId: string;
    originalEntryId: string;
    reversalEntryId: string;
    userId: string;
    userName: string;
    reason: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.logAction({
      organizationId: params.organizationId,
      entityType: 'journal_entry',
      entityId: params.originalEntryId,
      action: 'reverse',
      userId: params.userId,
      userName: params.userName,
      metadata: {
        reversalEntryId: params.reversalEntryId,
        reason: params.reason,
      },
      ipAddress: params.ipAddress,
    });
  }

  /**
   * Log invoice changes
   */
  static async logInvoiceUpdated(params: {
    organizationId: string;
    invoiceId: string;
    userId: string;
    userName: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    changes: Array<{ field: string; oldValue: any; newValue: any }>;
    ipAddress?: string;
  }): Promise<void> {
    await this.logAction({
      organizationId: params.organizationId,
      entityType: 'invoice',
      entityId: params.invoiceId,
      action: 'update',
      userId: params.userId,
      userName: params.userName,
      changes: params.changes,
      ipAddress: params.ipAddress,
    });
  }

  /**
   * Log bank reconciliation
   */
  static async logBankReconciliation(params: {
    organizationId: string;
    reconciliationId: string;
    userId: string;
    userName: string;
    transactionCount: number;
    ipAddress?: string;
  }): Promise<void> {
    await this.logAction({
      organizationId: params.organizationId,
      entityType: 'bank_reconciliation',
      entityId: params.reconciliationId,
      action: 'create',
      userId: params.userId,
      userName: params.userName,
      metadata: {
        transactionCount: params.transactionCount,
      },
      ipAddress: params.ipAddress,
    });
  }

  /**
   * Log ERP sync action
   */
  static async logERPSync(params: {
    organizationId: string;
    syncJobId: string;
    entityType: string;
    direction: 'push' | 'pull' | 'bidirectional';
    recordsProcessed: number;
    recordsSucceeded: number;
    recordsFailed: number;
  }): Promise<void> {
    await this.logAction({
      organizationId: params.organizationId,
      entityType: 'erp_sync',
      entityId: params.syncJobId,
      action: 'sync',
      userId: 'system',
      userName: 'System',
      metadata: {
        direction: params.direction,
        entityType: params.entityType,
        recordsProcessed: params.recordsProcessed,
        recordsSucceeded: params.recordsSucceeded,
        recordsFailed: params.recordsFailed,
      },
    });
  }

  /**
   * Query audit log
   */
  static async queryAuditLog(options: AuditQueryOptions): Promise<AuditLogEntry[]> {
    const conditions = [eq(financialAuditLog.organizationId, options.organizationId)];

    if (options.entityType) {
      conditions.push(eq(financialAuditLog.entityType, options.entityType));
    }

    if (options.entityId) {
      conditions.push(eq(financialAuditLog.entityId, options.entityId));
    }

    if (options.userId) {
      conditions.push(eq(financialAuditLog.userId, options.userId));
    }

    if (options.action) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(eq(financialAuditLog.action, options.action as any));
    }

    if (options.startDate) {
      conditions.push(gte(financialAuditLog.timestamp, options.startDate));
    }

    if (options.endDate) {
      conditions.push(lte(financialAuditLog.timestamp, options.endDate));
    }

    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const results = await db
      .select()
      .from(financialAuditLog)
      .where(and(...conditions))
      .orderBy(desc(financialAuditLog.timestamp))
      .limit(limit)
      .offset(offset);

    return results.map((entry) => ({
      ...(entry as AuditLogEntry),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      organizationId: (entry as any).organizationId || options.organizationId,
    })) as AuditLogEntry[];
  }

  /**
   * Get complete history for an entity
   */
  static async getEntityHistory(
    organizationId: string,
    entityType: string,
    entityId: string
  ): Promise<AuditLogEntry[]> {
    return this.queryAuditLog({
      organizationId,
      entityType,
      entityId,
    });
  }

  /**
   * Get user activity log
   */
  static async getUserActivity(
    organizationId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditLogEntry[]> {
    return this.queryAuditLog({
      organizationId,
      userId,
      startDate,
      endDate,
    });
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const logs = await this.queryAuditLog({
      organizationId,
      startDate,
      endDate,
      limit: 10000,
    });

    // Group by entity type
    const byEntityType = logs.reduce((acc, log) => {
      if (!acc[log.entityType]) {
        acc[log.entityType] = [];
      }
      acc[log.entityType].push(log);
      return acc;
    }, {} as Record<string, AuditLogEntry[]>);

    // Group by action
    const byAction = logs.reduce((acc, log) => {
      if (!acc[log.action]) {
        acc[log.action] = 0;
      }
      acc[log.action]++;
      return acc;
    }, {} as Record<string, number>);

    // Group by user
    const byUser = logs.reduce((acc, log) => {
      if (!acc[log.userId]) {
        acc[log.userId] = {
          userId: log.userId,
          userName: log.userName,
          actionCount: 0,
          actions: [],
        };
      }
      acc[log.userId].actionCount++;
      acc[log.userId].actions.push(log);
      return acc;
    }, {} as Record<string, UserActivity>);

    // Identify suspicious activities
    const suspiciousActivities = this.identifySuspiciousActivities(logs);

    return {
      organizationId,
      startDate,
      endDate,
      totalEvents: logs.length,
      byEntityType,
      byAction,
      byUser: Object.values(byUser),
      suspiciousActivities,
      generatedAt: new Date(),
    };
  }

  /**
   * Identify suspicious activities for compliance
   */
  private static identifySuspiciousActivities(logs: AuditLogEntry[]): SuspiciousActivity[] {
    const suspicious: SuspiciousActivity[] = [];

    // Check for rapid deletions
    const deletions = logs.filter(log => log.action === 'delete');
    const deletionsByUser = deletions.reduce((acc, log) => {
      if (!acc[log.userId]) acc[log.userId] = [];
      acc[log.userId].push(log);
      return acc;
    }, {} as Record<string, AuditLogEntry[]>);

    for (const [userId, userDeletions] of Object.entries(deletionsByUser)) {
      if (userDeletions.length > 10) {
        suspicious.push({
          type: 'excessive_deletions',
          userId,
          userName: userDeletions[0].userName,
          count: userDeletions.length,
          description: `User deleted ${userDeletions.length} records`,
          severity: 'high',
          timestamp: userDeletions[0].timestamp,
        });
      }
    }

    // Check for after-hours activities
    const afterHours = logs.filter(log => {
      const hour = log.timestamp.getHours();
      return hour < 6 || hour > 22;
    });

    if (afterHours.length > 0) {
      const byUser = afterHours.reduce((acc, log) => {
        if (!acc[log.userId]) acc[log.userId] = [];
        acc[log.userId].push(log);
        return acc;
      }, {} as Record<string, AuditLogEntry[]>);

      for (const [userId, userLogs] of Object.entries(byUser)) {
        if (userLogs.length > 5) {
          suspicious.push({
            type: 'after_hours_activity',
            userId,
            userName: userLogs[0].userName,
            count: userLogs.length,
            description: `User performed ${userLogs.length} actions after hours`,
            severity: 'medium',
            timestamp: userLogs[0].timestamp,
          });
        }
      }
    }

    // Check for large transaction modifications
    const largeModifications = logs.filter(log => {
      if (log.action !== 'update' || !log.changes) return false;
      return log.changes.some(change => {
        if (change.field.includes('amount') || change.field.includes('balance')) {
          const oldVal = parseFloat(change.oldValue as string);
          const newVal = parseFloat(change.newValue as string);
          return Math.abs(newVal - oldVal) > 10000;  // $10,000+ changes
        }
        return false;
      });
    });

    for (const log of largeModifications) {
      suspicious.push({
        type: 'large_modification',
        userId: log.userId,
        userName: log.userName,
        entityId: log.entityId,
        entityType: log.entityType,
        description: `Large financial modification detected`,
        severity: 'high',
        timestamp: log.timestamp,
      });
    }

    return suspicious;
  }

  /**
   * Export audit log for regulatory compliance
   */
  static async exportAuditLog(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv'
  ): Promise<string> {
    const logs = await this.queryAuditLog({
      organizationId,
      startDate,
      endDate,
      limit: 100000,
    });

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = [
      'Timestamp',
      'Entity Type',
      'Entity ID',
      'Action',
      'User ID',
      'User Name',
      'Changes',
      'IP Address',
    ];

    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.entityType,
      log.entityId,
      log.action,
      log.userId,
      log.userName,
      JSON.stringify(log.changes || []),
      log.ipAddress || '',
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
  }

  /**
   * Log a privileged action (general-purpose audit logging)
   * 
   * Use this for non-financial mutations that require audit trails.
   * Examples: user management, role changes, data access, configuration changes.
   * 
   * @param params - Privileged action details
   * @returns Promise with audit log entry
   */
  static async logPrivilegedAction(params: {
    actorId: string;
    actorRole: string;
    organizationId: string;
    actionType: string;
    entityType: string;
    entityId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
    visibilityScope: 'member' | 'staff' | 'admin' | 'system';
    ipAddress?: string;
    userAgent?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<any> {
    // Import at method level to avoid circular dependencies
    const { auditLogs } = await import('@/db/schema/audit-security-schema');

    // Sanitize metadata to remove sensitive fields
    const sanitizedMetadata = this.sanitizeMetadata(params.metadata || {});

    const [entry] = await db.insert(auditLogs).values({
      organizationId: params.organizationId,
      userId: params.actorId,
      action: params.actionType,
      resourceType: params.entityType,
      resourceId: params.entityId,
      metadata: {
        ...sanitizedMetadata,
        actorRole: params.actorRole,
        visibilityScope: params.visibilityScope,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      severity: 'info',
      outcome: 'success',
    }).returning();

    return entry;
  }

  /**
   * Sanitize metadata to remove sensitive fields
   * 
   * Removes passwords, tokens, secret keys, and other sensitive data
   * before storing in audit logs.
   * 
   * @param metadata - Raw metadata object
   * @returns Sanitized metadata
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'accessToken',
      'refreshToken',
      'sessionToken',
      'privateKey',
      'sin',  // Social Insurance Number
      'ssn',  // Social Security Number
      'creditCard',
      'cardNumber',
      'cvv',
      'pin',
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      
      // Check if key matches sensitive pattern
      const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()));
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface ComplianceReport {
  organizationId: string;
  startDate: Date;
  endDate: Date;
  totalEvents: number;
  byEntityType: Record<string, AuditLogEntry[]>;
  byAction: Record<string, number>;
  byUser: UserActivity[];
  suspiciousActivities: SuspiciousActivity[];
  generatedAt: Date;
}

export interface UserActivity {
  userId: string;
  userName: string;
  actionCount: number;
  actions: AuditLogEntry[];
}

export interface SuspiciousActivity {
  type: 'excessive_deletions' | 'after_hours_activity' | 'large_modification' | 'rapid_changes';
  userId: string;
  userName: string;
  count?: number;
  entityId?: string;
  entityType?: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

