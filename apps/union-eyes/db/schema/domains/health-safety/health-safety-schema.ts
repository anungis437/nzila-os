/**
 * Health & Safety Schema
 * 
 * Comprehensive workplace health and safety management system for union operations.
 * Handles incident tracking, safety inspections, hazard reports, PPE management,
 * safety committee operations, training records, audits, injury logs, policies,
 * corrective actions, and safety certifications.
 * 
 * Integration Points:
 * - Claims system (workplace_safety claim type)
 * - Education/Certifications (H&S rep certifications)
 * - Documents (incident photos, inspection reports, policy documents)
 * - Profiles (H&S representative assignments)
 * - Organizations (multi-organization support)
 * - Members (employee/member associations)
 * 
 * RLS: All tables have organization-level row-level security enabled
 * Indexes: Optimized for common query patterns (status, date ranges, organization)
 * 
 * @module health-safety-schema
 */

import { uniqueIndex,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  pgEnum,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Incident Severity Levels
 * Based on OSHA and Canadian CCOHS standards
 */
export const incidentSeverityEnum = pgEnum("incident_severity", [
  "near_miss",           // No injury occurred but could have
  "minor",               // First aid only, no lost time
  "moderate",            // Medical treatment required, limited lost time
  "serious",             // Significant injury, substantial lost time
  "critical",            // Life-threatening injury, permanent disability
  "fatal",               // Death occurred
]);

/**
 * Incident Type Classification
 */
export const incidentTypeEnum = pgEnum("incident_type", [
  "injury",              // Physical injury to worker
  "near_miss",           // Almost caused injury/damage
  "property_damage",     // Damage to equipment/property
  "environmental",       // Environmental spill/release
  "vehicle",             // Vehicle-related incident
  "ergonomic",           // Repetitive strain, ergonomic issue
  "exposure",            // Chemical, biological, radiation exposure
  "occupational_illness",// Work-related illness
  "fire",                // Fire-related incident
  "electrical",          // Electrical hazard/shock
  "fall",                // Slip, trip, fall from height
  "other",
]);

/**
 * Body Part Injured
 */
export const bodyPartEnum = pgEnum("body_part", [
  "head",
  "eyes",
  "face",
  "neck",
  "shoulder",
  "arm",
  "elbow",
  "wrist",
  "hand",
  "fingers",
  "chest",
  "back",
  "abdomen",
  "hip",
  "leg",
  "knee",
  "ankle",
  "foot",
  "toes",
  "multiple",
  "internal",
  "other",
]);

/**
 * Nature of Injury
 */
export const injuryNatureEnum = pgEnum("injury_nature", [
  "cut",
  "laceration",
  "puncture",
  "bruise",
  "contusion",
  "fracture",
  "sprain",
  "strain",
  "dislocation",
  "amputation",
  "burn",
  "chemical_burn",
  "concussion",
  "crushing",
  "electric_shock",
  "exposure",
  "hearing_loss",
  "infection",
  "inflammation",
  "poisoning",
  "respiratory",
  "multiple",
  "other",
]);

/**
 * Inspection Status
 */
export const inspectionStatusEnum = pgEnum("inspection_status", [
  "scheduled",
  "in_progress",
  "completed",
  "requires_followup",
  "followup_complete",
  "cancelled",
  "overdue",
]);

/**
 * Inspection Type
 */
export const inspectionTypeEnum = pgEnum("inspection_type", [
  "routine",             // Regular scheduled inspection
  "comprehensive",       // Detailed comprehensive inspection
  "targeted",            // Focused on specific area/hazard
  "post_incident",       // After an incident occurred
  "regulatory",          // Required by regulations
  "pre_operational",     // Before new equipment/process
  "contractor",          // Contractor work site inspection
  "joint_committee",     // Joint health & safety committee
  "other",
]);

/**
 * Hazard Level/Risk Rating
 */
export const hazardLevelEnum = pgEnum("hazard_level", [
  "low",                 // Minimal risk
  "moderate",            // Some risk, monitor
  "high",                // Significant risk, action needed
  "critical",            // Immediate danger, urgent action
  "extreme",             // Imminent threat to life/health
]);

/**
 * Hazard Category
 */
export const hazardCategoryEnum = pgEnum("hazard_category", [
  "biological",          // Viruses, bacteria, fungi, blood
  "chemical",            // Toxic substances, solvents
  "ergonomic",           // Repetitive motion, poor workstation
  "physical",            // Noise, radiation, temperature
  "psychosocial",        // Stress, violence, harassment
  "safety",              // Slips, trips, falls, machinery
  "environmental",       // Air quality, ventilation
  "electrical",          // Electrical hazards
  "fire",                // Fire hazards
  "confined_space",      // Confined space hazards
  "working_at_heights",  // Fall hazards
  "machinery",           // Machine guarding, lockout
  "other",
]);

/**
 * Corrective Action Status
 */
export const correctiveActionStatusEnum = pgEnum("corrective_action_status", [
  "open",                // Action identified, not started
  "assigned",            // Assigned to responsible party
  "in_progress",         // Work underway
  "pending_verification",// Action complete, awaiting verification
  "verified",            // Verified as complete
  "closed",              // Fully closed
  "deferred",            // Postponed to later date
  "cancelled",           // No longer required
]);

/**
 * Corrective Action Priority
 */
export const correctiveActionPriorityEnum = pgEnum("corrective_action_priority", [
  "immediate",           // Within 24 hours
  "urgent",              // Within 1 week
  "high",                // Within 1 month
  "normal",              // Within 3 months
  "low",                 // Can be scheduled as convenient
]);

/**
 * Audit Status
 */
export const auditStatusEnum = pgEnum("audit_status", [
  "planned",
  "scheduled",
  "in_progress",
  "report_draft",
  "under_review",
  "completed",
  "cancelled",
]);

/**
 * Audit Type
 */
export const auditTypeEnum = pgEnum("audit_type", [
  "internal",            // Internal audit
  "external",            // External regulatory audit
  "certification",       // ISO/certification audit
  "compliance",          // Compliance verification
  "management_system",   // Management system audit
  "contractor",          // Contractor safety audit
  "other",
]);

/**
 * Safety Training Status
 */
export const trainingStatusEnum = pgEnum("training_status", [
  "scheduled",
  "in_progress",
  "completed",
  "failed",
  "expired",
  "renewed",
  "cancelled",
]);

/**
 * PPE Type
 */
export const ppeTypeEnum = pgEnum("ppe_type", [
  "hard_hat",
  "safety_glasses",
  "face_shield",
  "hearing_protection",
  "respirator",
  "dust_mask",
  "safety_gloves",
  "chemical_gloves",
  "safety_boots",
  "high_vis_vest",
  "fall_protection",
  "welding_helmet",
  "protective_clothing",
  "coveralls",
  "apron",
  "other",
]);

/**
 * PPE Status
 */
export const ppeStatusEnum = pgEnum("ppe_status", [
  "in_stock",
  "issued",
  "in_use",
  "returned",
  "damaged",
  "expired",
  "disposed",
  "under_inspection",
]);

/**
 * Safety Certification Type
 */
export const safetyCertificationTypeEnum = pgEnum("safety_certification_type", [
  "health_safety_rep",           // H&S Committee Representative
  "first_aid",                   // First Aid/CPR
  "confined_space",              // Confined Space Entry
  "fall_protection",             // Fall Protection/Working at Heights
  "forklift",                    // Forklift Operation
  "whmis",                       // WHMIS (Workplace Hazardous Materials)
  "lockout_tagout",              // Lockout/Tagout
  "fire_safety",                 // Fire Safety/Fire Warden
  "emergency_response",          // Emergency Response Team
  "scaffolding",                 // Scaffolding Erection
  "crane_rigging",               // Crane/Rigging Operation
  "hazmat",                      // Hazardous Materials
  "radiation_safety",            // Radiation Safety
  "asbestos_awareness",          // Asbestos Awareness
  "silica_awareness",            // Silica Awareness
  "workplace_violence",          // Workplace Violence Prevention
  "accident_investigation",      // Accident Investigation
  "safety_auditor",              // Safety Auditor
  "ergonomics",                  // Ergonomics Assessment
  "occupational_hygiene",        // Occupational Hygiene
  "other",
]);

/**
 * Certification Status
 */
export const certificationStatusEnum = pgEnum("certification_status", [
  "active",
  "expired",
  "suspended",
  "revoked",
  "pending_renewal",
]);

/**
 * Meeting Type
 */
export const meetingTypeEnum = pgEnum("meeting_type", [
  "regular",             // Regular scheduled meeting
  "special",             // Special/emergency meeting
  "inspection",          // Inspection walkthrough meeting
  "incident_review",     // Post-incident review
  "training",            // Training session
  "other",
]);

// =============================================================================
// TABLES
// =============================================================================

/**
 * Workplace Incidents Table
 * 
 * Tracks all workplace incidents including injuries, near-misses, property damage,
 * and environmental incidents. Central table for incident management and reporting.
 * 
 * Links to claims for compensation tracking.
 * RLS: Users can only view incidents in their organization
 */
export const workplaceIncidents = pgTable("workplace_incidents", {
  // Primary Key
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization & References
  organizationId: uuid("organization_id").notNull(),
  incidentNumber: varchar("incident_number", { length: 50 }).notNull(),
  claimId: uuid("claim_id"), // Link to claims system
  
  // Incident Classification
  incidentType: incidentTypeEnum("incident_type").notNull(),
  severity: incidentSeverityEnum("severity").notNull(),
  
  // Incident Details
  incidentDate: timestamp("incident_date", { withTimezone: true }).notNull(),
  reportedDate: timestamp("reported_date", { withTimezone: true }).notNull(),
  locationDescription: text("location_description").notNull(),
  workplaceId: uuid("workplace_id"),
  workplaceName: varchar("workplace_name", { length: 255 }),
  departmentName: varchar("department_name", { length: 255 }),
  
  // Injured/Affected Person(s)
  injuredPersonId: uuid("injured_person_id"), // Link to profiles or members
  injuredPersonName: varchar("injured_person_name", { length: 255 }),
  injuredPersonJobTitle: varchar("injured_person_job_title", { length: 255 }),
  injuredPersonEmployeeId: varchar("injured_person_employee_id", { length: 100 }),
  
  // Injury Details (if applicable)
  bodyPartAffected: bodyPartEnum("body_part_affected"),
  injuryNature: injuryNatureEnum("injury_nature"),
  treatmentProvided: text("treatment_provided"),
  treatmentLocation: varchar("treatment_location", { length: 255 }),
  hospitalizedDays: integer("hospitalized_days"),
  lostTimeDays: integer("lost_time_days"),
  restrictedWorkDays: integer("restricted_work_days"),
  
  // Incident Description
  description: text("description").notNull(),
  whatHappened: text("what_happened"), // Detailed narrative
  taskBeingPerformed: text("task_being_performed"),
  equipmentInvolved: text("equipment_involved"),
  materialsInvolved: text("materials_involved"),
  
  // Environmental Conditions
  lightingCondition: varchar("lighting_condition", { length: 100 }),
  weatherCondition: varchar("weather_condition", { length: 100 }),
  temperatureCondition: varchar("temperature_condition", { length: 100 }),
  
  // Witnesses
  witnessesPresent: boolean("witnesses_present").default(false),
  witnessNames: jsonb("witness_names").$type<string[]>(), // Array of witness names
  witnessStatements: jsonb("witness_statements").$type<{ name: string; statement: string }[]>(),
  
  // Reporting & Investigation
  reportedById: uuid("reported_by_id"), // Profile of reporter
  reportedByName: varchar("reported_by_name", { length: 255 }),
  reportedByJobTitle: varchar("reported_by_job_title", { length: 255 }),
  isAnonymous: boolean("is_anonymous").default(false),
  supervisorNotifiedId: uuid("supervisor_notified_id"),
  supervisorNotifiedName: varchar("supervisor_notified_name", { length: 255 }),
  supervisorNotifiedDate: timestamp("supervisor_notified_date", { withTimezone: true }),
  
  investigationRequired: boolean("investigation_required").default(true),
  investigationStartDate: timestamp("investigation_start_date", { withTimezone: true }),
  investigationCompletedDate: timestamp("investigation_completed_date", { withTimezone: true }),
  investigatorId: uuid("investigator_id"),
  investigatorName: varchar("investigator_name", { length: 255 }),
  investigationReport: text("investigation_report"),
  rootCauseAnalysis: text("root_cause_analysis"),
  contributingFactors: jsonb("contributing_factors").$type<string[]>(),
  
  // Corrective Actions
  immediateActionsToken: text("immediate_actions_taken"),
  correctiveActionsRequired: boolean("corrective_actions_required").default(false),
  correctiveActionsSummary: text("corrective_actions_summary"),
  
  // Regulatory Reporting
  reportableToAuthority: boolean("reportable_to_authority").default(false),
  authorityNotified: boolean("authority_notified").default(false),
  authorityName: varchar("authority_name", { length: 255 }), // e.g., "WorkSafeBC", "WSIB Ontario"
  authorityReportNumber: varchar("authority_report_number", { length: 100 }),
  authorityReportDate: timestamp("authority_report_date", { withTimezone: true }),
  
  // WSIB/Workers Compensation
  wsibClaimNumber: varchar("wsib_claim_number", { length: 100 }),
  wsibClaimStatus: varchar("wsib_claim_status", { length: 50 }),
  wsibClaimAmount: numeric("wsib_claim_amount", { precision: 12, scale: 2 }),
  
  // Documents & Media
  documentIds: jsonb("document_ids").$type<string[]>(), // Array of document IDs
  photoUrls: jsonb("photo_urls").$type<string[]>(), // Photos of incident scene
  videoUrls: jsonb("video_urls").$type<string[]>(),
  
  // Status & Tracking
  status: varchar("status", { length: 50 }).notNull().default("reported"), // reported, investigating, closed
  closedDate: timestamp("closed_date", { withTimezone: true }),
  closureNotes: text("closure_notes"),
  
  // Prevention & Follow-up
  preventabilityAssessment: text("preventability_assessment"),
  lessonsLearned: text("lessons_learned"),
  trainingRecommended: boolean("training_recommended").default(false),
  trainingRecommendations: text("training_recommendations"),
  
  // Metadata
  metadata: jsonb("metadata"),
  tags: jsonb("tags").$type<string[]>(),
  
  // Audit Fields
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
}, (table) => ({
  // One number per organization, not one across all organizations (platform migration 0042).
  uqOrgIncidentNumber: uniqueIndex("uq_workplace_incidents_org_incident_number").on(table.organizationId, table.incidentNumber),
  // Indexes for performance
  idxIncidentsOrg: index("idx_incidents_org").on(table.organizationId),
  idxIncidentsDate: index("idx_incidents_date").on(table.incidentDate),
  idxIncidentsSeverity: index("idx_incidents_severity").on(table.severity),
  idxIncidentsStatus: index("idx_incidents_status").on(table.status),
  idxIncidentsType: index("idx_incidents_type").on(table.incidentType),
  idxIncidentsWorkplace: index("idx_incidents_workplace").on(table.workplaceId),
  idxIncidentsInjuredPerson: index("idx_incidents_injured_person").on(table.injuredPersonId),
  idxIncidentsClaim: index("idx_incidents_claim").on(table.claimId),
  // Composite index for reporting queries
  idxIncidentsOrgDate: index("idx_incidents_org_date").on(table.organizationId, table.incidentDate),
}));

/**
 * Safety Inspections Table
 * 
 * Records workplace safety audits and inspections conducted by safety committees,
 * supervisors, or external inspectors. Tracks findings and required follow-ups.
 * 
 * RLS: Users can only view inspections in their organization
 */
export const safetyInspections = pgTable("safety_inspections", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization & References
  organizationId: uuid("organization_id").notNull(),
  inspectionNumber: varchar("inspection_number", { length: 50 }).notNull(),
  
  // Classification
  inspectionType: inspectionTypeEnum("inspection_type").notNull(),
  status: inspectionStatusEnum("status").notNull().default("scheduled"),
  
  // Scheduling
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  startedDate: timestamp("started_date", { withTimezone: true }),
  completedDate: timestamp("completed_date", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  
  // Location
  workplaceId: uuid("workplace_id"),
  workplaceName: varchar("workplace_name", { length: 255 }),
  areasInspected: jsonb("areas_inspected").$type<string[]>(), // List of areas/departments
  specificLocation: text("specific_location"),
  
  // Inspection Team
  leadInspectorId: uuid("lead_inspector_id"),
  leadInspectorName: varchar("lead_inspector_name", { length: 255 }),
  inspectorIds: jsonb("inspector_ids").$type<string[]>(),
  inspectorNames: jsonb("inspector_names").$type<string[]>(),
  
  // Inspection Details
  inspectionScope: text("inspection_scope"),
  checklistUsed: varchar("checklist_used", { length: 255 }),
  checklistItems: jsonb("checklist_items").$type<{
    item: string;
    status: "pass" | "fail" | "na" | "requires_attention";
    notes?: string;
  }[]>(),
  
  // Findings
  totalItemsChecked: integer("total_items_checked"),
  itemsPassed: integer("items_passed"),
  itemsFailed: integer("items_failed"),
  itemsRequiringAttention: integer("items_requiring_attention"),
  
  hazardsIdentified: integer("hazards_identified").default(0),
  criticalHazards: integer("critical_hazards").default(0),
  
  // Inspection Results
  overallRating: varchar("overall_rating", { length: 50 }), // excellent, good, fair, poor
  scorePercentage: numeric("score_percentage", { precision: 5, scale: 2 }),
  
  findings: text("findings"),
  observations: text("observations"),
  positiveFindings: text("positive_findings"),
  areasOfConcern: text("areas_of_concern"),
  
  // Recommendations & Actions
  recommendations: text("recommendations"),
  immediateActionRequired: boolean("immediate_action_required").default(false),
  correctiveActionsRequired: boolean("corrective_actions_required").default(false),
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date", { withTimezone: true }),
  followUpCompleted: boolean("follow_up_completed").default(false),
  followUpNotes: text("follow_up_notes"),
  
  // Documents & Media
  documentIds: jsonb("document_ids").$type<string[]>(),
  photoUrls: jsonb("photo_urls").$type<string[]>(),
  reportUrl: text("report_url"),
  
  // Regulatory
  regulatoryRequirement: boolean("regulatory_requirement").default(false),
  regulatoryAgency: varchar("regulatory_agency", { length: 255 }),
  regulatoryReference: varchar("regulatory_reference", { length: 255 }),
  
  // Metadata
  metadata: jsonb("metadata"),
  tags: jsonb("tags").$type<string[]>(),
  notes: text("notes"),
  
  // Audit Fields
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
}, (table) => ({
  // One number per organization, not one across all organizations (platform migration 0042).
  uqOrgInspectionNumber: uniqueIndex("uq_safety_inspections_org_inspection_number").on(table.organizationId, table.inspectionNumber),
  idxInspectionsOrg: index("idx_inspections_org").on(table.organizationId),
  idxInspectionsStatus: index("idx_inspections_status").on(table.status),
  idxInspectionsDate: index("idx_inspections_date").on(table.scheduledDate),
  idxInspectionsType: index("idx_inspections_type").on(table.inspectionType),
  idxInspectionsWorkplace: index("idx_inspections_workplace").on(table.workplaceId),
  idxInspectionsFollowUp: index("idx_inspections_followup").on(table.followUpRequired, table.followUpCompleted),
}));

/**
 * Hazard Reports Table
 * 
 * Worker-reported hazards and unsafe conditions. Allows anyone to report
 * potential safety hazards for investigation and remediation.
 * 
 * RLS: Users can view reports in their organization
 */
export const hazardReports = pgTable("hazard_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization & References
  organizationId: uuid("organization_id").notNull(),
  reportNumber: varchar("report_number", { length: 50 }).notNull(),
  
  // Classification
  hazardCategory: hazardCategoryEnum("hazard_category").notNull(),
  hazardLevel: hazardLevelEnum("hazard_level").notNull(),
  
  // Report Details
  reportedDate: timestamp("reported_date", { withTimezone: true }).notNull().defaultNow(),
  hazardDate: timestamp("hazard_date", { withTimezone: true }), // When hazard was first observed
  
  // Location
  workplaceId: uuid("workplace_id"),
  workplaceName: varchar("workplace_name", { length: 255 }),
  department: varchar("department", { length: 255 }),
  specificLocation: text("specific_location").notNull(),
  
  // Reporter (can be anonymous)
  reportedById: uuid("reported_by_id"),
  reportedByName: varchar("reported_by_name", { length: 255 }),
  isAnonymous: boolean("is_anonymous").default(false),
  reporterContactInfo: varchar("reporter_contact_info", { length: 255 }),
  
  // Hazard Description
  hazardDescription: text("hazard_description").notNull(),
  whoIsAtRisk: text("who_is_at_risk"),
  potentialConsequences: text("potential_consequences"),
  existingControls: text("existing_controls"),
  suggestedCorrections: text("suggested_corrections"),
  
  // Assessment
  riskAssessmentCompleted: boolean("risk_assessment_completed").default(false),
  riskAssessmentDate: timestamp("risk_assessment_date", { withTimezone: true }),
  riskAssessorId: uuid("risk_assessor_id"),
  riskAssessorName: varchar("risk_assessor_name", { length: 255 }),
  
  // Risk Matrix Scores
  likelihoodScore: integer("likelihood_score"), // 1-5 scale
  severityScore: integer("severity_score"), // 1-5 scale
  riskScore: integer("risk_score"), // likelihood × severity
  
  // Status & Resolution
  status: varchar("status", { length: 50 }).notNull().default("reported"), // reported, assessed, assigned, resolved, closed
  assignedToId: uuid("assigned_to_id"),
  assignedToName: varchar("assigned_to_name", { length: 255 }),
  assignedDate: timestamp("assigned_date", { withTimezone: true }),
  
  resolutionDate: timestamp("resolution_date", { withTimezone: true }),
  resolutionDescription: text("resolution_description"),
  resolutionCost: numeric("resolution_cost", { precision: 12, scale: 2 }),
  
  verifiedById: uuid("verified_by_id"),
  verifiedByName: varchar("verified_by_name", { length: 255 }),
  verifiedDate: timestamp("verified_date", { withTimezone: true }),
  verificationNotes: text("verification_notes"),
  
  closedDate: timestamp("closed_date", { withTimezone: true }),
  
  // Corrective Actions
  correctiveActionRequired: boolean("corrective_action_required").default(true),
  correctiveActionIds: jsonb("corrective_action_ids").$type<string[]>(),
  
  // Documents & Media
  documentIds: jsonb("document_ids").$type<string[]>(),
  photoUrls: jsonb("photo_urls").$type<string[]>(),
  
  // Metadata
  metadata: jsonb("metadata"),
  tags: jsonb("tags").$type<string[]>(),
  notes: text("notes"),
  
  // Audit Fields
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
}, (table) => ({
  // One number per organization, not one across all organizations (platform migration 0042).
  uqOrgReportNumber: uniqueIndex("uq_hazard_reports_org_report_number").on(table.organizationId, table.reportNumber),
  idxHazardsOrg: index("idx_hazards_org").on(table.organizationId),
  idxHazardsStatus: index("idx_hazards_status").on(table.status),
  idxHazardsLevel: index("idx_hazards_level").on(table.hazardLevel),
  idxHazardsCategory: index("idx_hazards_category").on(table.hazardCategory),
  idxHazardsWorkplace: index("idx_hazards_workplace").on(table.workplaceId),
  idxHazardsDate: index("idx_hazards_date").on(table.reportedDate),
  idxHazardsRiskScore: index("idx_hazards_risk_score").on(table.riskScore),
}));

/**
 * Safety Training Records Table
 * 
 * Tracks completion of health & safety specific training programs.
 * Links to the main education/training system but specialized for safety.
 * 
 * RLS: Users can view training records in their organization
 */
export const safetyTrainingRecords = pgTable("safety_training_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization & References
  organizationId: uuid("organization_id").notNull(),
  recordNumber: varchar("record_number", { length: 50 }).unique().notNull(),
  
  // Training Course
  courseId: uuid("course_id"), // Link to training_courses if exists
  courseName: varchar("course_name", { length: 300 }).notNull(),
  courseCode: varchar("course_code", { length: 50 }),
  courseCategory: varchar("course_category", { length: 100 }),
  trainingProvider: varchar("training_provider", { length: 255 }),
  
  // Trainee
  traineeId: uuid("trainee_id").notNull(), // Link to profiles/members
  traineeName: varchar("trainee_name", { length: 255 }).notNull(),
  traineeEmployeeId: varchar("trainee_employee_id", { length: 100 }),
  traineeJobTitle: varchar("trainee_job_title", { length: 255 }),
  traineeDepartment: varchar("trainee_department", { length: 255 }),
  
  // Training Details
  trainingDate: date("training_date").notNull(),
  completionDate: date("completion_date"),
  expiryDate: date("expiry_date"),
  validityPeriod: integer("validity_period_months"), // How long certification is valid
  
  status: trainingStatusEnum("status").notNull().default("scheduled"),
  
  // Instructor
  instructorId: uuid("instructor_id"),
  instructorName: varchar("instructor_name", { length: 255 }),
  instructorCertification: varchar("instructor_certification", { length: 255 }),
  
  // Training Delivery
  deliveryMethod: varchar("delivery_method", { length: 50 }), // classroom, online, hands-on, hybrid
  trainingLocation: varchar("training_location", { length: 255 }),
  durationHours: numeric("duration_hours", { precision: 5, scale: 2 }),
  
  // Assessment
  assessmentRequired: boolean("assessment_required").default(false),
  assessmentScore: numeric("assessment_score", { precision: 5, scale: 2 }),
  passingScore: numeric("passing_score", { precision: 5, scale: 2 }),
  passed: boolean("passed"),
  
  // Certification
  certificateIssued: boolean("certificate_issued").default(false),
  certificateNumber: varchar("certificate_number", { length: 100 }),
  certificateUrl: text("certificate_url"),
  
  // Regulatory Compliance
  regulatoryRequirement: boolean("regulatory_requirement").default(false),
  regulatoryBody: varchar("regulatory_body", { length: 255 }),
  complianceReference: varchar("compliance_reference", { length: 255 }),
  isMandatory: boolean("is_mandatory").default(false),
  
  // Renewal
  renewalRequired: boolean("renewal_required").default(false),
  renewalDate: date("renewal_date"),
  renewalReminderSent: boolean("renewal_reminder_sent").default(false),
  
  // Documents
  documentIds: jsonb("document_ids").$type<string[]>(),
  
  // Cost Tracking
  trainingCost: numeric("training_cost", { precision: 10, scale: 2 }),
  costCoveredByEmployer: boolean("cost_covered_by_employer"),
  
  // Metadata
  metadata: jsonb("metadata"),
  notes: text("notes"),
  
  // Audit Fields
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
}, (table) => ({
  idxTrainingOrg: index("idx_training_org").on(table.organizationId),
  idxTrainingTrainee: index("idx_training_trainee").on(table.traineeId),
  idxTrainingStatus: index("idx_training_status").on(table.status),
  idxTrainingExpiry: index("idx_training_expiry").on(table.expiryDate),
  idxTrainingDate: index("idx_training_date").on(table.trainingDate),
  idxTrainingCourse: index("idx_training_course").on(table.courseId),
}));

/**
 * PPE Equipment Table
 * 
 * Tracks personal protective equipment inventory, issuance, and lifecycle.
 * Ensures workers have required safety equipment.
 * 
 * RLS: Users can view PPE records in their organization
 */
export const ppeEquipment = pgTable("ppe_equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization & References
  organizationId: uuid("organization_id").notNull(),
  itemNumber: varchar("item_number", { length: 50 }).notNull(),
  serialNumber: varchar("serial_number", { length: 100 }),
  
  // Equipment Details
  ppeType: ppeTypeEnum("ppe_type").notNull(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  description: text("description"),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  size: varchar("size", { length: 50 }),
  
  // Inventory
  status: ppeStatusEnum("status").notNull().default("in_stock"),
  storageLocation: varchar("storage_location", { length: 255 }),
  quantityInStock: integer("quantity_in_stock").default(0),
  quantityIssued: integer("quantity_issued").default(0),
  reorderLevel: integer("reorder_level"),
  reorderQuantity: integer("reorder_quantity"),
  
  // Issuance
  issuedToId: uuid("issued_to_id"), // Profile/member ID
  issuedToName: varchar("issued_to_name", { length: 255 }),
  issuedDate: date("issued_date"),
  issuedById: uuid("issued_by_id"),
  issuedByName: varchar("issued_by_name", { length: 255 }),
  
  returnedDate: date("returned_date"),
  returnCondition: varchar("return_condition", { length: 100 }),
  
  // Lifecycle
  purchaseDate: date("purchase_date"),
  purchaseCost: numeric("purchase_cost", { precision: 10, scale: 2 }),
  supplier: varchar("supplier", { length: 255 }),
  purchaseOrderNumber: varchar("purchase_order_number", { length: 100 }),
  
  // Expiry & Maintenance
  expiryDate: date("expiry_date"),
  inspectionRequired: boolean("inspection_required").default(false),
  lastInspectionDate: date("last_inspection_date"),
  nextInspectionDate: date("next_inspection_date"),
  inspectionFrequencyDays: integer("inspection_frequency_days"),
  
  maintenanceRequired: boolean("maintenance_required").default(false),
  lastMaintenanceDate: date("last_maintenance_date"),
  nextMaintenanceDate: date("next_maintenance_date"),
  maintenanceNotes: text("maintenance_notes"),
  
  // Compliance & Certification
  certificationStandard: varchar("certification_standard", { length: 255 }), // e.g., "CSA Z94.1-15"
  certificationNumber: varchar("certification_number", { length: 100 }),
  csaApproved: boolean("csa_approved").default(false),
  ansiApproved: boolean("ansi_approved").default(false),
  
  // Disposal
  disposalDate: date("disposal_date"),
  disposalReason: varchar("disposal_reason", { length: 255 }),
  disposalMethod: varchar("disposal_method", { length: 255 }),
  
  // Documents
  documentIds: jsonb("document_ids").$type<string[]>(),
  manualUrl: text("manual_url"),
  certificationUrl: text("certification_url"),
  
  // Metadata
  metadata: jsonb("metadata"),
  notes: text("notes"),
  
  // Audit Fields
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
}, (table) => ({
  // One number per organization, not one across all organizations (platform migration 0042).
  uqOrgItemNumber: uniqueIndex("uq_ppe_equipment_org_item_number").on(table.organizationId, table.itemNumber),
  idxPpeOrg: index("idx_ppe_org").on(table.organizationId),
  idxPpeStatus: index("idx_ppe_status").on(table.status),
  idxPpeType: index("idx_ppe_type").on(table.ppeType),
  idxPpeIssuedTo: index("idx_ppe_issued_to").on(table.issuedToId),
  idxPpeExpiry: index("idx_ppe_expiry").on(table.expiryDate),
  idxPpeInspection: index("idx_ppe_inspection").on(table.nextInspectionDate),
}));

// =============================================================================
// RELATIONS
// =============================================================================

export const workplaceIncidentsRelations = relations(workplaceIncidents, () => ({
}));

export const safetyInspectionsRelations = relations(safetyInspections, () => ({
}));

export const hazardReportsRelations = relations(hazardReports, () => ({
}));

export const safetyTrainingRecordsRelations = relations(safetyTrainingRecords, () => ({
}));

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Workplace Incidents
export type InsertWorkplaceIncident = typeof workplaceIncidents.$inferInsert;
export type SelectWorkplaceIncident = typeof workplaceIncidents.$inferSelect;

// Safety Inspections
export type InsertSafetyInspection = typeof safetyInspections.$inferInsert;
export type SelectSafetyInspection = typeof safetyInspections.$inferSelect;

// Hazard Reports
export type InsertHazardReport = typeof hazardReports.$inferInsert;
export type SelectHazardReport = typeof hazardReports.$inferSelect;

// Safety Committee Meetings

// Safety Training Records
export type InsertSafetyTrainingRecord = typeof safetyTrainingRecords.$inferInsert;
export type SelectSafetyTrainingRecord = typeof safetyTrainingRecords.$inferSelect;

// PPE Equipment
export type InsertPpeEquipment = typeof ppeEquipment.$inferInsert;
export type SelectPpeEquipment = typeof ppeEquipment.$inferSelect;

// Safety Audits

// Injury Logs

// Safety Policies

// Corrective Actions

// Safety Certifications
