/**
 * DEPRECATED FILE — re-export shim only.
 *
 * The canonical `organizationMembers` table is defined in
 * `apps/union-eyes/db/schema-organizations.ts` (Phase 5A CLC schema)
 * and is the version exported through `@/db/schema`.
 *
 * Historically a parallel definition lived here with a different column
 * shape (no `tenant_id`, no `preferred_contact_method`, different
 * `organization_id` typing). That divergence caused runtime
 * `column "tenant_id" does not exist` errors in CI because the runtime
 * SELECT used the canonical column list while QA / direct importers
 * used the legacy one.
 *
 * To prevent recurrence, this file is now a thin re-export of the
 * canonical definitions. Do NOT add new schema definitions here. New
 * imports should target `@/db/schema` or `@/db/schema-organizations`.
 */
import { pgEnum } from "drizzle-orm/pg-core";
import { organizationMembers } from "../schema-organizations";

export { organizationMembers } from "../schema-organizations";

// Member category enum is preserved here for backward-compatibility with
// existing imports that referenced it from this module. The DB-level enum
// is created idempotently in tooling/sql/union-eyes-qa-baseline.sql.
export const memberCategoryEnum = pgEnum("member_category", [
  "full_member",
  "associate",
  "honorary",
  "retired",
]);

export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;
export type SelectOrganizationMember = typeof organizationMembers.$inferSelect;
