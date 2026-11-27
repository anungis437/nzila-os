/**
 * Step 1 S1-A01: the authority physical guards on real PostgreSQL, including the primary-handler ceilings
 * (ue_authority_rule_primary_handler_ceiling_chk, ue_authority_mandates_primary_handler_ceiling_chk, ue_authority_rel_primary_origin_chk)
 * for case:disclose_to_member, case:export_sealed_evidence and case:close. Runs the exact authority-physical-guards suite in its
 * native mode (an owned disposable PostgreSQL 16 container). No assertion is copied or relaxed.
 */
process.env.UE_AUTHORITY_GUARDS_NATIVE = '1'
await import('../auth/authority-physical-guards.pglite.test')
