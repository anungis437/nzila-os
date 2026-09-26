# PHASE_H_PILOT_GOVERNANCE_PACKET

Applied: 2026-09-23, ~6:03 p.m. ET / `2026-09-23T22:03:50Z` UTC

## Authoritative approval and pilot envelope

| Field | Value |
|---|---|
| approver | `Aubert / Nzila designated pilot authority` |
| signedAt | `2026-09-23T22:03:50Z` |
| PILOT_END | **2026-10-07** |
| PILOT_SCOPE | **STAGING_ONLY** |
| PILOT_ORGANIZATIONS | **<=2** |
| EXPIRED_WAIVERS | **RISK_ACCEPTED_FOR_PILOT** |
| DEPENDENCY_VULNERABILITIES | **RISK_ACCEPTED_FOR_PILOT** |
| GOVERNANCE_GATE | **EXCEPTION_APPROVED_FOR_PILOT** |
| ROLLBACK_SUPPORT_CONTROLS | **PASS** |
| CONTROLLED_PILOT_READINESS | **READY_WITH_LIMITATIONS** |
| LIUNA_DEMO_READINESS | **READY_WITH_LIMITATIONS** |
| GENERAL_PRODUCTION_READINESS | **BLOCKED** |
| TECHNICAL_ACCESS_CONTROL | **PASS** |
| EXTERNAL_SPECIALIST_MATRIX | **10/10 PASS** |
| PR_797_MERGE | **NOT_AUTHORIZED** |
| PRODUCTION_PROMOTION | **NOT_AUTHORIZED** |
| PRODUCTION_DATA_MIGRATION | **NOT_AUTHORIZED** |
| ACA rollback dry-run | **OPTIONAL_NOT_RUN** (not a prerequisite) |

Chat approval recorded 2026-09-23; organizational risk acceptance by the designated pilot authority. Risk acceptances expire 2026-10-07 and create no production precedent.

## Technical AC closed (do not reopen authority work)

- **PRIMARY_AUTHENTICATION = PASS** — `PHASE_H_PRIMARY_AUTH_PROOF.json`.
- **EXTERNAL_SPECIALIST_BOUNDARY = PASS** — critical matrix **10/10 PASS**; RLS_CONTEXT_LEAKAGE=0.
- **TENANT_ISOLATION / RESOURCE_AUTHORITY = PASS**.

## Expired supply-chain waivers

All 19 expired waiver items are accepted for this staging-only pilot envelope. The waiver debt remains unresolved outside this risk acceptance.

| id | package | expiresAt | status | decision | approverDecision |
|---|---|---|---|---|---|
| 1113686 | `minimatch` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1113984 | `immutable` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117930 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117931 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117960 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117961 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117964 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117965 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117966 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117967 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117970 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117971 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117972 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117973 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117979 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117980 | `next` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117941 | `@opentelemetry/auto-instrumentations-node` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117942 | `@opentelemetry/sdk-node` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |
| 1117943 | `@opentelemetry/exporter-prometheus` | 2026-09-18 | EXPIRED | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |

Each item is signed by the same named human authority above at the same `signedAt`; no additional approver is recorded.

## Dependency vulnerabilities

| id | package | severity | title | decision | approverDecision |
|---|---|---|---|---|---|
| 1239030 | `adm-zip` | high | adm-zip: Uncontrolled memory allocation via the declared uncompressed size (DoS) | RISK_ACCEPTED_FOR_PILOT | RISK_ACCEPTED_FOR_PILOT |

`adm-zip` high remains unresolved debt; residual risk is accepted for this envelope only.

## GOVERNANCE_GATE

| Field | Value |
|---|---|
| exception reference | This same packet (`PHASE_H_PILOT_GOVERNANCE_PACKET`) — one record, not three |
| decision | **EXCEPTION_APPROVED_FOR_PILOT** |
| approverDecision | **EXCEPTION_APPROVED_FOR_PILOT** |
| approver | `Aubert / Nzila designated pilot authority` |
| signedAt | `2026-09-23T22:03:50Z` |
| expiry_no_later_than | **2026-10-07** |

## Sign-off state

```
awaiting_human_approval: false
approverDecision: EXCEPTION_APPROVED_FOR_PILOT
approver: Aubert / Nzila designated pilot authority
signedAt: 2026-09-23T22:03:50Z
```

Next activity: **pilot execution/preflight**, not another readiness-remediation phase. No production promotion, migration, or PR #797 merge is authorized.
