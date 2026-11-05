# WA-GROK Requirements Delta — Amendments to WORKAID_PRODUCT_SPEC_v0.1

**Mission:** WA-GROK-REDTEAM-01  
**Spec under challenge:** pack `WORKAID_PRODUCT_SPEC_v0.1.md`  
**Driver:** R3 findings at HEAD `38a824918cf2e7d7cfb7fcb0e796cbde45433be8`  
**Date:** 2026-10-23 America/Toronto  
**Status:** Begin list only — **not DESIGN_COMPLETE**. Spec remains design-in-progress.

Legend: **ADD** / **CORRECT** / **DELETE** / **UNRESOLVED**

---

## CORRECT

1. **CORRECT §2 / capability honesty — Clio**  
   State explicitly: at baseline SHA `38a82491…` there is **no Clio connector implementation** (only demo phrase-blocking). Replace any wording that could be read as “integration designed in repo” with “IntegrationLedger remains PROPOSED; pilot = manual.”

2. **CORRECT §5 Document/publication**  
   Map WorkAid classes onto enforceable controls distinct from existing UE `privacyLabel` set (`public_internal`…`highly_sensitive`). Spec must say steward-plus institutional visibility is **not** the default for WorkAid professional medical evidence.

3. **CORRECT §7 Permissions evaluation order**  
   Add explicit: “Server-action and CI org-scope detectors must parse both `'use server'` and `"use server"`; detection gaps are security defects (WA-R3-001).”

4. **CORRECT §8 / §9 Task & integration**  
   Affirm grievance deadline engine Phase A is **out of bounds** for WSIB statutory timers; WorkAid uses `DeadlineObligation` + `ReceiptFollowUpTask` only.

5. **CORRECT §4 RepresentationMatter**  
   Require three separately stored dimensions before any WSIB representative action: (a) technical access grant, (b) WorkAid professional acceptance, (c) valid instrument (e.g., DOA). Demo `ACCEPTED_VIEW` is not (b) or (c).

6. **CORRECT evidence vocabulary alignment**  
   Prefer pack terms; when referencing runtime, use `PROVEN_RUNTIME` only with staging attestation. Do not use READY/DEPLOYED/INTEGRATED.

---

## ADD

1. **ADD — Signed URL policy**  
   Maximum download URL TTL (recommend ≤ 60 minutes, re-authz on mint). Prohibit year-long pre-signed URLs for tenant documents. Document irrevocable prior-download warning (align WA-R3-006).

2. **ADD — Revocation cascade**  
   Authority revoke must transactionally revoke matter/document grants, invalidate specialist sessions for that authority, cancel/rebind notifications and tasks, and refuse deep links (WA-R3-008/015).

3. **ADD — Multi-org specialist rule**  
   Active session selects exactly one union institutional org context; specialist org is separate claim; queues and searches filter on both (WA-R3-004; D-08).

4. **ADD — Notification content contract**  
   Purpose-limited schemas; ban document titles and clinical text in email/push/lock-screen for restricted classes (WA-R3-010/022).

5. **ADD — AI / OCR deny-by-default**  
   No unrestricted model ingress for medical / highly_sensitive / ID documents; injection tests required (WA-R3-020).

6. **ADD — Cloud object metadata**  
   Blob/S3 metadata must not contain human-readable document names (WA-R3-012).

7. **ADD — Search authorization**  
   Restricted titles must not be scored or returned; unlinked documents are deny-by-default for sensitive classes (WA-R3-005/013).

8. **ADD — Exception expiry**  
   Org-required server-action exceptions are not a product control; migration or runtime proof required before 2026-11-17 (WA-R3-019).

9. **ADD — Acceptance delta**  
   Trace new WA-T081–WA-T100 (see `WA_GROK_ACCEPTANCE_DELTA.csv`) into spec §11/§12 evidence expectations when implemented.

10. **ADD — Platform dependency gate**  
    WorkAid pilot execution requires UE production readiness ≠ NO_GO under a fresh attested digest; public probe maintenance/503 is not GO (WA-R3-017/025).

---

## DELETE / defer wording

1. **DELETE** any implication that demo sandbox hydration checks = production feature completeness.  
2. **DELETE** any path that equates “packet document-complete” with “legally authorized to represent.”  
3. **Defer (do not delete partner observations):** ~95% incomplete referral and 4–6 week wait remain **partner-reported**, not commercial KPIs (R1-18 / R2-09) — keep measurement guards; do not promote to verified claims.

---

## UNRESOLVED (still block freeze; do not invent answers)

| ID | Question | R3 link |
|---|---|---|
| D-01 | Next-day = calendar vs business day; escalation party | timing abuse if automated |
| D-02 | Task system of record vs Clio | WA-R3-024 |
| D-03 | Member release approver / revoke / lawful access channel | WA-R3-011 |
| D-04 | Urgent incomplete packet rule | R2-04 |
| D-05 | ITO grouping within one claim | R2-02 |
| D-06 | Angelo vs Domenic WSIAT split | R2-07/08 |
| D-07 | Clio read-only / entry / none for pilot | WA-R3-024 — default **none** until chosen |
| D-08 | Multi-union / parallel representation | WA-R3-003/004 |
| D-09 | WorkAid-only communication classes | WA-R3-011/013 |
| D-10 | Lawful privacy/retention per data class | platform UE-F-PRIVACY blocked |
| D-11 | Dated objection policy validator | R2-03 |
| D-12 | Prior-claim disclosure on forms | R2-01 |

---

## Explicit non-claims

- This delta does **not** mark the specification DESIGN_COMPLETE.  
- This delta does **not** authorize staging changes, partner contact, or UE promotion.  
- R1/R2 remedies remain hypotheses until FIXED_PROVEN with executable evidence.

*End of requirements delta (begin list).*
