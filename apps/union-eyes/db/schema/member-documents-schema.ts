/**
 * DEPRECATED FILE — re-export shim only.
 *
 * The canonical `memberDocuments` table (27 columns, live-DB-verified
 * 2026-09-01) lives in `member-profile-v2-schema.ts`. This file's
 * declaration was a correct-but-incomplete 10-column subset of the same
 * physical table; two `pgTable("member_documents", ...)` definitions in
 * the same workspace cause the same class of drift documented in
 * `claims-schema.ts`'s equivalent shim. Do NOT add new schema definitions
 * here.
 */
import { memberDocuments } from './member-profile-v2-schema';

export { memberDocuments };
export type MemberDocument = typeof memberDocuments.$inferSelect;
export type NewMemberDocument = typeof memberDocuments.$inferInsert;



