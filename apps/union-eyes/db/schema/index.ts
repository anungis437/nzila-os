/**
 * Domain-Driven Database Schema
 * 
 * Consolidated schema exports organized by business domain.
 * 
 * This replaces the previous flat 75-file structure with 13 domain modules,
 * reducing import depth from 5 to 2 levels and eliminating 18 duplicates.
 * 
 * Migration Status: COMPLETE - All domains migrated
 * Date: February 11, 2026
 * 
 * @see SCHEMA_CONSOLIDATION_DESIGN.md for full consolidation plan
 * @see SCHEMA_CONSOLIDATION_STATUS.md for migration status
 */

// ============================================================================
// DOMAIN EXPORTS (New Structure)
// ============================================================================

// Core Business Domains
export * from "./domains/member";           // Priority 1: Member profiles and user management
export * from "./domains/claims";           // Priority 2: Claims, grievances, deadlines
export * from "./domains/agreements";       // Priority 3: Collective bargaining agreements
export * from "./domains/finance";          // Priority 4: Financial transactions and accounting
export * from "./domains/governance";       // Priority 5: Governance, voting, structure

// Communication & Content Domains
export * from "./domains/communications";   // Priority 6: Member engagement and notifications
export * from "./domains/documents";        // Priority 7: Document storage and e-signatures
export * from "./domains/scheduling";       // Priority 8: Calendar, events, training

// Compliance & Data Domains
export * from "./domains/compliance";       // Priority 9: Regulatory compliance and privacy
export * from "./domains/data";             // Priority 10: External data integration

// CBA Intelligence (Public Source Intelligence Layer)
export * from "./domains/cba-intelligence"; // Source registry, ingestion, extraction, review, benchmarks

// Health & Safety — re-export excluding auditStatusEnum (conflicts with infrastructure/accessibility)
export {
  // Enums (sans auditStatusEnum)
  incidentTypeEnum, incidentSeverityEnum, bodyPartEnum, injuryNatureEnum,
  inspectionStatusEnum, inspectionTypeEnum,
  hazardCategoryEnum, hazardLevelEnum,
  auditTypeEnum,
  trainingStatusEnum,
  ppeTypeEnum, ppeStatusEnum,
  safetyCertificationTypeEnum, certificationStatusEnum,
  correctiveActionStatusEnum, correctiveActionPriorityEnum,
  meetingTypeEnum,
  // Tables
  workplaceIncidents, safetyInspections, hazardReports,
  safetyCommitteeMeetings, safetyTrainingRecords, ppeEquipment,
  safetyAudits, injuryLogs, safetyPolicies, correctiveActions, safetyCertifications,
  // Relations
  workplaceIncidentsRelations, safetyInspectionsRelations, hazardReportsRelations,
  correctiveActionsRelations, injuryLogsRelations,
  // CNESST enums
  cneesstFilingTypeEnum, cneesstFilingStatusEnum,
  preventiveWithdrawalReasonEnum, rightOfRefusalOutcomeEnum,
  payEquityStatusEnum, antiScabViolationTypeEnum,
  // CNESST tables
  cneesstFilings, rightOfRefusalEvents, preventiveWithdrawals,
  jointHsCommittees, payEquityExercises, antiScabViolations,
  // CNESST relations
  cneesstFilingsRelations, rightOfRefusalEventsRelations, preventiveWithdrawalsRelations,
  // Provincial WCB enums
  wcbJurisdictionEnum, wcbClaimStatusEnum, wcbClaimTypeEnum, wcbReturnToWorkStatusEnum,
  // Provincial WCB tables
  wcbClaims, wcbEmployerAssessments,
  // Provincial WCB relations
  wcbClaimsRelations, wcbEmployerAssessmentsRelations,
} from "./domains/health-safety";

// Advanced Feature Domains
export * from "./domains/ml";               // Priority 11: Machine learning and AI
export * from "./domains/analytics";        // Priority 12: Reporting and analytics
export * from "./domains/infrastructure";   // Priority 13: System infrastructure and integrations

// Pilot Domains
export * from "./domains/pilot";            // CAPE-CLC pilot onboarding and demo data

// Federation
export * from "./domains/federation";       // Federation management and memberships

// Marketing & Growth
export * from "./domains/marketing";        // Impact metrics, case studies, pilot program

// Dispatch
export * from "./domains/dispatch/dispatch"; // Dispatch-hall automation

// Board Packets
export * from "./board-packet-schema";       // Governance meeting packet generation

// Dues & Finance (member dues ledger, arrears, employer remittances)
export * from "./dues-finance-schema";

// ============================================================================
// EXTERNAL EXPORTS (Outside Domain Structure)
// ============================================================================

// Organizations (CLC-level schema, external to local union domains)
export * from "../schema-organizations";

// Union Structure (Organizational hierarchy and operational structure)
export * from "./union-structure-schema";

// Committee Workspace (Meetings, minutes, action items, intelligence)
export * from "./committee-workspace-schema";

// ============================================================================
// EXPLICIT RE-EXPORTS (Resolve cross-domain ambiguities)
// ============================================================================

// consentStatusEnum - compliance is the canonical source for consent management
export { consentStatusEnum } from "./domains/compliance";

// GrievanceType - claims is the canonical source for grievances
export { type GrievanceType } from "./domains/claims";

// employmentStatusEnum - member domain is the canonical source
export { employmentStatusEnum } from "./domains/member";

// mlPredictions - ML domain is the canonical source for predictions
export { mlPredictions } from "./domains/ml";

// campaignStatusEnum - communications is the canonical source
export { campaignStatusEnum } from "./domains/communications";

// Finance-owned schemas that also appear in infrastructure/erp
export { accountTypeEnum, chartOfAccounts, chartOfAccountsRelations, glAccountMappings } from "./domains/finance";

// syncStatusEnum - infrastructure is the canonical source
export { syncStatusEnum } from "./domains/infrastructure";

// Employer / employers - compliance is the canonical source
export { employers, type Employer } from "./domains/compliance";

// Steward assignments - union-structure-schema is the canonical source
export { stewardAssignments, stewardAssignmentsRelations, type StewardAssignment } from "./union-structure-schema";
