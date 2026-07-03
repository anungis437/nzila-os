# Master Finalization Index

- **As of:** 2026-07-03
- **Approver:** Repo owner / sole operator (human GO sign-off)
- **Production scope:** `union-eyes`, `web`, `partners` (isolated prod runtimes, live). Internal-only: `console`, `control-plane`.
- **Authority:** this file (`master-finalization-index.md`) is the finalization authority. Every finalization document cites it.

This corpus records the real, Azure-CLI-verified and repo-gate-backed state of the
platform at production graduation. No evidence here is fabricated; every claim is
grounded in a live `az` read, a passing executable gate, or a recorded operation
in the attestation ledger (`proof-artifacts/rollout-attestations/`).

## Finalization documents

- `full-ecosystem-convergence-finalization.md` — convergence across the declared production surface.
- `canonical-operating-system-navigation.md` — canonical navigation of the production surface + governance.
- `full-role-experience-convergence.md` — role/experience posture for the production apps.
- `executive-operating-system-finalization.md` — executive-readable finalization summary.
- `full-environment-go-certification-program.md` — per-tier GO certification program (dev/staging/demo/pilot/prod).
- `production-readiness-hardening.md` — the hardening deltas closed (surface, deploy authority, BR-6, Azure runtime).
- `live-full-chain-operational-rehearsal.md` — the live build→deploy→verify→cutover chain, executed and verified.
- `cross-app-e2e-validation-matrix.md` — per-app production validation matrix.
- `final-operational-legitimacy-audit.md` — legitimacy audit across governance/operational/rollout/restoration/etc.
- `final-operating-system-readiness-review.md` — final readiness review + verdict.

## Evidence artifacts

- `proof-artifacts/finalization/finalization-manifest.json`
- `proof-artifacts/finalization/convergence-audit.json`
- `proof-artifacts/finalization/legitimacy-audit.json`
- `proof-artifacts/finalization/rehearsal-log.md`
- `proof-artifacts/finalization/certifications/{dev,staging,demo,pilot,prod}.json`
- `proof-artifacts/operational-proving/proving-manifest.json`
- `proof-artifacts/rollout-attestations/finalization-attestations.jsonl`
- `docs/readiness/*` (the full readiness certification set: isolation, OIDC, backup, DNS/TLS, config, digest, graduation).

## Anti-pattern posture

This corpus refuses launch-theater framing: no vanity scorecard, no leaderboard, no
metric-center theatrics. Status is derived only from executable gates and live
Azure evidence.
