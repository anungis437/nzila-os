/**
 * Canadian Labour Standards — Unified Module
 *
 * Comprehensive coverage of employment standards, labour relations,
 * workers' compensation, and compliance rules for all 13 Canadian
 * provinces/territories plus the federal jurisdiction.
 *
 * @module canadian-labour-standards
 */

// Types
export type {
  CanadianJurisdiction,
  BreakRule,
  EmploymentStandard,
  OvertimeRule,
  TerminationNoticeTier,
  TerminationNoticeSchedule,
  StatutoryHoliday,
  WorkersCompBoard,
  LabourRelationsBoard,
  AntiScabProvision,
  PayEquityRegime,
  JurisdictionProfile,
} from './types';

// Data registries
export { BREAK_RULES } from './break-rules';
export { OVERTIME_RULES, calculateOvertime, calculateBCOvertime } from './overtime';
export { TERMINATION_NOTICE, calculateTerminationNotice } from './termination-notice';
export { STATUTORY_HOLIDAYS, getStatutoryHolidayCount } from './statutory-holidays';
export { WCB_BOARDS, getWCBBoard, getClaimDeadlineDays } from './wcb-boards';
export { LRB_BOARDS, getLRBoard } from './lrb-boards';
export { ANTI_SCAB_PROVISIONS, hasAntiScabLaw, getAntiScabJurisdictions } from './anti-scab';
export { PAY_EQUITY_REGIMES, hasProactivePayEquity, getProactivePayEquityJurisdictions } from './pay-equity';

// Generators
export { buildDefaultBreakPolicies } from './break-defaults';
