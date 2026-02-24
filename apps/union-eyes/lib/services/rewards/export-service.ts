/**
 * CSV Export Service for Rewards System
 * Provides CSV export functionality for awards, ledger, budgets, and analytics
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import {
  recognitionAwards,
  rewardWalletLedger,
  rewardBudgetEnvelopes,
  rewardRedemptions,
} from '@/db/schema/recognition-rewards-schema';
import { logger } from '@/lib/logger';

/**
 * Convert array of objects to CSV string
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function arrayToCSV(data: any[], headers: string[]): string {
  const csvRows: string[] = [];
  
  // Add header row
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      
      // Escape values that contain commas or quotes
      if (value === null || value === undefined) {
        return '';
      }
      
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    });
    
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * Export awards to CSV
 */
export async function exportAwardsToCSV(
  orgId: string,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: string[];
    programId?: string;
  }
) {
  try {
    const conditions = [sql`ra.org_id = ${orgId}`];
    
    if (filters?.startDate) {
      conditions.push(sql`ra.created_at >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`ra.created_at <= ${filters.endDate}`);
    }
    if (filters?.status?.length) {
      conditions.push(sql`ra.status = ANY(${filters.status})`);
    }
    if (filters?.programId) {
      conditions.push(sql`rat.program_id = ${filters.programId}`);
    }
    
    const query = sql`
      SELECT 
        ra.id,
        ra.created_at,
        ra.status,
        rat.name as award_type,
        rp.name as program,
        recipient.user_name as recipient_name,
        recipient_user.email as recipient_email,
        issuer.user_name as issuer_name,
        issuer_user.email as issuer_email,
        ra.message,
        ra.credits_awarded,
        ra.approved_at,
        approver.user_name as approver_name,
        ra.issued_at,
        ra.revoked_at,
        ra.rejected_at
      FROM ${recognitionAwards} ra
      LEFT JOIN recognition_award_types rat ON rat.id = ra.award_type_id
      LEFT JOIN recognition_programs rp ON rp.id = rat.program_id
      LEFT JOIN organization_members recipient ON recipient.user_id = ra.recipient_user_id
      LEFT JOIN users recipient_user ON recipient_user.id = ra.recipient_user_id
      LEFT JOIN organization_members issuer ON issuer.user_id = ra.issuer_user_id
      LEFT JOIN users issuer_user ON issuer_user.id = ra.issuer_user_id
      LEFT JOIN organization_members approver ON approver.user_id = ra.approved_by_user_id
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY ra.created_at DESC
    `;
    
    const result = await db.execute(query);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const awards = (result as any[]).map((row: any) => ({
      id: row.id,
      created_at: new Date(row.created_at).toISOString(),
      status: row.status,
      award_type: row.award_type,
      program: row.program,
      recipient_name: row.recipient_name,
      recipient_email: row.recipient_email,
      issuer_name: row.issuer_name,
      issuer_email: row.issuer_email,
      message: row.message,
      credits_awarded: row.credits_awarded,
      approved_at: row.approved_at ? new Date(row.approved_at).toISOString() : '',
      approver_name: row.approver_name || '',
      issued_at: row.issued_at ? new Date(row.issued_at).toISOString() : '',
      revoked_at: row.revoked_at ? new Date(row.revoked_at).toISOString() : '',
      rejected_at: row.rejected_at ? new Date(row.rejected_at).toISOString() : '',
    }));
    
    const headers = [
      'id',
      'created_at',
      'status',
      'award_type',
      'program',
      'recipient_name',
      'recipient_email',
      'issuer_name',
      'issuer_email',
      'message',
      'credits_awarded',
      'approved_at',
      'approver_name',
      'issued_at',
      'revoked_at',
      'rejected_at',
    ];
    
    return arrayToCSV(awards, headers);
  } catch (error) {
    logger.error('[CSV Export] Error exporting awards', { error, orgId });
    throw error;
  }
}

/**
 * Export wallet ledger to CSV
 */
export async function exportLedgerToCSV(
  orgId: string,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    eventType?: string[];
  }
) {
  try {
    const conditions = [sql`rwl.org_id = ${orgId}`];
    
    if (filters?.startDate) {
      conditions.push(sql`rwl.created_at >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`rwl.created_at <= ${filters.endDate}`);
    }
    if (filters?.userId) {
      conditions.push(sql`rwl.user_id = ${filters.userId}`);
    }
    if (filters?.eventType?.length) {
      conditions.push(sql`rwl.event_type = ANY(${filters.eventType})`);
    }
    
    const query = sql`
      SELECT 
        rwl.id,
        rwl.created_at,
        rwl.event_type,
        rwl.amount,
        rwl.balance_after,
        om.user_name,
        u.email,
        rwl.source_type,
        rwl.source_id,
        rwl.description
      FROM ${rewardWalletLedger} rwl
      LEFT JOIN organization_members om ON om.user_id = rwl.user_id
      LEFT JOIN users u ON u.id = rwl.user_id
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY rwl.created_at DESC
    `;
    
    const result = await db.execute(query);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = (result as any[]).map((row: any) => ({
      id: row.id,
      created_at: new Date(row.created_at).toISOString(),
      event_type: row.event_type,
      amount: row.amount,
      balance_after: row.balance_after,
      user_name: row.user_name,
      email: row.email,
      source_type: row.source_type,
      source_id: row.source_id,
      description: row.description || '',
    }));
    
    const headers = [
      'id',
      'created_at',
      'event_type',
      'amount',
      'balance_after',
      'user_name',
      'email',
      'source_type',
      'source_id',
      'description',
    ];
    
    return arrayToCSV(entries, headers);
  } catch (error) {
    logger.error('[CSV Export] Error exporting ledger', { error, orgId });
    throw error;
  }
}

/**
 * Export budget usage to CSV
 */
export async function exportBudgetsToCSV(
  orgId: string,
  filters?: {
    programId?: string;
    activeOnly?: boolean;
  }
) {
  try {
    const conditions = [sql`rbe.org_id = ${orgId}`];
    
    if (filters?.programId) {
      conditions.push(sql`rbe.program_id = ${filters.programId}`);
    }
    if (filters?.activeOnly) {
      const now = new Date();
      conditions.push(sql`rbe.starts_at <= ${now} AND rbe.ends_at >= ${now}`);
    }
    
    const query = sql`
      SELECT 
        rbe.id,
        rbe.budget_name,
        rp.name as program_name,
        rbe.scope_type,
        rbe.total_credits,
        rbe.used_credits,
        rbe.starts_at,
        rbe.ends_at,
        rbe.created_at
      FROM ${rewardBudgetEnvelopes} rbe
      LEFT JOIN recognition_programs rp ON rp.id = rbe.program_id
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY rbe.created_at DESC
    `;
    
    const result = await db.execute(query);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const budgets = (result as any[]).map((row: any) => {
      const usagePercent = (row.used_credits / row.total_credits) * 100;
      return {
        id: row.id,
        budget_name: row.budget_name,
        program_name: row.program_name,
        scope_type: row.scope_type,
        total_credits: row.total_credits,
        used_credits: row.used_credits,
        remaining_credits: row.total_credits - row.used_credits,
        usage_percent: usagePercent.toFixed(2),
        starts_at: new Date(row.starts_at).toISOString(),
        ends_at: new Date(row.ends_at).toISOString(),
        created_at: new Date(row.created_at).toISOString(),
      };
    });
    
    const headers = [
      'id',
      'budget_name',
      'program_name',
      'scope_type',
      'total_credits',
      'used_credits',
      'remaining_credits',
      'usage_percent',
      'starts_at',
      'ends_at',
      'created_at',
    ];
    
    return arrayToCSV(budgets, headers);
  } catch (error) {
    logger.error('[CSV Export] Error exporting budgets', { error, orgId });
    throw error;
  }
}

/**
 * Export redemptions to CSV
 */
export async function exportRedemptionsToCSV(
  orgId: string,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: string[];
  }
) {
  try {
    const conditions = [sql`rr.org_id = ${orgId}`];
    
    if (filters?.startDate) {
      conditions.push(sql`rr.created_at >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`rr.created_at <= ${filters.endDate}`);
    }
    if (filters?.status?.length) {
      conditions.push(sql`rr.status = ANY(${filters.status})`);
    }
    
    const query = sql`
      SELECT 
        rr.id,
        rr.created_at,
        rr.status,
        om.user_name,
        u.email,
        rr.credits_redeemed,
        rr.cancelled_at,
        rr.cancellation_reason,
        rr.provider
      FROM ${rewardRedemptions} rr
      LEFT JOIN organization_members om ON om.user_id = rr.user_id
      LEFT JOIN users u ON u.id = rr.user_id
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY rr.created_at DESC
    `;
    
    const result = await db.execute(query);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redemptions = (result as any[]).map((row: any) => ({
      id: row.id,
      created_at: new Date(row.created_at).toISOString(),
      status: row.status,
      user_name: row.user_name,
      email: row.email,
      credits_redeemed: row.credits_redeemed,
      cancelled_at: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : '',
      cancellation_reason: row.cancellation_reason || '',
      provider: row.provider,
    }));
    
    const headers = [
      'id',
      'created_at',
      'status',
      'user_name',
      'email',
      'credits_redeemed',
      'cancelled_at',
      'cancellation_reason',
      'provider',
    ];
    
    return arrayToCSV(redemptions, headers);
  } catch (error) {
    logger.error('[CSV Export] Error exporting redemptions', { error, orgId });
    throw error;
  }
}

/**
 * Export analytics summary to CSV
 */
export async function exportAnalyticsToCSV(
  orgId: string,
  startDate: Date,
  endDate: Date
) {
  try {
    // Get summary statistics
    const statsQuery = sql`
      SELECT 
        DATE_TRUNC('day', ra.created_at) as date,
        COUNT(ra.id) as awards_issued,
        COUNT(DISTINCT ra.recipient_user_id) as unique_recipients,
        COUNT(DISTINCT ra.issuer_user_id) as unique_issuers,
        SUM(ra.credits_awarded) as total_credits
      FROM ${recognitionAwards} ra
      WHERE ra.org_id = ${orgId}
        AND ra.created_at BETWEEN ${startDate} AND ${endDate}
        AND ra.status = 'issued'
      GROUP BY date
      ORDER BY date ASC
    `;
    
    const result = await db.execute(statsQuery);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = (result as any[]).map((row: any) => ({
      date: new Date(row.date).toISOString().split('T')[0],
      awards_issued: row.awards_issued,
      unique_recipients: row.unique_recipients,
      unique_issuers: row.unique_issuers,
      total_credits: row.total_credits,
    }));
    
    const headers = [
      'date',
      'awards_issued',
      'unique_recipients',
      'unique_issuers',
      'total_credits',
    ];
    
    return arrayToCSV(stats, headers);
  } catch (error) {
    logger.error('[CSV Export] Error exporting analytics', {
      error,
      orgId,
      startDate,
      endDate,
    });
    throw error;
  }
}

