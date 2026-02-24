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

import {
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
  _foreignKey,
  _unique,
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
  incidentNumber: varchar("incident_number", { length: 50 }).unique().notNull(),
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
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => ({
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
  inspectionNumber: varchar("inspection_number", { length: 50 }).unique().notNull(),
  
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
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => ({
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
  reportNumber: varchar("report_number", { length: 50 }).unique().notNull(),
  
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
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => ({
  idxHazardsOrg: index("idx_hazards_org").on(table.organizationId),
  idxHazardsStatus: index("idx_hazards_status").on(table.status),
  idxHazardsLevel: index("idx_hazards_level").on(table.hazardLevel),
  idxHazardsCategory: index("idx_hazards_category").on(table.hazardCategory),
  idxHazardsWorkplace: index("idx_hazards_workplace").on(table.workplaceId),
  idxHazardsDate: index("idx_hazards_date").on(table.reportedDate),
  idxHazardsRiskScore: index("idx_hazards_risk_score").on(table.riskScore),
}));

/**
 * Safety Committee Meetings Table
 * 
 * Tracks joint health and safety committee meetings, agendas, attendance,
 * minutes, and action items.
 * 
 * RLS: Users can view meetings in their organization
 */
export const safetyCommitteeMeetings = pgTable("safety_committee_meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization & References
  organizationId: uuid("organization_id").notNull(),
  meetingNumber: varchar("meeting_number", { length: 50 }).unique().notNull(),
  
  // Meeting Details
  meetingType: meetingTypeEnum("meeting_type").notNull().default("regular"),
  meetingDate: timestamp("meeting_date", { withTimezone: true }).notNull(),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  duration: integer("duration_minutes"),
  
  // Location
  location: varchar("location", { length: 255 }),
  isVirtual: boolean("is_virtual").default(false),
  meetingLink: text("meeting_link"),
  
  // Committee Information
  committeeName: varchar("committee_name", { length: 255 }),
  chairpersonId: uuid("chairperson_id"),
  chairpersonName: varchar("chairperson_name", { length: 255 }),
  secretaryId: uuid("secretary_id"),
  secretaryName: varchar("secretary_name", { length: 255 }),
  
  // Attendance
  memberIds: jsonb("member_ids").$type<string[]>(),
  memberNames: jsonb("member_names").$type<string[]>(),
  attendeeIds: jsonb("attendee_ids").$type<string[]>(),
  attendeeNames: jsonb("attendee_names").$type<string[]>(),
  absentIds: jsonb("absent_ids").$type<string[]>(),
  absentNames: jsonb("absent_names").$type<string[]>(),
  guestIds: jsonb("guest_ids").$type<string[]>(),
  guestNames: jsonb("guest_names").$type<string[]>(),
  
  quorumMet: boolean("quorum_met").default(true),
  attendanceCount: integer("attendance_count"),
  
  // Agenda & Content
  agenda: text("agenda"),
  agendaItems: jsonb("agenda_items").$type<{
    order: number;
    topic: string;
    presenter?: string;
    duration?: number;
    completed: boolean;
  }[]>(),
  
  // Minutes & Discussion
  minutes: text("minutes"),
  discussionSummary: text("discussion_summary"),
  keyPoints: jsonb("key_points").$type<string[]>(),
  
  // Review Items
  previousMinutesApproved: boolean("previous_minutes_approved"),
  actionItemsReviewed: boolean("action_items_reviewed"),
  actionItemsFromPrevious: jsonb("action_items_from_previous").$type<{
    id: string;
    description: string;
    status: string;
  }[]>(),
  
  // Incidents & Hazards Reviewed
  incidentsReviewed: jsonb("incidents_reviewed").$type<string[]>(), // Array of incident IDs
  hazardsReviewed: jsonb("hazards_reviewed").$type<string[]>(), // Array of hazard IDs
  inspectionsReviewed: jsonb("inspections_reviewed").$type<string[]>(),
  
  // Action Items Generated
  actionItemsCreated: jsonb("action_items_created").$type<{
    description: string;
    assignedTo: string;
    dueDate: string;
    priority: string;
    status: string;
  }[]>(),
  
  // Recommendations
  recommendations: text("recommendations"),
  trainingNeeds: text("training_needs"),
  policyReviews: text("policy_reviews"),
  
  // Next Meeting
  nextMeetingDate: timestamp("next_meeting_date", { withTimezone: true }),
  nextMeetingAgenda: text("next_meeting_agenda"),
  
  // Documents
  documentIds: jsonb("document_ids").$type<string[]>(),
  minutesDocumentId: uuid("minutes_document_id"),
  recordingUrl: text("recording_url"),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("scheduled"), // scheduled, completed, cancelled
  minutesApproved: boolean("minutes_approved").default(false),
  minutesApprovedDate: timestamp("minutes_approved_date", { withTimezone: true }),
  
  // Metadata
  metadata: jsonb("metadata"),
  notes: text("notes"),
  
  // Audit Fields
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => ({
  idxMeetingsOrg: index("idx_meetings_org").on(table.organizationId),
  idxMeetingsDate: index("idx_meetings_date").on(table.meetingDate),
  idxMeetingsStatus: index("idx_meetings_status").on(table.status),
  idxMeetingsType: index("idx_meetings_type").on(table.meetingType),
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
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
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
  itemNumber: varchar("item_number", { length: 50 }).unique().notNull(),
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
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => ({
  idxPpeOrg: index("idx_ppe_org").on(table.organizationId),
  idxPpeStatus: index("idx_ppe_status").on(table.status),
  idxPpeType: index("idx_ppe_type").on(table.ppeType),
  idxPpeIssuedTo: index("idx_ppe_issued_to").on(table.issuedToId),
  idxPpeExpiry: index("idx_ppe_expiry").on(table.expiryDate),
  idxPpeInspection: index("idx_ppe_inspection").on(table.nextInspectionDate),
}));

/**
 * Safety Audits Table
 * 
 * Formal compliance audits of health & safety management systems.
 * More comprehensive than inspections, typically for regulatory/certification purposes.
 * 
 * RLS: Users can view audits in their organization
 */
export const safetyAudits = pgTable("safety_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization & References
  organizationId: uuid("organization_id").notNull(),
  auditNumber: varchar("audit_number", { length: 50 }).unique().notNull(),
  
  // Classification
  auditType: auditTypeEnum("audit_type").notNull(),
  status: auditStatusEnum("status").notNull().default("planned"),
  
  // Scheduling
  plannedDate: date("planned_date"),
  scheduledStartDate: date("scheduled_start_date").notNull(),
  scheduledEndDate: date("scheduled_end_date"),
  actualStartDate: date("actual_start_date"),
  actualEndDate: date("actual_end_date"),
  
  // Scope
  auditScope: text("audit_scope").notNull(),
  auditObjectives: text("audit_objectives"),
  standardsReferenced: jsonb("standards_referenced").$type<string[]>(), // ISO 45001, OHSAS, etc.
  
  // Location
  workplaceIds: jsonb("workplace_ids").$type<string[]>(),
  workplaceNames: jsonb("workplace_names").$type<string[]>(),
  departmentsAudited: jsonb("departments_audited").$type<string[]>(),
  
  // Audit Team
  leadAuditorId: uuid("lead_auditor_id"),
  leadAuditorName: varchar("lead_auditor_name", { length: 255 }),
  leadAuditorCertification: varchar("lead_auditor_certification", { length: 255 }),
  
  auditorIds: jsonb("auditor_ids").$type<string[]>(),
  auditorNames: jsonb("auditor_names").$type<string[]>(),
  
  isExternalAudit: boolean("is_external_audit").default(false),
  auditingOrganization: varchar("auditing_organization", { length: 255 }),
  
  // Audit Plan
  auditPlan: text("audit_plan"),
  documentsReviewed: jsonb("documents_reviewed").$type<string[]>(),
  areasInspected: jsonb("areas_inspected").$type<string[]>(),
  staffInterviewed: jsonb("staff_interviewed").$type<string[]>(),
  
  // Findings
  totalFindings: integer("total_findings").default(0),
  criticalFindings: integer("critical_findings").default(0),
  majorFindings: integer("major_findings").default(0),
  minorFindings: integer("minor_findings").default(0),
  observations: integer("observations").default(0),
  
  findingsDetail: jsonb("findings_detail").$type<{
    findingNumber: string;
    severity: "critical" | "major" | "minor" | "observation";
    category: string;
    description: string;
    evidence: string;
    standardClause: string;
    requiresCorrectiveAction: boolean;
  }[]>(),
  
  // Compliance Rating
  overallComplianceRating: varchar("overall_compliance_rating", { length: 50 }),
  compliancePercentage: numeric("compliance_percentage", { precision: 5, scale: 2 }),
  
  // Strengths & Weaknesses
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  opportunitiesForImprovement: text("opportunities_for_improvement"),
  
  // Report
  executiveSummary: text("executive_summary"),
  auditReport: text("audit_report"),
  reportUrl: text("report_url"),
  reportIssueDate: date("report_issue_date"),
  
  // Corrective Actions
  correctiveActionsRequired: boolean("corrective_actions_required").default(false),
  correctiveActionPlan: text("corrective_action_plan"),
  correctiveActionIds: jsonb("corrective_action_ids").$type<string[]>(),
  
  // Follow-up
  followUpAuditRequired: boolean("follow_up_audit_required").default(false),
  followUpAuditDate: date("follow_up_audit_date"),
  followUpCompleted: boolean("follow_up_completed").default(false),
  
  // Certification (if applicable)
  certificationAwarded: boolean("certification_awarded").default(false),
  certificationType: varchar("certification_type", { length: 255 }),
  certificateNumber: varchar("certificate_number", { length: 100 }),
  certificationValidFrom: date("certification_valid_from"),
  certificationValidUntil: date("certification_valid_until"),
  
  // Documents
  documentIds: jsonb("document_ids").$type<string[]>(),
  
  // Metadata
  metadata: jsonb("metadata"),
  notes: text("notes"),
  
  // Audit Fields
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => ({
  idxAuditsOrg: index("idx_audits_org").on(table.organizationId),
  idxAuditsStatus: index("idx_audits_status").on(table.status),
  idxAuditsType: index("idx_audits_type").on(table.auditType),
  idxAuditsDate: index("idx_audits_date").on(table.scheduledStartDate),
}));

/**
 * Injury Logs Table
 * 
 * Detailed tracking of injuries specifically for WSIB/workers compensation.
 * Separate from incidents for specialized injury data and claims tracking.
 * 
 * RLS: Users can view injury logs in their organization
 */
export const injuryLogs = pgTable("injury_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization & References
  organizationId: uuid("organization_id").notNull(),
  logNumber: varchar("log_number", { length: 50 }).unique().notNull(),
  
  // Cross-references
  incidentId: uuid("incident_id"), // Link to workplace_incidents
  claimId: uuid("claim_id"), // Link to claims
  
  // Injured Worker
  workerId: uuid("worker_id").notNull(),
  workerName: varchar("worker_name", { length: 255 }).notNull(),
  workerEmployeeId: varchar("worker_employee_id", { length: 100 }),
  workerDateOfBirth: date("worker_date_of_birth"),
  workerJobTitle: varchar("worker_job_title", { length: 255 }),
  workerDepartment: varchar("worker_department", { length: 255 }),
  workerHireDate: date("worker_hire_date"),
  
  // Injury Details
  injuryDate: date("injury_date").notNull(),
  injuryTime: varchar("injury_time", { length: 20 }),
  reportedDate: date("reported_date").notNull(),
  
  bodyPartsAffected: jsonb("body_parts_affected").$type<string[]>(),
  injuryTypes: jsonb("injury_types").$type<string[]>(),
  injurySeverity: incidentSeverityEnum("injury_severity").notNull(),
  
  // Medical Treatment
  firstAidProvided: boolean("first_aid_provided").default(false),
  firstAidDescription: text("first_aid_description"),
  
  medicalAttentionRequired: boolean("medical_attention_required").default(false),
  treatedAtLocation: varchar("treated_at_location", { length: 255 }),
  treatingPhysician: varchar("treating_physician", { length: 255 }),
  hospitalName: varchar("hospital_name", { length: 255 }),
  hospitalized: boolean("hospitalized").default(false),
  hospitalizationDays: integer("hospitalization_days"),
  
  // Work Impact
  lostTimeInjury: boolean("lost_time_injury").default(false),
  firstDayMissed: date("first_day_missed"),
  returnToWorkDate: date("return_to_work_date"),
  daysAway: integer("days_away"),
  daysRestricted: integer("days_restricted"),
  daysTransferred: integer("days_transferred"),
  
  modifiedDutiesAssigned: boolean("modified_duties_assigned").default(false),
  modifiedDutiesDescription: text("modified_duties_description"),
  
  permanentImpairment: boolean("permanent_impairment").default(false),
  impairmentDescription: text("impairment_description"),
  impairmentRatingPercentage: numeric("impairment_rating_percentage", { precision: 5, scale: 2 }),
  
  // WSIB/Workers Compensation
  wsibClaimFiled: boolean("wsib_claim_filed").default(false),
  wsibClaimNumber: varchar("wsib_claim_number", { length: 100 }),
  wsibClaimDate: date("wsib_claim_date"),
  wsibClaimStatus: varchar("wsib_claim_status", { length: 100 }),
  wsibDecision: varchar("wsib_decision", { length: 255 }),
  wsibDecisionDate: date("wsib_decision_date"),
  
  benefitsApproved: boolean("benefits_approved").default(false),
  benefitStartDate: date("benefit_start_date"),
  benefitAmount: numeric("benefit_amount", { precision: 12, scale: 2 }),
  
  // Costs
  medicalCosts: numeric("medical_costs", { precision: 12, scale: 2 }),
  wageLossCosts: numeric("wage_loss_costs", { precision: 12, scale: 2 }),
  rehabilitationCosts: numeric("rehabilitation_costs", { precision: 12, scale: 2 }),
  totalCosts: numeric("total_costs", { precision: 12, scale: 2 }),
  
  // OSHA Recordability (for US operations)
  oshaRecordable: boolean("osha_recordable").default(false),
  oshaFormNumber: varchar("osha_form_number", { length: 50 }),
  oshaClassification: varchar("osha_classification", { length: 100 }),
  
  // Provincial Reporting (Canada)
  provincialReportRequired: boolean("provincial_report_required").default(false),
  provincialReportFiled: boolean("provincial_report_filed").default(false),
  provincialReportNumber: varchar("provincial_report_number", { length: 100 }),
  
  // Documents
  documentIds: jsonb("document_ids").$type<string[]>(),
  medicalRecords: jsonb("medical_records").$type<string[]>(),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("active"), // active, resolved, closed
  closedDate: date("closed_date"),
  closureNotes: text("closure_notes"),
  
  // Metadata
  metadata: jsonb("metadata"),
  notes: text("notes"),
  
  // Audit Fields
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => ({
  idxInjuryLogsOrg: index("idx_injury_logs_org").on(table.organizationId),
  idxInjuryLogsWorker: index("idx_injury_logs_worker").on(table.workerId),
  idxInjuryLogsDate: index("idx_injury_logs_date").on(table.injuryDate),
  idxInjuryLogsStatus: index("idx_injury_logs_status").on(table.status),
  idxInjuryLogsIncident: index("idx_injury_logs_incident").on(table.incidentId),
  idxInjuryLogsWsib: index("idx_injury_logs_wsib").on(table.wsibClaimNumber),
}));

/**
 * Safety Policies Table
 * 
 * Repository of health & safety policies, procedures, and safe work practices.
 * Version controlled with approval workflow.
 * 
 * RLS: Users can view policies in their organization
 */
export const safetyPolicies = pgTable("safety_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization & References
  organizationId: uuid("organization_id").notNull(),
  policyNumber: varchar("policy_number", { length: 50 }).unique().notNull(),
  
  // Policy Identification
  policyTitle: varchar("policy_title", { length: 500 }).notNull(),
  policyCategory: varchar("policy_category", { length: 100 }).notNull(), // e.g., "PPE", "Lockout", "Confined Space"
  policyType: varchar("policy_type", { length: 100 }), // policy, procedure, safe_work_practice, guideline
  
  // Content
  policyDescription: text("policy_description"),
  purpose: text("purpose"),
  scope: text("scope"),
  applicability: text("applicability"),
  responsibilities: text("responsibilities"),
  procedures: text("procedures"),
  definitions: jsonb("definitions"),
  references: text("references"),
  
  // Document
  documentId: uuid("document_id"), // Link to documents table
  documentUrl: text("document_url"),
  
  // Version Control
  version: varchar("version", { length: 20 }).notNull().default("1.0"),
  revisionHistory: jsonb("revision_history").$type<{
    version: string;
    date: string;
    changes: string;
    approvedBy: string;
  }[]>(),
  
  // Effective Dates
  effectiveDate: date("effective_date").notNull(),
  reviewDate: date("review_date"),
  nextReviewDate: date("next_review_date"),
  expiryDate: date("expiry_date"),
  reviewFrequencyMonths: integer("review_frequency_months").default(12),
  
  // Approval Workflow
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, under_review, approved, active, archived
  
  draftedById: uuid("drafted_by_id"),
  draftedByName: varchar("drafted_by_name", { length: 255 }),
  draftedDate: date("drafted_date"),
  
  reviewedById: uuid("reviewed_by_id"),
  reviewedByName: varchar("reviewed_by_name", { length: 255 }),
  reviewedDate: date("reviewed_date"),
  reviewComments: text("review_comments"),
  
  approvedById: uuid("approved_by_id"),
  approvedByName: varchar("approved_by_name", { length: 255 }),
  approvalDate: date("approval_date"),
  approvalComments: text("approval_comments"),
  
  // Regulatory Compliance
  regulatoryRequirement: boolean("regulatory_requirement").default(false),
  regulatoryReference: varchar("regulatory_reference", { length: 500 }),
  legislationCitation: text("legislation_citation"),
  
  // Training & Communication
  trainingRequired: boolean("training_required").default(false),
  trainingCourseIds: jsonb("training_course_ids").$type<string[]>(),
  communicationPlan: text("communication_plan"),
  
  affectedEmployees: jsonb("affected_employees").$type<string[]>(),
  affectedDepartments: jsonb("affected_departments").$type<string[]>(),
  
  acknowledgementRequired: boolean("acknowledgement_required").default(false),
  acknowledgedBy: jsonb("acknowledged_by").$type<{
    userId: string;
    name: string;
    date: string;
  }[]>(),
  
  // Related Items
  relatedPolicyIds: jsonb("related_policy_ids").$type<string[]>(),
  supersededPolicyIds: jsonb("superseded_policy_ids").$type<string[]>(),
  
  // Metadata
  metadata: jsonb("metadata"),
  tags: jsonb("tags").$type<string[]>(),
  keywords: jsonb("keywords").$type<string[]>(),
  notes: text("notes"),
  
  // Audit Fields
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => ({
  idxPoliciesOrg: index("idx_policies_org").on(table.organizationId),
  idxPoliciesStatus: index("idx_policies_status").on(table.status),
  idxPoliciesCategory: index("idx_policies_category").on(table.policyCategory),
  idxPoliciesReview: index("idx_policies_review").on(table.nextReviewDate),
  idxPoliciesEffective: index("idx_policies_effective").on(table.effectiveDate),
}));

/**
 * Corrective Actions Table
 * 
 * Tracks corrective and preventive actions arising from incidents, inspections,
 * hazards, audits, or other safety findings. Ensures follow-through.
 * 
 * RLS: Users can view corrective actions in their organization
 */
export const correctiveActions = pgTable("corrective_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization & References
  organizationId: uuid("organization_id").notNull(),
  actionNumber: varchar("action_number", { length: 50 }).unique().notNull(),
  
  // Source/Origin
  sourceType: varchar("source_type", { length: 50 }).notNull(), // incident, inspection, hazard, audit, other
  sourceId: uuid("source_id"), // ID of the source record
  sourceReference: varchar("source_reference", { length: 100 }),
  
  // Classification
  actionType: varchar("action_type", { length: 50 }).notNull(), // corrective, preventive, improvement
  priority: correctiveActionPriorityEnum("priority").notNull().default("normal"),
  status: correctiveActionStatusEnum("status").notNull().default("open"),
  
  // Action Description
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  rootCause: text("root_cause"),
  
  // Problem Details
  problemStatement: text("problem_statement"),
  immediateActions: text("immediate_actions"),
  
  // Proposed Solution
  proposedAction: text("proposed_action").notNull(),
  implementationPlan: text("implementation_plan"),
  requiredResources: text("required_resources"),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }),
  actualCost: numeric("actual_cost", { precision: 12, scale: 2 }),
  
  // Assignment
  assignedToId: uuid("assigned_to_id"),
  assignedToName: varchar("assigned_to_name", { length: 255 }),
  assignedDate: timestamp("assigned_date", { withTimezone: true }),
  
  responsiblePersonId: uuid("responsible_person_id"),
  responsiblePersonName: varchar("responsible_person_name", { length: 255 }),
  
  // Dates
  identifiedDate: date("identified_date").notNull(),
  dueDate: date("due_date").notNull(),
  targetCompletionDate: date("target_completion_date"),
  actualCompletionDate: date("actual_completion_date"),
  verificationDate: date("verification_date"),
  closedDate: date("closed_date"),
  
  // Progress
  progressPercentage: integer("progress_percentage").default(0),
  progressNotes: text("progress_notes"),
  
  milestonesUpdates: jsonb("milestones_updates").$type<{
    date: string;
    milestone: string;
    completed: boolean;
    notes?: string;
  }[]>(),
  
  // Completion & Verification
  completionNotes: text("completion_notes"),
  completionEvidence: text("completion_evidence"),
  
  verifiedById: uuid("verified_by_id"),
  verifiedByName: varchar("verified_by_name", { length: 255 }),
  verificationMethod: varchar("verification_method", { length: 255 }),
  verificationNotes: text("verification_notes"),
  verificationPassed: boolean("verification_passed"),
  
  // Effectiveness Review
  effectivenessReviewRequired: boolean("effectiveness_review_required").default(false),
  effectivenessReviewDate: date("effectiveness_review_date"),
  effectivenessReviewedBy: varchar("effectiveness_reviewed_by", { length: 255 }),
  effectivenessRating: varchar("effectiveness_rating", { length: 50 }), // effective, partially_effective, ineffective
  effectivenessNotes: text("effectiveness_notes"),
  
  // Recurrence Prevention
  preventiveMeasures: text("preventive_measures"),
  systemChangesRequired: boolean("system_changes_required").default(false),
  systemChangesDescription: text("system_changes_description"),
  
  // Documents
  documentIds: jsonb("document_ids").$type<string[]>(),
  
  // Notifications
  notificationsSent: jsonb("notifications_sent").$type<{
    recipient: string;
    date: string;
    type: string;
  }[]>(),
  
  remindersSent: integer("reminders_sent").default(0),
  lastReminderDate: timestamp("last_reminder_date", { withTimezone: true }),
  
  // Metadata
  metadata: jsonb("metadata"),
  tags: jsonb("tags").$type<string[]>(),
  notes: text("notes"),
  
  // Audit Fields
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => ({
  idxCorrectiveActionsOrg: index("idx_corrective_actions_org").on(table.organizationId),
  idxCorrectiveActionsStatus: index("idx_corrective_actions_status").on(table.status),
  idxCorrectiveActionsPriority: index("idx_corrective_actions_priority").on(table.priority),
  idxCorrectiveActionsDueDate: index("idx_corrective_actions_due_date").on(table.dueDate),
  idxCorrectiveActionsAssigned: index("idx_corrective_actions_assigned").on(table.assignedToId),
  idxCorrectiveActionsSource: index("idx_corrective_actions_source").on(table.sourceType, table.sourceId),
}));

/**
 * Safety Certifications Table
 * 
 * Tracks health & safety representative certifications and credentials.
 * Links to training records and ensures certified personnel are available.
 * 
 * RLS: Users can view certifications in their organization
 */
export const safetyCertifications = pgTable("safety_certifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization & References
  organizationId: uuid("organization_id").notNull(),
  certificationNumber: varchar("certification_number", { length: 50 }).unique().notNull(),
  
  // Certificate Holder
  holderIdId: uuid("holder_id").notNull(), // Profile/member ID
  holderName: varchar("holder_name", { length: 255 }).notNull(),
  holderEmployeeId: varchar("holder_employee_id", { length: 100 }),
  holderJobTitle: varchar("holder_job_title", { length: 255 }),
  holderDepartment: varchar("holder_department", { length: 255 }),
  
  // Certification Details
  certificationType: safetyCertificationTypeEnum("certification_type").notNull(),
  certificationName: varchar("certification_name", { length: 300 }).notNull(),
  certificationLevel: varchar("certification_level", { length: 100 }), // basic, intermediate, advanced
  
  // Issuing Body
  issuingOrganization: varchar("issuing_organization", { length: 255 }).notNull(),
  issuingBody: varchar("issuing_body", { length: 255 }),
  certificationStandard: varchar("certification_standard", { length: 255 }),
  
  certificateNumber: varchar("certificate_number", { length: 100 }),
  
  // Dates
  issueDate: date("issue_date").notNull(),
  expiryDate: date("expiry_date"),
  validityPeriodYears: integer("validity_period_years"),
  
  status: certificationStatusEnum("status").notNull().default("active"),
  
  // Renewal
  renewalRequired: boolean("renewal_required").default(false),
  renewalDate: date("renewal_date"),
  renewalInProgress: boolean("renewal_in_progress").default(false),
  renewalApplicationDate: date("renewal_application_date"),
  
  reminderSentDate: date("reminder_sent_date"),
  reminderFrequencyDays: integer("reminder_frequency_days").default(30),
  
  // Training Link
  trainingRecordId: uuid("training_record_id"), // Link to safety_training_records
  courseId: uuid("course_id"),
  trainingCompletedDate: date("training_completed_date"),
  
  // Assessment/Examination
  examinationRequired: boolean("examination_required").default(false),
  examinationDate: date("examination_date"),
  examinationScore: numeric("examination_score", { precision: 5, scale: 2 }),
  examinationPassed: boolean("examination_passed"),
  
  // Competency
  competencyAssessed: boolean("competency_assessed").default(false),
  competencyLevel: varchar("competency_level", { length: 50 }),
  competencyAssessmentDate: date("competency_assessment_date"),
  
  // Responsibilities
  authorizedActivities: jsonb("authorized_activities").$type<string[]>(),
  restrictions: text("restrictions"),
  
  // Regulatory Compliance
  regulatoryRequirement: boolean("regulatory_requirement").default(false),
  legislationReference: varchar("legislation_reference", { length: 500 }),
  complianceNotes: text("compliance_notes"),
  
  // Suspension/Revocation
  suspendedDate: date("suspended_date"),
  suspensionReason: text("suspension_reason"),
  revokedDate: date("revoked_date"),
  revocationReason: text("revocation_reason"),
  
  reinstatementDate: date("reinstatement_date"),
  reinstatementConditions: text("reinstatement_conditions"),
  
  // Documents
  documentIds: jsonb("document_ids").$type<string[]>(),
  certificateUrl: text("certificate_url"),
  
  // Continuing Education
  continuingEducationRequired: boolean("continuing_education_required").default(false),
  continuingEducationHoursRequired: integer("continuing_education_hours_required"),
  continuingEducationHoursCompleted: integer("continuing_education_hours_completed"),
  
  // Metadata
  metadata: jsonb("metadata"),
  notes: text("notes"),
  
  // Audit Fields
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => ({
  idxCertificationsOrg: index("idx_certifications_org").on(table.organizationId),
  idxCertificationsHolder: index("idx_certifications_holder").on(table.holderIdId),
  idxCertificationsStatus: index("idx_certifications_status").on(table.status),
  idxCertificationsType: index("idx_certifications_type").on(table.certificationType),
  idxCertificationsExpiry: index("idx_certifications_expiry").on(table.expiryDate),
  idxCertificationsTraining: index("idx_certifications_training").on(table.trainingRecordId),
}));

// =============================================================================
// RELATIONS
// =============================================================================

export const workplaceIncidentsRelations = relations(workplaceIncidents, ({ many }) => ({
  correctiveActions: many(correctiveActions),
  injuryLogs: many(injuryLogs),
}));

export const safetyInspectionsRelations = relations(safetyInspections, ({ many }) => ({
  correctiveActions: many(correctiveActions),
}));

export const hazardReportsRelations = relations(hazardReports, ({ many }) => ({
  correctiveActions: many(correctiveActions),
}));

export const safetyAuditsRelations = relations(safetyAudits, ({ many }) => ({
  correctiveActions: many(correctiveActions),
}));

export const correctiveActionsRelations = relations(correctiveActions, ({ one }) => ({
  sourceIncident: one(workplaceIncidents, {
    fields: [correctiveActions.sourceId],
    references: [workplaceIncidents.id],
  }),
  sourceInspection: one(safetyInspections, {
    fields: [correctiveActions.sourceId],
    references: [safetyInspections.id],
  }),
  sourceHazard: one(hazardReports, {
    fields: [correctiveActions.sourceId],
    references: [hazardReports.id],
  }),
  sourceAudit: one(safetyAudits, {
    fields: [correctiveActions.sourceId],
    references: [safetyAudits.id],
  }),
}));

export const injuryLogsRelations = relations(injuryLogs, ({ one }) => ({
  incident: one(workplaceIncidents, {
    fields: [injuryLogs.incidentId],
    references: [workplaceIncidents.id],
  }),
}));

export const safetyCertificationsRelations = relations(safetyCertifications, ({ one }) => ({
  trainingRecord: one(safetyTrainingRecords, {
    fields: [safetyCertifications.trainingRecordId],
    references: [safetyTrainingRecords.id],
  }),
}));

export const safetyTrainingRecordsRelations = relations(safetyTrainingRecords, ({ many }) => ({
  certifications: many(safetyCertifications),
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
export type InsertSafetyCommitteeMeeting = typeof safetyCommitteeMeetings.$inferInsert;
export type SelectSafetyCommitteeMeeting = typeof safetyCommitteeMeetings.$inferSelect;

// Safety Training Records
export type InsertSafetyTrainingRecord = typeof safetyTrainingRecords.$inferInsert;
export type SelectSafetyTrainingRecord = typeof safetyTrainingRecords.$inferSelect;

// PPE Equipment
export type InsertPpeEquipment = typeof ppeEquipment.$inferInsert;
export type SelectPpeEquipment = typeof ppeEquipment.$inferSelect;

// Safety Audits
export type InsertSafetyAudit = typeof safetyAudits.$inferInsert;
export type SelectSafetyAudit = typeof safetyAudits.$inferSelect;

// Injury Logs
export type InsertInjuryLog = typeof injuryLogs.$inferInsert;
export type SelectInjuryLog = typeof injuryLogs.$inferSelect;

// Safety Policies
export type InsertSafetyPolicy = typeof safetyPolicies.$inferInsert;
export type SelectSafetyPolicy = typeof safetyPolicies.$inferSelect;

// Corrective Actions
export type InsertCorrectiveAction = typeof correctiveActions.$inferInsert;
export type SelectCorrectiveAction = typeof correctiveActions.$inferSelect;

// Safety Certifications
export type InsertSafetyCertification = typeof safetyCertifications.$inferInsert;
export type SelectSafetyCertification = typeof safetyCertifications.$inferSelect;
