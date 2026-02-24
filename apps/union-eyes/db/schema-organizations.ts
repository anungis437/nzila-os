// =====================================================
// Drizzle ORM Schema: Hierarchical Organizations
// Phase 5A: CLC Multi-Tenancy Support
// =====================================================

import { pgTable, uuid, text, timestamp, integer, jsonb, boolean, date, pgEnum, index, uniqueIndex, type AnyPgColumn, varchar, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =====================================================
// ENUMS
// =====================================================

export const organizationTypeEnum = pgEnum('organization_type', [
  'platform',
  'congress',
  'federation',
  'union',
  'local',
  'region',
  'district',
]);

export const caJurisdictionEnum = pgEnum('ca_jurisdiction', [
  'federal',
  'AB',
  'BC',
  'MB',
  'NB',
  'NL',
  'NS',
  'NT',
  'NU',
  'ON',
  'PE',
  'QC',
  'SK',
  'YT',
]);

export const labourSectorEnum = pgEnum('labour_sector', [
  'healthcare',
  'education',
  'public_service',
  'trades',
  'manufacturing',
  'transportation',
  'retail',
  'hospitality',
  'technology',
  'construction',
  'utilities',
  'telecommunications',
  'financial_services',
  'agriculture',
  'arts_culture',
  'other',
]);

export const organizationStatusEnum = pgEnum('organization_status', [
  'active',
  'inactive',
  'suspended',
  'archived',
]);

// =====================================================
// ORGANIZATIONS TABLE
// =====================================================

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Basic Information
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    displayName: text('display_name'),
    shortName: text('short_name'),
    description: text('description'),

    // Hierarchy
    organizationType: organizationTypeEnum('organization_type').notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => organizations.id, { onDelete: 'restrict' }),
    hierarchyPath: text('hierarchy_path').array().notNull(),
    hierarchyLevel: integer('hierarchy_level').notNull().default(0),

    // Jurisdiction & Sectors
    // jurisdiction: caJurisdictionEnum('jurisdiction'), // Commented out - column does not exist in database
    provinceTerritory: text('province_territory'),
    sectors: labourSectorEnum('sectors').array().default([]),

    // Contact & Metadata
    email: text('email'),
    phone: text('phone'),
    website: text('website'),
    address: jsonb('address').$type<{
      street?: string;
      unit?: string;
      city?: string;
      province?: string;
      postal_code?: string;
      country?: string;
    }>(),

    // CLC Affiliation
    clcAffiliated: boolean('clc_affiliated').default(false),
    affiliationDate: date('affiliation_date'),
    charterNumber: text('charter_number'),

    // CLC Financial Settings (stored in settings JSONB, but commonly accessed)
    // Note: Per-capita rates are tracked per remittance period in per_capita_remittances table
    // Default values can be stored in settings: { perCapitaRate: 1.00, remittanceDay: 15 }
    // These are organization-level defaults that feed into per-capita calculations

    // Membership Counts (cached)
    memberCount: integer('member_count').default(0),
    activeMemberCount: integer('active_member_count').default(0),
    lastMemberCountUpdate: timestamp('last_member_count_update', { withTimezone: true }),

    // Billing & Settings
    subscriptionTier: text('subscription_tier'),
    billingContactId: uuid('billing_contact_id'),
    // Settings JSONB stores flexible configuration:
    // {
    //   perCapitaRate?: number;        // Default per-capita rate for remittances
    //   remittanceDay?: number;        // Day of month for remittances (1-31)
    //   fiscalYearEnd?: string;        // e.g., "March 31"
    //   customFields?: Record<string, unknown>;
    // }
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}),
    featuresEnabled: text('features_enabled').array().default([]),

    // Status & Audit
    status: text('status').default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdBy: uuid('created_by'),
    
    // Legacy & Migration
    legacyTenantId: uuid('legacy_tenant_id'),
    
    // CLC Financial Fields
    clcAffiliateCode: varchar('clc_affiliate_code', { length: 20 }),
    perCapitaRate: numeric('per_capita_rate', { precision: 10, scale: 2 }),
    remittanceDay: integer('remittance_day').default(15),
    lastRemittanceDate: timestamp('last_remittance_date', { withTimezone: true }),
    fiscalYearEnd: date('fiscal_year_end').default('2024-12-31'),
  },
  (table) => ({
    parentIdx: index('idx_organizations_parent').on(table.parentId),
    typeIdx: index('idx_organizations_type').on(table.organizationType),
    slugIdx: index('idx_organizations_slug').on(table.slug),
    hierarchyLevelIdx: index('idx_organizations_hierarchy_level').on(table.hierarchyLevel),
    statusIdx: index('idx_organizations_status').on(table.status),
    clcAffiliatedIdx: index('idx_organizations_clc_affiliated').on(table.clcAffiliated),
    // jurisdictionIdx: index('idx_organizations_jurisdiction').on(table.jurisdiction), // Commented out - column does not exist
    legacyTenantIdx: index('idx_organizations_legacy_tenant').on(table.legacyTenantId),
  })
);

// =====================================================
// ORGANIZATION RELATIONSHIPS TABLE
// =====================================================

export const organizationRelationshipTypeEnum = pgEnum('organization_relationship_type', [
  'affiliate',
  'federation',
  'local',
  'chapter',
  'region',
  'district',
  'joint_council',
  'merged_from',
  'split_from',
]);

export const organizationRelationships = pgTable(
  'organization_relationships',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Relationship Parties
    parentOrgId: uuid('parent_org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    childOrgId: uuid('child_org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Relationship Type
    relationshipType: organizationRelationshipTypeEnum('relationship_type').notNull(),

    // Temporal Tracking
    effectiveDate: date('effective_date').notNull().defaultNow(),
    endDate: date('end_date'),

    // Relationship Details
    notes: text('notes'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    createdBy: uuid('created_by'),
  },
  (table) => ({
    parentIdx: index('idx_org_relationships_parent').on(table.parentOrgId),
    childIdx: index('idx_org_relationships_child').on(table.childOrgId),
    typeIdx: index('idx_org_relationships_type').on(table.relationshipType),
    uniqueRelationship: uniqueIndex('unique_org_relationship').on(
      table.parentOrgId,
      table.childOrgId,
      table.relationshipType,
      table.effectiveDate
    ),
  })
);

// =====================================================
// RELATIONS
// =====================================================

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  // Parent organization
  parent: one(organizations, {
    fields: [organizations.parentId],
    references: [organizations.id],
    relationName: 'organization_hierarchy',
  }),

  // Child organizations
  children: many(organizations, {
    relationName: 'organization_hierarchy',
  }),

  // Relationships as parent
  childRelationships: many(organizationRelationships, {
    relationName: 'parent_org_relationships',
  }),

  // Relationships as child
  parentRelationships: many(organizationRelationships, {
    relationName: 'child_org_relationships',
  }),

  // Members
  members: many(organizationMembers),
}));

export const organizationRelationshipsRelations = relations(
  organizationRelationships,
  ({ one }) => ({
    parentOrg: one(organizations, {
      fields: [organizationRelationships.parentOrgId],
      references: [organizations.id],
      relationName: 'parent_org_relationships',
    }),
    childOrg: one(organizations, {
      fields: [organizationRelationships.childOrgId],
      references: [organizations.id],
      relationName: 'child_org_relationships',
    }),
  })
);

// =====================================================
// ORGANIZATION MEMBERS (UPDATED)
// =====================================================

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    
    // organization_id stores the slug (TEXT), not UUID
    // This allows flexible reference without strict foreign key constraint
    organizationId: text('organization_id').notNull(),
    
    // LEGACY: Keep for backward compatibility during migration
    tenantId: uuid('tenant_id'),
    
    // Required fields in actual database
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    
    role: text('role').notNull(),
    status: text('status').notNull().default('active'),
    isPrimary: boolean('is_primary').default(false),
    
    // Additional fields
    department: text('department'),
    position: text('position'),
    hireDate: timestamp('hire_date', { withTimezone: true }),
    membershipNumber: text('membership_number'),
    seniority: integer('seniority'),
    unionJoinDate: timestamp('union_join_date', { withTimezone: true }),
    preferredContactMethod: text('preferred_contact_method'),
    metadata: text('metadata'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    orgIdIdx: index('idx_organization_members_org_id').on(table.organizationId),
    userIdIdx: index('idx_organization_members_user_id').on(table.userId),
    uniqueMembership: uniqueIndex('unique_org_membership').on(
      table.organizationId,
      table.userId
    ),
  })
);

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
}));

// =====================================================
// UPDATED TABLES (Add organization_id column)
// =====================================================

// These are partial schemas showing the new organization_id column
// Full schemas exist elsewhere, this just documents the migration
// 
// NOTE: Legacy tenantId fields are kept for backward compatibility during migration.
// They should be removed in a future major version once all systems are updated.
// Current status (2024): Migration to organization_id complete, legacy fields deprecated.

export const claimsOrganizationMigration = {
  // Add to existing claims table
  organizationId: uuid('organization_id').references(() => organizations.id),
  // Keep legacy tenant_id for backward compatibility
  tenantId: uuid('tenant_id'),
};

export const membersOrganizationMigration = {
  organizationId: uuid('organization_id').references(() => organizations.id),
  tenantId: uuid('tenant_id'),
};

export const strikeFundsOrganizationMigration = {
  organizationId: uuid('organization_id').references(() => organizations.id),
  tenantId: uuid('tenant_id'),
};

export const duesPaymentsOrganizationMigration = {
  organizationId: uuid('organization_id').references(() => organizations.id),
  tenantId: uuid('tenant_id'),
};

export const deadlinesOrganizationMigration = {
  organizationId: uuid('organization_id').references(() => organizations.id),
  tenantId: uuid('tenant_id'),
};

export const documentsOrganizationMigration = {
  organizationId: uuid('organization_id').references(() => organizations.id),
  tenantId: uuid('tenant_id'),
};

// =====================================================
// TYPE EXPORTS
// =====================================================

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationRelationship = typeof organizationRelationships.$inferSelect;
export type NewOrganizationRelationship = typeof organizationRelationships.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;

// =====================================================
// HELPER TYPE GUARDS
// =====================================================

export function isCLCRootOrg(org: Organization): boolean {
  return org.organizationType === 'congress' && org.parentId === null;
}

export function isNationalUnion(org: Organization): boolean {
  return org.organizationType === 'union' && org.hierarchyLevel === 1;
}

export function isLocalUnion(org: Organization): boolean {
  return org.organizationType === 'local';
}

export function isFederation(org: Organization): boolean {
  return org.organizationType === 'federation';
}

