# Full Environment GO Certification Program

Authority: `master-finalization-index.md`. As of 2026-07-03.

Per-tier GO certification. Each tier's machine-readable certificate lives in
`proof-artifacts/finalization/certifications/<tier>.json` and carries the human
GO decision of the sole approver plus per-area state (PROVEN or N/A).

## Tiers

| Tier | Env | Verdict | Basis |
| --- | --- | --- | --- |
| dev | developer/integration | GO | Governance gates run here; production-only areas N/A. |
| staging | `nzila-canada-staging-env` | GO | Promotion source; digest-verified artifact origin. |
| demo | `nzila-canada-demo-env` | GO | Isolated demo tier (union-eyes-demo). |
| pilot | `nzila-canada-pilot-env` | GO | Sovereign pilot (union-eyes-pilot + django, `nzila-canada-pilot-db`). |
| prod | `nzila-canada-prod-env` | GO | union-eyes/web/partners isolated, digest-pinned, live domains + TLS, backed DB, OIDC. |

## Areas certified

governance legitimacy · operational legitimacy · rollout legitimacy · restoration
legitimacy · continuity legitimacy · executive readability · operational
sustainability · cadence sustainability · convergence integrity · onboarding
legitimacy.

Areas not applicable to a tier are marked `N/A` (not falsely PROVEN). The prod tier
carries all ten as PROVEN with anchors resolving to the attestation ledger.
