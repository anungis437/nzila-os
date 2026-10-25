/**
 * Phase 5B: Inter-Union Features - Sharing Permissions Schema
 * Created: November 19, 2025
 * Purpose: Organization sharing settings, access logs, and explicit grants
 */

import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  boolean, 
  timestamp,
  index,
  jsonb,
  integer
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../../../schema-organizations";

// ============================================================================
// ORGANIZATION SHARING SETTINGS
// ============================================================================

export const organizationSharingSettings = pgTable("organization_sharing_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  
  // Federation sharing settings
  allowFederationSharing: boolean("allow_federation_sharing").default(false),
  allowSectorSharing: boolean("allow_sector_sharing").default(false),
  allowProvinceSharing: boolean("allow_province_sharing").default(false),
  allowCongressSharing: boolean("allow_congress_sharing").default(false),
  autoShareClauses: boolean("auto_share_clauses").default(false),
  autoSharePrecedents: boolean("auto_share_precedents").default(false),
  requireAnonymization: boolean("require_anonymization").default(true),
  defaultSharingLevel: varchar("default_sharing_level", { length: 50 }).default('private'),
  allowedSharingLevels: varchar("allowed_sharing_levels", { length: 50 }).array(),
  sharingApprovalRequired: boolean("sharing_approval_required").default(true),
  sharingApproverRole: varchar("sharing_approver_role", { length: 50 }).default('admin'),
  maxSharedClauses: integer("max_shared_clauses"),
  maxSharedPrecedents: integer("max_shared_precedents"),
  
  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("idx_sharing_settings_org").on(table.organizationId),
}));

// ============================================================================
// CROSS-ORG ACCESS LOG
// ============================================================================

export const crossOrgAccessLog = pgTable("cross_org_access_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Who accessed
  userId: varchar("user_id", { length: 255 }).notNull(),
  userOrganizationId: uuid("user_organization_id")
    .notNull()
    .references(() => organizations.id),
  
  // What was accessed
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  resourceId: uuid("resource_id").notNull(),
  resourceOrganizationId: uuid("resource_organization_id").notNull(),
  
  // Access context
  accessType: varchar("access_type", { length: 50 }).notNull(),
  accessGrantedVia: varchar("access_granted_via", { length: 50 }),
  
  // Request metadata
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  
  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_access_log_user").on(table.userId),
  userOrgIdx: index("idx_access_log_user_org").on(table.userOrganizationId),
  resourceIdx: index("idx_access_log_resource").on(table.resourceType, table.resourceId),
  ownerIdx: index("idx_access_log_owner").on(table.resourceOrganizationId),
  dateIdx: index("idx_access_log_date").on(table.createdAt),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const organizationSharingSettingsRelations = relations(organizationSharingSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationSharingSettings.organizationId],
    references: [organizations.id],
  }),
}));

export const crossOrgAccessLogRelations = relations(crossOrgAccessLog, ({ one }) => ({
  userOrganization: one(organizations, {
    fields: [crossOrgAccessLog.userOrganizationId],
    references: [organizations.id],
    relationName: "userOrganization",
  }),
  resourceOwnerOrg: one(organizations, {
    fields: [crossOrgAccessLog.resourceOrganizationId],
    references: [organizations.id],
    relationName: "resourceOwnerOrg",
  }),
}));

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type OrganizationSharingSettings = typeof organizationSharingSettings.$inferSelect;
export type NewOrganizationSharingSettings = typeof organizationSharingSettings.$inferInsert;

export type CrossOrgAccessLog = typeof crossOrgAccessLog.$inferSelect;
export type NewCrossOrgAccessLog = typeof crossOrgAccessLog.$inferInsert;


// Sharing level types (imported from clause library schema)
// export type SharingLevel = "private" | "federation" | "congress" | "public";

// Resource types
export type ResourceType = "clause" | "precedent" | "analytics" | "cba" | "decision";

// Access types
export type AccessType = "view" | "download" | "compare" | "cite" | "export";

