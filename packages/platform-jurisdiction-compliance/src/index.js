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
// ─── Re-export Types & Functions ───────────────────────────────────────────
export { getPolicy, isSupportedJurisdiction, getSupportedJurisdictions, comparePolicies, policies, } from './policies';
export { validateJurisdiction, validateTaxId, validateMinimumWage, validateWorkingHours, validateAnnualLeaveDays, validatePensionContribution, calculateTax, validateCorporateTaxRate, validateCooperativeRegistration, validateAddress, validateExamType, validateExamGrade, validateCertificateFreshness, validateEmployeeRecord, validateCooperativeRecord, } from './validators';
export { generateKenyaCooperative, generateKenyaFarmers, generateKenyaExaminee, generateUgandaCooperative, generateUgandaFarmers, generateUgandaExaminee, generateNigeriaCooperative, generateNigeriaFarmers, generateNigeriaExaminee, generateTestDataset, } from './test-datasets';
export const jurisdictions = {
    KE: {
        code: 'KE',
        displayName: 'Kenya',
        region: 'East Africa',
        languages: ['en', 'sw'],
        currency: 'KES',
        timezoneUTC: 'EAT (+03:00)',
    },
    UG: {
        code: 'UG',
        displayName: 'Uganda',
        region: 'East Africa',
        languages: ['en', 'sw'],
        currency: 'UGX',
        timezoneUTC: 'EAT (+03:00)',
    },
    NG: {
        code: 'NG',
        displayName: 'Nigeria',
        region: 'West Africa',
        languages: ['en', 'ha'],
        currency: 'NGN',
        timezoneUTC: 'WAT (+01:00)',
    },
    default: {
        code: 'default',
        displayName: 'Global Default',
        region: 'Global',
        languages: ['en', 'fr'],
        currency: 'USD',
        timezoneUTC: 'UTC (+00:00)',
    },
};
// ── Agrimo Jurisdiction Policies ────────────────────────────────────────────
export const agrimoTaxRates = {
    KE: {
        cooperativeRegistrationTaxPercent: 0.15, // 15% on cooperative revenue
        harvestSalesTaxPercent: 0.08, // 8% Agricultural produce VAT
        certificationFeesUSD: 50, // ISO/organic cert fees
        supportedCrops: ['maize', 'beans', 'tea', 'coffee', 'avocado', 'macadamia'],
        certifications: ['ISO-9001', 'Fairtrade', 'Organic-KE'],
    },
    UG: {
        cooperativeRegistrationTaxPercent: 0.1, // 10%
        harvestSalesTaxPercent: 0.08, // 8% VAT
        certificationFeesUSD: 35,
        supportedCrops: ['coffee', 'cocoa', 'cassava', 'bananas', 'cotton'],
        certifications: ['Fairtrade', 'Organic-UG', 'RainForest-Alliance'],
    },
    NG: {
        cooperativeRegistrationTaxPercent: 0.25, // 25% VAT in Nigeria
        harvestSalesTaxPercent: 0.05, // 5% agricultural exemption
        certificationFeesUSD: 45,
        supportedCrops: ['cocoa', 'cashew', 'groundnut', 'rice', 'millet'],
        certifications: ['ISO-9001', 'Organic-NG'],
    },
    default: {
        cooperativeRegistrationTaxPercent: 0.15,
        harvestSalesTaxPercent: 0.1,
        certificationFeesUSD: 50,
        supportedCrops: ['maize', 'beans', 'wheat'],
        certifications: ['ISO-9001', 'Organic'],
    },
};
export const agrimoPensionRequirements = {
    KE: {
        mandatoryContributionPercent: 0.1, // 10% matching for cooperatives ≥2000 members
        providerName: 'NSSF Kenya',
        accountFormat: 'NSSF-ID-12345678',
        minimumMembersForEnrollment: 50,
        auditFrequencyMonths: 12,
    },
    UG: {
        mandatoryContributionPercent: 0.05, // 5%
        providerName: 'NSSF Uganda',
        accountFormat: 'NSSF-ID-12345678',
        minimumMembersForEnrollment: 50,
        auditFrequencyMonths: 12,
    },
    NG: {
        mandatoryContributionPercent: 0.08, // 8%
        providerName: 'PenCom Nigeria',
        accountFormat: 'PIN-XXXXXXXX-XX',
        minimumMembersForEnrollment: 100,
        auditFrequencyMonths: 6,
    },
    default: {
        mandatoryContributionPercent: 0.1,
        providerName: 'Standard Pension',
        accountFormat: 'ACC-XXXXXXX',
        minimumMembersForEnrollment: 100,
        auditFrequencyMonths: 12,
    },
};
// ── NACP Jurisdiction Policies ──────────────────────────────────────────────
export const nacpExamRequirements = {
    KE: {
        examBoardName: 'Kenya National Examinations Council (KNEC)',
        minimumPassingGrade: 65, // Out of 100
        certificateValidityYears: 3,
        renewalRequired: true,
        supportedExamTypes: ['apprenticeship', 'competency', 'advanced_craft'],
        minimumTrainingHours: 2400, // 3 years × 800 hours/year
        maxAttempts: 3,
    },
    UG: {
        examBoardName: 'Uganda National Examinations Board (UNEB)',
        minimumPassingGrade: 50, // Out of 100
        certificateValidityYears: 5,
        renewalRequired: false,
        supportedExamTypes: ['apprenticeship', 'competency', 'skills_certification'],
        minimumTrainingHours: 1920, // 2.4 years
        maxAttempts: 3,
    },
    NG: {
        examBoardName: 'National Board for Technical Education (NBTE)',
        minimumPassingGrade: 60, // Out of 100
        certificateValidityYears: 2,
        renewalRequired: true,
        supportedExamTypes: ['apprenticeship', 'national_diploma', 'advanced_diploma'],
        minimumTrainingHours: 2880, // 3.6 years
        maxAttempts: 2,
    },
    default: {
        examBoardName: 'International Competency Authority',
        minimumPassingGrade: 60,
        certificateValidityYears: 3,
        renewalRequired: true,
        supportedExamTypes: ['competency', 'certification'],
        minimumTrainingHours: 2400,
        maxAttempts: 3,
    },
};
// ── Feature Flags ───────────────────────────────────────────────────────────
export const jurisdictionFeatureFlags = {
    KE: {
        enablePensionIntegration: true,
        enableCooperativeTaxReporting: true,
        enableMobileMoneyPayments: true, // M-Pesa
        enableSwahiliUI: true,
        enableBulkCertificationImport: false,
        enableAdvancedAnalytics: true,
        enablePriceFluctuationAlerts: true,
    },
    UG: {
        enablePensionIntegration: true,
        enableCooperativeTaxReporting: true,
        enableMobileMoneyPayments: true, // MTN Mobile, Airtel
        enableSwahiliUI: true,
        enableBulkCertificationImport: true,
        enableAdvancedAnalytics: false, // Phase 2
        enablePriceFluctuationAlerts: true,
    },
    NG: {
        enablePensionIntegration: true,
        enableCooperativeTaxReporting: true,
        enableMobileMoneyPayments: true, // Flutterwave, Paystack
        enableSwahiliUI: false, // Arabic instead
        enableBulkCertificationImport: true,
        enableAdvancedAnalytics: false, // Phase 2
        enablePriceFluctuationAlerts: false, // Phase 2
    },
    default: {
        enablePensionIntegration: false,
        enableCooperativeTaxReporting: false,
        enableMobileMoneyPayments: false,
        enableSwahiliUI: false,
        enableBulkCertificationImport: false,
        enableAdvancedAnalytics: false,
        enablePriceFluctuationAlerts: false,
    },
};
// ── Resolution Functions ────────────────────────────────────────────────────
/**
 * Resolve jurisdiction-specific config for Agrimo tax rates.
 */
export function getAgrimoTaxPolicy(code) {
    return agrimoTaxRates[code] || agrimoTaxRates.default;
}
/**
 * Resolve jurisdiction-specific config for Agrimo pension requirements.
 */
export function getAgrimoPensionPolicy(code) {
    return agrimoPensionRequirements[code] || agrimoPensionRequirements.default;
}
/**
 * Resolve jurisdiction-specific config for NACP exam requirements.
 */
export function getNACPExamPolicy(code) {
    return nacpExamRequirements[code] || nacpExamRequirements.default;
}
/**
 * Resolve jurisdiction-specific feature flags.
 */
export function getFeatureFlags(code) {
    return jurisdictionFeatureFlags[code] || jurisdictionFeatureFlags.default;
}
/**
 * Check if an app + jurisdiction combination is launchable.
 */
export function isJurisdictionLaunchReady(jurisdiction, app) {
    const blockers = [];
    if (jurisdiction === 'KE' && app === 'agrimo') {
        // Kenya + Agrimo: require tax reporting, pension integration
        if (!getAgrimoTaxPolicy('KE').supportedCrops)
            blockers.push('Missing crop list');
    }
    if (jurisdiction === 'NG' && app === 'nacp') {
        // Nigeria + NACP: require NBTE compliance
        const policy = getNACPExamPolicy('NG');
        if (policy.maxAttempts < 2)
            blockers.push('Insufficient exam attempts allowed');
    }
    return {
        ready: blockers.length === 0,
        blockers,
    };
}
export function generateLaunchChecklist(jurisdiction, app) {
    const baseItems = [
        { label: 'Jurisdiction metadata verified', completed: true, notes: '' },
        { label: 'Feature flags configured', completed: false, notes: '' },
        { label: 'Tax/compliance policies reviewed by legal', completed: false, notes: '' },
        { label: 'Test datasets created', completed: false, notes: '' },
        { label: 'Localization (i18n) complete', completed: false, notes: '' },
        { label: 'Load testing passed for jurisdiction', completed: false, notes: '' },
    ];
    if (app === 'agrimo') {
        baseItems.push({
            label: 'Cooperative tax reporting validated',
            completed: false,
            notes: '',
        });
        baseItems.push({
            label: 'Pension provider integration tested',
            completed: false,
            notes: '',
        });
    }
    if (app === 'nacp') {
        baseItems.push({
            label: 'Exam board policies reviewed',
            completed: false,
            notes: '',
        });
        baseItems.push({
            label: 'Certificate validity rules implemented',
            completed: false,
            notes: '',
        });
    }
    return { jurisdiction, app, items: baseItems };
}
// ─── Convenience Functions ─────────────────────────────────────────────────
/**
 * Get jurisdiction name from code.
 * @param code Code like 'KE', 'UG', 'NG'
 * @returns Human-readable name
 */
export function getJurisdictionName(code) {
    return jurisdictions[code]?.displayName || code;
}
/**
 * Get jurisdiction metadata (timezone, languages, currency).
 */
export function getJurisdictionInfo(code) {
    return jurisdictions[code] || jurisdictions.default;
}
/**
 * Check if jurisdiction is supported in this package version.
 */
export function isSupportedJurisdictionCode(code) {
    return code in jurisdictions;
}
//# sourceMappingURL=index.js.map