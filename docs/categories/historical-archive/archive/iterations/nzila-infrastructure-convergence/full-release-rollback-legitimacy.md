# 09 — Full Release & Rollback Legitimacy

**Authority:** ACA revision enumeration + container env release metadata.

---

## 1. Revision Lineage (staging fabric)

| App                          | Latest revision         | Total revisions detected |
|------------------------------|-------------------------|---------------------------|
| `nzila-os-web`               | `--0000147`             | high (147+)               |
| `nzila-os-console`           | `--0000154`             | high (154+)               |
| `nzila-os-partners`          | `--0000153`             | high (153+)               |
| `nzila-os-union-eyes`        | `--0000263`             | very high (263+)          |
| `nzila-os-zonga`             | `--0000145`             | high (145+)               |
| `nzila-os-control-plane`     | `--0000041`             | medium (41)               |
| `nzila-os-platform-admin`    | `--0000008`             | low (8)                   |
| `nzila-os-flow`              | `--0000004`             | low (4)                   |
| `nzila-os-cfo`               | `--0000004`             | low (4)                   |
| `nzila-os-agrimo`            | `--0000004`             | low (4)                   |
| `nzila-os-cora`              | `--0000004`             | low (4)                   |
| `nzila-os-trade`             | `--0000004`             | low (4)                   |
| `nzila-os-mobility`          | `--0000004`             | low (4)                   |
| `nzila-os-orchestrator-api`  | `--0000005`             | low (5)                   |
| `nzila-os-abr`               | `--0000004`             | low (4)                   |

ACA retains revision history (default: keep all revisions in `Single` mode;
rollback = `az containerapp revision activate -n <revision>`).

---

## 2. Demo Revision Lineage

| App                          | Latest revision | Total |
|------------------------------|-----------------|-------|
| `nzila-os-union-eyes-demo`   | `--0000001`     | 1     |

> **Honest gap:** Only one revision ever. Rollback would target nothing.

---

## 3. Release Metadata (UE staging container env)

| Env var          | Set?  | Source                |
|------------------|-------|-----------------------|
| `RELEASE_ID`     | YES   | gitops-deploy.yml     |
| `GITHUB_SHA`     | YES   | gitops-deploy.yml     |
| `BUILD_TIME`     | YES   | gitops-deploy.yml     |
| `BUILD_TIMESTAMP`| YES   | gitops-deploy.yml     |
| `ARTIFACT_ID`    | YES   | gitops-deploy.yml     |
| `REVISION_TAG`   | YES   | container             |

Image SHAs are themselves embedded as the image tag
(`f1e66a2d04720c5e8df59454e14e75104292f250` on 14 of 15 apps).

**Verdict:** Release lineage is **LIVE and traceable** on staging.

---

## 4. Demo Release Metadata

| Env var          | Set?  |
|------------------|-------|
| `RELEASE_ID`     | NO    |
| `GITHUB_SHA`     | NO    |
| `BUILD_TIME`     | NO    |
| `BUILD_TIMESTAMP`| NO    |
| `ARTIFACT_ID`    | NO    |

> **Honest gap:** Demo has no release lineage env vars. A demo deployment
> cannot be matched to a repo SHA. Rollback is meaningless without a target
> SHA. **MISSING.**

---

## 5. Rollback Procedure (documented, manual)

```pwsh
# Roll back UE staging to revision N-1
az containerapp revision list -n nzila-os-union-eyes -g nzila-canada-staging-rg `
  -o table | Select-Object -First 5
az containerapp revision activate -n nzila-os-union-eyes -g nzila-canada-staging-rg `
  --revision <previous-revision-name>
az containerapp revision deactivate -n nzila-os-union-eyes -g nzila-canada-staging-rg `
  --revision <current-revision-name>
```

**Caveat:** ACA `Single` revision mode immediately swaps active revision —
no canary, no gradual shift. For graduated rollback, switch to `Multiple`
mode and configure traffic weights.

---

## 6. Restoration Procedure (PG)

| Concern                    | Verdict |
|----------------------------|---------|
| Azure PG Flexible PITR enabled | LIVE (default 7 days) |
| Geo-redundant backup       | UNVERIFIED — requires `az postgres flexible-server show` review |
| Restoration drill cadence  | DEFERRED — not drilled |

---

## 7. Evidence Linkage

Each release should produce a procurement-grade evidence pack linked to:
- Git SHA
- Build artifact ID
- Container image SHA
- Migration ledger snapshot
- E2E result

| Linkage element            | Status |
|----------------------------|--------|
| SHA → image                | LIVE   |
| SHA → release-id env var   | LIVE (staging) / MISSING (demo) |
| SHA → migration ledger     | NOT AUTOMATED |
| SHA → E2E result           | PARTIAL — Playwright report artifacts in Actions, not aggregated |
| SHA → evidence pack file   | LIVE (UE evidence pack generation) |

---

## 8. Required Remediation (NOT auto-executed)

| # | Action                                                              | Authorization |
|---|---------------------------------------------------------------------|---------------|
| RB1 | Wire RELEASE_ID/GITHUB_SHA/BUILD_TIME on demo container            | YES |
| RB2 | Capture rollback runbook in `docs/ops/`                             | LOW |
| RB3 | Schedule quarterly restoration drill                                | YES |
| RB4 | Aggregate per-release evidence index (SHA → manifest)              | LOW |
| RB5 | Verify geo-redundant backup config on staging DB                   | LOW (read-only) |

---

## 9. Findings

| # | Finding                                                            | Severity |
|---|--------------------------------------------------------------------|----------|
| 1 | Staging release lineage is fully traceable                         | LIVE     |
| 2 | Demo release lineage is invisible                                  | High     |
| 3 | Rollback is manual (no canary)                                     | Medium   |
| 4 | Restoration not drilled                                            | Medium   |
| 5 | platform-admin image tag is not a SHA — rollback target ambiguous  | Medium   |

---

**Verdict for §9:** Release & rollback legitimacy is **LIVE on staging**,
**MISSING on demo**. Restoration is **DOCUMENTED but not drilled**.
