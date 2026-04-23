# @nzila/platform-growth-os — STATUS

A truthful matrix of what is shipped, what is calibrated-not-trained, and what is explicitly Phase-2 deferred.
This file is the source of truth — never the marketing pages.

## Shipped (Phase-1, end-to-end)

| Capability | Surface | Persistence | Tests | Notes |
|---|---|---|---|---|
| Brand voice registry + copy check | `campaigns.upsertBrandVoice`, `checkCopyAgainstVoice` | file | ✅ | Substring + case-insensitive; fails closed |
| Audience segments (6 predicates) | `campaigns.upsertAudienceSegment`, `filterBySegment`, `updateSegmentEstimate` | file | ✅ | Dotted-path field reads supported |
| Campaign lifecycle | `createCampaign`, `transitionCampaign` | file | ✅ | State machine; throws on illegal moves |
| Content assets with approval | `createContentAsset`, `submitContentAssetForReview`, `approveContentAsset`, `reviseContentAsset` | file | ✅ | Revise resets approval; unsourced submit blocked |
| Commercial offers + recommend | `createCommercialOffer`, `recommendOffer` | file | partial | Approval path for offers is read-only today |
| Campaign runs with hard gates | `startCampaignRun`, `recordRunResult` | file | ✅ | Live + approved required; result counts validated |
| Lead scoring | `scoring.scoreLead`, `computeLeadScore`, `deriveLeadStage` | file | ✅ | Per-feature contributions for explainability |
| Multi-touch attribution (5 models) | `attribution.computeAttribution` | file | ✅ | first / last / linear / time_decay / position |
| Proof lifecycle | `proof.createProofRequest` … `publishProof` | file | ✅ | Permission, quote, KPI gates before publish |
| Founder narrative (themes + cadence) | `founder.upsertFounderTopic`, `dueFounderTopics` | file | ✅ | Sorted by overdue-days desc |
| Next-best-action (rule-based) | `recommendNextBestAction`, `recommendBatch` | n/a | ✅ | 9 rules; rationale per recommendation |
| Drizzle schema for all 11 entities | `./schema` subpath | declared, not wired | n/a | Mirrors cognition-core pattern |
| CLI report | `pnpm growthos:report` | n/a | manual | Reads file store; safe in CI |

## Calibrated, NOT trained

These models are **shipped with hand-set weights**. They are deterministic,
explainable, and version-pinned for an honest ML upgrade path.

| Model | Version | Where | Upgrade path |
|---|---|---|---|
| Lead score logistic | `lead-logistic-v1` | `src/scoring/lead-score.ts` `WEIGHTS` | Train on real CRM events; replace WEIGHTS table; bump version constant. Feature contract (`LeadScoreFeatures`) is fixed |
| Stage classifier | embedded | `deriveLeadStage` | Same; thresholds become learned cutoffs |
| Time-decay attribution | half-life 14d | `src/attribution/engine.ts` | Calibrate per-product when enough closed-won data exists |
| Next-best-action | `nba-rules-v1` | `src/recommend/next-best-action.ts` | Replace with bandit / sequence model when reward data exists |

## Phase-2 deferred (intentionally NOT shipped)

| Capability | Why deferred | Where it will land |
|---|---|---|
| Drizzle migration | Needs DBA review of 11 tables + index strategy | `migrations/` (after schema review) |
| Outbound IO (HubSpot/Zoho/SMTP push) | Out of scope for an internal scoring/attribution layer | `packages/integrations-hubspot`, `apps/flow/lib/zoho` |
| Trained scoring model | Insufficient closed-won volume to train responsibly | `@nzila/ml-core` |
| LLM-generated copy | Not stored unsigned; brand-voice gate first | TBD; will require provenance track |
| Cross-org leaderboards | Privacy review required | `apps/control-plane` |
| Real-time event stream | File store is sufficient for current operator volume | Phase-2 with Drizzle wiring |
| Approval flow for commercial offers | Out of scope today; offers are operator-curated | Future asset-style flow |

## Composes (does NOT duplicate)

| Already-existing system | What it owns | How growth-os uses it |
|---|---|---|
| `apps/partners` + `packages/db/src/schema/partners.ts` | Partner records, deals, commissions, certifications | Console growth surface joins `partner_deals` for partner GTM section |
| `packages/db/src/schema/commerce.ts` (`commerceOpportunities`, `commerceQuotes`) | Pipeline, quotes, deal stages | Console growth surface joins to compute pipeline summary |
| `packages/platform-cognition-core` | Memory events, trajectory risk, consent gating | Lead-score features can be derived from cognition events when wired |
| `packages/platform-decision-engine` | Operational decisions with audit | NBA recommendations can be promoted to decisions in Phase-2 |
| `packages/platform-intelligence` | OperationalSignal contract | Lead scores can be projected as OperationalSignals |
| `packages/crm-hubspot`, `apps/flow/lib/zoho` | External CRM IO | Out of growth-os scope; integration adapters live there |
| `apps/cfo`, `packages/platform-metrics`, `packages/platform-proof` | Pilot metrics, executive views | Console growth surface links out, never re-implements |
| `docs/commercial/*.md` | Commercial source-of-truth content | Content assets must reference these as `sources[]` |

## Honesty checklist

* No "world-class". No "leverage synergies". The brand-voice check enforces this on stored copy — and the package tests this enforcement.
* No invented metrics. Every count and every $ in `pnpm growthos:report` is computed from records on disk.
* No hidden duplication. The audit that produced this package is in [`docs/commercial/GROWTHOS_OVERVIEW.md`](../../docs/commercial/GROWTHOS_OVERVIEW.md).
