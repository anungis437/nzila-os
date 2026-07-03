# Live Feature Gating Audit

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE: union-eyes feature gating (apps/union-eyes/lib/feature-flags.ts). UE_DEMO_PROFILE=cupe4373 in production is a zod-enum-constrained UI role-experience profile for the CUPE tenant (not synthetic-data seeding) — verified in apps/union-eyes/lib/config/env-validation.ts. No demo-seeding or synthetic mode active in production.
