# UE Gate 0 — SLA risk input provenance (source evidence only)

- Frozen defect: `DEF-0B9-ML-SLA-SCORE-IS-LITERAL-WEIGHTS-OVER-CALLER-VALUES-PRESENTED-AS-A-MODEL-WITH-CONSTANT-CONFIDENCE`; frozen 777-defect classification unchanged.
- Parent HEAD: `1e84ed05a2522218a09e9341bc29e80def8df2e1`.
- Source change: version v2 uses tenant-bound case priority and deadline only. Unverified client-supplied transition count, previous breaches, priority, hours and feature references have no scoring authority. Legacy request fields remain accepted for compatibility; model metadata and audit use server-defined provenance. GET excludes legacy v1 prediction rows.
- Semantics: this is an uncalibrated rule-based risk indicator, not a trained model or statistical probability. Unknown historical facts are excluded, not represented as observed zero.
- Regression tests authored: forged priority/deadline/history/provenance cannot change score; v2 GET version predicate; verified scoring helper.
- Source state: patch authored. Unit/contract: NOT VERIFIED. Native PG15/16: NOT VERIFIED. HTTP/browser/staging: NOT VERIFIED. Independent reviewer/persona/institutional authority: OUTSTANDING.
- Remaining: qualify downstream consumers of old v1 scores and decide trusted case-history model before reintroducing historical features. No CLOSED status or completion credit.
