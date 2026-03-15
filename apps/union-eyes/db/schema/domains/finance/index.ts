/**
 * Finance Domain
 * 
 * Financial transactions, dues, and accounting schemas.
 * 
 * This domain consolidates:
 * - dues-transactions-schema.ts
 * - autopay-settings-schema.ts
 * - financial-payments-schema.ts
 * - chart-of-accounts-schema.ts
 * - strike-fund-tax-schema.ts
 * - transfer-pricing-schema.ts
 * 
 * Priority: 4
 * 
 * Duplicates to resolve:
 * - chartOfAccounts (3 locations - use chart-of-accounts-schema)
 * - glAccountMappings (2 locations)
 * - accountTypeEnum (2 locations)
 */

// Export all finance-related schemas from consolidated domain location
export * from './dues';
export * from './autopay';
export * from './payments';
export * from './accounting';
export * from './taxes';
export * from './transfer-pricing';
export * from './billing-config';
export * from './pension';

// Explicit re-exports to resolve ambiguities
export { paymentProcessorEnum } from './payments';
