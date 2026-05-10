# Nzila Live Operational Audit — Authoritative Operational Truth Layer

**Status:** Final Live Environment & Operational Readiness Audit
**Authority:** This directory is the canonical operational truth layer for Nzila OS.
**Scope:** dev → staging → demo → pilot → prod
**Discipline:** Operational honesty — partial, deferred, mocked, simulated, or
incomplete elements MUST be explicitly identified.

---

## Purpose

This audit suite is **NOT**:
- architectural expansion
- governance invention
- validator expansion
- runtime redesign
- doctrine growth

This audit suite **IS**:
- final operational truth validation
- one authoritative operational truth report
- the authority layer above all prior `nzila-*` doctrine, governance, finalization,
  cognition, maturity, and convergence corpora

---

## Authority Lineage

| Predecessor Layer                             | Status      | Authority for                    |
|-----------------------------------------------|-------------|----------------------------------|
| `docs/nzila-finalization/`                    | upstream    | finalization corpus              |
| `docs/nzila-cognition-doctrine/`              | upstream    | cognition doctrine               |
| `docs/nzila-rollout-governance/`              | upstream    | rollout governance               |
| `docs/nzila-final-convergence/`               | upstream    | convergence certification        |
| `docs/nzila-maturity-elevation/`              | upstream    | maturity convergence             |
| `docs/nzila-operational-proving/`             | upstream    | operational proving              |
| `governance/release/domain-routing-registry.json` | source-of-truth | URL/domain routing           |
| `apps/union-eyes/tests/fixtures/test-users.ts`    | source-of-truth | UE test personas              |
| **`docs/nzila-live-audit/`**                  | **THIS LAYER** | **operational truth verdict** |

---

## Document Index

| #   | Document                                                                                  | Purpose                                            |
|-----|-------------------------------------------------------------------------------------------|----------------------------------------------------|
| 01  | [full-environment-inventory-audit.md](full-environment-inventory-audit.md)                | Authoritative environment inventory (dev → prod)   |
| 02  | [authoritative-url-domain-audit.md](authoritative-url-domain-audit.md)                    | Canonical URL & domain registry                    |
| 03  | [live-auth-role-access-audit.md](live-auth-role-access-audit.md)                          | Real runtime role access matrix                    |
| 04  | [test-persona-credentials-audit.md](test-persona-credentials-audit.md)                    | Canonical validation persona registry              |
| 05  | [full-page-navigation-reality-audit.md](full-page-navigation-reality-audit.md)            | Page/navigation reality check                      |
| 06  | [full-e2e-environment-validation.md](full-e2e-environment-validation.md)                  | Full operational journey coverage                  |
| 07  | [live-feature-gating-audit.md](live-feature-gating-audit.md)                              | Authoritative monetization & visibility truth      |
| 08  | [monetization-doctrine-alignment-audit.md](monetization-doctrine-alignment-audit.md)      | Doctrine-aligned monetization architecture         |
| 09  | [ue-whole-system-review.md](ue-whole-system-review.md)                                    | Union Eyes whole-system operating-system review    |
| 10  | [final-live-operational-status-report.md](final-live-operational-status-report.md)        | **Production readiness verdict**                   |

---

## Operational Honesty Conventions

Every claim in this audit must be classified as one of:

| Marker  | Meaning                                                                |
|---------|------------------------------------------------------------------------|
| `LIVE`  | Reachable, operational, validated against real runtime                 |
| `STAGING-ONLY` | Operational in staging, not yet promoted to prod                |
| `RESERVED` | Domain reserved, not yet TLS-bound or DNS-active                    |
| `DEFERRED` | Intentionally postponed; explicit decision recorded                 |
| `PARTIAL` | Some surfaces operational, others incomplete                         |
| `MOCKED`  | Surface present but backed by stub/seed data, not live integrations  |
| `SIMULATED` | Behavior reproduced for QA, not the real production code path      |
| `BLOCKED` | Known gating risk; documented with mitigation                        |
| `MISSING` | Promised but not present; counted against the verdict                |

A surface that is `LIVE` in one environment but `STAGING-ONLY` in another must
appear **twice** with the appropriate marker in each row.

---

## Validator

The validator at [tooling/scripts/validate-live-operational-readiness.mjs](../../tooling/scripts/validate-live-operational-readiness.mjs)
enforces the existence and structural integrity of every document in this layer.

Run via:

```sh
pnpm validate:live-readiness
```

Exit code `0` means the operational truth layer is structurally complete.
Exit code `1` means at least one required artifact is missing or malformed.
The validator does **not** reach out to live environments — runtime traversal
is captured in the audit documents themselves and gated by infrastructure
credentials not available in CI.

---

## Source Anchors

Every assertion in this audit corpus traces back to one of:

- `governance/release/domain-routing-registry.json` — domain & ACA bindings
- `apps/union-eyes/tests/fixtures/test-users.ts` — UE personas
- `apps/console/lib/nav-config.ts` — Console navigation surface
- `apps/union-eyes/lib/workflows/grievance-state-machine.ts` — UE role guards
- `apps/trustcore/types/core.ts` — platform role taxonomy
- `apps/union-eyes/lib/feature-flags.ts` — runtime feature gating
- `.github/workflows/gitops-deploy.yml` — deployment lineage
- `.github/workflows/e2e.yml` — E2E coverage
- `tooling/scripts/validate-rollout-legitimacy.mjs` — environment tier authority
- `nzila-truth-manifest.json` — repo-wide truth manifest

If an assertion cannot be traced to one of these anchors, it must be marked
`UNVERIFIED` and tracked in the verdict report's "Unresolved" section.
