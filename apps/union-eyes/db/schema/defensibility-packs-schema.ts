import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { claims } from "./claims-schema";

/**
 * Defensibility Packs - System of Record Exports
 * 
 * PR-12: Complete Defensibility Pack Integration
 * 
 * Purpose: Store immutable, cryptographically-verified exports of case records
 * for arbitration proceedings, legal defense, and institutional accountability.
 * 
 * Philosophy: "If it's not in UnionEyes, it didn't happen"
 */

export const defensibilityPacks = pgTable("defensibility_packs", {
  packId: uuid("pack_id").primaryKey().defaultRandom(),
  
  // Case association
  caseId: uuid("case_id").notNull().references(() => claims.claimId),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  organizationId: uuid("organization_id").notNull(),
  
  // Pack metadata
  packVersion: varchar("pack_version", { length: 10 }).notNull().default("1.0.0"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  generatedBy: varchar("generated_by", { length: 255 }).notNull(),
  
  // Export details
  exportFormat: varchar("export_format", { length: 10 }).notNull(), // 'json' | 'pdf' | 'zip'
  exportPurpose: varchar("export_purpose", { length: 50 }).notNull(), // 'arbitration' | 'legal_defense' | 'audit' | 'member_request'
  requestedBy: varchar("requested_by", { length: 255 }), // User who requested export (if manual)
  
  // Pack content (stored as JSONB for queryability)
  packData: jsonb("pack_data").notNull(), // Full DefensibilityPack structure
  
  // Integrity verification
  integrityHash: varchar("integrity_hash", { length: 64 }).notNull(), // SHA-256 combined hash
  timelineHash: varchar("timeline_hash", { length: 64 }).notNull(),
  auditHash: varchar("audit_hash", { length: 64 }).notNull(),
  stateTransitionHash: varchar("state_transition_hash", { length: 64 }).notNull(),
  
  // Verification status
  verificationStatus: varchar("verification_status", { length: 20 }).notNull().default("verified"), // 'verified' | 'tampered' | 'unverified'
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  verificationAttempts: integer("verification_attempts").default(0),
  
  // Download tracking
  downloadCount: integer("download_count").default(0),
  lastDownloadedAt: timestamp("last_downloaded_at", { withTimezone: true }),
  lastDownloadedBy: varchar("last_downloaded_by", { length: 255 }),
  
  // Storage metadata
  fileSizeBytes: integer("file_size_bytes"),
  storageLocation: text("storage_location"), // For future cloud storage integration
  
  // Soft delete (packs should never be truly deleted - institutional dependency)
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: varchar("deleted_by", { length: 255 }),
  deletionReason: text("deletion_reason"),
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Pack Download Log - Track every access for audit trail
 */
export const packDownloadLog = pgTable("pack_download_log", {
  logId: uuid("log_id").primaryKey().defaultRandom(),
  
  packId: uuid("pack_id").notNull().references(() => defensibilityPacks.packId),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  organizationId: uuid("organization_id").notNull(),
  
  // Download details
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull().defaultNow(),
  downloadedBy: varchar("downloaded_by", { length: 255 }).notNull(),
  downloadedByRole: varchar("downloaded_by_role", { length: 50 }), // 'admin' | 'steward' | 'member'
  
  // Access context
  downloadPurpose: varchar("download_purpose", { length: 100 }), // 'review' | 'arbitration' | 'legal' | 'member_request'
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
  userAgent: text("user_agent"),
  
  // File details at time of download
  exportFormat: varchar("export_format", { length: 10 }).notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  integrityVerified: boolean("integrity_verified").default(true),
  
  // Download success
  downloadSuccess: boolean("download_success").default(true),
  errorMessage: text("error_message"),
});

/**
 * Pack Verification Log - Track integrity checks
 */
export const packVerificationLog = pgTable("pack_verification_log", {
  verificationId: uuid("verification_id").primaryKey().defaultRandom(),
  
  packId: uuid("pack_id").notNull(),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  
  // Verification details
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedBy: varchar("verified_by", { length: 255 }), // User or 'system' for auto-checks
  
  // Verification results
  verificationPassed: boolean("verification_passed").notNull(),
  expectedHash: varchar("expected_hash", { length: 64 }).notNull(),
  actualHash: varchar("actual_hash", { length: 64 }),
  
  // Failure details
  failureReason: text("failure_reason"),
  tamperedFields: jsonb("tampered_fields"), // Array of field paths that failed verification
  
  // Context
  verificationTrigger: varchar("verification_trigger", { length: 50 }), // 'download' | 'scheduled' | 'manual' | 'alert'
});

// Indexes for query performance
export const packIndexes = {
  caseIdIdx: sql`CREATE INDEX IF NOT EXISTS idx_defensibility_packs_case_id ON defensibility_packs(case_id)`,
  caseNumberIdx: sql`CREATE INDEX IF NOT EXISTS idx_defensibility_packs_case_number ON defensibility_packs(case_number)`,
  orgIdIdx: sql`CREATE INDEX IF NOT EXISTS idx_defensibility_packs_org_id ON defensibility_packs(organization_id)`,
  generatedAtIdx: sql`CREATE INDEX IF NOT EXISTS idx_defensibility_packs_generated_at ON defensibility_packs(generated_at DESC)`,
  integrityHashIdx: sql`CREATE INDEX IF NOT EXISTS idx_defensibility_packs_integrity_hash ON defensibility_packs(integrity_hash)`,
  
  // Download log indexes
  downloadPackIdIdx: sql`CREATE INDEX IF NOT EXISTS idx_pack_download_log_pack_id ON pack_download_log(pack_id)`,
  downloadCaseNumberIdx: sql`CREATE INDEX IF NOT EXISTS idx_pack_download_log_case_number ON pack_download_log(case_number)`,
  downloadedAtIdx: sql`CREATE INDEX IF NOT EXISTS idx_pack_download_log_downloaded_at ON pack_download_log(downloaded_at DESC)`,
  
  // Verification log indexes
  verificationPackIdIdx: sql`CREATE INDEX IF NOT EXISTS idx_pack_verification_log_pack_id ON pack_verification_log(pack_id)`,
  verificationPassedIdx: sql`CREATE INDEX IF NOT EXISTS idx_pack_verification_log_passed ON pack_verification_log(verification_passed)`,
};

