import { pgTable, uuid, text, timestamp, varchar, jsonb, boolean, integer } from "drizzle-orm/pg-core";

/**
 * Force Majeure & Disaster Recovery Schema
 * Swiss Cold Storage + Break-Glass Emergency Access
 * Implements Shamir's Secret Sharing for multi-signature recovery
 */

// Swiss cold storage configuration
export const swissColdStorage = pgTable("swiss_cold_storage", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Vault details
  vaultProvider: varchar("vault_provider", { length: 100 }).notNull(), // "Malca-Amit", "Loomis", etc.
  vaultLocation: text("vault_location").notNull(), // Physical address in Switzerland
  vaultAccountNumber: varchar("vault_account_number", { length: 100 }),
  
  // Storage details
  storageType: varchar("storage_type", { length: 50 }).notNull(), // "encrypted_backup", "master_keys", "signing_keys"
  dataCategory: varchar("data_category", { length: 50 }).notNull(), // "database_backup", "encryption_keys", "signing_certificates"
  lastUpdated: timestamp("last_updated").notNull(),
  
  // Encryption
  encryptionAlgorithm: varchar("encryption_algorithm", { length: 50 }).notNull().default("AES-256-GCM"),
  encryptedBy: varchar("encrypted_by", { length: 255 }).notNull(),
  
  // Access control
  accessRequiresMultiSig: boolean("access_requires_multi_sig").notNull().default(true),
  minimumSignatures: integer("minimum_signatures").notNull().default(3), // 3-of-5
  totalKeyHolders: integer("total_key_holders").notNull().default(5),
  
  // Audit
  lastAccessedAt: timestamp("last_accessed_at"),
  lastAccessedBy: varchar("last_accessed_by", { length: 255 }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Break-glass emergency system
export const breakGlassSystem = pgTable("break_glass_system", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Emergency scenario
  scenarioType: varchar("scenario_type", { length: 50 }).notNull(), // "total_system_failure", "ransomware", "key_compromise", "data_center_loss"
  scenarioDescription: text("scenario_description").notNull(),
  
  // Recovery plan
  recoveryPlanDocument: text("recovery_plan_document"), // S3/Azure Blob URL
  estimatedRecoveryTime: varchar("estimated_recovery_time", { length: 50 }).notNull(), // "48 hours", "72 hours"
  
  // Shamir's Secret Sharing configuration
  shamirThreshold: integer("shamir_threshold").notNull().default(3), // Need 3 of 5 keys
  shamirTotalShares: integer("shamir_total_shares").notNull().default(5),
  
  // Key holders (Board members, trusted officers)
  keyHolderId1: varchar("key_holder_id_1", { length: 255 }),
  keyHolderId2: varchar("key_holder_id_2", { length: 255 }),
  keyHolderId3: varchar("key_holder_id_3", { length: 255 }),
  keyHolderId4: varchar("key_holder_id_4", { length: 255 }),
  keyHolderId5: varchar("key_holder_id_5", { length: 255 }),
  
  // Emergency contacts
  emergencyContact1Name: text("emergency_contact_1_name"),
  emergencyContact1Phone: varchar("emergency_contact_1_phone", { length: 20 }),
  emergencyContact1Email: varchar("emergency_contact_1_email", { length: 255 }),
  
  emergencyContact2Name: text("emergency_contact_2_name"),
  emergencyContact2Phone: varchar("emergency_contact_2_phone", { length: 20 }),
  emergencyContact2Email: varchar("emergency_contact_2_email", { length: 255 }),
  
  // Testing
  lastTestedAt: timestamp("last_tested_at"),
  testingFrequency: varchar("testing_frequency", { length: 50 }).notNull().default("quarterly"), // "monthly", "quarterly", "biannual"
  nextTestDue: timestamp("next_test_due").notNull(),
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default("active"), // "active", "testing", "activated"
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Disaster recovery drills
export const disasterRecoveryDrills = pgTable("disaster_recovery_drills", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Drill details
  drillName: text("drill_name").notNull(),
  drillType: varchar("drill_type", { length: 50 }).notNull(), // "tabletop_exercise", "simulation", "full_test", "surprise_drill"
  scenarioType: varchar("scenario_type", { length: 50 }).notNull(), // Same as break_glass_system.scenarioType
  
  // Schedule
  scheduledDate: timestamp("scheduled_date").notNull(),
  actualStartTime: timestamp("actual_start_time"),
  actualEndTime: timestamp("actual_end_time"),
  duration: varchar("duration", { length: 50 }), // "2h 15m"
  
  // Participants
  participants: jsonb("participants").notNull(), // Array of user IDs
  participantCount: integer("participant_count").notNull(),
  
  // Objectives
  objectives: jsonb("objectives").notNull(), // ["Test Swiss cold storage access", "Validate multi-sig", etc.]
  objectivesMet: jsonb("objectives_met"), // Which objectives were achieved
  
  // Results
  status: varchar("status", { length: 20 }).notNull().default("scheduled"), // "scheduled", "in_progress", "completed", "failed"
  overallScore: integer("overall_score"), // 0-100
  
  // Performance metrics
  targetRecoveryTime: varchar("target_recovery_time", { length: 50 }).notNull(), // "48 hours"
  actualRecoveryTime: varchar("actual_recovery_time", { length: 50 }),
  recoveryTimeObjectiveMet: boolean("recovery_time_objective_met").notNull().default(false),
  
  // Issues identified
  issuesIdentified: jsonb("issues_identified"), // Problems found during drill
  remediationActions: jsonb("remediation_actions"), // Actions to fix issues
  remediationDeadline: timestamp("remediation_deadline"),
  
  // Documentation
  drillReportUrl: text("drill_report_url"),
  videoRecordingUrl: text("video_recording_url"),
  
  // Audit
  conductedBy: varchar("conducted_by", { length: 255 }).notNull(),
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: timestamp("approved_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Key holder registry (for Shamir's Secret Sharing)
export const keyHolderRegistry = pgTable("key_holder_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  
  // Key holder details
  role: varchar("role", { length: 50 }).notNull(), // "board_chair", "secretary_treasurer", "president", "vp", "trustee"
  keyHolderNumber: integer("key_holder_number").notNull(), // 1-5
  
  // Shamir share (encrypted)
  shamirShareEncrypted: text("shamir_share_encrypted").notNull(), // Encrypted with user's public key
  shamirShareFingerprint: varchar("shamir_share_fingerprint", { length: 64 }).notNull(), // SHA-256 hash
  
  // Key custody
  keyIssuedAt: timestamp("key_issued_at").notNull(),
  keyExpiresAt: timestamp("key_expires_at"),
  keyRotationDue: timestamp("key_rotation_due").notNull(), // Annual rotation recommended
  
  // Training
  breakGlassTrainingCompleted: boolean("break_glass_training_completed").notNull().default(false),
  trainingCompletedAt: timestamp("training_completed_at"),
  trainingExpiresAt: timestamp("training_expires_at"), // Annual retraining
  
  // Availability
  emergencyPhone: varchar("emergency_phone", { length: 20 }).notNull(),
  emergencyEmail: varchar("emergency_email", { length: 255 }).notNull(),
  backupContactName: text("backup_contact_name"),
  backupContactPhone: varchar("backup_contact_phone", { length: 20 }),
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default("active"), // "active", "suspended", "expired"
  
  // Audit
  lastVerifiedAt: timestamp("last_verified_at"),
  nextVerificationDue: timestamp("next_verification_due").notNull(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Recovery time objectives (RTO) tracking
export const recoveryTimeObjectives = pgTable("recovery_time_objectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // System component
  systemComponent: varchar("system_component", { length: 100 }).notNull(), // "database", "application_servers", "authentication", etc.
  componentDescription: text("component_description"),
  
  // RTO/RPO
  rtoHours: integer("rto_hours").notNull(), // Recovery Time Objective (hours)
  rpoHours: integer("rpo_hours").notNull(), // Recovery Point Objective (hours) - acceptable data loss
  
  // Dependencies
  dependsOn: jsonb("depends_on"), // Other components this depends on
  criticalityLevel: varchar("criticality_level", { length: 20 }).notNull(), // "critical", "high", "medium", "low"
  
  // Last test
  lastTestedAt: timestamp("last_tested_at"),
  lastTestResult: varchar("last_test_result", { length: 20 }), // "passed", "failed", "partial"
  actualRecoveryTime: integer("actual_recovery_time"), // Actual time in last test (hours)
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Emergency declarations (used by break-glass service)
export const emergencyDeclarations = pgTable("emergency_declarations", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Emergency classification
  emergencyType: varchar("emergency_type", { length: 50 }).notNull(), // "strike", "lockout", "cyberattack", "natural_disaster", "government_seizure", "infrastructure_failure"
  severityLevel: varchar("severity_level", { length: 20 }).notNull().default("medium"), // "low", "medium", "high", "critical"
  
  // Declaration
  declaredByUserId: varchar("declared_by_user_id", { length: 255 }).notNull(),
  declaredAt: timestamp("declared_at").notNull(),
  notes: text("notes"),
  
  // Impact
  affectedLocations: jsonb("affected_locations"), // Array of location names
  affectedMemberCount: integer("affected_member_count").default(0),
  
  // Resolution
  resolvedAt: timestamp("resolved_at"),
  status: varchar("status", { length: 20 }).notNull().default("active"), // "active", "resolved"
  
  // Break-glass activation
  notificationSent: boolean("notification_sent").notNull().default(false),
  breakGlassActivated: boolean("break_glass_activated").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Break-glass activations (Shamir's Secret Sharing records)
export const breakGlassActivations = pgTable("break_glass_activations", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Emergency reference
  emergencyId: uuid("emergency_id").notNull().references(() => emergencyDeclarations.id),
  
  // Activation details
  activationInitiatedAt: timestamp("activation_initiated_at").notNull(),
  activationApprovedAt: timestamp("activation_approved_at"),
  activationReason: text("activation_reason").notNull(),
  
  // Key holders' approvals (3 of 5 required)
  keyHolderIds: jsonb("key_holder_ids"), // Array of key holder user IDs who approved
  secretShares: jsonb("secret_shares"), // Array of encrypted secret shares
  requiredSignatures: integer("required_signatures").notNull().default(3),
  signaturesReceived: integer("signatures_received").notNull().default(0),
  
  // Signature tracking (the Django compliance model names the first column signature1_user_id, so the series follows it)
  signature1UserId: varchar("signature1_user_id", { length: 255 }),
  signature1Timestamp: timestamp("signature1_timestamp"),
  signature1IpAddress: varchar("signature1_ip_address", { length: 45 }),
  
  signature2UserId: varchar("signature2_user_id", { length: 255 }),
  signature2Timestamp: timestamp("signature2_timestamp"),
  signature2IpAddress: varchar("signature2_ip_address", { length: 45 }),
  
  signature3UserId: varchar("signature3_user_id", { length: 255 }),
  signature3Timestamp: timestamp("signature3_timestamp"),
  signature3IpAddress: varchar("signature3_ip_address", { length: 45 }),
  
  // Recovery log
  recoveryActionsLog: jsonb("recovery_actions_log"), // Detailed log of recovery steps
  swissColdStorageAccessed: boolean("swiss_cold_storage_accessed").notNull().default(false),
  coldStorageAccessedAt: timestamp("cold_storage_accessed_at"),
  
  // Post-activation
  incidentReportUrl: text("incident_report_url"),
  lessonsLearnedUrl: text("lessons_learned_url"),
  systemUpdatesRequired: jsonb("system_updates_required"),
  
  // Audit
  auditedAt: timestamp("audited_at"),
  auditedBy: varchar("audited_by", { length: 255 }),
  auditReport: text("audit_report"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

