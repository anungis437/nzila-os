/**
 * Domain-Driven Schema Exports
 * 
 * Consolidated schema exports organized by business domain.
 * 
 * This replaces the flat 75-file structure with 13 domain modules,
 * reducing import depth from 5 to 2 levels and eliminating 18 duplicates.
 * 
 * Migration Status: Phase 2 Complete - Domain Structure Created
 * Next: Phase 3 - Migrate individual schemas into domain folders
 * 
 * @see SCHEMA_CONSOLIDATION_DESIGN.md for full consolidation plan
 */

// Core Domains (High Priority)
export * from './member';           // Priority 1: Member profiles and user management
export * from './claims';           // Priority 2: Claims, grievances, deadlines
export * from './agreements';       // Priority 3: Collective bargaining agreements
export * from './finance';          // Priority 4: Financial transactions and accounting
export * from './governance';       // Priority 5: Governance, voting, structure
export * from './federation';       // Priority 5b: Provincial/Regional federation management

// Communication & Content Domains
export * from './communications';   // Priority 6: Member engagement and notifications
export * from './documents';        // Priority 7: Document storage and e-signatures
export * from './scheduling';       // Priority 8: Calendar, events, training

// Compliance & Data Domains
export * from './compliance';       // Priority 9: Regulatory compliance and privacy
export * from './data';             // Priority 10: External data integration
export * from './health-safety';   // Priority 10b: Workplace health & safety management

// Operations Domains
export * from './dispatch';         // Dispatch hall automation
export * from './employer-execution'; // Employer payroll/remittance execution

// Pilot Domains
export * from './pilot';            // CAPE-CLC pilot onboarding and demo data

// Advanced Feature Domains
export * from './ml';               // Priority 11: Machine learning and AI
export * from './analytics';        // Priority 12: Reporting and analytics

// Infrastructure Domain (Lowest Priority - Largest)
export * from './infrastructure';   // Priority 13: System infrastructure and integrations
