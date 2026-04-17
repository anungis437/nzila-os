/**
 * @nzila/platform-jurisdiction-compliance — Policy Definitions
 *
 * Jurisdiction-specific compliance policies for Kenya, Uganda, Nigeria.
 * Derived from official tax authorities, labor ministries, pension regulators, NAEB/NCAT exam boards.
 *
 * Sources:
 * - Kenya: KRA, NSSF, Labour Ministry
 * - Uganda: URA, NSSF, Examinations Board
 * - Nigeria: FIRS, PenCom, NABTEB, NBTE
 *
 * @module @nzila/platform-jurisdiction-compliance/policies
 */
export interface TaxIdFormat {
    prefix: string;
    length: number;
    regex: string;
    example: string;
}
export interface TaxConfig {
    standard: number;
    reduced: number;
    corporate: number;
    personal: number;
}
export interface LaborLaw {
    minimumWageMonthly: number;
    maximumHoursPerWeek: number;
    minimumLeaveDaysPerYear: number;
    pensionContributionRequired: boolean;
    healthInsuranceRequired: boolean;
    workersCompensationRequired: boolean;
}
export interface PensionConfig {
    contribution: number;
    employerContribution: number;
    vesting: number;
    eligibilityAgeYears: number;
    annualContributionCap?: number;
}
export interface ExamBoard {
    name: string;
    examTypes: readonly string[];
    certificateValidityYears: number;
    appealDeadlineDays: number;
}
export interface AddressFormat {
    required: readonly string[];
    example: string;
}
export interface RegistrationFormat {
    pattern: string;
    example: string;
}
export interface Policy {
    name: string;
    taxIdFormat: TaxIdFormat;
    taxes: TaxConfig;
    laborLaw: LaborLaw;
    pension: PensionConfig;
    examBoards: readonly ExamBoard[];
    addressFormat: AddressFormat;
    registrationFormat: RegistrationFormat;
    currency: string;
    calendarYearEnd: string;
    complianceReminders: readonly string[];
}
export declare const policies: Record<string, Policy>;
/**
 * Get policy for a jurisdiction code.
 * @param jurisdiction - Code (KE, UG, NG)
 * @returns Policy object
 * @throws Error if jurisdiction not found
 */
export declare function getPolicy(jurisdiction: string): Policy;
/**
 * Check if a jurisdiction is supported.
 * @param jurisdiction - Code to check
 * @returns true if supported
 */
export declare function isSupportedJurisdiction(jurisdiction: string): boolean;
/**
 * List all supported jurisdiction codes.
 * @returns Array of codes
 */
export declare function getSupportedJurisdictions(): string[];
/**
 * Compare policies (for CLI tools, doc generation, etc.)
 * @param j1 - First jurisdiction
 * @param j2 - Second jurisdiction
 * @returns Object showing differences
 */
export declare function comparePolicies(j1: string, j2: string): Record<string, unknown>;
//# sourceMappingURL=policies.d.ts.map