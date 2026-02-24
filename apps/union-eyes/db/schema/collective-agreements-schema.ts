import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, index, boolean } from "drizzle-orm/pg-core";

// Enums for Collective Bargaining Agreements
export const jurisdictionEnum = pgEnum("cba_jurisdiction", [
  "federal",
  "ontario",
  "bc",
  "alberta",
  "quebec",
  "manitoba",
  "saskatchewan",
  "nova_scotia",
  "new_brunswick",
  "pei",
  "newfoundland",
  "northwest_territories",
  "yukon",
  "nunavut"
]);

export const cbaLanguageEnum = pgEnum("cba_language", [
  "en",
  "fr",
  "bilingual"
]);

export const cbaStatusEnum = pgEnum("cba_status", [
  "active",
  "expired",
  "under_negotiation",
  "ratified_pending",
  "archived"
]);

// Main Collective Bargaining Agreement table
export const collectiveAgreements = pgTable("collective_agreements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  
  // Core identification
  cbaNumber: varchar("cba_number", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 500 }).notNull(),
  jurisdiction: jurisdictionEnum("jurisdiction").notNull(),
  language: cbaLanguageEnum("language").notNull().default("en"),
  
  // Parties
  employerName: varchar("employer_name", { length: 300 }).notNull(),
  employerId: varchar("employer_id", { length: 100 }),
  unionName: varchar("union_name", { length: 300 }).notNull(),
  unionLocal: varchar("union_local", { length: 100 }),
  unionId: varchar("union_id", { length: 100 }),
  
  // Dates and duration
  effectiveDate: timestamp("effective_date", { withTimezone: true }).notNull(),
  expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),
  signedDate: timestamp("signed_date", { withTimezone: true }),
  ratificationDate: timestamp("ratification_date", { withTimezone: true }),
  
  // Scope and coverage
  industrySector: varchar("industry_sector", { length: 200 }).notNull(),
  sector: varchar("sector", { length: 200 }),
  employeeCoverage: integer("employee_coverage"),
  bargainingUnitDescription: text("bargaining_unit_description"),
  
  // Document storage
  documentUrl: text("document_url"),
  documentHash: varchar("document_hash", { length: 64 }),
  rawText: text("raw_text"),
  
  // Structure and metadata
  structuredData: jsonb("structured_data").$type<{
    tableOfContents?: Array<{ section: string; page: number; title: string }>;
    articles?: Array<{ number: string; title: string; pageStart: number }>;
    schedules?: Array<{ name: string; description: string; pageStart: number }>;
    appendices?: Array<{ name: string; description: string; pageStart: number }>;
    wageGrid?: Array<{ classification: string; step: number; rate: number; effectiveDate: string }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    benefitSummary?: { [key: string]: any };
  }>(),
  
  // AI/Search capabilities
  embedding: text("embedding"), // Vector embedding as text (JSON array) - will convert to vector type if pgvector available
  summaryGenerated: text("summary_generated"),
  keyTerms: jsonb("key_terms").$type<string[]>(),
  aiProcessed: boolean("ai_processed").default(false),
  
  // Status and tracking
  status: cbaStatusEnum("status").notNull().default("active"),
  isPublic: boolean("is_public").default(false),
  viewCount: integer("view_count").default(0),
  
  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }),
  lastModifiedBy: varchar("last_modified_by", { length: 255 }),
  
  // Version control
  version: integer("version").notNull().default(1),
  supersededBy: uuid("superseded_by"),
  precedesId: uuid("precedes_id"),
}, (table) => ({
  organizationIdx: index("cba_organization_idx").on(table.organizationId),
  jurisdictionIdx: index("cba_jurisdiction_idx").on(table.jurisdiction),
  employerIdx: index("cba_employer_idx").on(table.employerName),
  unionIdx: index("cba_union_idx").on(table.unionName),
  expiryIdx: index("cba_expiry_idx").on(table.expiryDate),
  statusIdx: index("cba_status_idx").on(table.status),
  effectiveDateIdx: index("cba_effective_date_idx").on(table.effectiveDate),
  sectorIdx: index("cba_sector_idx").on(table.industrySector),
}));

// CBA versions history (for tracking amendments and renewals)
export const cbaVersionHistory = pgTable("cba_version_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  cbaId: uuid("cba_id").notNull().references(() => collectiveAgreements.id, { onDelete: "cascade" }),
  
  version: integer("version").notNull(),
  changeDescription: text("change_description").notNull(),
  changeType: varchar("change_type", { length: 50 }).notNull(), // amendment, renewal, correction, etc.
  
  previousData: jsonb("previous_data"),
  newData: jsonb("new_data"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
}, (table) => ({
  cbaIdx: index("cba_version_cba_idx").on(table.cbaId),
  versionIdx: index("cba_version_number_idx").on(table.version),
}));

// CBA contacts (negotiators, representatives, administrators)
export const cbaContacts = pgTable("cba_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  cbaId: uuid("cba_id").notNull().references(() => collectiveAgreements.id, { onDelete: "cascade" }),
  
  contactType: varchar("contact_type", { length: 50 }).notNull(), // union_rep, employer_rep, chief_negotiator, administrator
  name: varchar("name", { length: 200 }).notNull(),
  title: varchar("title", { length: 200 }),
  organization: varchar("organization", { length: 300 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  
  isPrimary: boolean("is_primary").default(false),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  cbaIdx: index("cba_contacts_cba_idx").on(table.cbaId),
  typeIdx: index("cba_contacts_type_idx").on(table.contactType),
}));

