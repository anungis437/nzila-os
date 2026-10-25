/**
 * Union Eyes — Policy Lifecycle Extension Schema
 *
 * UE-specific table that links organization-scoped workflow overrides to the
 * platform-level governed_policies registry (packages/db).
 *
 * Enables per-org customization while maintaining full platform policy lineage.
 * An org can bind a governed policy to a local workflow with a custom evaluator
 * without forking or mutating the platform policy record.
 */

// The ue_policy_bindings Drizzle declaration was retired (UE-CONV-H-007); the physical table is unchanged.
export {};
