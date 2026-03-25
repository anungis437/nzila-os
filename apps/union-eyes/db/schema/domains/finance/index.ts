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
export * from './contracts';
export * from './usage-metering';
export * from './dunning';

// DAPL — Dues-Aware Platform Ledger (Layers 1-3)
export * from './platform-billing';
export * from './platform-ledger';
export * from './allocation';

// MIL Phase 2 — Transaction Fees, Pricing, Amendments, Reconciliation
export * from './transaction-fees';
export * from './pricing-templates';
export * from './contract-amendments';
export * from './reconciliation';

// Explicit re-exports to resolve ambiguities
export { paymentProcessorEnum } from './payments';
