import { db } from "@/db";
import {
  _dataClassificationPolicy,
  dataClassificationRegistry,
  firewallAccessRules,
  employerAccessAttempts,
  accessJustificationRequests,
  unionOnlyDataTags,
  firewallViolations,
  firewallComplianceAudit,
} from "@/db/schema/employer-non-interference-schema";
import { eq, and, desc, gte } from "drizzle-orm";

/**
 * Employer Non-Interference Service
 * Enforces firewall between employer and union data
 */

export interface AccessAttempt {
  userId: string;
  userEmail: string;
  userRole: string;
  dataTypeRequested: string;
  dataTypeId?: string;
  justificationProvided?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface DataClassification {
  dataType: string;
  classificationLevel: "union_only" | "shared" | "employer_accessible";
  accessibleByEmployer: boolean;
  accessibleByUnion: boolean;
  requiresJustification: boolean;
  dataDescription?: string;
  legalBasis?: string;
}

export class EmployerNonInterferenceService {
  /**
   * Validate access attempt against firewall rules
   */
  static async validateAccessAttempt(attempt: AccessAttempt): Promise<{
    granted: boolean;
    denialReason?: string;
    requiresJustification?: boolean;
    requiresApproval?: boolean;
  }> {
    // Check if data type is classified
    const classification = await db
      .select()
      .from(dataClassificationRegistry)
      .where(
        attempt.dataTypeId
          ? eq(dataClassificationRegistry.id, attempt.dataTypeId)
          : eq(dataClassificationRegistry.dataType, attempt.dataTypeRequested)
      )
      .limit(1);

    if (classification.length === 0) {
      // Data type not classified - default to union-only
      await this.logAccessAttempt(attempt, false, "data_type_not_classified");
      return {
        granted: false,
        denialReason: "Data type not classified - defaulting to union-only access",
      };
    }

    const dataClass = classification[0];

    // Check firewall access rules for user role
    const accessRule = await db
      .select()
      .from(firewallAccessRules)
      .where(
        and(
          eq(firewallAccessRules.dataTypeId, dataClass.id),
          eq(firewallAccessRules.userRole, attempt.userRole)
        )
      )
      .limit(1);

    // If user is employer and data is union-only, deny immediately
    if (
      this.isEmployerRole(attempt.userRole) &&
      dataClass.classificationLevel === "union_only"
    ) {
      await this.logAccessAttempt(attempt, false, "employer_firewall_violation");
      await this.flagViolation(attempt, "unauthorized_access_attempt", "high");
      return {
        granted: false,
        denialReason: "Employer access to union-only data is prohibited",
      };
    }

    if (accessRule.length === 0) {
      // No explicit rule - deny by default
      await this.logAccessAttempt(attempt, false, "no_access_rule_defined");
      return {
        granted: false,
        denialReason: "No access rule defined for this user role",
      };
    }

    const rule = accessRule[0];

    if (!rule.accessPermitted) {
      await this.logAccessAttempt(attempt, false, "access_denied_by_rule");
      return {
        granted: false,
        denialReason: "Access denied by firewall rule",
      };
    }

    // Check if justification required
    if (rule.justificationRequired && !attempt.justificationProvided) {
      await this.logAccessAttempt(attempt, false, "justification_required");
      return {
        granted: false,
        denialReason: "Justification required for access",
        requiresJustification: true,
      };
    }

    // Check if approval required
    if (rule.requiresApproval) {
      await this.logAccessAttempt(attempt, false, "approval_required");
      return {
        granted: false,
        denialReason: "Approval required for access",
        requiresApproval: true,
      };
    }

    // Access granted
    await this.logAccessAttempt(attempt, true);
    return { granted: true };
  }

  /**
   * Log access attempt
   */
  private static async logAccessAttempt(
    attempt: AccessAttempt,
    granted: boolean,
    denialReason?: string
  ) {
    const flagForReview =
      !granted && this.isEmployerRole(attempt.userRole) && denialReason === "employer_firewall_violation";

    await db.insert(employerAccessAttempts).values({
      userId: attempt.userId,
      userEmail: attempt.userEmail,
      userRole: attempt.userRole,
      dataTypeRequested: attempt.dataTypeRequested,
      dataTypeId: attempt.dataTypeId,
      accessGranted: granted,
      denialReason,
      justificationProvided: attempt.justificationProvided,
      ipAddress: attempt.ipAddress,
      userAgent: attempt.userAgent,
      sessionId: attempt.sessionId,
      flaggedForReview: flagForReview,
    });
  }

  /**
   * Submit access justification request
   */
  static async submitAccessJustification(params: {
    requestedBy: string;
    requestedByEmail: string;
    requestedByRole: string;
    dataTypeRequested: string;
    dataTypeId?: string;
    justification: string;
    businessPurpose: string;
  }) {
    // Check if employer requesting access to union-only data
    const classification = await db
      .select()
      .from(dataClassificationRegistry)
      .where(
        params.dataTypeId
          ? eq(dataClassificationRegistry.id, params.dataTypeId)
          : eq(dataClassificationRegistry.dataType, params.dataTypeRequested)
      )
      .limit(1);

    if (
      classification.length > 0 &&
      classification[0].classificationLevel === "union_only" &&
      this.isEmployerRole(params.requestedByRole)
    ) {
      // Auto-deny employer requests for union-only data
      const [request] = await db
        .insert(accessJustificationRequests)
        .values({
          ...params,
          requestStatus: "denied",
          reviewedAt: new Date(),
          reviewDecision: "denied",
          reviewNotes: "Employer access to union-only data is prohibited by firewall policy",
        })
        .returning();

      return {
        request,
        autoRejected: true,
        reason: "Employer access to union-only data is prohibited",
      };
    }

    // Create pending request
    const [request] = await db
      .insert(accessJustificationRequests)
      .values({
        ...params,
        requestStatus: "pending",
      })
      .returning();

    return { request, autoRejected: false };
  }

  /**
   * Review access justification
   */
  static async reviewAccessJustification(
    requestId: string,
    reviewedBy: string,
    decision: "approved" | "denied" | "escalated",
    reviewNotes: string,
    approvalExpiryDate?: Date
  ) {
    const [request] = await db
      .update(accessJustificationRequests)
      .set({
        requestStatus: decision,
        reviewedBy,
        reviewedAt: new Date(),
        reviewDecision: decision,
        reviewNotes,
        approvalExpiryDate,
        accessGrantedAt: decision === "approved" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(accessJustificationRequests.id, requestId))
      .returning();

    return request;
  }

  /**
   * Tag data as union-only
   */
  static async tagUnionOnlyData(params: {
    resourceType: string;
    resourceId: string;
    resourceName?: string;
    taggedBy: string;
    tagReason?: string;
    reviewDate?: Date;
  }) {
    const [tag] = await db
      .insert(unionOnlyDataTags)
      .values({
        ...params,
        unionOnlyFlag: true,
        employerAccessBlocked: true,
        classificationLevel: "union_only",
      })
      .returning();

    return tag;
  }

  /**
   * Check if resource is union-only
   */
  static async isUnionOnly(resourceType: string, resourceId: string): Promise<boolean> {
    const tags = await db
      .select()
      .from(unionOnlyDataTags)
      .where(
        and(
          eq(unionOnlyDataTags.resourceType, resourceType),
          eq(unionOnlyDataTags.resourceId, resourceId)
        )
      )
      .limit(1);

    return tags.length > 0 && tags[0].unionOnlyFlag;
  }

  /**
   * Flag firewall violation
   */
  private static async flagViolation(
    attempt: AccessAttempt,
    violationType: string,
    severity: string
  ) {
    await db.insert(firewallViolations).values({
      violationType,
      severity,
      userId: attempt.userId,
      userEmail: attempt.userEmail,
      userRole: attempt.userRole,
      dataTypeAccessed: attempt.dataTypeRequested,
      dataTypeId: attempt.dataTypeId,
      violationDescription: `Unauthorized access attempt by ${attempt.userRole} to ${attempt.dataTypeRequested}`,
      systemDetected: true,
      incidentStatus: "open",
    });
  }

  /**
   * Get flagged access attempts requiring review
   */
  static async getFlaggedAccessAttempts() {
    return await db
      .select()
      .from(employerAccessAttempts)
      .where(eq(employerAccessAttempts.flaggedForReview, true))
      .orderBy(desc(employerAccessAttempts.attemptTimestamp));
  }

  /**
   * Get open firewall violations
   */
  static async getOpenViolations() {
    return await db
      .select()
      .from(firewallViolations)
      .where(eq(firewallViolations.incidentStatus, "open"))
      .orderBy(desc(firewallViolations.violationDate));
  }

  /**
   * Generate compliance audit report
   */
  static async generateComplianceAudit(auditPeriod: string, auditedBy: string) {
    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - 3); // Last 3 months

    const allAttempts = await db
      .select()
      .from(employerAccessAttempts)
      .where(gte(employerAccessAttempts.attemptTimestamp, periodStart));

    const employerAttempts = allAttempts.filter((a) => this.isEmployerRole(a.userRole));
    const deniedAccess = allAttempts.filter((a) => !a.accessGranted);
    const violations = await db
      .select()
      .from(firewallViolations)
      .where(gte(firewallViolations.violationDate, periodStart));

    const criticalViolations = violations.filter((v) => v.severity === "critical");

    const complianceRate = allAttempts.length > 0
      ? (((allAttempts.length - deniedAccess.length) / allAttempts.length) * 100).toFixed(2)
      : "100.00";

    // Top violated data types
    const dataTypeCounts: Record<string, number> = {};
    deniedAccess.forEach((attempt) => {
      dataTypeCounts[attempt.dataTypeRequested] = (dataTypeCounts[attempt.dataTypeRequested] || 0) + 1;
    });

    const topViolatedDataTypes = Object.entries(dataTypeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([dataType, count]) => ({ dataType, count }));

    const [audit] = await db
      .insert(firewallComplianceAudit)
      .values({
        auditPeriod,
        totalAccessAttempts: allAttempts.length.toString(),
        totalEmployerAttempts: employerAttempts.length.toString(),
        totalDeniedAccess: deniedAccess.length.toString(),
        totalViolations: violations.length.toString(),
        criticalViolations: criticalViolations.length.toString(),
        complianceRate,
        topViolatedDataTypes,
        auditedBy,
      })
      .returning();

    return audit;
  }

  /**
   * Check if role is employer-affiliated
   */
  private static isEmployerRole(role: string): boolean {
    const employerRoles = ["employer_admin", "employer_supervisor", "employer_hr", "employer_manager"];
    return employerRoles.includes(role.toLowerCase());
  }

  /**
   * Classify data type
   */
  static async classifyDataType(classification: DataClassification) {
    const [record] = await db
      .insert(dataClassificationRegistry)
      .values(classification)
      .returning();

    return record;
  }

  /**
   * Get all employer access attempts for data type
   */
  static async getEmployerAccessHistory(dataTypeId: string) {
    return await db
      .select()
      .from(employerAccessAttempts)
      .where(eq(employerAccessAttempts.dataTypeId, dataTypeId))
      .orderBy(desc(employerAccessAttempts.attemptTimestamp));
  }
}
