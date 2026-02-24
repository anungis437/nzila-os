import { db } from "@/db";
import {
  fmvPolicy,
  cpiData,
  fmvBenchmarks,
  procurementRequests,
  procurementBids,
  independentAppraisals,
  cpiAdjustedPricing,
  fmvViolations,
  fmvAuditLog,
} from "@/db/schema/joint-trust-fmv-schema";
import { eq, and, lte, gte, desc } from "drizzle-orm";

/**
 * Joint-Trust Fund Fair Market Value Service
 * FMV benchmarking, CPI escalator integration, 3-bid procurement process
 */

export interface FMVBenchmarkData {
  itemCategory: string;
  itemDescription: string;
  fmvLow: number;
  fmvHigh: number;
  fmvMedian: number;
  region: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataSources?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  comparableTransactions?: any[];
}

export interface ProcurementRequestData {
  requestTitle: string;
  requestDescription: string;
  estimatedValue: number;
  procurementType: string;
  requestedBy: string;
  requestedByDepartment?: string;
}

export interface BidSubmission {
  procurementRequestId: string;
  bidderName: string;
  bidderContact: string;
  bidAmount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bidDocuments?: any[];
  bidNotes?: string;
}

export class JointTrustFMVService {
  private static readonly COMPETITIVE_BIDDING_THRESHOLD = 10000.0; // $10k
  private static readonly MINIMUM_BIDS_REQUIRED = 3;
  private static readonly APPRAISAL_THRESHOLD = 50000.0; // $50k
  private static readonly CPI_BASE_YEAR = "2002";

  /**
   * Create FMV benchmark
   */
  static async createFMVBenchmark(data: FMVBenchmarkData, createdBy: string) {
    const effectiveFrom = new Date();
    const effectiveTo = new Date();
    effectiveTo.setFullYear(effectiveTo.getFullYear() + 1); // Valid for 1 year

    const [benchmark] = await db
      .insert(fmvBenchmarks)
      .values({
        itemCategory: data.itemCategory,
        itemDescription: data.itemDescription,
        fmvLow: data.fmvLow.toFixed(2),
        fmvHigh: data.fmvHigh.toFixed(2),
        fmvMedian: data.fmvMedian.toFixed(2),
        region: data.region,
        effectiveFrom,
        effectiveTo,
        dataSources: data.dataSources,
        comparableTransactions: data.comparableTransactions,
        cpiAdjusted: false,
      })
      .returning();

    // Audit log
    await this.logAuditAction({
      actionType: "benchmark_created",
      actionDescription: `FMV benchmark created for ${data.itemCategory}: $${data.fmvMedian.toFixed(2)}`,
      performedBy: createdBy,
      complianceImpact: "low",
    });

    return benchmark;
  }

  /**
   * Get FMV benchmark for item
   */
  static async getFMVBenchmark(itemCategory: string, region: string) {
    const now = new Date();
    
    const benchmarks = await db
      .select()
      .from(fmvBenchmarks)
      .where(
        and(
          eq(fmvBenchmarks.itemCategory, itemCategory),
          eq(fmvBenchmarks.region, region),
          lte(fmvBenchmarks.effectiveFrom, now),
          gte(fmvBenchmarks.effectiveTo, now)
        )
      )
      .orderBy(desc(fmvBenchmarks.createdAt))
      .limit(1);

    return benchmarks.length > 0 ? benchmarks[0] : null;
  }

  /**
   * Import CPI data from Statistics Canada
   */
  static async importCPIData(
    year: string,
    month: string,
    cpiValue: number,
    importedBy: string
  ) {
    const periodDate = new Date(parseInt(year), parseInt(month) - 1, 1);

    const [cpi] = await db
      .insert(cpiData)
      .values({
        periodYear: year,
        periodMonth: month.padStart(2, "0"),
        periodDate,
        cpiValue: cpiValue.toFixed(4),
        baseYear: this.CPI_BASE_YEAR,
        source: "statistics_canada",
        dataQuality: "official",
        importedBy,
      })
      .returning();

    // Audit log
    await this.logAuditAction({
      actionType: "cpi_imported",
      actionDescription: `CPI data imported for ${year}-${month}: ${cpiValue}`,
      performedBy: importedBy,
      complianceImpact: "none",
    });

    return cpi;
  }

  /**
   * Adjust price using CPI escalator
   */
  static async adjustPriceForCPI(params: {
    itemId: string;
    itemDescription: string;
    originalPrice: number;
    originalPriceDate: Date;
    approvedBy: string;
  }) {
    // Get original CPI
    const originalCPI = await this.getCPIForDate(params.originalPriceDate);
    if (!originalCPI) {
      throw new Error("Original CPI data not available");
    }

    // Get current CPI
    const currentCPI = await this.getCurrentCPI();
    if (!currentCPI) {
      throw new Error("Current CPI data not available");
    }

    // Calculate adjustment
    const cpiChange =
      (parseFloat(currentCPI.cpiValue) - parseFloat(originalCPI.cpiValue)) /
      parseFloat(originalCPI.cpiValue);
    const adjustmentAmount = params.originalPrice * cpiChange;
    const adjustedPrice = params.originalPrice + adjustmentAmount;

    // Record adjustment
    const [adjustment] = await db
      .insert(cpiAdjustedPricing)
      .values({
        itemId: params.itemId,
        itemDescription: params.itemDescription,
        originalPrice: params.originalPrice.toFixed(2),
        originalPriceDate: params.originalPriceDate,
        originalCPI: originalCPI.cpiValue,
        adjustedPrice: adjustedPrice.toFixed(2),
        adjustmentDate: new Date(),
        currentCPI: currentCPI.cpiValue,
        cpiChangePercentage: (cpiChange * 100).toFixed(4),
        adjustmentAmount: adjustmentAmount.toFixed(2),
        adjustmentApproved: true,
        approvedBy: params.approvedBy,
        approvedAt: new Date(),
      })
      .returning();

    // Audit log
    await this.logAuditAction({
      actionType: "cpi_adjusted",
      actionDescription: `Price adjusted for CPI: $${params.originalPrice.toFixed(2)} → $${adjustedPrice.toFixed(2)} (${(cpiChange * 100).toFixed(2)}% increase)`,
      performedBy: params.approvedBy,
      complianceImpact: "low",
    });

    return adjustment;
  }

  /**
   * Get CPI for specific date
   */
  private static async getCPIForDate(date: Date) {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");

    const cpi = await db
      .select()
      .from(cpiData)
      .where(and(eq(cpiData.periodYear, year), eq(cpiData.periodMonth, month)))
      .limit(1);

    return cpi.length > 0 ? cpi[0] : null;
  }

  /**
   * Get current CPI (most recent month)
   */
  private static async getCurrentCPI() {
    const cpi = await db
      .select()
      .from(cpiData)
      .orderBy(desc(cpiData.periodDate))
      .limit(1);

    return cpi.length > 0 ? cpi[0] : null;
  }

  /**
   * Create procurement request (with 3-bid requirement)
   */
  static async createProcurementRequest(data: ProcurementRequestData) {
    const _policy = await this.getPolicy();
    const requiresCompetitiveBidding =
      data.estimatedValue >= this.COMPETITIVE_BIDDING_THRESHOLD;
    const requiresAppraisal = data.estimatedValue >= this.APPRAISAL_THRESHOLD;

    // Generate request number
    const requestNumber = `PR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Set bidding deadline (14 days from now)
    const biddingDeadline = new Date();
    biddingDeadline.setDate(biddingDeadline.getDate() + 14);

    const [request] = await db
      .insert(procurementRequests)
      .values({
        requestNumber,
        requestTitle: data.requestTitle,
        requestDescription: data.requestDescription,
        estimatedValue: data.estimatedValue.toFixed(2),
        procurementType: data.procurementType,
        procurementMethod: requiresCompetitiveBidding ? "competitive_bidding" : "sole_source",
        requestedBy: data.requestedBy,
        requestedByDepartment: data.requestedByDepartment,
        minimumBidsRequired: requiresCompetitiveBidding
          ? this.MINIMUM_BIDS_REQUIRED.toString()
          : "1",
        biddingDeadline: requiresCompetitiveBidding ? biddingDeadline : undefined,
        status: "open_bidding",
      })
      .returning();

    // Log if appraisal required
    if (requiresAppraisal) {
      await this.logAuditAction({
        actionType: "appraisal_required",
        actionDescription: `Procurement request ${requestNumber} requires independent appraisal (value: $${data.estimatedValue.toFixed(2)})`,
        procurementRequestId: request.id,
        performedBy: data.requestedBy,
        complianceImpact: "medium",
      });
    }

    // Audit log
    await this.logAuditAction({
      actionType: "procurement_initiated",
      actionDescription: `Procurement request ${requestNumber} created. Estimated value: $${data.estimatedValue.toFixed(2)}`,
      procurementRequestId: request.id,
      performedBy: data.requestedBy,
      complianceImpact: requiresCompetitiveBidding ? "medium" : "low",
    });

    return request;
  }

  /**
   * Submit bid for procurement
   */
  static async submitBid(bid: BidSubmission) {
    // Get procurement request
    const request = await db
      .select()
      .from(procurementRequests)
      .where(eq(procurementRequests.id, bid.procurementRequestId))
      .limit(1);

    if (request.length === 0) {
      throw new Error("Procurement request not found");
    }

    const procurementRequest = request[0];

    // Check if bidding is still open
    if (procurementRequest.status !== "open_bidding") {
      throw new Error("Procurement bidding is closed");
    }

    // Check deadline
    if (
      procurementRequest.biddingDeadline &&
      new Date() > procurementRequest.biddingDeadline
    ) {
      throw new Error("Bidding deadline has passed");
    }

    // Get FMV benchmark if available
    let withinFMVRange = false;
    let fmvVariance = 0;
    let fmvBenchmarkId = undefined;

    const benchmark = await this.getFMVBenchmark(
      procurementRequest.procurementType,
      "national" // Could be region-specific
    );

    if (benchmark) {
      fmvBenchmarkId = benchmark.id;
      const fmvMedian = parseFloat(benchmark.fmvMedian);
      const bidAmount = bid.bidAmount;

      withinFMVRange =
        bidAmount >= parseFloat(benchmark.fmvLow) &&
        bidAmount <= parseFloat(benchmark.fmvHigh);
      fmvVariance = ((bidAmount - fmvMedian) / fmvMedian) * 100;
    }

    // Submit bid
    const [submitted] = await db
      .insert(procurementBids)
      .values({
        procurementRequestId: bid.procurementRequestId,
        bidderName: bid.bidderName,
        bidderContact: bid.bidderContact,
        bidAmount: bid.bidAmount.toFixed(2),
        bidDocuments: bid.bidDocuments,
        bidNotes: bid.bidNotes,
        fmvBenchmarkId,
        withinFMVRange,
        fmvVariancePercentage: fmvVariance.toFixed(2),
        bidStatus: "submitted",
      })
      .returning();

    // Update bids received count
    const newBidsReceived = parseInt(procurementRequest.bidsReceived) + 1;
    await db
      .update(procurementRequests)
      .set({
        bidsReceived: newBidsReceived.toString(),
        updatedAt: new Date(),
      })
      .where(eq(procurementRequests.id, bid.procurementRequestId));

    // Audit log
    await this.logAuditAction({
      actionType: "bid_submitted",
      actionDescription: `Bid submitted by ${bid.bidderName}: $${bid.bidAmount.toFixed(2)} (${newBidsReceived}/${procurementRequest.minimumBidsRequired} bids)`,
      procurementRequestId: bid.procurementRequestId,
      bidId: submitted.id,
      performedBy: "system",
      complianceImpact: "low",
    });

    return submitted;
  }

  /**
   * Verify 3-bid compliance
   */
  static async verify3BidCompliance(procurementRequestId: string): Promise<{
    compliant: boolean;
    violations: string[];
  }> {
    const violations: string[] = [];

    // Get procurement request
    const request = await db
      .select()
      .from(procurementRequests)
      .where(eq(procurementRequests.id, procurementRequestId))
      .limit(1);

    if (request.length === 0) {
      throw new Error("Procurement request not found");
    }

    const procurementRequest = request[0];
    const estimatedValue = parseFloat(procurementRequest.estimatedValue);

    // Check if competitive bidding required
    if (estimatedValue >= this.COMPETITIVE_BIDDING_THRESHOLD) {
      const minimumBids = parseInt(procurementRequest.minimumBidsRequired);
      const bidsReceived = parseInt(procurementRequest.bidsReceived);

      if (bidsReceived < minimumBids) {
        violations.push(
          `Insufficient bids: ${bidsReceived}/${minimumBids} received (minimum ${minimumBids} required for values ≥$${this.COMPETITIVE_BIDDING_THRESHOLD.toFixed(2)})`
        );

        // Log violation
        await this.logViolation({
          violationType: "insufficient_bids",
          violationDescription: violations[0],
          procurementRequestId,
          severity: "high",
        });
      }
    }

    // Check if appraisal required but missing
    if (estimatedValue >= this.APPRAISAL_THRESHOLD) {
      const appraisals = await db
        .select()
        .from(independentAppraisals)
        .where(eq(independentAppraisals.procurementRequestId, procurementRequestId))
        .limit(1);

      if (appraisals.length === 0) {
        violations.push(
          `Independent appraisal required but not completed (value ≥$${this.APPRAISAL_THRESHOLD.toFixed(2)})`
        );

        // Log violation
        await this.logViolation({
          violationType: "no_appraisal",
          violationDescription: violations[violations.length - 1],
          procurementRequestId,
          severity: "critical",
        });
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  /**
   * Request independent appraisal
   */
  static async requestIndependentAppraisal(params: {
    itemType: string;
    itemDescription: string;
    procurementRequestId?: string;
    appraiserName: string;
    appraiserCompany: string;
    requestedBy: string;
  }) {
    // Create appraisal request (appraised value TBD)
    const appraisalValidUntil = new Date();
    appraisalValidUntil.setMonth(appraisalValidUntil.getMonth() + 6); // Valid 6 months

    const [appraisal] = await db
      .insert(independentAppraisals)
      .values({
        itemType: params.itemType,
        itemDescription: params.itemDescription,
        procurementRequestId: params.procurementRequestId,
        appraiserName: params.appraiserName,
        appraiserCompany: params.appraiserCompany,
        appraisedValue: "0.00", // To be updated when appraisal complete
        appraisalMethod: "comparable_sales",
        appraisalDate: new Date(),
        appraisalValidUntil,
      })
      .returning();

    // Audit log
    await this.logAuditAction({
      actionType: "appraisal_requested",
      actionDescription: `Independent appraisal requested from ${params.appraiserCompany}`,
      procurementRequestId: params.procurementRequestId,
      appraisalId: appraisal.id,
      performedBy: params.requestedBy,
      complianceImpact: "medium",
    });

    return appraisal;
  }

  /**
   * Log FMV violation
   */
  private static async logViolation(params: {
    violationType: string;
    violationDescription: string;
    procurementRequestId?: string;
    transactionId?: string;
    severity: string;
  }) {
    await db.insert(fmvViolations).values({
      violationType: params.violationType,
      violationDescription: params.violationDescription,
      procurementRequestId: params.procurementRequestId,
      transactionId: params.transactionId,
      severity: params.severity,
      status: "pending",
      detectedBy: "system",
    });
  }

  /**
   * Log audit action
   */
  private static async logAuditAction(params: {
    actionType: string;
    actionDescription: string;
    procurementRequestId?: string;
    bidId?: string;
    appraisalId?: string;
    performedBy: string;
    performedByRole?: string;
    complianceImpact?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
  }) {
    await db.insert(fmvAuditLog).values({
      actionType: params.actionType,
      actionDescription: params.actionDescription,
      procurementRequestId: params.procurementRequestId,
      bidId: params.bidId,
      appraisalId: params.appraisalId,
      performedBy: params.performedBy,
      performedByRole: params.performedByRole,
      complianceImpact: params.complianceImpact,
      metadata: params.metadata,
    });
  }

  /**
   * Get FMV policy
   */
  private static async getPolicy() {
    const policies = await db.select().from(fmvPolicy).limit(1);

    if (policies.length === 0) {
      // Create default policy
      const [policy] = await db
        .insert(fmvPolicy)
        .values({
          policyEnabled: true,
          fmvVerificationRequired: true,
          competitiveBiddingThreshold: this.COMPETITIVE_BIDDING_THRESHOLD.toFixed(2),
          minimumBidsRequired: this.MINIMUM_BIDS_REQUIRED.toString(),
          cpiEscalatorEnabled: true,
          appraisalRequired: true,
          appraisalThreshold: this.APPRAISAL_THRESHOLD.toFixed(2),
        })
        .returning();

      return policy;
    }

    return policies[0];
  }

  /**
   * Get all FMV violations
   */
  static async getViolations(status?: string) {
    if (status) {
      return await db
        .select()
        .from(fmvViolations)
        .where(eq(fmvViolations.status, status))
        .orderBy(desc(fmvViolations.createdAt));
    }

    return await db
      .select()
      .from(fmvViolations)
      .orderBy(desc(fmvViolations.createdAt));
  }
}
