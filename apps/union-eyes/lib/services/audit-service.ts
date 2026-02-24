/**
 * Audit Service
 * 
 * Comprehensive audit logging for all system activities
 * Supports immutability requirements and compliance reporting
 */

import { db } from '@/db';
import { auditLogs } from '@/db/schema/audit-security-schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export interface AuditLogEntry {
  organizationId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  description?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogQuery {
  organizationId: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<string> {
  const id = uuidv4();
  
  try {
    await db.insert(auditLogs).values({
      auditId: id,
      organizationId: entry.organizationId,
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: entry.metadata ?? undefined,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    });

    logger.info('Created audit log', {
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
    });
    return id;
  } catch (error) {
    logger.error('Failed to create audit log', { error });
    // Return ID anyway to prevent cascading failures
    return id;
  }
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(query: AuditLogQuery): Promise<{
  entries: typeof auditLogs.$inferSelect[];
  total: number;
}> {
  const conditions = [eq(auditLogs.organizationId, query.organizationId)];
  
  if (query.startDate) {
    conditions.push(gte(auditLogs.createdAt, query.startDate));
  }
  if (query.endDate) {
    conditions.push(lte(auditLogs.createdAt, query.endDate));
  }
  if (query.userId) {
    conditions.push(eq(auditLogs.userId, query.userId));
  }
  if (query.action) {
    conditions.push(eq(auditLogs.action, query.action));
  }
  if (query.resourceType) {
    conditions.push(eq(auditLogs.resourceType, query.resourceType));
  }
  if (query.resourceId) {
    conditions.push(eq(auditLogs.resourceId, query.resourceId));
  }

  const limit = query.limit || 100;
  const offset = query.offset || 0;

  const entries = await db.query.auditLogs.findMany({
    where: and(...conditions),
    orderBy: [desc(auditLogs.createdAt)],
    limit,
    offset,
  });

  // Get total count
  const total = await db.$count(auditLogs, and(...conditions));

  return { entries, total };
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditTrail(
  organizationId: string,
  resourceType: string,
  resourceId: string
): Promise<typeof auditLogs.$inferSelect[]> {
  return await db.query.auditLogs.findMany({
    where: and(
      eq(auditLogs.organizationId, organizationId),
      eq(auditLogs.resourceType, resourceType),
      eq(auditLogs.resourceId, resourceId)
    ),
    orderBy: [desc(auditLogs.createdAt)],
  });
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditTrail(
  organizationId: string,
  userId: string,
  limit = 100
): Promise<typeof auditLogs.$inferSelect[]> {
  return await db.query.auditLogs.findMany({
    where: and(
      eq(auditLogs.organizationId, organizationId),
      eq(auditLogs.userId, userId)
    ),
    orderBy: [desc(auditLogs.createdAt)],
    limit,
  });
}

/**
 * Get audit statistics for a time period
 */
export async function getAuditStats(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalEntries: number;
  entriesByAction: Record<string, number>;
  entriesByResource: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
}> {
  const entries = await db.query.auditLogs.findMany({
    where: and(
      eq(auditLogs.organizationId, organizationId),
      gte(auditLogs.createdAt, startDate),
      lte(auditLogs.createdAt, endDate)
    ),
  });

  // Aggregate statistics
  const entriesByAction: Record<string, number> = {};
  const entriesByResource: Record<string, number> = {};
  const userCounts: Record<string, number> = {};

  for (const entry of entries) {
    entriesByAction[entry.action] = (entriesByAction[entry.action] || 0) + 1;
    entriesByResource[entry.resourceType] = (entriesByResource[entry.resourceType] || 0) + 1;
    if (entry.userId) {
      userCounts[entry.userId] = (userCounts[entry.userId] || 0) + 1;
    }
  }

  const topUsers = Object.entries(userCounts)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalEntries: entries.length,
    entriesByAction,
    entriesByResource,
    topUsers,
  };
}

/**
 * PR #11: Archive old audit logs instead of deleting (immutable audit trail)
 * Marks audit logs as archived for compliance with retention policies.
 * Logs can be exported to cold storage (S3/JSON) and marked with archive path.
 */
export async function archiveOldAuditLogs(
  organizationId: string,
  beforeDate: Date,
  archivePath?: string
): Promise<number> {
  const result = await db.update(auditLogs)
    .set({
      archived: true,
      archivedAt: new Date(),
      archivedPath: archivePath || null,
    })
    .where(
      and(
        eq(auditLogs.organizationId, organizationId),
        lte(auditLogs.createdAt, beforeDate),
        eq(auditLogs.archived, false) // Only archive non-archived logs
      )
    )
    .returning();

  logger.info('Archived audit logs', {
    count: result.length,
    beforeDate: beforeDate.toISOString(),
  });
  return result.length;
}

/**
 * @deprecated Use archiveOldAuditLogs() instead. Direct deletion violates audit trail immutability.
 * This function is disabled to prevent accidental data loss.
 */
export async function deleteOldAuditLogs(
  _organizationId: string,
  _beforeDate: Date
): Promise<number> {
  throw new Error(
    'PR #11: Direct audit log deletion is disabled. Use archiveOldAuditLogs() instead. ' +
    'Audit logs must be archived (not deleted) for compliance and defensibility.'
  );
}

/**
 * Export audit logs for compliance reporting
 */
export async function exportAuditLogs(
  query: AuditLogQuery
): Promise<string> {
  const { entries, total } = await queryAuditLogs({
    ...query,
    limit: 10000, // Maximum export size
  });

  const _exportData = entries.map(entry => ({
    id: entry.auditId,
    timestamp: entry.createdAt,
    userId: entry.userId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    ipAddress: entry.ipAddress,
  }));

  const exportId = `AUDIT-EXPORT-${Date.now()}`;
  
  // In production, would write to S3/Azure Blob and return download URL
  logger.info('Exported audit log entries', { total, exportId });
  
  return exportId;
}

/**
 * Create audit log helper for common operations
 */
export function auditOperation(
  organizationId: string,
  userId: string | undefined,
  action: string,
  resourceType: string,
  resourceId: string,
  description?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>
) {
  return createAuditLog({
    organizationId,
    userId,
    action,
    resourceType,
    resourceId,
    description,
    metadata,
  });
}

