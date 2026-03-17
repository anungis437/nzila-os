/**
 * Domain layer — canonical entity types, invariants, and value objects.
 *
 * This directory is the source of truth for union-eyes business terminology.
 * Import domain types from here, not from db schemas or service files.
 *
 * Migration: entity types will be extracted here from db/ and lib/types/
 * as files are touched. New entity types must be defined here.
 */

// Re-export from existing locations during migration
// TODO: Extract Claim, Member, Organization types here
export {}
