/**
 * DEPRECATED FILE — re-export shim only.
 *
 * The canonical `claims` and `claimUpdates` tables (along with all
 * claim enums) live in `apps/union-eyes/db/schema/claims-schema.ts`.
 * That file matches the `tooling/sql/union-eyes-qa-baseline.sql`
 * column shapes (decimal money columns, idempotency_hash, FK to
 * organizations, indexes).
 *
 * Historically this module re-defined `claims` with a different shape
 * (varchar money columns, no FK, no idempotency_hash). Two
 * `pgTable("claims", ...)` definitions in the same workspace cause
 * subtle SELECT/INSERT drift depending on which import path consumers
 * use. To prevent that recurring, this file is now a thin re-export
 * of the canonical definitions. Do NOT add new schema definitions
 * here.
 */
export {
  claimStatusEnum,
  claimPriorityEnum,
  claimTypeEnum,
  visibilityScopeEnum,
  claims,
  claimUpdates,
  type Claim,
  type NewClaim,
  type ClaimUpdate,
  type NewClaimUpdate,
} from "../../claims-schema";
