/**
 * Health & Safety Domain - Index
 * 
 * Exports all health and safety related schemas, types, and enums
 * 
 * @module health-safety
 */

export * from './health-safety-schema';
export * from './cnesst-schema';
export * from './provincial-wcb-schema';

// Re-export commonly used types for convenience
export type {
  InsertWorkplaceIncident,
  SelectWorkplaceIncident,
  InsertSafetyInspection,
  SelectSafetyInspection,
  InsertHazardReport,
  SelectHazardReport,
  InsertSafetyCommitteeMeeting,
  SelectSafetyCommitteeMeeting,
  InsertSafetyTrainingRecord,
  SelectSafetyTrainingRecord,
  InsertPpeEquipment,
  SelectPpeEquipment,
  InsertSafetyAudit,
  SelectSafetyAudit,
  InsertInjuryLog,
  SelectInjuryLog,
  InsertSafetyPolicy,
  SelectSafetyPolicy,
  InsertCorrectiveAction,
  SelectCorrectiveAction,
  InsertSafetyCertification,
  SelectSafetyCertification,
} from './health-safety-schema';

// Quebec CNESST types
export type {
  InsertCneesstFiling,
  SelectCneesstFiling,
  InsertRightOfRefusalEvent,
  SelectRightOfRefusalEvent,
  InsertPreventiveWithdrawal,
  SelectPreventiveWithdrawal,
  InsertJointHsCommittee,
  SelectJointHsCommittee,
  InsertPayEquityExercise,
  SelectPayEquityExercise,
  InsertAntiScabViolation,
  SelectAntiScabViolation,
} from './cnesst-schema';

// Provincial WCB types
export type {
  InsertWcbClaim,
  SelectWcbClaim,
  InsertWcbEmployerAssessment,
  SelectWcbEmployerAssessment,
} from './provincial-wcb-schema';
