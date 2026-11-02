// Labour Market Benefits Plan (LMBP) Immigration System Schema
// Canada Federal Immigration: Foreign worker compliance tracking
// Global Skills Strategy (GSS) 2-week processing, LMBP letter generation, skills transfer mentorship

import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, decimal, varchar } from "drizzle-orm/pg-core";

/**
 * Foreign Workers Table
 * Tracks foreign workers hired under Labour Market Impact Assessment (LMIA) or Global Skills Strategy (GSS)
 */
export const foreignWorkers = pgTable("foreign_workers", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Worker identification
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").unique(),
  phoneNumber: text("phone_number"),
  
  // Immigration details
  workPermitNumber: text("work_permit_number").unique().notNull(),
  workPermitExpiry: timestamp("work_permit_expiry").notNull(),
  countryOfOrigin: text("country_of_origin").notNull(),
  
  // Employment details
  employerId: uuid("employer_id").notNull(), // Foreign key to profiles/companies
  positionTitle: text("position_title").notNull(),
  nocCode: text("noc_code").notNull(), // National Occupational Classification code
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"), // Contract end date (if fixed-term)
  
  // LMIA/GSS pathway
  immigrationPathway: text("immigration_pathway").notNull(), // 'LMIA' | 'GSS' | 'IMP' (International Mobility Program)
  lmiaNumber: text("lmia_number"), // Labour Market Impact Assessment number (if applicable)
  gssCategory: text("gss_category"), // 'A' (unique/specialized talent) or 'B' (short-duration work)
  
  // LMBP requirements
  requiresLMBP: boolean("requires_lmbp").default(false), // Large employers (>10 workers) must provide LMBP
  lmbpLetterGenerated: boolean("lmbp_letter_generated").default(false),
  lmbpLetterDate: timestamp("lmbp_letter_date"),
  
  // Skills transfer tracking (LMBP requirement)
  skillsTransferPlan: jsonb("skills_transfer_plan"), // JSON: { mentorId, goals: [], timeline: '' }
  mentorshipStartDate: timestamp("mentorship_start_date"),
  mentorshipEndDate: timestamp("mentorship_end_date"),
  
  // Compliance status
  complianceStatus: text("compliance_status").notNull().default("pending"), // 'pending' | 'compliant' | 'at_risk' | 'non_compliant'
  lastComplianceCheck: timestamp("last_compliance_check"),
  complianceNotes: text("compliance_notes"),
  
  // Audit trail
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by", { length: 255 }), // Admin/HR user who created the record
});

/**
 * LMBP Letters Table
 * Labour Market Benefits Plan letters generated for employers
 * Required for employers hiring 10+ foreign workers in a 12-month period
 */
export const lmbpLetters = pgTable("lmbp_letters", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Employer details
  employerId: uuid("employer_id").notNull(),
  employerName: text("employer_name").notNull(),
  
  // Letter details
  letterNumber: text("letter_number").unique().notNull(), // e.g., 'LMBP-2026-001234'
  generatedDate: timestamp("generated_date").notNull(),
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(), // Typically 2 years
  
  // LMBP commitments (required by IRCC)
  commitments: jsonb("commitments").notNull(), // JSON array of commitments
  // Example: [
  //   { type: 'skills_transfer', description: 'Pair each foreign worker with Canadian mentor', kpi: '100% mentorship completion' },
  //   { type: 'hiring', description: 'Recruit and train 5 Canadian workers', kpi: '5 hires by 2027-12-31' },
  //   { type: 'investment', description: 'Invest $50,000 in training infrastructure', kpi: 'Training lab by 2027-06-30' }
  // ]
  
  // Associated foreign workers
  foreignWorkerIds: jsonb("foreign_worker_ids").notNull(), // Array of foreign worker UUIDs
  
  // Compliance tracking
  complianceReportDue: timestamp("compliance_report_due"), // Annual report due date
  lastComplianceReport: timestamp("last_compliance_report"),
  complianceStatus: text("compliance_status").default("active"), // 'active' | 'under_review' | 'non_compliant' | 'expired'
  
  // Document storage
  letterPdfUrl: text("letter_pdf_url"), // S3/Azure Blob URL
  letterPdfHash: text("letter_pdf_hash"), // SHA-256 hash for tamper detection
  
  // Audit trail
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by", { length: 255 }),
});

/**
 * GSS Applications Table
 * Global Skills Strategy 2-week processing applications
 * Canada promises 2-week turnaround for GSS Category A/B applications
 */
export const gssApplications = pgTable("gss_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Foreign worker reference
  foreignWorkerId: uuid("foreign_worker_id").notNull(),
  
  // Application details
  applicationNumber: text("application_number").unique().notNull(), // IRCC application number
  submissionDate: timestamp("submission_date").notNull(),
  gssCategory: text("gss_category").notNull(), // 'A' (unique talent) | 'B' (short-duration)
  
  // GSS Category A: Unique and specialized talent
  // - Top researchers, entrepreneurs, tech leads
  // GSS Category B: Short-duration work (<30 days) or intra-company transfers
  
  // Processing timeline (2-week commitment)
  expectedDecisionDate: timestamp("expected_decision_date").notNull(), // submission + 10 business days
  actualDecisionDate: timestamp("actual_decision_date"),
  processingDays: integer("processing_days"), // Actual business days taken
  met2WeekTarget: boolean("met2_week_target"), // Did IRCC meet 2-week commitment? (the Django compliance model names it met2_week_target)
  
  // Application outcome
  status: text("status").notNull().default("submitted"), // 'submitted' | 'in_review' | 'approved' | 'denied' | 'withdrawn'
  decisionDetails: jsonb("decision_details"), // JSON: { outcome, reasons: [], conditions: [] }
  
  // Supporting documents
  documents: jsonb("documents"), // JSON array: [{ type: 'resume', url: '', uploadedAt: '' }, ...]
  
  // Employer details
  employerId: uuid("employer_id").notNull(),
  positionDetails: jsonb("position_details"), // JSON: { title, nocCode, salary, duties: [] }
  
  // Compliance flags
  complianceFlags: jsonb("compliance_flags"), // JSON: [{ type: 'missing_lmbp', severity: 'high', resolvedAt: null }, ...]
  
  // Audit trail
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by", { length: 255 }),
});

/**
 * Mentorship Programs Table
 * Skills transfer mentorship tracking (LMBP requirement)
 * Each foreign worker paired with Canadian mentor to transfer knowledge
 */
export const mentorships = pgTable("mentorships", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Mentee (foreign worker)
  menteeId: uuid("mentee_id").notNull(), // Foreign worker ID
  menteeName: text("mentee_name").notNull(),
  
  // Mentor (Canadian worker)
  mentorId: uuid("mentor_id").notNull(), // Canadian employee/member ID
  mentorName: text("mentor_name").notNull(),
  
  // Mentorship details
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"), // Planned end date
  actualEndDate: timestamp("actual_end_date"),
  
  // Skills transfer goals (LMBP requirement)
  skillsToTransfer: jsonb("skills_to_transfer").notNull(), // JSON: ['Python programming', 'Database optimization', 'Team leadership']
  learningObjectives: jsonb("learning_objectives"), // JSON: [{ objective: 'Master PostgreSQL', deadline: '2027-06-30', status: 'in_progress' }]
  
  // Progress tracking
  meetingFrequency: text("meeting_frequency"), // 'weekly' | 'bi-weekly' | 'monthly'
  totalMeetings: integer("total_meetings").default(0),
  lastMeetingDate: timestamp("last_meeting_date"),
  
  // KPIs (LMBP compliance)
  completionPercentage: integer("completion_percentage").default(0), // 0-100
  canadianWorkerTrained: boolean("canadian_worker_trained").default(false), // Did mentor upskill?
  knowledgeTransferDocumented: boolean("knowledge_transfer_documented").default(false), // Documentation created?
  
  // Status
  status: text("status").notNull().default("active"), // 'active' | 'completed' | 'on_hold' | 'terminated'
  statusReason: text("status_reason"),
  
  // Employer reference
  employerId: uuid("employer_id").notNull(),
  
  // Audit trail
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * LMBP Compliance Alerts Table
 * Automated alerts for LMBP/GSS compliance issues
 */
export const lmbpComplianceAlerts = pgTable("lmbp_compliance_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Alert type
  alertType: text("alert_type").notNull(), // 'work_permit_expiry' | 'lmbp_letter_missing' | 'mentorship_incomplete' | 'gss_delay' | 'compliance_report_due'
  severity: text("severity").notNull(), // 'low' | 'medium' | 'high' | 'critical'
  
  // Associated orgs
  foreignWorkerId: uuid("foreign_worker_id"),
  employerId: uuid("employer_id"),
  lmbpLetterId: uuid("lmbp_letter_id"),
  gssApplicationId: uuid("gss_application_id"),
  mentorshipId: uuid("mentorship_id"),
  
  // Alert details
  title: text("title").notNull(),
  description: text("description").notNull(),
  recommendedAction: text("recommended_action"),
  
  // Alert timing
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
  dueDate: timestamp("due_date"), // When action must be taken
  resolvedAt: timestamp("resolved_at"),
  
  // Alert status
  status: text("status").notNull().default("open"), // 'open' | 'in_progress' | 'resolved' | 'dismissed'
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by", { length: 255 }), // Admin user who resolved
  
  // Notification tracking
  emailSent: boolean("email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  dashboardNotified: boolean("dashboard_notified").default(false),
  
  // Audit trail
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * LMBP Compliance Reports Table
 * Annual compliance reports submitted to IRCC
 * Employers must report on LMBP commitment progress
 */
export const lmbpComplianceReports = pgTable("lmbp_compliance_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Report details
  lmbpLetterId: uuid("lmbp_letter_id").notNull(),
  employerId: uuid("employer_id").notNull(),
  reportingPeriodStart: timestamp("reporting_period_start").notNull(),
  reportingPeriodEnd: timestamp("reporting_period_end").notNull(),
  
  // Submission details
  submittedToIRCC: boolean("submitted_to_ircc").default(false),
  submissionDate: timestamp("submission_date"),
  irccConfirmationNumber: text("ircc_confirmation_number"),
  
  // Commitment progress
  commitmentProgress: jsonb("commitment_progress").notNull(), // JSON: [{ commitmentId, status: 'completed|in_progress|not_started', evidence: '' }]
  
  // Metrics
  totalForeignWorkers: integer("total_foreign_workers").notNull(),
  totalMentorships: integer("total_mentorships").notNull(),
  mentorshipsCompleted: integer("mentorships_completed").notNull(),
  canadianWorkersHired: integer("canadian_workers_hired").notNull(),
  trainingInvestment: decimal("training_investment", { precision: 10, scale: 2 }), // CAD spent on training
  
  // Compliance outcome
  complianceRating: text("compliance_rating"), // 'excellent' | 'satisfactory' | 'needs_improvement' | 'non_compliant'
  irccFeedback: text("ircc_feedback"),
  correctiveActionsRequired: jsonb("corrective_actions_required"), // JSON: [{ action, deadline, status }]
  
  // Document storage
  reportPdfUrl: text("report_pdf_url"),
  supportingDocumentsUrls: jsonb("supporting_documents_urls"), // JSON: ['url1', 'url2']
  
  // Audit trail
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by", { length: 255 }),
});

// Type exports for TypeScript
export type ForeignWorker = typeof foreignWorkers.$inferSelect;
export type NewForeignWorker = typeof foreignWorkers.$inferInsert;

export type LMBPLetter = typeof lmbpLetters.$inferSelect;
export type NewLMBPLetter = typeof lmbpLetters.$inferInsert;

export type GSSApplication = typeof gssApplications.$inferSelect;
export type NewGSSApplication = typeof gssApplications.$inferInsert;

export type Mentorship = typeof mentorships.$inferSelect;
export type NewMentorship = typeof mentorships.$inferInsert;

export type LMBPComplianceAlert = typeof lmbpComplianceAlerts.$inferSelect;
export type NewLMBPComplianceAlert = typeof lmbpComplianceAlerts.$inferInsert;

export type LMBPComplianceReport = typeof lmbpComplianceReports.$inferSelect;
export type NewLMBPComplianceReport = typeof lmbpComplianceReports.$inferInsert;

