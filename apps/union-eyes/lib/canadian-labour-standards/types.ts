/**
 * Canadian Labour Standards — Shared Types
 *
 * Common interfaces used across all provincial/territorial/federal
 * labour standards modules.
 *
 * @module canadian-labour-standards/types
 */

/** All Canadian jurisdictions (provinces, territories, federal) */
export type CanadianJurisdiction =
  | 'federal'
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU'
  | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

/** Statutory break rule */
export interface BreakRule {
  type: 'meal' | 'rest' | 'weekly_rest';
  description: string;
  article: string;
  statute: string;
  consecutiveHoursTrigger: number;
  durationMinutes: number;
  paid: boolean;
  exceptions: string[];
}

/** Employment standard */
export interface EmploymentStandard {
  id: string;
  name: string;
  article: string;
  statute: string;
  description: string;
  value: string | number | null;
  enforceableBy: string;
}

/** Overtime rule */
export interface OvertimeRule {
  dailyThresholdHours: number | null;
  weeklyThresholdHours: number;
  multiplier: number;
  statute: string;
  article: string;
  notes: string;
}

/** Termination notice tier */
export interface TerminationNoticeTier {
  minYears: number;
  maxYears: number | null;
  weeksNotice: number;
}

/** Termination notice schedule */
export interface TerminationNoticeSchedule {
  statute: string;
  article: string;
  tiers: TerminationNoticeTier[];
}

/** Statutory holiday */
export interface StatutoryHoliday {
  name: string;
  date: string; // "MM-DD" or "variable"
  notes?: string;
}

/** Workers' compensation board info */
export interface WorkersCompBoard {
  name: string;
  acronym: string;
  statute: string;
  portalUrl: string;
  claimDeadlineDays: number;
  notes?: string;
}

/** Labour relations board info */
export interface LabourRelationsBoard {
  name: string;
  abbreviation: string;
  statute: string;
  certificationProcess: string;
  website: string;
}

/** Anti-scab provision */
export interface AntiScabProvision {
  hasAntiScab: boolean;
  statute?: string;
  article?: string;
  effectiveDate?: string;
  summary?: string;
  penalties?: string;
}

/** Pay equity regime */
export interface PayEquityRegime {
  hasLegislation: boolean;
  statute?: string;
  appliesToPrivateSector: boolean;
  appliesToPublicSector: boolean;
  enforcementBody?: string;
  maintenanceCycleYears?: number;
}

/** Full jurisdiction profile */
export interface JurisdictionProfile {
  code: CanadianJurisdiction;
  name: string;
  employmentStandardsAct: string;
  breakRules: BreakRule[];
  overtimeRule: OvertimeRule;
  terminationNotice: TerminationNoticeSchedule;
  statutoryHolidays: StatutoryHoliday[];
  workersCompBoard: WorkersCompBoard;
  labourRelationsBoard: LabourRelationsBoard;
  antiScab: AntiScabProvision;
  payEquity: PayEquityRegime;
  minimumWage: { hourly: number; effectiveDate: string };
}
