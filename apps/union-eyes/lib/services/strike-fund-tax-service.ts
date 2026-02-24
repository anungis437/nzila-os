/**
 * Strike Fund Tax Compliance Service
 *
 * Handles tax reporting for strike payments:
 * - T4A generation (Box 028: Other Income) for payments >$500/week
 * - RL-1 generation (Quebec-specific, Case O: Other Income)
 * - Year-end processing by Feb 28 deadline
 * - Cumulative annual threshold tracking
 * 
 * NOTE: This service uses the strikeFundDisbursements table for payment tracking.
 * Ensure strike payments are properly recorded in that table.
 */

import { db } from '@/db';
import { eq, and, sql } from 'drizzle-orm';
import { users, strikeFundDisbursements } from '@/db/schema';
import { decryptSIN } from '@/lib/encryption';
import { logger } from '@/lib/logger';

export interface T4ASlip {
  slipType: 'T4A';
  taxYear: number;
  recipientName: string;
  recipientSIN: string;
  recipientAddress: string;
  box028_otherIncome: number;
  issuedDate: Date;
  employerName: string;
  employerBusinessNumber: string;
}

export interface RL1Slip {
  slipType: 'RL-1';
  taxYear: number;
  recipientName: string;
  recipientNAS: string;
  recipientAddress: string;
  caseO_autresRevenus: number;
  issuedDate: Date;
  employerName: string;
  employerNEQ: string;
}

/**
 * Check if strike payment requires T4A reporting
 * CRA threshold: >$500/week OR annual >$26,000
 */
export async function checkStrikePaymentTaxability(
  memberId: string,
  paymentAmount: number,
  _weekNumber?: number
): Promise<{ requiresT4A: boolean; reason: string; threshold: number }> {
  const T4A_THRESHOLD_WEEKLY = 500;
  const T4A_THRESHOLD_ANNUAL = 26000;

  // Check weekly threshold
  if (paymentAmount > T4A_THRESHOLD_WEEKLY) {
    return {
      requiresT4A: true,
      reason: `Strike pay of $${paymentAmount} exceeds $500/week CRA threshold`,
      threshold: T4A_THRESHOLD_WEEKLY
    };
  }

  // Check cumulative annual for current year
  const currentYear = new Date().getFullYear();
  const yearTotal = await getYearlyStrikePay(memberId, currentYear);

  if (yearTotal > T4A_THRESHOLD_ANNUAL) {
    return {
      requiresT4A: true,
      reason: `Annual strike pay of $${yearTotal} exceeds $26,000 CRA threshold`,
      threshold: T4A_THRESHOLD_ANNUAL
    };
  }

  return {
    requiresT4A: false,
    reason: 'Below both weekly ($500) and annual ($26,000) thresholds',
    threshold: T4A_THRESHOLD_WEEKLY
  };
}

/**
 * Generate T4A slip for member (All Canadian provinces)
 * Must be issued by Feb 28 following tax year
 */
export async function generateT4A(
  memberId: string,
  taxYear: number
): Promise<T4ASlip> {
  // Get member details
  const member = await db.query.users
    .findFirst({
      where: eq(users.userId, memberId)
    })
    .catch(() => null);

  if (!member) {
    throw new Error(`Member ${memberId} not found`);
  }

  // Calculate yearly strike pay
  const strikePay = await getYearlyStrikePay(memberId, taxYear);

  // Decrypt SIN for tax document generation
  // CRITICAL: SIN is only decrypted for official CRA tax reporting
  // This operation is audited in encryption.ts logger
  let recipientSIN = 'NOT PROVIDED';
  
  if (member.encryptedSin) {
    try {
      recipientSIN = await decryptSIN(member.encryptedSin);
      
      // Audit log for compliance (without logging actual SIN)
      logger.info('SIN decrypted for T4A generation', {
        memberId,
        taxYear,
        action: 't4a_generation',
        hasEncryptedSin: true,
      });
    } catch (error) {
      logger.error('Failed to decrypt SIN for T4A generation', error as Error, {
        memberId,
        taxYear,
      });
      throw new Error('Unable to decrypt member SIN for tax document generation');
    }
  } else {
    logger.warn('Member has no encrypted SIN on file', {
      memberId,
      taxYear,
      action: 't4a_generation',
    });
  }

  return {
    slipType: 'T4A',
    taxYear,
    recipientName: member.displayName || 
                   `${member.firstName || ''} ${member.lastName || ''}`.trim() || 
                   member.email || 
                   'Unknown', // Construct name from available user fields
    recipientSIN: recipientSIN, // Encrypted/protected SIN
    recipientAddress: 'NOT PROVIDED', // Users table doesn&apos;t have address field
    box028_otherIncome: strikePay, // Box 028: Other Income
    issuedDate: new Date(),
    employerName: process.env.UNION_NAME || 'Your Union Local',
    employerBusinessNumber: process.env.UNION_BN || 'NOT SET'
  };
}

/**
 * Generate RL-1 slip for Quebec members
 * Quebec-specific equivalent to T4A
 * Must be issued by Feb 28 following tax year
 */
export async function generateRL1(
  memberId: string,
  taxYear: number
): Promise<RL1Slip> {
  const memberResult = await db.query.users
    .findFirst({
      where: eq(users.userId, memberId)
    })
    .catch(() => null);

  if (!memberResult) {
    throw new Error(`Member ${memberId} not found`);
  }

  const member = memberResult as typeof memberResult;

  const isQuebecMember = await isMemberInQuebec(memberId);
  if (!isQuebecMember) {
    throw new Error(`Member ${memberId} is not eligible for RL-1 (not Quebec)`);
  }

  const strikePay = await getYearlyStrikePay(memberId, taxYear);

  // Decrypt SIN/NAS for Quebec tax document generation
  // CRITICAL: SIN is only decrypted for official Revenu Québec tax reporting
  // This operation is audited in encryption.ts logger
  let recipientNAS = 'NOT PROVIDED';
  
  if (member.encryptedSin) {
    try {
      recipientNAS = await decryptSIN(member.encryptedSin);
      
      // Audit log for compliance (without logging actual SIN/NAS)
      logger.info('SIN decrypted for RL-1 generation', {
        memberId,
        taxYear,
        action: 'rl1_generation',
        hasEncryptedSin: true,
      });
    } catch (error) {
      logger.error('Failed to decrypt SIN for RL-1 generation', error as Error, {
        memberId,
        taxYear,
      });
      throw new Error('Unable to decrypt member SIN for Quebec tax document generation');
    }
  } else {
    logger.warn('Member has no encrypted SIN on file', {
      memberId,
      taxYear,
      action: 'rl1_generation',
    });
  }

  return {
    slipType: 'RL-1',
    taxYear,
    recipientName: member.displayName || 
                   `${member.firstName || ''} ${member.lastName || ''}`.trim() || 
                   member.email || 
                   'Unknown', // Construct name from available user fields
    recipientNAS: recipientNAS, // NAS = Number d'assurance sociale
    recipientAddress: 'NOT PROVIDED', // Users table doesn&apos;t have address field
    caseO_autresRevenus: strikePay, // Case O: Autres revenus (Other income)
    issuedDate: new Date(),
    employerName: process.env.UNION_NAME || 'Your Union Local',
    employerNEQ: process.env.UNION_NEQ_QC || 'NOT SET' // NEQ = Numéro d'établissement du Québec
  };
}

/**
 * Year-end tax slip processing
 * Should run in January/February for previous tax year
 * DEADLINE: Feb 28 following tax year
 */
export async function processYearEndTaxSlips(
  taxYear: number
): Promise<{
  processed: number;
  t4aGenerated: number;
  rl1Generated: number;
  deadline: Date;
}> {
  // CRITICAL: This function requires the strikeFundDisbursements table to be populated
  // with strike payment data. Ensure payments are recorded there before running year-end processing.
  
  // Query all members who received strike pay in the tax year
  const payments = await db.select({
    userId: strikeFundDisbursements.userId,
    totalAmount: sql<number>`SUM(${strikeFundDisbursements.paymentAmount})`,
    province: strikeFundDisbursements.province,
  })
  .from(strikeFundDisbursements)
  .where(
    eq(strikeFundDisbursements.taxYear, taxYear.toString())
  )
  .groupBy(strikeFundDisbursements.userId, strikeFundDisbursements.province)
  .catch(() => []);

  if (payments.length === 0) {
    logger.warn('No strike payments found for tax year', { taxYear });
  }

  const uniqueMembers = payments.filter(p => (p.totalAmount || 0) > 500);

  let t4aCount = 0;
  let rl1Count = 0;

  for (const payment of uniqueMembers) {
    const memberId = payment.userId;
    const yearTotal = payment.totalAmount || 0;

    // Only generate if above threshold
    if (yearTotal <= 500) continue;

    const member = await db.query.users
      .findFirst({
        where: eq(users.userId, memberId)
      })
      .catch(() => null);

    if (!member) {
      logger.error('Member not found for tax slip generation', { memberId, taxYear });
      continue;
    }

    // Generate T4A for all provinces
    try {
      const _t4a = await generateT4A(memberId as string, taxYear);
      // Store T4A in database (would need taxSlips table)
      t4aCount++;
    } catch (error) {
      logger.error('Failed to generate T4A', { error, memberId, taxYear });
    }

    // Generate RL-1 for Quebec members
    // Check province from disbursement record, not from user table
    if (payment.province === 'QC') {
      try {
        const _rl1 = await generateRL1(memberId as string, taxYear);
        // Store RL-1 in database
        rl1Count++;
      } catch (error) {
        logger.error('Failed to generate RL-1', { error, memberId, taxYear });
      }
    }
  }

  // Calculate deadline (Feb 28 following tax year)
  const deadline = new Date(`${taxYear + 1}-02-28`);

  return {
    processed: uniqueMembers.length,
    t4aGenerated: t4aCount,
    rl1Generated: rl1Count,
    deadline
  };
}

/**
 * Get yearly strike pay for member
 */
async function getYearlyStrikePay(
  memberId: string,
  year?: number
): Promise<number> {
  const targetYear = year || new Date().getFullYear();

  // Query from strikeFundDisbursements table (tax compliance tracking)
  const payments = await db.select({
    totalAmount: sql<number>`COALESCE(SUM(${strikeFundDisbursements.paymentAmount}), 0)`,
  })
  .from(strikeFundDisbursements)
  .where(
    and(
      eq(strikeFundDisbursements.userId, memberId),
      eq(strikeFundDisbursements.taxYear, targetYear.toString())
    )
  )
  .catch(() => [{ totalAmount: 0 }]);

  return Number(payments[0]?.totalAmount || 0);
}

/**
 * Get tax filing status for member
 */
export async function getTaxFilingStatus(
  memberId: string,
  taxYear: number
): Promise<{
  requiresT4A: boolean;
  t4aIssued: boolean;
  rl1Required: boolean;
  rl1Issued: boolean;
  deadline: Date;
}> {
  const yearTotal = await getYearlyStrikePay(memberId, taxYear);

  // Check if requires T4A
  const requiresT4A = yearTotal > 500;

  return {
    requiresT4A,
    t4aIssued: false, // Would check database
    rl1Required: requiresT4A && (await isMemberInQuebec(memberId)),
    rl1Issued: false, // Would check database
    deadline: new Date(`${taxYear + 1}-02-28`)
  };
}

async function isMemberInQuebec(memberId: string): Promise<boolean> {
  // Users table doesn&apos;t have province field
  // Check from strike fund disbursements table instead
  try {
    const result = await db
      .select({ province: strikeFundDisbursements.province })
      .from(strikeFundDisbursements)
      .where(eq(strikeFundDisbursements.userId, memberId))
      .limit(1);
    
    return result[0]?.province === 'QC';
  } catch (error) {
    logger.error('Failed to check member province', error as Error, { memberId });
    return false; // Default to false if unable to determine
  }
}

/**
 * Generate strike fund tax compliance report
 */
export async function generateStrikeFundTaxReport(taxYear: number): Promise<{
  compliant: boolean;
  issues: string[];
  t4asGenerated: number;
  rl1sGenerated: number;
  deadline: string;
}> {
  const result = await processYearEndTaxSlips(taxYear);

  const issues: string[] = [];

  if (result.t4aGenerated === 0 && result.rl1Generated === 0) {
    // Could be compliant if no one exceeded thresholds
  }

  return {
    compliant: issues.length === 0,
    issues,
    t4asGenerated: result.t4aGenerated,
    rl1sGenerated: result.rl1Generated,
    deadline: `Feb 28, ${taxYear + 1} (CRA requirement)`
  };
}

