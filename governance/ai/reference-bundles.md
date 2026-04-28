# Reference Bundles — What Was Consulted, What Was Adopted

**Source:** `infotech/bigdata/` (gitignored, Info-Tech commercial-licensed bundles)
**Reviewed:** 2026-04-28

This index records what we read, what we built from each, and what we
deliberately did not adopt — so future reviewers can see the rationale
without re-reading the original decks.

| Bundle | Adopted into | Status | Notes |
|--------|--------------|:------:|------|
| Establish-Your-Adaptive-AI-Governance-Program-From-Principles-to-Practice | [README.md](README.md), [principles.md](principles.md), [governance-committee-charter.md](governance-committee-charter.md), [ai-policy.md](ai-policy.md), [risk-classification.md](risk-classification.md), [inventory.md](inventory.md), [lifecycle-gates.md](lifecycle-gates.md), [assurance-program.md](assurance-program.md), [maturity-assessment.md](maturity-assessment.md) | ✅ Adopted | Backbone of the AI governance program. 9-phase methodology mapped to NIST AI RMF + ISO/IEC 42001. |
| Prepare-for-AI-Regulation | [regulation-landscape.md](regulation-landscape.md) | ✅ Adopted | EU AI Act risk tiers + jurisdiction summary; extended with US state laws and Canadian context. |
| Determine-When-You-Should-Use-Synthetic-Data | [synthetic-data-policy.md](synthetic-data-policy.md) | ✅ Adopted | Validates and formalizes existing `packages/staging-seed-*` practice; 5-category use-case framework. |
| An-Operational-Framework-for-Rolling-Out-AI | [rollout-playbook.md](rollout-playbook.md) | ✅ Adopted | 10-stage rollout playbook with RACI. |
| Building-Info-Tech-s-Chatbot | (reference) | 📚 Reference | Validates Nzila's Console RAG pattern (retrieval + envelope + human escalation). No new artifact — existing PIA covers it. |
| Architect-Your-Big-Data-Environment | — | ⏸ Deferred | Nzila is operational SaaS not a big-data platform; current Postgres + pgvector scale is appropriate. Revisit if analytics workloads grow > 1 TB / day. |
| Build-a-Data-Warehouse | — | ⏸ Deferred | Same rationale as above. CFO/finops use cases currently served by per-app stores; if cross-app reporting becomes a strategic need, return to this. |
| Leverage-Big-Data-by-Starting-Small | — | ⏸ Deferred | Methodology is sound but premature. Use-case suggestion tool may inform future product decisions. |
| Beyond-Survival | — | 📚 Reference | High-level executive narrative; not a derivative source for governance artifacts. |

## Re-evaluation triggers

Re-open the deferred bundles if any of these change:

- Cross-app analytics becomes a stated product need
- A regulated counterparty (e.g., FRFI) requires a formal data-warehouse architecture review
- Storage/processing volumes exceed thresholds where pgvector + per-app DBs become uneconomic
- A new line of business requires curated multi-source datasets (e.g., partner network analytics)
