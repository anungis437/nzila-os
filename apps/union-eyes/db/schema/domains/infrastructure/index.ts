/**
 * Infrastructure Domain
 * 
 * System infrastructure and integration schemas.
 * 
 * This domain consolidates:
 * - audit-security-schema.ts
 * - feature-flags-schema.ts
 * - user-uuid-mapping-schema.ts (migration artifact)
 * - alerting-automation-schema.ts (595 lines)
 * - automation-rules-schema.ts
 * - recognition-rewards-schema.ts (563 lines)
 * - award-templates-schema.ts
 * - organizing-tools-schema.ts (727 lines - largest)
 * - sharing-permissions-schema.ts
 * - cms-website-schema.ts (717 lines)
 * - erp-integration-schema.ts (519 lines)
 * - clc-partnership-schema.ts
 * - clc-sync-schema.ts
 * - clc-per-capita-schema.ts
 * - clc-sync-audit-schema.ts
 * - international-address-schema.ts
 * - social-media-schema.ts (484 lines)
 * - joint-trust-fmv-schema.ts
 * - defensibility-packs-schema.ts
 * - accessibility-schema.ts
 * 
 * Priority: 13 (Last - largest and lowest coupling)
 * Files: 20 schemas
 * Lines: ~3,000 (largest domain)
 * 
 * Duplicates to resolve:
 * - clcSyncLog (3 locations - use clc-partnership-schema)
 * - clcWebhookLog (3 locations)
 * - rewardWalletLedger (2 locations)
 * - automationRules (2 locations)
 */

// Export all infrastructure-related schemas from consolidated domain location
export * from './audit';
export * from './features';
export * from './uuid-mapping';
export * from './alerting';
export * from './automation';
export * from './rewards';
export * from './awards';
export * from './organizing';
export * from './sharing';
export * from './cms';
export * from './erp';
export * from './clc-partnership';
export * from './clc-sync';
export * from './clc-per-capita';
export * from './clc-audit';
export * from './addresses';
export * from './social-media';
export * from './trust-fmv';
export * from './defensibility';
export * from './accessibility';
export * from './support';
export * from './integrations';
export * from './exit-interviews';

// Explicit re-exports to resolve ambiguities
// automationRules and AutomationRule - use automation.ts (primary definition)
export { automationRules, type AutomationRule } from './automation';

// awardStatusEnum and rewardWalletLedger - use awards.ts (primary award definitions)
export { awardStatusEnum, rewardWalletLedger } from './awards';

// clcSyncLog and clcSyncStatusEnum - use clc-partnership.ts (main CLC integration)
export { clcSyncLog, clcSyncStatusEnum } from './clc-partnership';

// clcSyncLogRelations - use clc-sync.ts (primary sync relations)
export { clcSyncLogRelations } from './clc-sync';

// clcWebhookLog - use clc-audit.ts (audit tracking purpose)
export { clcWebhookLog } from './clc-audit';

// chartOfAccounts and chartOfAccountsRelations - use erp.ts (main ERP integration)
export { chartOfAccounts, chartOfAccountsRelations } from './erp';

// syncStatusEnum - use erp.ts (primary definition)
export { syncStatusEnum } from './erp';
