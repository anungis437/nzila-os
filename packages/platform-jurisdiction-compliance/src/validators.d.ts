/**
 * @nzila/platform-jurisdiction-compliance — Policy Validators
 *
 * Validation functions to check data against jurisdiction-specific rules.
 * Useful for form validation (frontend) and API request validation (backend).
 *
 * @module @nzila/platform-jurisdiction-compliance/validators
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}
export declare function validateJurisdiction(jurisdiction: string): ValidationResult;
export declare function validateTaxId(taxId: string, jurisdiction: string): ValidationResult;
export declare function validateMinimumWage(wage: number, jurisdiction: string): ValidationResult;
export declare function validateWorkingHours(hoursPerWeek: number, jurisdiction: string): ValidationResult;
export declare function validateAnnualLeaveDays(days: number, jurisdiction: string): ValidationResult;
export declare function validatePensionContribution(contribution: number, jurisdiction: string): ValidationResult;
export declare function calculateTax(grossAmount: number, jurisdiction: string, taxType?: 'standard' | 'reduced'): ValidationResult & {
    taxAmount?: number;
};
export declare function validateCorporateTaxRate(rate: number, jurisdiction: string): ValidationResult;
export declare function validateCooperativeRegistration(registrationNumber: string, jurisdiction: string): ValidationResult;
export declare function validateAddress(address: Record<string, string>, jurisdiction: string): ValidationResult;
export declare function validateExamType(examType: string, jurisdiction: string): ValidationResult;
export declare function validateExamGrade(grade: number, minGrade?: number, maxGrade?: number): ValidationResult;
export declare function validateCertificateFreshness(expiryDate: Date, jurisdiction: string): ValidationResult;
export interface EmployeeRecord {
    name: string;
    wage: number;
    hoursPerWeek: number;
    annualLeaveDays: number;
    pensionContribution: number;
    jurisdiction: string;
}
export declare function validateEmployeeRecord(employee: EmployeeRecord): ValidationResult;
export interface CooperativeRecord {
    name: string;
    taxId: string;
    registrationNumber: string;
    address: Record<string, string>;
    jurisdiction: string;
}
export declare function validateCooperativeRecord(coop: CooperativeRecord): ValidationResult;
//# sourceMappingURL=validators.d.ts.map