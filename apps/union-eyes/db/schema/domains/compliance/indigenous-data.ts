import { pgTable, uuid, text, timestamp, varchar, jsonb, boolean } from "drizzle-orm/pg-core";

/**
 * Indigenous Data Sovereignty Schema
 * Implements OCAP® (Ownership, Control, Access, Possession) principles
 * Supports First Nations, Métis, and Inuit data governance
 */

// Band Council registry and consent tracking
export const bandCouncils = pgTable("band_councils", {
  id: uuid("id").primaryKey().defaultRandom(),
  bandName: text("band_name").notNull(),
  bandNumber: varchar("band_number", { length: 10 }).notNull().unique(), // ISC Band Number
  province: varchar("province", { length: 2 }).notNull(),
  region: varchar("region", { length: 50 }).notNull(), // "Treaty 6", "Métis Nation of Alberta", etc.
  
  // Contact information
  chiefName: text("chief_name"),
  adminContactName: text("admin_contact_name"),
  adminContactEmail: varchar("admin_contact_email", { length: 255 }),
  adminContactPhone: varchar("admin_contact_phone", { length: 20 }),
  
  // On-reserve data storage location (OCAP® Possession requirement)
  onReserveStorageEnabled: boolean("on_reserve_storage_enabled").notNull().default(false),
  storageLocation: text("storage_location"), // Physical server location or cloud region
  
  // Data sovereignty preferences
  dataResidencyRequired: boolean("data_residency_required").notNull().default(true),
  thirdPartyAccessAllowed: boolean("third_party_access_allowed").notNull().default(false),
  aggregationAllowed: boolean("aggregation_allowed").notNull().default(false),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Band Council consent for specific data collection/use
export const bandCouncilConsent = pgTable("band_council_consent", {
  id: uuid("id").primaryKey().defaultRandom(),
  bandCouncilId: uuid("band_council_id").notNull(),
  consentType: varchar("consent_type", { length: 50 }).notNull(), // "member_data_collection", "health_data", "employment_data", etc.
  consentGiven: boolean("consent_given").notNull(),
  
  // Band Council Resolution (BCR) tracking
  bcrNumber: varchar("bcr_number", { length: 50 }), // Official BCR reference
  bcrDate: timestamp("bcr_date"),
  bcrDocument: text("bcr_document"), // S3/Azure Blob URL for signed BCR
  
  // Consent details
  purposeOfCollection: text("purpose_of_collection").notNull(),
  dataCategories: jsonb("data_categories").notNull(), // ["employment", "health", "education", etc.]
  intendedUse: text("intended_use").notNull(),
  
  // Consent limitations
  expiresAt: timestamp("expires_at"), // BCR may have expiry
  restrictedToMembers: boolean("restricted_to_members").notNull().default(true),
  anonymizationRequired: boolean("anonymization_required").notNull().default(false),
  
  // Revocation
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  
  approvedBy: varchar("approved_by", { length: 255 }).notNull(), // Band Council admin user
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Indigenous member cultural classification
export const indigenousMemberData = pgTable("indigenous_member_data", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  
  // Identity (OCAP® Ownership)
  indigenousStatus: varchar("indigenous_status", { length: 50 }).notNull(), // "Status Indian", "Non-Status", "Métis", "Inuit"
  bandCouncilId: uuid("band_council_id"), // NULL for Métis/Inuit
  treatyNumber: varchar("treaty_number", { length: 20 }), // e.g., "Treaty 6", "Treaty 7"
  
  // Cultural sensitivity classification
  culturalDataSensitivity: varchar("cultural_data_sensitivity", { length: 20 }).notNull().default("standard"), // "standard", "sensitive", "sacred"
  traditionalKnowledgeHolder: boolean("traditional_knowledge_holder").notNull().default(false),
  elderStatus: boolean("elder_status").notNull().default(false),
  
  // Data governance preferences (OCAP® Control)
  dataControlPreference: varchar("data_control_preference", { length: 50 }).notNull().default("band_council"), // "band_council", "individual", "shared"
  allowAggregation: boolean("allow_aggregation").notNull().default(false),
  allowThirdPartyAccess: boolean("allow_third_party_access").notNull().default(false),
  
  // On-reserve data routing (OCAP® Possession)
  onReserveDataOnly: boolean("on_reserve_data_only").notNull().default(false),
  preferredStorageLocation: text("preferred_storage_location"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Indigenous data access logs (OCAP® Access tracking)
export const indigenousDataAccessLog = pgTable("indigenous_data_access_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(), // Indigenous member whose data was accessed
  accessedBy: varchar("accessed_by", { length: 255 }).notNull(), // Who accessed the data
  bandCouncilId: uuid("band_council_id"),
  
  // Access details
  accessType: varchar("access_type", { length: 50 }).notNull(), // "view", "export", "aggregate", "share"
  accessPurpose: text("access_purpose").notNull(),
  dataCategories: jsonb("data_categories").notNull(),
  
  // Authorization
  authorizedBy: varchar("authorized_by", { length: 50 }).notNull(), // "individual_consent", "band_council_consent", "legal_obligation"
  authorizationReference: text("authorization_reference"), // BCR number, consent ID, etc.
  
  // Audit trail
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Indigenous data sharing agreements (inter-union or third-party)
export const indigenousDataSharingAgreements = pgTable("indigenous_data_sharing_agreements", {
  id: uuid("id").primaryKey().defaultRandom(),
  bandCouncilId: uuid("band_council_id").notNull(),
  
  // Sharing partner
  partnerName: text("partner_name").notNull(), // Other union, government agency, research institution
  partnerType: varchar("partner_type", { length: 50 }).notNull(), // "union", "government", "researcher", "service_provider"
  
  // Agreement details
  agreementTitle: text("agreement_title").notNull(),
  agreementDescription: text("agreement_description").notNull(),
  agreementDocument: text("agreement_document"), // S3/Azure Blob URL
  signedDate: timestamp("signed_date"),
  
  // Data sharing scope
  dataSharingScope: jsonb("data_sharing_scope").notNull(), // What data can be shared
  purposeLimitation: text("purpose_limitation").notNull(), // Specific purpose only
  anonymizationRequired: boolean("anonymization_required").notNull().default(true),
  
  // Terms
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until"),
  autoRenewal: boolean("auto_renewal").notNull().default(false),
  
  // Band Council approval
  approvedBy: varchar("approved_by", { length: 255 }).notNull(),
  bcrNumber: varchar("bcr_number", { length: 50 }),
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default("active"), // "active", "expired", "terminated"
  terminatedAt: timestamp("terminated_at"),
  terminationReason: text("termination_reason"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Traditional knowledge protection
export const traditionalKnowledgeRegistry = pgTable("traditional_knowledge_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  bandCouncilId: uuid("band_council_id").notNull(),
  
  // Knowledge classification
  knowledgeType: varchar("knowledge_type", { length: 50 }).notNull(), // "ceremony", "medicine", "craft", "oral_history", etc.
  knowledgeTitle: text("knowledge_title").notNull(),
  knowledgeDescription: text("knowledge_description"),
  
  // Cultural sensitivity
  sensitivityLevel: varchar("sensitivity_level", { length: 20 }).notNull(), // "public", "restricted", "sacred"
  genderRestricted: boolean("gender_restricted").notNull().default(false), // Some knowledge gender-specific
  ageRestricted: boolean("age_restricted").notNull().default(false),
  
  // Knowledge holders
  primaryKeeperUserId: varchar("primary_keeper_user_id", { length: 255 }),
  secondaryKeepers: jsonb("secondary_keepers"), // Array of user IDs
  
  // Access control
  publicAccess: boolean("public_access").notNull().default(false),
  memberOnlyAccess: boolean("member_only_access").notNull().default(true),
  elderApprovalRequired: boolean("elder_approval_required").notNull().default(false),
  
  // Documentation
  documentationUrl: text("documentation_url"),
  videoUrl: text("video_url"),
  audioUrl: text("audio_url"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

