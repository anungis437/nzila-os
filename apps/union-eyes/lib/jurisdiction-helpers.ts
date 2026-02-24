/**
 * Jurisdiction Helper Functions - Server Only
 * Database-accessing functions for jurisdiction operations
 */

import 'server-only';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import type { CAJurisdiction } from './jurisdiction-helpers-client';
import {
  mapJurisdictionValue,
  getJurisdictionName,
  requiresBilingualSupport,
  getDeadlineUrgency
} from './jurisdiction-helpers-client';

// Re-export client-safe functions
export type { CAJurisdiction } from './jurisdiction-helpers-client';
export {
  mapJurisdictionValue,
  getJurisdictionName,
  requiresBilingualSupport,
  getDeadlineUrgency
};

/**
 * Get organization's jurisdiction from database
 */
export async function getOrganizationJurisdiction(organizationId: string): Promise<CAJurisdiction | null> {
  try {
    const result = await db.execute(sql`
      SELECT jurisdiction 
      FROM organizations 
      WHERE id = ${organizationId}
    `);
    
    const rows = result as unknown as Array<{ jurisdiction: string }>;
    if (rows.length === 0 || !rows[0].jurisdiction) {
      return null;
    }
    
    // Map the old enum value to new format
    return mapJurisdictionValue(rows[0].jurisdiction);
  } catch (_error) {
return null;
  }
}

/**
 * Get tenant's jurisdiction (via organization lookup)
 */
export async function getTenantJurisdiction(organizationId: string): Promise<CAJurisdiction | null> {
  try {
    // First try to get from organizations table directly if tenant_id matches org_id
    const result = await db.execute(sql`
      SELECT jurisdiction 
      FROM organizations 
      WHERE id = ${organizationId}
    `);
    
    const rows = result as unknown as Array<{ jurisdiction: string }>;
    if (rows.length > 0 && rows[0].jurisdiction) {
      return mapJurisdictionValue(rows[0].jurisdiction);
    }
    
    return null;
  } catch (_error) {
return null;
  }
}
/**
 * Get jurisdiction-specific deadline for rule category
 */
export async function getJurisdictionDeadline(
  jurisdiction: CAJurisdiction,
  ruleCategory: string
): Promise<{ days: number; legalReference: string } | null> {
  try {
    const result = await db.execute(sql`
      SELECT 
        (rule_parameters->>'deadline_days')::INTEGER as days,
        legal_reference
      FROM jurisdiction_rules
      WHERE jurisdiction = ${jurisdiction}
        AND rule_category = ${ruleCategory}
        AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
      ORDER BY version DESC
      LIMIT 1
    `);
    
    const rows = result as unknown as Array<{ days: number; legal_reference: string }>;
    if (rows.length === 0) {
      return null;
    }
    
    return {
      days: rows[0].days,
      legalReference: rows[0].legal_reference,
    };
  } catch (_error) {
return null;
  }
}

/**
 * Calculate business days deadline
 */
export async function calculateBusinessDaysDeadline(
  jurisdiction: CAJurisdiction,
  startDate: Date,
  businessDays: number
): Promise<Date | null> {
  try {
    const result = await db.execute(sql`
      SELECT add_business_days(
        ${jurisdiction},
        ${startDate.toISOString()}::DATE,
        ${businessDays}
      ) as deadline
    `);
    
    const rows = result as unknown as Array<{ deadline: string }>;
    if (rows.length === 0) {
      return null;
    }
    
    return new Date(rows[0].deadline);
  } catch (_error) {
return null;
  }
}

