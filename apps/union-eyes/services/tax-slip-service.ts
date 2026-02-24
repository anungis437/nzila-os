import { db } from "@/db";
import {
  strikeFundDisbursements,
  t4aTaxSlips,
  rl1TaxSlips,
  taxYearEndProcessing,
  weeklyThresholdTracking,
} from "@/db/schema/domains/finance";
import { users } from "@/db/schema/domains/member";
import { organizationMembers } from "@/db/schema/organization-members-schema";
import { eq, and } from "drizzle-orm";
import { NotificationService } from "@/lib/services/notification-service";
import { logger } from "@/lib/logger";

/**
 * Strike Fund Tax Service
 * CRA Compliance: T4A/RL-1 for strike pay >$500/week
 * 
 * Key Requirements:
 * - Federal: T4A Box 028 (Other Income) for strike pay
 * - Quebec: RL-1 Box O (Other Income) for Quebec residents
 * - Threshold: >$500 per week triggers tax slip requirement
 * - Filing Deadline: February 28 following tax year
 * - Member Delivery: By February 28
 */

export interface StrikeDisbursement {
  userId: string;
  strikeId?: string;
  strikeName?: string;
  paymentDate: Date;
  paymentAmount: number;
  paymentMethod: string;
  paymentReference?: string;
  province: string;
}

export interface MemberTaxInfo {
  userId: string;
  fullName: string;
  sin?: string; // Encrypted
  address: string;
  city: string;
  province: string;
  postalCode: string;
  isQuebecResident: boolean;
}

export class TaxSlipService {
  private static readonly WEEKLY_THRESHOLD = 500.00;
  
  /**
   * Record strike fund disbursement and check threshold
   */
  static async recordDisbursement(disbursement: StrikeDisbursement) {
    const taxYear = disbursement.paymentDate.getFullYear().toString();
    const taxMonth = (disbursement.paymentDate.getMonth() + 1).toString().padStart(2, "0");
    const weekNumber = this.getWeekNumber(disbursement.paymentDate);
    const isQuebecResident = disbursement.province === "QC";

    // Calculate weekly total for this user
    const weeklyTotal = await this.getWeeklyTotal(
      disbursement.userId,
      taxYear,
      weekNumber
    );
    const newWeeklyTotal = weeklyTotal + disbursement.paymentAmount;
    const exceedsThreshold = newWeeklyTotal > this.WEEKLY_THRESHOLD;

    // Insert disbursement record
    const [record] = await db
      .insert(strikeFundDisbursements)
      .values({
        userId: disbursement.userId,
        strikeId: disbursement.strikeId,
        strikeName: disbursement.strikeName,
        paymentDate: disbursement.paymentDate,
        paymentAmount: disbursement.paymentAmount.toFixed(2),
        paymentMethod: disbursement.paymentMethod,
        paymentReference: disbursement.paymentReference,
        taxYear,
        taxMonth,
        weekNumber,
        weeklyTotal: newWeeklyTotal.toFixed(2),
        exceedsThreshold,
        requiresTaxSlip: exceedsThreshold,
        province: disbursement.province,
        isQuebecResident,
      })
      .returning();

    // Update weekly threshold tracking
    await this.updateWeeklyThresholdTracking(
      disbursement.userId,
      taxYear,
      weekNumber,
      disbursement.paymentDate,
      newWeeklyTotal,
      exceedsThreshold,
      isQuebecResident
    );

    // Alert if threshold exceeded
    if (exceedsThreshold && newWeeklyTotal - disbursement.paymentAmount <= this.WEEKLY_THRESHOLD) {
      await this.notifyThresholdExceeded(disbursement.userId, taxYear, newWeeklyTotal);
    }

    return record;
  }

  /**
   * Get ISO week number (YYYY-Www format)
   */
  private static getWeekNumber(date: Date): string {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
  }

  /**
   * Calculate week date range from week number
   */
  private static getWeekDateRange(weekNumber: string): { start: Date; end: Date } {
    const [year, week] = weekNumber.split("-W");
    const startOfYear = new Date(parseInt(year), 0, 1);
    const dayOffset = (parseInt(week) - 1) * 7;
    const start = new Date(startOfYear.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  /**
   * Get weekly total for user
   */
  private static async getWeeklyTotal(
    userId: string,
    taxYear: string,
    weekNumber: string
  ): Promise<number> {
    const disbursements = await db
      .select()
      .from(strikeFundDisbursements)
      .where(
        and(
          eq(strikeFundDisbursements.userId, userId),
          eq(strikeFundDisbursements.taxYear, taxYear),
          eq(strikeFundDisbursements.weekNumber, weekNumber)
        )
      );

    return disbursements.reduce((sum, d) => sum + parseFloat(d.paymentAmount), 0);
  }

  /**
   * Update weekly threshold tracking
   */
  private static async updateWeeklyThresholdTracking(
    userId: string,
    taxYear: string,
    weekNumber: string,
    paymentDate: Date,
    weeklyTotal: number,
    exceedsThreshold: boolean,
    isQuebecResident: boolean
  ) {
    const { start, end } = this.getWeekDateRange(weekNumber);

    // Check if tracking record exists
    const existing = await db
      .select()
      .from(weeklyThresholdTracking)
      .where(
        and(
          eq(weeklyThresholdTracking.userId, userId),
          eq(weeklyThresholdTracking.taxYear, taxYear),
          eq(weeklyThresholdTracking.weekNumber, weekNumber)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(weeklyThresholdTracking)
        .set({
          weeklyTotal: weeklyTotal.toFixed(2),
          exceedsThreshold,
          requiresT4A: exceedsThreshold,
          requiresRL1: exceedsThreshold && isQuebecResident,
          paymentCount: (parseInt(existing[0].paymentCount) + 1).toString(),
          updatedAt: new Date(),
        })
        .where(eq(weeklyThresholdTracking.id, existing[0].id));
    } else {
      // Create new
      await db.insert(weeklyThresholdTracking).values({
        userId,
        taxYear,
        weekNumber,
        weekStartDate: start,
        weekEndDate: end,
        weeklyTotal: weeklyTotal.toFixed(2),
        exceedsThreshold,
        requiresT4A: exceedsThreshold,
        requiresRL1: exceedsThreshold && isQuebecResident,
        paymentCount: "1",
      });
    }
  }

  /**
   * Generate T4A tax slips for a tax year
   */
  static async generateT4ASlips(
    taxYear: string,
    payerInfo: {
      name: string;
      businessNumber: string;
      address: string;
      city: string;
      province: string;
      postalCode: string;
    },
    generatedBy: string
  ) {
    // Get all users who exceeded threshold
    const usersRequiringSlips = await db
      .select()
      .from(weeklyThresholdTracking)
      .where(
        and(
          eq(weeklyThresholdTracking.taxYear, taxYear),
          eq(weeklyThresholdTracking.requiresT4A, true)
        )
      );

    const uniqueUsers = [...new Set(usersRequiringSlips.map((u) => u.userId))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slips: any[] = [];

    for (const userId of uniqueUsers) {
      // Calculate total strike pay for year
      const yearlyDisbursements = await db
        .select()
        .from(strikeFundDisbursements)
        .where(
          and(
            eq(strikeFundDisbursements.userId, userId),
            eq(strikeFundDisbursements.taxYear, taxYear),
            eq(strikeFundDisbursements.requiresTaxSlip, true)
          )
        );

      const totalAmount = yearlyDisbursements.reduce(
        (sum, d) => sum + parseFloat(d.paymentAmount),
        0
      );

      if (totalAmount === 0) continue;

      // Get member tax info (would normally query user table)
      // For now, using placeholder
      const memberInfo = await this.getMemberTaxInfo(userId);

      // Create T4A slip
      const [slip] = await db
        .insert(t4aTaxSlips)
        .values({
          userId,
          taxYear,
          payerName: payerInfo.name,
          payerBusinessNumber: payerInfo.businessNumber,
          payerAddress: payerInfo.address,
          payerCity: payerInfo.city,
          payerProvince: payerInfo.province,
          payerPostalCode: payerInfo.postalCode,
          recipientName: memberInfo.fullName,
          recipientSin: memberInfo.sin,
          recipientAddress: memberInfo.address,
          recipientCity: memberInfo.city,
          recipientProvince: memberInfo.province,
          recipientPostalCode: memberInfo.postalCode,
          box028OtherIncome: totalAmount.toFixed(2),
          box022IncomeTaxDeducted: "0.00", // Strike pay typically has no tax withholding
          generatedBy,
        })
        .returning();

      slips.push(slip);

      // Mark disbursements as having T4A generated
      await db
        .update(strikeFundDisbursements)
        .set({
          t4aGenerated: true,
          t4aGeneratedAt: new Date(),
        })
        .where(
          and(
            eq(strikeFundDisbursements.userId, userId),
            eq(strikeFundDisbursements.taxYear, taxYear)
          )
        );
    }

    return slips;
  }

  /**
   * Generate RL-1 tax slips for Quebec residents
   */
  static async generateRL1Slips(
    taxYear: string,
    payerInfo: {
      name: string;
      quebecEnterpriseNumber: string;
      address: string;
      city: string;
      postalCode: string;
    },
    generatedBy: string
  ) {
    // Get Quebec residents who exceeded threshold
    const usersRequiringSlips = await db
      .select()
      .from(weeklyThresholdTracking)
      .where(
        and(
          eq(weeklyThresholdTracking.taxYear, taxYear),
          eq(weeklyThresholdTracking.requiresRL1, true)
        )
      );

    const uniqueUsers = [...new Set(usersRequiringSlips.map((u) => u.userId))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slips: any[] = [];

    for (const userId of uniqueUsers) {
      // Calculate total strike pay for year
      const yearlyDisbursements = await db
        .select()
        .from(strikeFundDisbursements)
        .where(
          and(
            eq(strikeFundDisbursements.userId, userId),
            eq(strikeFundDisbursements.taxYear, taxYear),
            eq(strikeFundDisbursements.isQuebecResident, true),
            eq(strikeFundDisbursements.requiresTaxSlip, true)
          )
        );

      const totalAmount = yearlyDisbursements.reduce(
        (sum, d) => sum + parseFloat(d.paymentAmount),
        0
      );

      if (totalAmount === 0) continue;

      const memberInfo = await this.getMemberTaxInfo(userId);

      // Create RL-1 slip
      const [slip] = await db
        .insert(rl1TaxSlips)
        .values({
          userId,
          taxYear,
          payerName: payerInfo.name,
          payerQuebecEnterpriseNumber: payerInfo.quebecEnterpriseNumber,
          payerAddress: payerInfo.address,
          payerCity: payerInfo.city,
          payerPostalCode: payerInfo.postalCode,
          recipientName: memberInfo.fullName,
          recipientSin: memberInfo.sin,
          recipientAddress: memberInfo.address,
          recipientCity: memberInfo.city,
          recipientPostalCode: memberInfo.postalCode,
          boxOOtherIncome: totalAmount.toFixed(2),
          boxEQuebecIncomeTaxDeducted: "0.00",
          generatedBy,
        })
        .returning();

      slips.push(slip);

      // Mark disbursements as having RL-1 generated
      await db
        .update(strikeFundDisbursements)
        .set({
          rl1Generated: true,
          rl1GeneratedAt: new Date(),
        })
        .where(
          and(
            eq(strikeFundDisbursements.userId, userId),
            eq(strikeFundDisbursements.taxYear, taxYear),
            eq(strikeFundDisbursements.isQuebecResident, true)
          )
        );
    }

    return slips;
  }

  /**
   * Process year-end tax slips (February 28 deadline)
   */
  static async processYearEnd(taxYear: string, processedBy: string) {
    // Check if year-end already processed
    const existing = await db
      .select()
      .from(taxYearEndProcessing)
      .where(eq(taxYearEndProcessing.taxYear, taxYear))
      .limit(1);

    if (existing.length > 0 && existing[0].processingCompletedAt) {
      throw new Error(`Year-end ${taxYear} already processed`);
    }

    // Create or update year-end record
    const filingDeadline = new Date(`${parseInt(taxYear) + 1}-02-28`);
    
    if (existing.length === 0) {
      await db.insert(taxYearEndProcessing).values({
        taxYear,
        t4aFilingDeadline: filingDeadline,
        rl1FilingDeadline: filingDeadline,
        processingStartedAt: new Date(),
        processedBy,
        complianceStatus: "in_progress",
      });
    } else {
      await db
        .update(taxYearEndProcessing)
        .set({
          processingStartedAt: new Date(),
          processedBy,
          complianceStatus: "in_progress",
        })
        .where(eq(taxYearEndProcessing.taxYear, taxYear));
    }

    return { taxYear, filingDeadline };
  }

  /**
   * Mark year-end processing as complete
   */
  static async completeYearEndProcessing(
    taxYear: string,
    t4aCount: number,
    rl1Count: number,
    t4aTotal: number,
    rl1Total: number
  ) {
    const now = new Date();
    const filingDeadline = new Date(`${parseInt(taxYear) + 1}-02-28`);
    const deadlineMissed = now > filingDeadline;

    await db
      .update(taxYearEndProcessing)
      .set({
        processingCompletedAt: now,
        t4aSlipsGenerated: t4aCount.toString(),
        t4aTotalAmount: t4aTotal.toFixed(2),
        rl1SlipsGenerated: rl1Count.toString(),
        rl1TotalAmount: rl1Total.toFixed(2),
        complianceStatus: deadlineMissed ? "overdue" : "completed",
        deadlineMissed,
      })
      .where(eq(taxYearEndProcessing.taxYear, taxYear));
  }

  /**
   * Get member tax information from user tables
   */
  private static async getMemberTaxInfo(userId: string): Promise<MemberTaxInfo> {
    // Query user information from user_management.users table
    const userResult = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        encryptedSin: users.encryptedSin,
      })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    // Query member information from organization_members table
    const memberResult = await db
      .select({
        name: organizationMembers.name,
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))
      .limit(1);

    const user = userResult[0];
    const member = memberResult[0];
    
    // Track missing required data for CRA compliance
    const missingFields: string[] = [];
    
    // Construct full name from available data
    const fullName = user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : member?.name;
    
    if (!fullName) {
      missingFields.push('fullName');
      logger.warn('Tax slip: Missing member name', { userId });
    }

    // SIN decryption: Requires proper encryption/decryption infrastructure with secure key management
    // Implementation should use AWS KMS, Azure Key Vault, or similar HSM for production
    // For now, return undefined as we need proper encryption implementation with:
    // - Encrypted at rest in database (user.encryptedSin field)
    // - Decryption key stored in HSM (not in code/env)
    // - Audit logging of all SIN access
    // - CRA compliance for SIN storage (safeguards, retention, disposal)
    const sin = undefined; // user?.encryptedSin ? await decrypt(user.encryptedSin) : undefined
    
    if (!user?.encryptedSin) {
      missingFields.push('sin');
      logger.warn('Tax slip: Missing SIN for member', { userId });
    }

    // Address fields: Should be added to member schema for CRA compliance
    // Required fields for T4A/RL-1: street, city, province, postal code
    // TODO: Add member_addresses table or extend profiles/users with address fields:
    // - streetAddress (varchar 200)
    // - city (varchar 100)
    // - province (varchar 2) - use provincesEnum
    // - postalCode (varchar 10) - validate Canadian postal code format
    // - addressType (enum: 'mailing', 'residential')
    // - effectiveDate (timestamp)
    //
    // Migration required: See docs/migrations/add-member-addresses.md
    // Schema location: db/schema/domains/member/addresses.ts
    
    // For now, log warning and use placeholder values
    // In production, T4A/RL-1 generation should fail with clear error
    // when address data is missing, requiring admin to complete member profile
    const address = "Address Required";
    const city = "City Required";
    const province = "Province Required";
    const postalCode = "Postal Code Required";
    
    missingFields.push('address', 'city', 'province', 'postalCode');
    logger.error('Tax slip: Missing address fields - member profile incomplete', { 
      userId,
      missingFields,
      requiresAction: 'Admin must complete member address data for tax compliance'
    });
    
    // Calculate Quebec residency from province
    const isQuebecResident = province === "QC";

    // Log data quality issues for compliance tracking
    if (missingFields.length > 0) {
      logger.warn('Tax slip generation: Incomplete member data', {
        userId,
        fullName: fullName || 'Unknown',
        missingFields,
        complianceRisk: 'Tax slips may not meet CRA requirements',
        actionRequired: 'Complete member profile with missing fields'
      });
    }

    return {
      userId,
      fullName: fullName || "Member Name Required",
      sin,
      address,
      city,
      province,
      postalCode,
      isQuebecResident,
    };
  }

  /**
   * Notify that weekly threshold exceeded
   */
  private static async notifyThresholdExceeded(
    userId: string,
    taxYear: string,
    weeklyTotal: number
  ) {
    logger.info('Weekly tax threshold exceeded', {
      userId,
      taxYear,
      weeklyTotal: weeklyTotal.toFixed(2),
      threshold: this.WEEKLY_THRESHOLD,
    });
    
    try {
      // Get user details
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      
      if (user?.email) {
        const notificationService = new NotificationService();
        
        // Notify user that they've exceeded threshold
        await notificationService.send({
          organizationId: user.organizationId || 'system',
          recipientId: userId,
          recipientEmail: user.email,
          type: 'email',
          priority: 'normal',
          subject: 'Tax Reporting Threshold Exceeded',
          body: `Your weekly income has exceeded the $500 threshold for tax year ${taxYear}.\n\nWeekly Total: $${weeklyTotal.toFixed(2)}\n\nYou will be required to receive a tax slip (T4A) for this tax year. Please ensure your personal information and address are up to date in your profile.`,
          htmlBody: `
            <h2>Tax Reporting Threshold Exceeded</h2>
            <p>Your weekly income has exceeded the $500 threshold for tax year ${taxYear}.</p>
            <ul>
              <li><strong>Weekly Total:</strong> $${weeklyTotal.toFixed(2)}</li>
              <li><strong>Tax Year:</strong> ${taxYear}</li>
            </ul>
            <p>You will be required to receive a tax slip (T4A) for this tax year.</p>
            <p><strong>Action Required:</strong> Please ensure your personal information and mailing address are up to date in your profile to receive your tax slip.</p>
          `,
          actionUrl: '/profile/tax-information',
          actionLabel: 'Update Profile',
          metadata: {
            taxYear,
            weeklyTotal: weeklyTotal.toString(),
            threshold: '500',
          },
        });
        
        // Also notify admin/accounting
        await notificationService.send({
          organizationId: user.organizationId || 'system',
          recipientEmail: process.env.ACCOUNTING_EMAIL || process.env.ADMIN_EMAIL || 'admin@unioneyes.app',
          type: 'email',
          priority: 'normal',
          subject: `Tax Slip Required - User ${userId}`,
          body: `User ${userId} (${user.email}) has exceeded the weekly threshold for tax year ${taxYear}.\n\nWeekly Total: $${weeklyTotal.toFixed(2)}\n\nA tax slip (T4A) will need to be generated for this user.`,
          htmlBody: `
            <h2>Tax Slip Required</h2>
            <p>A user has exceeded the weekly income threshold for tax reporting.</p>
            <ul>
              <li><strong>User ID:</strong> ${userId}</li>
              <li><strong>Email:</strong> ${user.email}</li>
              <li><strong>Tax Year:</strong> ${taxYear}</li>
              <li><strong>Weekly Total:</strong> $${weeklyTotal.toFixed(2)}</li>
            </ul>
            <p>A tax slip (T4A) will need to be generated and distributed to this user.</p>
          `,
          metadata: {
            userId,
            taxYear,
            weeklyTotal: weeklyTotal.toString(),
          },
        });
      }
    } catch (error) {
      logger.error('Failed to send threshold notification', { error, userId, taxYear });
      // Don't throw - notification failure shouldn't block threshold tracking
    }
  }

  /**
   * Get users requiring tax slips for a year
   */
  static async getUsersRequiringTaxSlips(taxYear: string) {
    return await db
      .select()
      .from(weeklyThresholdTracking)
      .where(
        and(
          eq(weeklyThresholdTracking.taxYear, taxYear),
          eq(weeklyThresholdTracking.exceedsThreshold, true)
        )
      );
  }

  /**
   * Check if year-end deadline approaching
   */
  static async checkYearEndDeadline(taxYear: string): Promise<{
    daysUntilDeadline: number;
    isOverdue: boolean;
    requiresAction: boolean;
  }> {
    const filingDeadline = new Date(`${parseInt(taxYear) + 1}-02-28`);
    const now = new Date();
    const daysUntilDeadline = Math.ceil(
      (filingDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const yearEnd = await db
      .select()
      .from(taxYearEndProcessing)
      .where(eq(taxYearEndProcessing.taxYear, taxYear))
      .limit(1);

    const requiresAction =
      daysUntilDeadline <= 30 &&
      (!yearEnd[0] || !yearEnd[0].processingCompletedAt);

    return {
      daysUntilDeadline,
      isOverdue: daysUntilDeadline < 0,
      requiresAction,
    };
  }
}
