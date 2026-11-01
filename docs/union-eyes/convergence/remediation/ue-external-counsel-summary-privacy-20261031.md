# Union Eyes Gate 0 — external counsel summary privacy correction (2026-10-31)

**Runtime evidence before correction:** On commit `37baf015c00151d369f8ce1cd1f9abef300cc09f`, GitHub Actions run 41191908589, job 124510234301, the real production-build HTTP/browser acceptance failed the desktop external-counsel whitelist test. The external grievance GET returned a `summary` containing `PRIVATE internal description that must not reach counsel`. This was an actual synthetic-fixture disclosure over HTTP, not merely a speculative source finding.

**Root cause:** `/api/external/grievances/[id]` selected `grievances.description` as `summary`, and `toExternalMatterProjection` returned it verbatim. The external view permission authorizes a whitelisted response shape, not disclosure of internal grievance descriptions.

**Correction:** The route no longer reads `grievances.description`. The external projection retains the stable `summary` response key but sets it to `null` until a separately approved, persisted counsel-safe summary and its authorization workflow exist. This is a deliberate fail-closed limitation; it does not invent a reviewed summary. Unit regressions cover populated confidential summaries, and the existing real HTTP test checks the sentinel.

**Qualification:** Source-level change committed; unit tests, exact-commit native PostgreSQL 15/16, complete Vitest/contract, real HTTP/browser rerun and staging are NOT credited by this document. The runtime failure remains open until the exact-commit HTTP acceptance passes. No frozen Gate 0 register, reviewer ratification or institutional authority record is modified.
