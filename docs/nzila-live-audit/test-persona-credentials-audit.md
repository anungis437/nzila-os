# Test Persona Credentials Audit

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

Test personas are RESERVED to non-production only. Fixtures: apps/union-eyes/tests/fixtures/test-users.ts. No test/demo persona credentials are provisioned in the production runtime; production secrets live in the ACA secret store / nzila-canada-prod-kv (not plaintext). One legacy plaintext storage key was surfaced on staging partners and is tracked for rotation (PARTIAL until rotated).
