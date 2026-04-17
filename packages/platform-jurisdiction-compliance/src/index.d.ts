/**
 * @nzila/platform-jurisdiction-compliance
 *
 * Multi-jurisdiction compliance policy framework for regulatory requirements
 * across Africa (Kenya, Uganda, Nigeria).
 *
 * Provides jurisdiction-specific policies for:
 * - Tax rates, IDs, compliance deadlines
 * - Labor laws (minimum wage, hours, leave)
 * - Pension/retirement requirements
 * - Exam board standards and certificate validity
 * - Address/registration formats per jurisdiction
 *
 * @module @nzila/platform-jurisdiction-compliance
 * @exports Jurisdiction, Policy, ValidationResult, getPolicy, validateEmployeeRecord, etc.
 */
export { getPolicy, isSupportedJurisdiction, getSupportedJurisdictions, comparePolicies, policies, } from './policies';
export type { TaxIdFormat, TaxConfig, LaborLaw, PensionConfig, ExamBoard, AddressFormat, RegistrationFormat, Policy, } from './policies';
export { validateJurisdiction, validateTaxId, validateMinimumWage, validateWorkingHours, validateAnnualLeaveDays, validatePensionContribution, calculateTax, validateCorporateTaxRate, validateCooperativeRegistration, validateAddress, validateExamType, validateExamGrade, validateCertificateFreshness, validateEmployeeRecord, validateCooperativeRecord, } from './validators';
export type { ValidationResult, EmployeeRecord, CooperativeRecord, } from './validators';
export { generateKenyaCooperative, generateKenyaFarmers, generateKenyaExaminee, generateUgandaCooperative, generateUgandaFarmers, generateUgandaExaminee, generateNigeriaCooperative, generateNigeriaFarmers, generateNigeriaExaminee, generateTestDataset, } from './test-datasets';
export type { TestCooperative, TestFarmer, TestExaminee, } from './test-datasets';
export type JurisdictionCode = 'KE' | 'UG' | 'NG' | 'default';
export interface JurisdictionMetadata {
    code: JurisdictionCode;
    displayName: string;
    region: 'East Africa' | 'West Africa' | 'Southern Africa' | 'Global';
    languages: readonly string[];
    currency: string;
    timezoneUTC: string;
}
export declare const jurisdictions: Record<JurisdictionCode, JurisdictionMetadata>;
export declare const agrimoTaxRates: {
    KE: {
        cooperativeRegistrationTaxPercent: number;
        harvestSalesTaxPercent: number;
        certificationFeesUSD: number;
        supportedCrops: string[];
        certifications: string[];
    };
    UG: {
        cooperativeRegistrationTaxPercent: number;
        harvestSalesTaxPercent: number;
        certificationFeesUSD: number;
        supportedCrops: string[];
        certifications: string[];
    };
    NG: {
        cooperativeRegistrationTaxPercent: number;
        harvestSalesTaxPercent: number;
        certificationFeesUSD: number;
        supportedCrops: string[];
        certifications: string[];
    };
    default: {
        cooperativeRegistrationTaxPercent: number;
        harvestSalesTaxPercent: number;
        certificationFeesUSD: number;
        supportedCrops: string[];
        certifications: string[];
    };
};
export declare const agrimoPensionRequirements: {
    KE: {
        mandatoryContributionPercent: number;
        providerName: string;
        accountFormat: string;
        minimumMembersForEnrollment: number;
        auditFrequencyMonths: number;
    };
    UG: {
        mandatoryContributionPercent: number;
        providerName: string;
        accountFormat: string;
        minimumMembersForEnrollment: number;
        auditFrequencyMonths: number;
    };
    NG: {
        mandatoryContributionPercent: number;
        providerName: string;
        accountFormat: string;
        minimumMembersForEnrollment: number;
        auditFrequencyMonths: number;
    };
    default: {
        mandatoryContributionPercent: number;
        providerName: string;
        accountFormat: string;
        minimumMembersForEnrollment: number;
        auditFrequencyMonths: number;
    };
};
export declare const nacpExamRequirements: {
    KE: {
        examBoardName: string;
        minimumPassingGrade: number;
        certificateValidityYears: number;
        renewalRequired: boolean;
        supportedExamTypes: string[];
        minimumTrainingHours: number;
        maxAttempts: number;
    };
    UG: {
        examBoardName: string;
        minimumPassingGrade: number;
        certificateValidityYears: number;
        renewalRequired: boolean;
        supportedExamTypes: string[];
        minimumTrainingHours: number;
        maxAttempts: number;
    };
    NG: {
        examBoardName: string;
        minimumPassingGrade: number;
        certificateValidityYears: number;
        renewalRequired: boolean;
        supportedExamTypes: string[];
        minimumTrainingHours: number;
        maxAttempts: number;
    };
    default: {
        examBoardName: string;
        minimumPassingGrade: number;
        certificateValidityYears: number;
        renewalRequired: boolean;
        supportedExamTypes: string[];
        minimumTrainingHours: number;
        maxAttempts: number;
    };
};
export declare const jurisdictionFeatureFlags: {
    KE: {
        enablePensionIntegration: boolean;
        enableCooperativeTaxReporting: boolean;
        enableMobileMoneyPayments: boolean;
        enableSwahiliUI: boolean;
        enableBulkCertificationImport: boolean;
        enableAdvancedAnalytics: boolean;
        enablePriceFluctuationAlerts: boolean;
    };
    UG: {
        enablePensionIntegration: boolean;
        enableCooperativeTaxReporting: boolean;
        enableMobileMoneyPayments: boolean;
        enableSwahiliUI: boolean;
        enableBulkCertificationImport: boolean;
        enableAdvancedAnalytics: boolean;
        enablePriceFluctuationAlerts: boolean;
    };
    NG: {
        enablePensionIntegration: boolean;
        enableCooperativeTaxReporting: boolean;
        enableMobileMoneyPayments: boolean;
        enableSwahiliUI: boolean;
        enableBulkCertificationImport: boolean;
        enableAdvancedAnalytics: boolean;
        enablePriceFluctuationAlerts: boolean;
    };
    default: {
        enablePensionIntegration: boolean;
        enableCooperativeTaxReporting: boolean;
        enableMobileMoneyPayments: boolean;
        enableSwahiliUI: boolean;
        enableBulkCertificationImport: boolean;
        enableAdvancedAnalytics: boolean;
        enablePriceFluctuationAlerts: boolean;
    };
};
export interface JurisdictionConfig {
    jurisdictionCode: JurisdictionCode;
    orgId: string;
    appType: 'agrimo' | 'nacp' | 'union_eyes' | 'platform';
}
/**
 * Resolve jurisdiction-specific config for Agrimo tax rates.
 */
export declare function getAgrimoTaxPolicy(code: JurisdictionCode): {
    cooperativeRegistrationTaxPercent: number;
    harvestSalesTaxPercent: number;
    certificationFeesUSD: number;
    supportedCrops: string[];
    certifications: string[];
} | {
    cooperativeRegistrationTaxPercent: number;
    harvestSalesTaxPercent: number;
    certificationFeesUSD: number;
    supportedCrops: string[];
    certifications: string[];
} | {
    cooperativeRegistrationTaxPercent: number;
    harvestSalesTaxPercent: number;
    certificationFeesUSD: number;
    supportedCrops: string[];
    certifications: string[];
} | {
    cooperativeRegistrationTaxPercent: number;
    harvestSalesTaxPercent: number;
    certificationFeesUSD: number;
    supportedCrops: string[];
    certifications: string[];
};
/**
 * Resolve jurisdiction-specific config for Agrimo pension requirements.
 */
export declare function getAgrimoPensionPolicy(code: JurisdictionCode): {
    mandatoryContributionPercent: number;
    providerName: string;
    accountFormat: string;
    minimumMembersForEnrollment: number;
    auditFrequencyMonths: number;
} | {
    mandatoryContributionPercent: number;
    providerName: string;
    accountFormat: string;
    minimumMembersForEnrollment: number;
    auditFrequencyMonths: number;
} | {
    mandatoryContributionPercent: number;
    providerName: string;
    accountFormat: string;
    minimumMembersForEnrollment: number;
    auditFrequencyMonths: number;
} | {
    mandatoryContributionPercent: number;
    providerName: string;
    accountFormat: string;
    minimumMembersForEnrollment: number;
    auditFrequencyMonths: number;
};
/**
 * Resolve jurisdiction-specific config for NACP exam requirements.
 */
export declare function getNACPExamPolicy(code: JurisdictionCode): {
    examBoardName: string;
    minimumPassingGrade: number;
    certificateValidityYears: number;
    renewalRequired: boolean;
    supportedExamTypes: string[];
    minimumTrainingHours: number;
    maxAttempts: number;
} | {
    examBoardName: string;
    minimumPassingGrade: number;
    certificateValidityYears: number;
    renewalRequired: boolean;
    supportedExamTypes: string[];
    minimumTrainingHours: number;
    maxAttempts: number;
} | {
    examBoardName: string;
    minimumPassingGrade: number;
    certificateValidityYears: number;
    renewalRequired: boolean;
    supportedExamTypes: string[];
    minimumTrainingHours: number;
    maxAttempts: number;
} | {
    examBoardName: string;
    minimumPassingGrade: number;
    certificateValidityYears: number;
    renewalRequired: boolean;
    supportedExamTypes: string[];
    minimumTrainingHours: number;
    maxAttempts: number;
};
/**
 * Resolve jurisdiction-specific feature flags.
 */
export declare function getFeatureFlags(code: JurisdictionCode): {
    enablePensionIntegration: boolean;
    enableCooperativeTaxReporting: boolean;
    enableMobileMoneyPayments: boolean;
    enableSwahiliUI: boolean;
    enableBulkCertificationImport: boolean;
    enableAdvancedAnalytics: boolean;
    enablePriceFluctuationAlerts: boolean;
} | {
    enablePensionIntegration: boolean;
    enableCooperativeTaxReporting: boolean;
    enableMobileMoneyPayments: boolean;
    enableSwahiliUI: boolean;
    enableBulkCertificationImport: boolean;
    enableAdvancedAnalytics: boolean;
    enablePriceFluctuationAlerts: boolean;
} | {
    enablePensionIntegration: boolean;
    enableCooperativeTaxReporting: boolean;
    enableMobileMoneyPayments: boolean;
    enableSwahiliUI: boolean;
    enableBulkCertificationImport: boolean;
    enableAdvancedAnalytics: boolean;
    enablePriceFluctuationAlerts: boolean;
} | {
    enablePensionIntegration: boolean;
    enableCooperativeTaxReporting: boolean;
    enableMobileMoneyPayments: boolean;
    enableSwahiliUI: boolean;
    enableBulkCertificationImport: boolean;
    enableAdvancedAnalytics: boolean;
    enablePriceFluctuationAlerts: boolean;
};
/**
 * Check if an app + jurisdiction combination is launchable.
 */
export declare function isJurisdictionLaunchReady(jurisdiction: JurisdictionCode, app: string): {
    ready: boolean;
    blockers: readonly string[];
};
/**
 * Generate a launch checklist for a jurisdiction + app.
 */
export interface LaunchChecklist {
    jurisdiction: JurisdictionCode;
    app: string;
    items: {
        label: string;
        completed: boolean;
        notes?: string;
    }[];
}
export declare function generateLaunchChecklist(jurisdiction: JurisdictionCode, app: string): LaunchChecklist;
/**
 * Get jurisdiction name from code.
 * @param code Code like 'KE', 'UG', 'NG'
 * @returns Human-readable name
 */
export declare function getJurisdictionName(code: JurisdictionCode): string;
/**
 * Get jurisdiction metadata (timezone, languages, currency).
 */
export declare function getJurisdictionInfo(code: JurisdictionCode): JurisdictionMetadata;
/**
 * Check if jurisdiction is supported in this package version.
 */
export declare function isSupportedJurisdictionCode(code: string): code is JurisdictionCode;
//# sourceMappingURL=index.d.ts.map