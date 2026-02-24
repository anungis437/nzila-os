/**
 * CLC Per-Capita Remittance Calculator Service
 * Purpose: Calculate monthly per-capita tax remittances from local unions to parent organizations
 * Compliance: CLC Constitution Article 6 - Per-Capita Tax Requirements
 */

import { db } from '@/db';
import {
  organizations,
  organizationMembers,
  perCapitaRemittances,
} from '@/db/schema';
import { eq, and, sql, lte, isNotNull } from 'drizzle-orm';

// =====================================================================================
// TYPES
// =====================================================================================

export interface PerCapitaCalculation {
  fromOrganizationId: string;
  toOrganizationId: string;
  remittanceMonth: number;
  remittanceYear: number;
  totalMembers: number;
  goodStandingMembers: number;
  remittableMembers: number;
  perCapitaRate: number;
  totalAmount: number;
  dueDate: Date;
  clcAccountCode: string;
  glAccount: string;
}

export interface RemittanceStatus {
  organizationId: string;
  organizationName: string;
  totalDue: number;
  totalPaid: number;
  totalOverdue: number;
  pendingCount: number;
  overdueCount: number;
  lastRemittanceDate: Date | null;
}

export interface MemberStanding {
  userId: string;
  organizationId: string;
  isGoodStanding: boolean;
  lastDuesPaymentDate: Date | null;
  duesOwing: number;
}

// =====================================================================================
// CONFIGURATION
// =====================================================================================

const DEFAULT_REMITTANCE_DAY = 15; // 15th of each month
const GRACE_PERIOD_DAYS = 5; // 5 days grace period before overdue
const CLC_PER_CAPITA_ACCOUNT = '4100-001'; // CLC Chart of Accounts code
const GL_PER_CAPITA_EXPENSE = '5200'; // General Ledger expense account

// =====================================================================================
// MEMBER STANDING CALCULATIONS
// =====================================================================================

/**
 * Determine if member is in good standing
 * Good standing = Dues paid within last 60 days
 */
export async function getMemberStanding(
  userId: string,
  organizationId: string
): Promise<MemberStanding> {
  // Check organization membership
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, 'active')
      )
    );

  if (!membership) {
    return {
      userId,
      organizationId,
      isGoodStanding: false,
      lastDuesPaymentDate: null,
      duesOwing: 0,
    };
  }

  // Check latest dues payment (last 60 days)
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const result = await db.execute(sql`
    SELECT 
      MAX(payment_date) as last_payment_date,
      COALESCE(SUM(CASE WHEN payment_date < ${sixtyDaysAgo} THEN amount ELSE 0 END), 0) as dues_owing
    FROM dues_payments
    WHERE member_id = ${userId}
      AND organization_id = ${organizationId}
      AND status = 'completed'
  `);

  const lastPaymentDate = result[0]?.last_payment_date as Date | null;
  const duesOwing = parseFloat(String(result[0]?.dues_owing || '0')) || 0;

  const isGoodStanding = lastPaymentDate ? lastPaymentDate >= sixtyDaysAgo : false;

  return {
    userId,
    organizationId,
    isGoodStanding,
    lastDuesPaymentDate: lastPaymentDate,
    duesOwing,
  };
}

/**
 * Count members in good standing for an organization
 */
export async function countGoodStandingMembers(
  organizationId: string
): Promise<{ total: number; goodStanding: number; remittable: number }> {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const result = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT om.user_id) as total_members,
      COUNT(DISTINCT CASE 
        WHEN dp.payment_date >= ${sixtyDaysAgo} THEN om.user_id 
      END) as good_standing_members
    FROM organization_members om
    LEFT JOIN dues_payments dp ON dp.member_id = om.user_id 
      AND dp.organization_id = om.organization_id
      AND dp.status = 'completed'
    WHERE om.organization_id = ${organizationId}
      AND om.status = 'active'
  `);

  const totalMembers = parseInt(String(result[0]?.total_members || '0')) || 0;
  const goodStandingMembers = parseInt(String(result[0]?.good_standing_members || '0')) || 0;

  // Remittable members = good standing members
  // (In some unions, this might include a grace period or different logic)
  const remittableMembers = goodStandingMembers;

  return {
    total: totalMembers,
    goodStanding: goodStandingMembers,
    remittable: remittableMembers,
  };
}

// =====================================================================================
// PER-CAPITA CALCULATION
// =====================================================================================

/**
 * Calculate per-capita remittance for a single organization
 */
export async function calculatePerCapita(
  organizationId: string,
  remittanceMonth: number,
  remittanceYear: number
): Promise<PerCapitaCalculation | null> {
  // Get organization details
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  if (!org) {
    throw new Error(`Organization ${organizationId} not found`);
  }

  // Must have parent organization for remittance
  if (!org.parentId) {
return null;
  }

  // Get per-capita rate from organization settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgSettings = (org.settings as any) || {};
  const perCapitaRate = parseFloat(orgSettings.perCapitaRate || '1.0');
  
  if (perCapitaRate <= 0) {
return null;
  }

  // Count members
  const memberCounts = await countGoodStandingMembers(organizationId);

  // Calculate total amount using rate from settings
  const totalAmount = memberCounts.remittable * perCapitaRate;

  // Calculate due date using remittanceDay from settings or default
  const remittanceDay = parseInt(orgSettings.remittanceDay || DEFAULT_REMITTANCE_DAY.toString());
  const dueDate = new Date(remittanceYear, remittanceMonth, remittanceDay);

  // Get CLC account code (or use default)
  const clcAccountCode = org.charterNumber || CLC_PER_CAPITA_ACCOUNT;

  return {
    fromOrganizationId: organizationId,
    toOrganizationId: org.parentId,
    remittanceMonth,
    remittanceYear,
    totalMembers: memberCounts.total,
    goodStandingMembers: memberCounts.goodStanding,
    remittableMembers: memberCounts.remittable,
    perCapitaRate,
    totalAmount,
    dueDate,
    clcAccountCode,
    glAccount: GL_PER_CAPITA_EXPENSE,
  };
}

/**
 * Calculate per-capita for all organizations with parent org
 * Typically run monthly via cron job
 */
export async function calculateAllPerCapita(
  remittanceMonth: number,
  remittanceYear: number
): Promise<PerCapitaCalculation[]> {
// Get all active organizations with parent (potential remitters)
  const orgsWithParent = await db
    .select()
    .from(organizations)
    .where(
      and(
        isNotNull(organizations.parentId),
        eq(organizations.status, 'active')
      )
    );

  // Filter to those with per-capita rate in settings
  const orgsWithRate = orgsWithParent.filter(org => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = (org.settings as any) || {};
    return settings.perCapitaRate && parseFloat(settings.perCapitaRate) > 0;
  });
const calculations: PerCapitaCalculation[] = [];

  for (const org of orgsWithRate) {
    try {
      const calculation = await calculatePerCapita(org.id, remittanceMonth, remittanceYear);
      if (calculation) {
        calculations.push(calculation);
      }
    } catch (_error) {
}
  }
return calculations;
}

/**
 * Save per-capita calculations to database
 */
export async function savePerCapitaRemittances(
  calculations: PerCapitaCalculation[]
): Promise<{ saved: number; errors: number }> {
  let saved = 0;
  let errors = 0;

  for (const calc of calculations) {
    try {
      // Check if remittance already exists for this period
      const [existing] = await db
        .select()
        .from(perCapitaRemittances)
        .where(
          and(
            eq(perCapitaRemittances.fromOrganizationId, calc.fromOrganizationId),
            eq(perCapitaRemittances.toOrganizationId, calc.toOrganizationId),
            eq(perCapitaRemittances.remittanceMonth, calc.remittanceMonth),
            eq(perCapitaRemittances.remittanceYear, calc.remittanceYear)
          )
        );

      if (existing) {
        // Update existing remittance
        await db
          .update(perCapitaRemittances)
          .set({
            totalMembers: calc.totalMembers,
            goodStandingMembers: calc.goodStandingMembers,
            remittableMembers: calc.remittableMembers,
            perCapitaRate: calc.perCapitaRate.toString(),
            totalAmount: calc.totalAmount.toString(),
            dueDate: calc.dueDate.toISOString().split('T')[0],
            clcAccountCode: calc.clcAccountCode,
            glAccount: calc.glAccount,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(perCapitaRemittances.id, existing.id));
      } else {
        // Insert new remittance
        await db.insert(perCapitaRemittances).values({
          organizationId: calc.fromOrganizationId, // Submitting organization
          fromOrganizationId: calc.fromOrganizationId,
          toOrganizationId: calc.toOrganizationId,
          remittanceMonth: calc.remittanceMonth,
          remittanceYear: calc.remittanceYear,
          totalMembers: calc.totalMembers,
          goodStandingMembers: calc.goodStandingMembers,
          remittableMembers: calc.remittableMembers,
          perCapitaRate: calc.perCapitaRate.toString(),
          totalAmount: calc.totalAmount.toString(),
          dueDate: calc.dueDate.toISOString().split('T')[0],
          clcAccountCode: calc.clcAccountCode,
          glAccount: calc.glAccount,
          status: 'pending',
        });
      }

      saved++;
    } catch (_error) {
errors++;
    }
  }
return { saved, errors };
}

// =====================================================================================
// REMITTANCE STATUS & REPORTING
// =====================================================================================

/**
 * Get remittance status for all organizations (for parent org view)
 */
export async function getRemittanceStatusForParent(
  parentOrgId: string,
  year?: number
): Promise<RemittanceStatus[]> {
  const targetYear = year || new Date().getFullYear();

  const result = await db.execute(sql`
    SELECT 
      o.id as organization_id,
      o.name as organization_name,
      COALESCE(SUM(CASE WHEN r.status IN ('pending', 'submitted') THEN r.total_amount ELSE 0 END), 0) as total_due,
      COALESCE(SUM(CASE WHEN r.status = 'paid' THEN r.total_amount ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(CASE WHEN r.status = 'overdue' THEN r.total_amount ELSE 0 END), 0) as total_overdue,
      COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN r.status = 'overdue' THEN 1 END) as overdue_count,
      MAX(r.paid_date) as last_remittance_date
    FROM organizations o
    LEFT JOIN per_capita_remittances r ON r.from_organization_id = o.id
      AND r.remittance_year = ${targetYear}
    WHERE o.parent_id = ${parentOrgId}
      AND o.status = 'active'
    GROUP BY o.id, o.name
    ORDER BY o.name
  `);

  return result.map(row => ({
    organizationId: row.organization_id as string,
    organizationName: row.organization_name as string,
    totalDue: parseFloat(row.total_due as string),
    totalPaid: parseFloat(row.total_paid as string),
    totalOverdue: parseFloat(row.total_overdue as string),
    pendingCount: parseInt(row.pending_count as string),
    overdueCount: parseInt(row.overdue_count as string),
    lastRemittanceDate: row.last_remittance_date as Date | null,
  }));
}

/**
 * Get overdue remittances (past due date + grace period)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOverdueRemittances(): Promise<any[]> {
  const _today = new Date();
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() - GRACE_PERIOD_DAYS);
  const _gracePeriodEndStr = gracePeriodEnd.toISOString().split('T')[0];

  const overdueRemittances = await db
    .select()
    .from(perCapitaRemittances)
    .where(
      and(
        eq(perCapitaRemittances.status, 'pending'),
        lte(perCapitaRemittances.dueDate, gracePeriodEnd.toISOString().split('T')[0])
      )
    );

  return overdueRemittances;
}

/**
 * Mark overdue remittances (run daily via cron)
 */
export async function markOverdueRemittances(): Promise<number> {
  const _today = new Date();
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() - GRACE_PERIOD_DAYS);
  const gracePeriodEndStr = gracePeriodEnd.toISOString().split('T')[0];

  const result = await db
    .update(perCapitaRemittances)
    .set({ 
      status: 'overdue',
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(perCapitaRemittances.status, 'pending'),
        lte(perCapitaRemittances.dueDate, gracePeriodEndStr)
      )
    );

  return result.length || 0;
}

/**
 * Update organization's last_remittance_date
 */
export async function updateLastRemittanceDate(
  organizationId: string,
  remittanceDate: Date
): Promise<void> {
  // Update organization settings to track last remittance
  const org = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (org[0]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = (org[0].settings as any) || {};
    await db
      .update(organizations)
      .set({ 
        settings: {
          ...settings,
          lastRemittanceDate: remittanceDate.toISOString()
        },
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));
  }
}

// =====================================================================================
// MONTHLY BATCH PROCESSING
// =====================================================================================

/**
 * Main monthly per-capita processing function
 * Call this from cron job on the 1st of each month
 */
export async function processMonthlyPerCapita(): Promise<{
  calculated: number;
  saved: number;
  errors: number;
  overdueMarked: number;
}> {
const now = new Date();
  const remittanceMonth = now.getMonth() + 1; // Current month
  const remittanceYear = now.getFullYear();

  try {
    // Step 1: Calculate all per-capita remittances
    const calculations = await calculateAllPerCapita(remittanceMonth, remittanceYear);

    // Step 2: Save remittances to database
    const { saved, errors } = await savePerCapitaRemittances(calculations);

    // Step 3: Mark overdue remittances
    const overdueMarked = await markOverdueRemittances();
return {
      calculated: calculations.length,
      saved,
      errors,
      overdueMarked,
    };
  } catch (error) {
throw error;
  }
}

// =====================================================================================
// EXPORTS
// =====================================================================================

export const PerCapitaCalculator = {
  // Member standing
  getMemberStanding,
  countGoodStandingMembers,
  
  // Calculation
  calculatePerCapita,
  calculateAllPerCapita,
  savePerCapitaRemittances,
  
  // Status & reporting
  getRemittanceStatusForParent,
  getOverdueRemittances,
  markOverdueRemittances,
  updateLastRemittanceDate,
  
  // Batch processing
  processMonthlyPerCapita,
  
  // Constants
  DEFAULT_REMITTANCE_DAY,
  GRACE_PERIOD_DAYS,
};
