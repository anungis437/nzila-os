import { db } from "@/db";
import {
  bandCouncils,
  bandCouncilConsent,
  indigenousMemberData,
  indigenousDataAccessLog,
  indigenousDataSharingAgreements,
  traditionalKnowledgeRegistry,
} from "@/db/schema/indigenous-data-schema";
import { eq, and } from "drizzle-orm";

/**
 * Indigenous Data Sovereignty Service
 * Implements OCAP® principles:
 * - Ownership: Indigenous data belongs to Indigenous peoples
 * - Control: Indigenous peoples control how data is collected, used, disclosed
 * - Access: Indigenous peoples have right to access data about themselves
 * - Possession: Indigenous peoples must possess their data (on-reserve storage)
 */

export interface BandCouncilRegistration {
  bandName: string;
  bandNumber: string;
  province: string;
  region: string;
  chiefName?: string;
  adminContactName?: string;
  adminContactEmail?: string;
  adminContactPhone?: string;
  onReserveStorageEnabled: boolean;
  storageLocation?: string;
}

export interface OCAPConsentRequest {
  bandCouncilId: string;
  consentType: string;
  purposeOfCollection: string;
  dataCategories: string[];
  intendedUse: string;
  bcrNumber?: string;
  bcrDate?: Date;
  bcrDocument?: string;
  expiresAt?: Date;
  approvedBy: string;
}

export interface IndigenousMemberRegistration {
  userId: string;
  indigenousStatus: "Status Indian" | "Non-Status" | "Métis" | "Inuit";
  bandCouncilId?: string;
  treatyNumber?: string;
  culturalDataSensitivity?: "standard" | "sensitive" | "sacred";
  onReserveDataOnly?: boolean;
}

export class IndigenousDataService {
  /**
   * Register a Band Council in the system
   */
  static async registerBandCouncil(registration: BandCouncilRegistration) {
    // Check if Band Council already exists
    const existing = await db
      .select()
      .from(bandCouncils)
      .where(eq(bandCouncils.bandNumber, registration.bandNumber))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Band Council ${registration.bandNumber} already registered`);
    }

    const [bandCouncil] = await db
      .insert(bandCouncils)
      .values({
        bandName: registration.bandName,
        bandNumber: registration.bandNumber,
        province: registration.province,
        region: registration.region,
        chiefName: registration.chiefName,
        adminContactName: registration.adminContactName,
        adminContactEmail: registration.adminContactEmail,
        adminContactPhone: registration.adminContactPhone,
        onReserveStorageEnabled: registration.onReserveStorageEnabled,
        storageLocation: registration.storageLocation,
      })
      .returning();

    return bandCouncil;
  }

  /**
   * Record Band Council Resolution (BCR) consent
   * Implements OCAP® Control principle
   */
  static async recordBandCouncilConsent(consent: OCAPConsentRequest) {
    // Verify Band Council exists
    const bandCouncil = await db
      .select()
      .from(bandCouncils)
      .where(eq(bandCouncils.id, consent.bandCouncilId))
      .limit(1);

    if (bandCouncil.length === 0) {
      throw new Error("Band Council not found");
    }

    const [consentRecord] = await db
      .insert(bandCouncilConsent)
      .values({
        bandCouncilId: consent.bandCouncilId,
        consentType: consent.consentType,
        consentGiven: true,
        bcrNumber: consent.bcrNumber,
        bcrDate: consent.bcrDate,
        bcrDocument: consent.bcrDocument,
        purposeOfCollection: consent.purposeOfCollection,
        dataCategories: consent.dataCategories,
        intendedUse: consent.intendedUse,
        expiresAt: consent.expiresAt,
        approvedBy: consent.approvedBy,
      })
      .returning();

    return consentRecord;
  }

  /**
   * Check if Band Council has given consent for specific data use
   * Implements OCAP® Control principle
   */
  static async hasBandCouncilConsent(
    bandCouncilId: string,
    consentType: string
  ): Promise<boolean> {
    const consents = await db
      .select()
      .from(bandCouncilConsent)
      .where(
        and(
          eq(bandCouncilConsent.bandCouncilId, bandCouncilId),
          eq(bandCouncilConsent.consentType, consentType),
          eq(bandCouncilConsent.consentGiven, true)
        )
      )
      .orderBy(bandCouncilConsent.createdAt);

    if (consents.length === 0) return false;

    const latestConsent = consents[consents.length - 1];

    // Check if consent has been revoked
    if (latestConsent.revokedAt) return false;

    // Check if consent has expired
    if (latestConsent.expiresAt && new Date() > latestConsent.expiresAt) {
      return false;
    }

    return true;
  }

  /**
   * Register Indigenous member with OCAP® preferences
   * Implements OCAP® Ownership principle
   */
  static async registerIndigenousMember(registration: IndigenousMemberRegistration) {
    // Validate Band Council if Status Indian
    if (registration.indigenousStatus === "Status Indian" && registration.bandCouncilId) {
      const bandCouncil = await db
        .select()
        .from(bandCouncils)
        .where(eq(bandCouncils.id, registration.bandCouncilId))
        .limit(1);

      if (bandCouncil.length === 0) {
        throw new Error("Band Council not found");
      }
    }

    const [member] = await db
      .insert(indigenousMemberData)
      .values({
        userId: registration.userId,
        indigenousStatus: registration.indigenousStatus,
        bandCouncilId: registration.bandCouncilId,
        treatyNumber: registration.treatyNumber,
        culturalDataSensitivity: registration.culturalDataSensitivity || "standard",
        onReserveDataOnly: registration.onReserveDataOnly || false,
      })
      .returning();

    return member;
  }

  /**
   * Get preferred storage location for Indigenous member data
   * Implements OCAP® Possession principle
   */
  static async getStorageLocation(userId: string): Promise<string | null> {
    const [member] = await db
      .select()
      .from(indigenousMemberData)
      .where(eq(indigenousMemberData.userId, userId))
      .limit(1);

    if (!member) return null;

    // If member requires on-reserve storage only
    if (member.onReserveDataOnly && member.bandCouncilId) {
      const [bandCouncil] = await db
        .select()
        .from(bandCouncils)
        .where(eq(bandCouncils.id, member.bandCouncilId))
        .limit(1);

      if (bandCouncil?.onReserveStorageEnabled && bandCouncil.storageLocation) {
        return bandCouncil.storageLocation;
      }
    }

    // Default to member's preferred location
    return member.preferredStorageLocation;
  }

  /**
   * Log data access for audit trail
   * Implements OCAP® Access principle
   */
  static async logDataAccess(params: {
    userId: string;
    accessedBy: string;
    accessType: "view" | "export" | "aggregate" | "share";
    accessPurpose: string;
    dataCategories: string[];
    authorizedBy: "individual_consent" | "band_council_consent" | "legal_obligation";
    authorizationReference?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Get member's Band Council ID
    const [member] = await db
      .select()
      .from(indigenousMemberData)
      .where(eq(indigenousMemberData.userId, params.userId))
      .limit(1);

    await db.insert(indigenousDataAccessLog).values({
      userId: params.userId,
      accessedBy: params.accessedBy,
      bandCouncilId: member?.bandCouncilId,
      accessType: params.accessType,
      accessPurpose: params.accessPurpose,
      dataCategories: params.dataCategories,
      authorizedBy: params.authorizedBy,
      authorizationReference: params.authorizationReference,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  /**
   * Check if data access is authorized for Indigenous member
   * Validates OCAP® Control
   */
  static async isAccessAuthorized(
    userId: string,
    accessType: string,
    requestedBy: string
  ): Promise<{ authorized: boolean; reason?: string }> {
    const [member] = await db
      .select()
      .from(indigenousMemberData)
      .where(eq(indigenousMemberData.userId, userId))
      .limit(1);

    if (!member) {
      return { authorized: false, reason: "Member not found" };
    }

    // Self-access is always allowed
    if (userId === requestedBy) {
      return { authorized: true };
    }

    // Check if member allows third-party access
    if (!member.allowThirdPartyAccess && accessType !== "aggregate") {
      return {
        authorized: false,
        reason: "Member does not allow third-party access",
      };
    }

    // Check if aggregation is allowed
    if (accessType === "aggregate" && !member.allowAggregation) {
      return {
        authorized: false,
        reason: "Member does not allow data aggregation",
      };
    }

    // If member has Band Council control preference, check BCR
    if (member.dataControlPreference === "band_council" && member.bandCouncilId) {
      const hasConsent = await this.hasBandCouncilConsent(
        member.bandCouncilId,
        `member_data_${accessType}`
      );

      if (!hasConsent) {
        return {
          authorized: false,
          reason: "Band Council consent required but not obtained",
        };
      }
    }

    return { authorized: true };
  }

  /**
   * Create data sharing agreement with third party
   * Requires Band Council approval (OCAP® Control)
   */
  static async createSharingAgreement(params: {
    bandCouncilId: string;
    partnerName: string;
    partnerType: string;
    agreementTitle: string;
    agreementDescription: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataSharingScope: any;
    purposeLimitation: string;
    validFrom: Date;
    validUntil?: Date;
    approvedBy: string;
    bcrNumber?: string;
    agreementDocument?: string;
  }) {
    const [agreement] = await db
      .insert(indigenousDataSharingAgreements)
      .values({
        bandCouncilId: params.bandCouncilId,
        partnerName: params.partnerName,
        partnerType: params.partnerType,
        agreementTitle: params.agreementTitle,
        agreementDescription: params.agreementDescription,
        dataSharingScope: params.dataSharingScope,
        purposeLimitation: params.purposeLimitation,
        validFrom: params.validFrom,
        validUntil: params.validUntil,
        approvedBy: params.approvedBy,
        bcrNumber: params.bcrNumber,
        agreementDocument: params.agreementDocument,
        anonymizationRequired: true, // Default to true for safety
      })
      .returning();

    return agreement;
  }

  /**
   * Get active sharing agreements for Band Council
   */
  static async getActiveSharingAgreements(bandCouncilId: string) {
    const _now = new Date();
    return await db
      .select()
      .from(indigenousDataSharingAgreements)
      .where(
        and(
          eq(indigenousDataSharingAgreements.bandCouncilId, bandCouncilId),
          eq(indigenousDataSharingAgreements.status, "active")
        )
      );
  }

  /**
   * Register traditional knowledge with protection
   * Implements cultural sensitivity and access control
   */
  static async registerTraditionalKnowledge(params: {
    bandCouncilId: string;
    knowledgeType: string;
    knowledgeTitle: string;
    knowledgeDescription?: string;
    sensitivityLevel: "public" | "restricted" | "sacred";
    primaryKeeperUserId?: string;
    elderApprovalRequired?: boolean;
  }) {
    const [knowledge] = await db
      .insert(traditionalKnowledgeRegistry)
      .values({
        bandCouncilId: params.bandCouncilId,
        knowledgeType: params.knowledgeType,
        knowledgeTitle: params.knowledgeTitle,
        knowledgeDescription: params.knowledgeDescription,
        sensitivityLevel: params.sensitivityLevel,
        primaryKeeperUserId: params.primaryKeeperUserId,
        elderApprovalRequired: params.elderApprovalRequired || false,
        publicAccess: params.sensitivityLevel === "public",
        memberOnlyAccess: params.sensitivityLevel !== "public",
      })
      .returning();

    return knowledge;
  }

  /**
   * Validate if data operation complies with OCAP® principles
   */
  static async validateOCAPCompliance(params: {
    userId: string;
    operationType: string;
    requestedBy: string;
    purpose: string;
  }): Promise<{
    compliant: boolean;
    violations: string[];
    recommendations: string[];
  }> {
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check Ownership: Is user Indigenous?
    const [member] = await db
      .select()
      .from(indigenousMemberData)
      .where(eq(indigenousMemberData.userId, params.userId))
      .limit(1);

    if (!member) {
      violations.push("OCAP® Ownership: Member not registered as Indigenous");
      recommendations.push("Register member with Indigenous status and Band Council affiliation");
      return { compliant: false, violations, recommendations };
    }

    // Check Control: Does Band Council have consent?
    if (member.dataControlPreference === "band_council" && member.bandCouncilId) {
      const hasConsent = await this.hasBandCouncilConsent(
        member.bandCouncilId,
        `member_data_${params.operationType}`
      );

      if (!hasConsent) {
        violations.push("OCAP® Control: Band Council consent not obtained");
        recommendations.push(
          "Obtain Band Council Resolution (BCR) authorizing this data operation"
        );
      }
    }

    // Check Access: Is requestor authorized?
    const accessAuth = await this.isAccessAuthorized(
      params.userId,
      params.operationType,
      params.requestedBy
    );

    if (!accessAuth.authorized) {
      violations.push(`OCAP® Access: ${accessAuth.reason}`);
      recommendations.push("Obtain explicit consent from member or Band Council");
    }

    // Check Possession: Is data stored in preferred location?
    const preferredLocation = await this.getStorageLocation(params.userId);
    if (member.onReserveDataOnly && !preferredLocation) {
      violations.push("OCAP® Possession: On-reserve storage required but not configured");
      recommendations.push("Configure on-reserve data storage location for Band Council");
    }

    return {
      compliant: violations.length === 0,
      violations,
      recommendations,
    };
  }
}
