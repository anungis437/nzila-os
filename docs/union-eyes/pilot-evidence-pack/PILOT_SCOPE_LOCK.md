# Union Eyes — Pilot Scope Lock

> **Temporal status — SUPERSEDED FOR CURRENT POSTURE (added 2026-09-24):** this document is dated
> 2026-05 and predates the `UE_SAAS_OPERATIONAL_READINESS` gate ruling of 2026-08-31
> ([`../reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md`](../reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md))
> and the Phase 3A runtime findings of 2026-09-01
> ([`../reality-remediation/26_UE_PHASE3A_RUNTIME_ACCEPTANCE.md`](../reality-remediation/26_UE_PHASE3A_RUNTIME_ACCEPTANCE.md)).
> The current gate reads **`NO_GO — RUNTIME_PROOF_REQUIRED`**. Any `CURRENT`, `GO`, `LOCKED`, or
> `VERIFIED` marking below describes this document's own state in 2026-05, not the current pilot
> posture, and must not be quoted as buyer-facing readiness. Body retained unmodified as
> historical evidence; current posture lives in [`../README.md`](../README.md).

**Version:** 1.0  
**Status:** LOCKED  
**Last updated:** 2026-05-14  
**Source of truth:** This document — do not expand scope without Engineering Lead sign-off  
**Supersedes:** N/A (first scope lock)  
**Live-evidence dependencies:** None

---

## In-Scope for Union Eyes v0.1 Controlled Pilot

### Modules

| Module                         | In scope | Notes                                     |
| ------------------------------ | -------- | ----------------------------------------- |
| Case / Grievance filing        | ✅       | Full server-side FSM enforced             |
| Case intake (idempotent)       | ✅       | Org-scoped idempotency                    |
| Case assignment engine         | ✅       | Workload balancing, multi-officer support |
| Evidence export + sealing      | ✅       | PDF manifest, HMAC seal, verify endpoint  |
| File upload (DMS)              | ✅       | Org-scoped signed URLs, ClamAV scanning   |
| Document OCR                   | ✅       | Integrated in DMS upload path             |
| Hash-chained audit trail       | ✅       | Append-only, seal/verify lifecycle tested |
| Steward workbench (queue view) | ✅       | Basic queue + case detail                 |
| Leadership dashboard (ED view) | ✅       | Aggregate timeline, case status summary   |
| RBAC / multi-role per org      | ✅       | steward, ed, it_privacy, member roles     |
| Setup checklist / first-run UX | ✅       | `pilot-readiness-checklist.tsx`           |
| Auth (NextAuth + Argon2id)     | ✅       | Per-org RBAC enforced                     |
| Correlation-ID instrumentation | ✅       | TS and Django backend parity              |

### Excluded from this pilot (hard freeze)

| Module                                          | Reason                                             |
| ----------------------------------------------- | -------------------------------------------------- |
| Finance / dues persistence                      | In-memory; post-pilot                              |
| Pattern detection / ML predictions              | Infrastructure present; not pilot-validated        |
| Admin console (full)                            | UI polish incomplete; provide checklist UX instead |
| Taxonomy management                             | Post-pilot                                         |
| CSV bulk export                                 | Post-pilot                                         |
| API public endpoints (third-party integrations) | Not in pilot charter                               |
| Multi-org cross-access                          | Out of scope; single org per pilot instance        |
| Tier 2 apps (Zonga, ABR, etc.)                  | Not Union Eyes                                     |

---

## Pilot Parameters

| Parameter        | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| Pilot org count  | 1 (single CUPE local)                                          |
| Worksites        | Up to 5                                                        |
| Members          | Up to 200                                                      |
| Data sensitivity | Real member data permitted after DPA signed and conditions met |
| Data residency   | Azure Canada Central (`canadacentral`) only                    |
| Duration         | 90 days or until expanded by mutual agreement                  |

---

## Freeze Acknowledgement

Changes to this scope lock require:

1. Engineering Lead approval
2. Update to `UNION_EYES_CURRENT_STATE.md` delta section
3. New entry in `CHANGELOG.md`

_Do not add features to production during the pilot window without this process._
