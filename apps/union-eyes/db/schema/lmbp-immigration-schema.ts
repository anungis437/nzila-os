/**
 * Compatibility path for LMBP immigration.
 * The only pgTable declarations live in the domain module.
 * Do not add a second pgTable in this file.
 */
export {
  foreignWorkers,
  lmbpLetters,
  gssApplications,
  mentorships,
  lmbpComplianceAlerts,
  lmbpComplianceReports,
  type ForeignWorker,
  type NewForeignWorker,
  type LMBPLetter,
  type NewLMBPLetter,
  type GSSApplication,
  type NewGSSApplication,
  type Mentorship,
  type NewMentorship,
  type LMBPComplianceAlert,
  type NewLMBPComplianceAlert,
  type LMBPComplianceReport,
  type NewLMBPComplianceReport,
} from './domains/compliance/immigration';
