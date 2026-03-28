/**
 * Member Domain
 * 
 * Core member identity and user management schemas.
 * 
 * This domain consolidates:
 * - profiles-schema.ts (18 dependencies)
 * - organization-members-schema.ts (deprecated)
 * - pending-profiles-schema.ts
 * - user-management-schema.ts
 * 
 * Priority: 1 (Highest - most connected)
 */

// Export all member-related schemas from consolidated domain location
export * from './profiles';
export * from './pending-profiles';
export * from './user-management';
export * from './member-employment';
export * from './member-segments';
export * from './addresses';
export * from './stewards';
export * from './jurisdiction-preferences';
// Note: organization-members-schema was commented out in original (using Phase 5A version from schema-organizations)
