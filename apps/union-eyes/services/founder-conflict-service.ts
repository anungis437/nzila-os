import { db } from "@/db";
import {
  conflictOfInterestPolicy,
  blindTrustRegistry,
  conflictDisclosures,
  armsLengthVerification,
  recusalTracking,
  _conflictReviewCommittee,
  _conflictTraining,
  conflictAuditLog,
} from "@/db/schema/domains/governance";
import { eq, and, lte, desc } from "drizzle-orm";

/**
 * Founder & Executive Conflict of Interest Service
 * Enforces blind trust requirements, disclosure obligations, arms-length verification
 */

export interface BlindTrustSetup {
  userId: string;
  fullName: string;
  role: string;
  trusteeName: string;
  trusteeContact: string;
  trusteeRelationship: string;
  trustType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assetsTransferred: any[];
  estimatedValue: number;
  trustDocument: string;
}

export interface ConflictDisclosure {
  userId: string;
  fullName: string;
  role: string;
  disclosureType: string;
  conflictType: string;
  conflictDescription: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  relatedParties?: any[];
  financialInterestAmount?: number;
  ownershipPercentage?: number;
  mitigationPlan?: string;
  recusalRequired?: boolean;
}

export interface ArmsLengthCheck {
  transactionId: string;
  transactionType: string;
  transactionAmount: number;
  fromParty: string;
  toParty: string;
}

export class FounderConflictService {
  private static readonly SIGNIFICANT_INTEREST_THRESHOLD = 5000.0; // $5k
  private static readonly COVERED_ROLES = [
    "founder",
    "president",
    "vice_president",
    "treasurer",
    "secretary",
    "executive_director",
    "board_member",
  ];

  /**
   * Check if user role requires blind trust
   */
  static async requiresBlindTrust(userId: string, role: string): Promise<boolean> {
    const policy = await this.getPolicy();
    
    if (!policy.policyEnabled || !policy.blindTrustRequired) {
      return false;
    }

    const coveredRoles = (policy.coveredRoles as string[]) || this.COVERED_ROLES;
    return coveredRoles.includes(role.toLowerCase());
  }

  /**
   * Establish blind trust for founder/executive
   */
  static async establishBlindTrust(setup: BlindTrustSetup) {
    // Check if user is in covered role
    const requiresTrust = await this.requiresBlindTrust(setup.userId, setup.role);
    
    if (!requiresTrust) {
      throw new Error(`Role ${setup.role} does not require blind trust`);
    }

    // Check if trust already exists
    const existing = await db
      .select()
      .from(blindTrustRegistry)
      .where(eq(blindTrustRegistry.userId, setup.userId))
      .limit(1);

    if (existing.length > 0) {
      throw new Error("Blind trust already established for this user");
    }

    // Set next review date (annual)
    const nextReviewDue = new Date();
    nextReviewDue.setFullYear(nextReviewDue.getFullYear() + 1);

    // Create trust registry entry
    const [trust] = await db
      .insert(blindTrustRegistry)
      .values({
        userId: setup.userId,
        fullName: setup.fullName,
        role: setup.role,
        trustStatus: "established",
        trustEstablishedDate: new Date(),
        trusteeName: setup.trusteeName,
        trusteeContact: setup.trusteeContact,
        trusteeRelationship: setup.trusteeRelationship,
        trustType: setup.trustType,
        trustDocument: setup.trustDocument,
        assetsTransferred: setup.assetsTransferred,
        estimatedValue: setup.estimatedValue.toFixed(2),
        compliant: false, // Requires verification
        lastReviewDate: new Date(),
        nextReviewDue,
      })
      .returning();

    // Audit log
    await this.logAuditAction({
      actionType: "blind_trust_established",
      actionDescription: `Blind trust established for ${setup.fullName} (${setup.role}). Trustee: ${setup.trusteeName}`,
      subjectUserId: setup.userId,
      performedBy: setup.userId,
      complianceImpact: "high",
    });

    return trust;
  }

  /**
   * Verify blind trust compliance
   */
  static async verifyBlindTrust(
    trustId: string,
    verifiedBy: string,
    compliant: boolean,
    verificationNotes: string
  ) {
    await db
      .update(blindTrustRegistry)
      .set({
        trustStatus: compliant ? "verified" : "non_compliant",
        verifiedBy,
        verifiedAt: new Date(),
        verificationNotes,
        compliant,
        updatedAt: new Date(),
      })
      .where(eq(blindTrustRegistry.id, trustId));

    // Audit log
    await this.logAuditAction({
      actionType: "blind_trust_verified",
      actionDescription: `Blind trust verification ${compliant ? "passed" : "failed"}`,
      performedBy: verifiedBy,
      complianceImpact: compliant ? "none" : "critical",
      metadata: { trustId, verificationNotes },
    });
  }

  /**
   * Submit conflict of interest disclosure
   */
  static async submitDisclosure(disclosure: ConflictDisclosure) {
    const policy = await this.getPolicy();
    
    // Set disclosure deadline based on type
    let disclosureDeadline: Date | undefined;
    if (disclosure.disclosureType === "annual") {
      const year = new Date().getFullYear();
      const [month, day] = (policy.disclosureDeadline || "01-31").split("-");
      disclosureDeadline = new Date(year, parseInt(month) - 1, parseInt(day));
    }

    // Check if disclosure is overdue
    const overdue = disclosureDeadline ? new Date() > disclosureDeadline : false;

    const [submitted] = await db
      .insert(conflictDisclosures)
      .values({
        userId: disclosure.userId,
        fullName: disclosure.fullName,
        role: disclosure.role,
        disclosureType: disclosure.disclosureType,
        disclosureYear: disclosure.disclosureType === "annual" ? new Date().getFullYear().toString() : undefined,
        conflictType: disclosure.conflictType,
        conflictDescription: disclosure.conflictDescription,
        relatedParties: disclosure.relatedParties,
        financialInterestAmount: disclosure.financialInterestAmount?.toFixed(2),
        ownershipPercentage: disclosure.ownershipPercentage?.toFixed(2),
        mitigationPlan: disclosure.mitigationPlan,
        recusalRequired: disclosure.recusalRequired || false,
        recusalDocumented: false,
        reviewStatus: "pending",
        disclosureDeadline,
        overdue,
      })
      .returning();

    // Audit log
    await this.logAuditAction({
      actionType: "disclosure_submitted",
      actionDescription: `Conflict disclosure submitted by ${disclosure.fullName}: ${disclosure.conflictType}`,
      subjectUserId: disclosure.userId,
      performedBy: disclosure.userId,
      complianceImpact: disclosure.financialInterestAmount && disclosure.financialInterestAmount >= this.SIGNIFICANT_INTEREST_THRESHOLD ? "high" : "medium",
      relatedDisclosureId: submitted.id,
    });

    return submitted;
  }

  /**
   * Review conflict disclosure
   */
  static async reviewDisclosure(
    disclosureId: string,
    reviewedBy: string,
    reviewStatus: string,
    reviewNotes?: string
  ) {
    // Get existing reviewers
    const disclosure = await db
      .select()
      .from(conflictDisclosures)
      .where(eq(conflictDisclosures.id, disclosureId))
      .limit(1);

    if (disclosure.length === 0) {
      throw new Error("Disclosure not found");
    }

    const existingReviewers = (disclosure[0].reviewedBy as string[]) || [];
    const updatedReviewers = [...existingReviewers, reviewedBy];

    // Check if minimum reviewers met
    const policy = await this.getPolicy();
    const minimumReviewers = parseInt(policy.minimumReviewers || "2");
    const reviewComplete = updatedReviewers.length >= minimumReviewers;

    await db
      .update(conflictDisclosures)
      .set({
        reviewStatus: reviewComplete ? reviewStatus : "under_review",
        reviewNotes,
        reviewedBy: updatedReviewers,
        reviewCompletedAt: reviewComplete ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(conflictDisclosures.id, disclosureId));

    // Audit log
    await this.logAuditAction({
      actionType: "disclosure_reviewed",
      actionDescription: `Conflict disclosure reviewed by reviewer ${updatedReviewers.length}/${minimumReviewers}. Status: ${reviewStatus}`,
      performedBy: reviewedBy,
      complianceImpact: reviewStatus === "rejected" ? "high" : "low",
      relatedDisclosureId: disclosureId,
    });
  }

  /**
   * Verify arms-length transaction
   */
  static async verifyArmsLength(check: ArmsLengthCheck) {
    // Check if parties have any relationship
    const relationship = await this.checkRelationship(check.fromParty, check.toParty);

    const [verification] = await db
      .insert(armsLengthVerification)
      .values({
        transactionId: check.transactionId,
        transactionType: check.transactionType,
        transactionAmount: check.transactionAmount.toFixed(2),
        fromParty: check.fromParty,
        toParty: check.toParty,
        relationshipExists: relationship.exists,
        relationshipType: relationship.type,
        relationshipDescription: relationship.description,
        armsLengthStatus: relationship.exists ? "requires_review" : "arms_length",
        compliant: !relationship.exists,
      })
      .returning();

    // If relationship exists, require review
    if (relationship.exists) {
      await this.logAuditAction({
        actionType: "arms_length_flagged",
        actionDescription: `Transaction flagged for arms-length review. Relationship: ${relationship.type}`,
        performedBy: "system",
        complianceImpact: "high",
        relatedTransactionId: check.transactionId,
      });
    }

    return verification;
  }

  /**
   * Check relationship between parties
   */
  private static async checkRelationship(
    party1: string,
    party2: string
  ): Promise<{ exists: boolean; type?: string; description?: string }> {
    // Check if either party has disclosed a relationship
    const disclosures = await db
      .select()
      .from(conflictDisclosures)
      .where(eq(conflictDisclosures.userId, party1));

    for (const disclosure of disclosures) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const relatedParties = (disclosure.relatedParties as any[]) || [];
      const hasRelationship = relatedParties.some((p) => p.userId === party2);

      if (hasRelationship) {
        return {
          exists: true,
          type: disclosure.conflictType,
          description: disclosure.conflictDescription,
        };
      }
    }

    // Check blind trust registry (founders/execs)
    const trustRecords = await db
      .select()
      .from(blindTrustRegistry)
      .where(eq(blindTrustRegistry.userId, party1));

    if (trustRecords.length > 0) {
      // Party1 is a founder/exec with blind trust - still needs review
      return {
        exists: true,
        type: "founder_executive",
        description: `${trustRecords[0].fullName} is a ${trustRecords[0].role} with blind trust`,
      };
    }

    return { exists: false };
  }

  /**
   * Document recusal
   */
  static async documentRecusal(params: {
    userId: string;
    fullName: string;
    role: string;
    recusalType: string;
    recusalReason: string;
    relatedMatter?: string;
    relatedTransactionId?: string;
    documentedBy: string;
  }) {
    const [recusal] = await db
      .insert(recusalTracking)
      .values({
        userId: params.userId,
        fullName: params.fullName,
        role: params.role,
        recusalType: params.recusalType,
        recusalReason: params.recusalReason,
        relatedMatter: params.relatedMatter,
        relatedTransactionId: params.relatedTransactionId,
        recusalDocumented: true,
        documentedBy: params.documentedBy,
        documentedAt: new Date(),
        recusalStartDate: new Date(),
      })
      .returning();

    // Audit log
    await this.logAuditAction({
      actionType: "recusal_documented",
      actionDescription: `Recusal documented for ${params.fullName}: ${params.recusalReason}`,
      subjectUserId: params.userId,
      performedBy: params.documentedBy,
      complianceImpact: "medium",
      relatedTransactionId: params.relatedTransactionId,
    });

    return recusal;
  }

  /**
   * Get overdue annual disclosures
   */
  static async getOverdueDisclosures() {
    const today = new Date();
    
    return await db
      .select()
      .from(conflictDisclosures)
      .where(
        and(
          eq(conflictDisclosures.disclosureType, "annual"),
          lte(conflictDisclosures.disclosureDeadline, today),
          eq(conflictDisclosures.reviewStatus, "pending")
        )
      )
      .orderBy(desc(conflictDisclosures.disclosureDeadline));
  }

  /**
   * Get non-compliant blind trusts
   */
  static async getNonCompliantTrusts() {
    return await db
      .select()
      .from(blindTrustRegistry)
      .where(eq(blindTrustRegistry.compliant, false))
      .orderBy(desc(blindTrustRegistry.createdAt));
  }

  /**
   * Log audit action
   */
  private static async logAuditAction(params: {
    actionType: string;
    actionDescription: string;
    subjectUserId?: string;
    relatedDisclosureId?: string;
    relatedTransactionId?: string;
    performedBy: string;
    performedByRole?: string;
    complianceImpact?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
  }) {
    await db.insert(conflictAuditLog).values({
      actionType: params.actionType,
      actionDescription: params.actionDescription,
      subjectUserId: params.subjectUserId,
      relatedDisclosureId: params.relatedDisclosureId,
      relatedTransactionId: params.relatedTransactionId,
      performedBy: params.performedBy,
      performedByRole: params.performedByRole,
      complianceImpact: params.complianceImpact,
      metadata: params.metadata,
    });
  }

  /**
   * Get conflict of interest policy
   */
  private static async getPolicy() {
    const policies = await db.select().from(conflictOfInterestPolicy).limit(1);

    if (policies.length === 0) {
      // Create default policy
      const [policy] = await db
        .insert(conflictOfInterestPolicy)
        .values({
          policyEnabled: true,
          blindTrustRequired: true,
          annualDisclosureRequired: true,
          disclosureDeadline: "01-31", // January 31
          significantInterestThreshold: this.SIGNIFICANT_INTEREST_THRESHOLD.toFixed(2),
          armsLengthVerificationRequired: true,
          coveredRoles: this.COVERED_ROLES,
          reviewCommitteeRequired: true,
          minimumReviewers: "2",
        })
        .returning();

      return policy;
    }

    return policies[0];
  }

  /**
   * Get all conflict disclosures for user
   */
  static async getUserDisclosures(userId: string) {
    return await db
      .select()
      .from(conflictDisclosures)
      .where(eq(conflictDisclosures.userId, userId))
      .orderBy(desc(conflictDisclosures.createdAt));
  }

  /**
   * Get user blind trust status
   */
  static async getUserBlindTrust(userId: string) {
    const trusts = await db
      .select()
      .from(blindTrustRegistry)
      .where(eq(blindTrustRegistry.userId, userId))
      .limit(1);

    return trusts.length > 0 ? trusts[0] : null;
  }
}
