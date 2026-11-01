# Union Eyes Gate 0 — global location policy least-privilege correction (2026-11-01)

Source baseline: `8a5f606cd1f664cda752ddbdb3e66cd42f384b91`, branch `agents/ue-cursor-final-closure`.

The preceding location-purpose remediation removed lazy creation of `location_tracking_config` from `services/geofence-privacy-service.ts`, but the source-governed storage authority registry still authorized `INSERT` for the member runtime role. This contradicted the new fail-closed read-only behavior.

This change removes runtime `INSERT` from the `location_tracking_config` authority declaration, leaving `SELECT` only. It updates the source justification to reflect that absent policy refuses GPS tracking, no member route can establish institutional location policy, and the Django generated configuration endpoint remains deny-all. The manifest-invariant regression test pins the read-only privilege, runtime principal and fail-closed justification.

Evidence status: **SOURCE_CHANGED_TEST_AUTHORED_NOT_QUALIFIED**. This is a privilege declaration and regression-test source correction, not proof that the deployed PostgreSQL roles have been reconciled. Exact-HEAD full Vitest/contract, native PG15/16 grants and catalog authority contract, HTTP/browser, staging, owner-persona and institutional decisions remain required. The separate scoped migration 0048 SECURITY DEFINER privilege-preflight failure is unresolved and must not be bypassed.

Defect accounting: 0 new implemented credits, 0 independent qualifications, 0 CLOSED. The 777-defect frozen provenance and release-debt index are untouched.
