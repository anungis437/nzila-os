/**
 * @nzila/platform-jurisdiction-compliance — Policy Validators
 *
 * Validation functions to check data against jurisdiction-specific rules.
 * Useful for form validation (frontend) and API request validation (backend).
 *
 * @module @nzila/platform-jurisdiction-compliance/validators
 */
import { getPolicy, isSupportedJurisdiction } from './policies';
// ─────────────────────────────────────────────────────────────────────────────
// Jurisdiction Validation
// ─────────────────────────────────────────────────────────────────────────────
export function validateJurisdiction(jurisdiction) {
    if (!jurisdiction) {
        return { valid: false, error: 'Jurisdiction is required' };
    }
    if (!isSupportedJurisdiction(jurisdiction)) {
        return { valid: false, error: `Unsupported jurisdiction: ${jurisdiction}` };
    }
    return { valid: true };
}
// ─────────────────────────────────────────────────────────────────────────────
// Tax ID Validation
// ─────────────────────────────────────────────────────────────────────────────
export function validateTaxId(taxId, jurisdiction) {
    if (!taxId) {
        return { valid: false, error: 'Tax ID is required' };
    }
    try {
        const policy = getPolicy(jurisdiction);
        const format = policy.taxIdFormat;
        const regex = new RegExp(format.regex);
        if (!regex.test(taxId)) {
            return {
                valid: false,
                error: `Tax ID must match format: ${format.example}`,
            };
        }
        if (taxId.length !== format.length) {
            return {
                valid: false,
                error: `Tax ID must be exactly ${format.length} characters`,
            };
        }
        return { valid: true };
    }
    catch (err) {
        if (err instanceof Error) {
            return { valid: false, error: err.message };
        }
        return { valid: false, error: 'Invalid jurisdiction' };
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Wage Validation
// ─────────────────────────────────────────────────────────────────────────────
export function validateMinimumWage(wage, jurisdiction) {
    try {
        const policy = getPolicy(jurisdiction);
        const minWage = policy.laborLaw.minimumWageMonthly;
        if (wage < minWage) {
            return {
                valid: false,
                error: `Wage must be at least ${minWage.toLocaleString()} ${policy.currency}`,
            };
        }
        return { valid: true };
    }
    catch (err) {
        if (err instanceof Error) {
            return { valid: false, error: err.message };
        }
        return { valid: false, error: 'Invalid jurisdiction' };
    }
}
export function validateWorkingHours(hoursPerWeek, jurisdiction) {
    try {
        const policy = getPolicy(jurisdiction);
        const maxHours = policy.laborLaw.maximumHoursPerWeek;
        if (hoursPerWeek > maxHours) {
            return {
                valid: false,
                error: `Maximum working hours per week: ${maxHours}`,
            };
        }
        if (hoursPerWeek < 0) {
            return { valid: false, error: 'Working hours cannot be negative' };
        }
        return { valid: true };
    }
    catch (err) {
        if (err instanceof Error) {
            return { valid: false, error: err.message };
        }
        return { valid: false, error: 'Invalid jurisdiction' };
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Leave & Benefits Validation
// ─────────────────────────────────────────────────────────────────────────────
export function validateAnnualLeaveDays(days, jurisdiction) {
    try {
        const policy = getPolicy(jurisdiction);
        const minDays = policy.laborLaw.minimumLeaveDaysPerYear;
        if (days < minDays) {
            return {
                valid: false,
                error: `Minimum leave days per year: ${minDays}`,
            };
        }
        if (days > 365) {
            return { valid: false, error: 'Leave days cannot exceed 365' };
        }
        return { valid: true };
    }
    catch (err) {
        if (err instanceof Error) {
            return { valid: false, error: err.message };
        }
        return { valid: false, error: 'Invalid jurisdiction' };
    }
}
export function validatePensionContribution(contribution, jurisdiction) {
    try {
        const policy = getPolicy(jurisdiction);
        if (!policy.laborLaw.pensionContributionRequired && contribution > 0) {
            return { valid: true }; // Optional, but contribution is OK if provided
        }
        if (contribution < 0) {
            return { valid: false, error: 'Contribution cannot be negative' };
        }
        // Check if contribution exceeds annual cap (if present)
        if (policy.pension.annualContributionCap && contribution > policy.pension.annualContributionCap) {
            return {
                valid: false,
                error: `Contribution cap: ${policy.pension.annualContributionCap.toLocaleString()} ${policy.currency}`,
            };
        }
        return { valid: true };
    }
    catch (err) {
        if (err instanceof Error) {
            return { valid: false, error: err.message };
        }
        return { valid: false, error: 'Invalid jurisdiction' };
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Tax & Financial Validation
// ─────────────────────────────────────────────────────────────────────────────
export function calculateTax(grossAmount, jurisdiction, taxType = 'standard') {
    try {
        const policy = getPolicy(jurisdiction);
        const rate = policy.taxes[taxType];
        if (rate < 0 || rate > 1) {
            return { valid: false, error: 'Invalid tax rate' };
        }
        const taxAmount = grossAmount * rate;
        return { valid: true, taxAmount };
    }
    catch (err) {
        if (err instanceof Error) {
            return { valid: false, error: err.message };
        }
        return { valid: false, error: 'Invalid jurisdiction' };
    }
}
export function validateCorporateTaxRate(rate, jurisdiction) {
    try {
        const policy = getPolicy(jurisdiction);
        const expectedRate = policy.taxes.corporate;
        if (Math.abs(rate - expectedRate) > 0.01) {
            // Allow 1% tolerance for rounding
            return {
                valid: false,
                error: `Corporate tax rate for ${policy.name}: ${(expectedRate * 100).toFixed(1)}%`,
            };
        }
        return { valid: true };
    }
    catch (err) {
        if (err instanceof Error) {
            return { valid: false, error: err.message };
        }
        return { valid: false, error: 'Invalid jurisdiction' };
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Registration & Address Validation
// ─────────────────────────────────────────────────────────────────────────────
export function validateCooperativeRegistration(registrationNumber, jurisdiction) {
    try {
        const policy = getPolicy(jurisdiction);
        const pattern = new RegExp(policy.registrationFormat.pattern);
        if (!pattern.test(registrationNumber)) {
            return {
                valid: false,
                error: `Registration number format: ${policy.registrationFormat.example}`,
            };
        }
        return { valid: true };
    }
    catch (err) {
        if (err instanceof Error) {
            return { valid: false, error: err.message };
        }
        return { valid: false, error: 'Invalid jurisdiction' };
    }
}
export function validateAddress(address, jurisdiction) {
    try {
        const policy = getPolicy(jurisdiction);
        const required = policy.addressFormat.required;
        const missing = required.filter((field) => !address[field]);
        if (missing.length > 0) {
            return {
                valid: false,
                error: `Missing required address fields: ${missing.join(', ')}`,
            };
        }
        return { valid: true };
    }
    catch (err) {
        if (err instanceof Error) {
            return { valid: false, error: err.message };
        }
        return { valid: false, error: 'Invalid jurisdiction' };
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Exam Board Validation
// ─────────────────────────────────────────────────────────────────────────────
export function validateExamType(examType, jurisdiction) {
    try {
        const policy = getPolicy(jurisdiction);
        const validTypes = new Set();
        for (const board of policy.examBoards) {
            for (const type of board.examTypes) {
                validTypes.add(type);
            }
        }
        if (!validTypes.has(examType)) {
            return {
                valid: false,
                error: `Invalid exam type for ${policy.name}. Valid types: ${Array.from(validTypes).join(', ')}`,
            };
        }
        return { valid: true };
    }
    catch (err) {
        if (err instanceof Error) {
            return { valid: false, error: err.message };
        }
        return { valid: false, error: 'Invalid jurisdiction' };
    }
}
export function validateExamGrade(grade, minGrade = 0, maxGrade = 100) {
    if (grade < minGrade || grade > maxGrade) {
        return {
            valid: false,
            error: `Grade must be between ${minGrade} and ${maxGrade}`,
        };
    }
    return { valid: true };
}
export function validateCertificateFreshness(expiryDate, jurisdiction) {
    try {
        const policy = getPolicy(jurisdiction);
        const boardWithMaxValidity = policy.examBoards.reduce((max, current) => current.certificateValidityYears > max.certificateValidityYears ? current : max);
        const now = new Date();
        const maxValidityMs = boardWithMaxValidity.certificateValidityYears * 365.25 * 24 * 60 * 60 * 1000;
        const daysSinceValidityEnd = (now.getTime() - expiryDate.getTime()) / (24 * 60 * 60 * 1000);
        if (daysSinceValidityEnd > 0) {
            return {
                valid: false,
                error: `Certificate expired ${Math.floor(daysSinceValidityEnd)} days ago`,
            };
        }
        return { valid: true };
    }
    catch (err) {
        if (err instanceof Error) {
            return { valid: false, error: err.message };
        }
        return { valid: false, error: 'Invalid jurisdiction' };
    }
}
export function validateEmployeeRecord(employee) {
    const jurisdictionCheck = validateJurisdiction(employee.jurisdiction);
    if (!jurisdictionCheck.valid)
        return jurisdictionCheck;
    const wageCheck = validateMinimumWage(employee.wage, employee.jurisdiction);
    if (!wageCheck.valid)
        return wageCheck;
    const hoursCheck = validateWorkingHours(employee.hoursPerWeek, employee.jurisdiction);
    if (!hoursCheck.valid)
        return hoursCheck;
    const leaveCheck = validateAnnualLeaveDays(employee.annualLeaveDays, employee.jurisdiction);
    if (!leaveCheck.valid)
        return leaveCheck;
    const pensionCheck = validatePensionContribution(employee.pensionContribution, employee.jurisdiction);
    if (!pensionCheck.valid)
        return pensionCheck;
    return { valid: true };
}
export function validateCooperativeRecord(coop) {
    const jurisdictionCheck = validateJurisdiction(coop.jurisdiction);
    if (!jurisdictionCheck.valid)
        return jurisdictionCheck;
    const taxIdCheck = validateTaxId(coop.taxId, coop.jurisdiction);
    if (!taxIdCheck.valid)
        return taxIdCheck;
    const regCheck = validateCooperativeRegistration(coop.registrationNumber, coop.jurisdiction);
    if (!regCheck.valid)
        return regCheck;
    const addressCheck = validateAddress(coop.address, coop.jurisdiction);
    if (!addressCheck.valid)
        return addressCheck;
    return { valid: true };
}
//# sourceMappingURL=validators.js.map