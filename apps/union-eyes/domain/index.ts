/**
 * Domain layer — canonical entity types, invariants, and value objects.
 *
 * This directory is the source of truth for union-eyes business terminology.
 * Import domain types from here, not from db schemas or service files.
 *
 * Migration: entity types will be extracted here from db/ and lib/types/
 * as files are touched. New entity types must be defined here.
 */

// ── Claim ───────────────────────────────────────────────────────────────────
export type {
  Claim,
  NewClaim,
  ClaimUpdate,
  NewClaimUpdate,
} from '@/db/schema/domains/claims/claims';

// ── Organization Member ─────────────────────────────────────────────────────
export type {
  SelectOrganizationMember as Member,
  InsertOrganizationMember as NewMember,
} from '@/db/schema/organization-members-schema';

// ── Organization ────────────────────────────────────────────────────────────
export type {
  Organization,
} from '@/db/schema/organizations-schema';
