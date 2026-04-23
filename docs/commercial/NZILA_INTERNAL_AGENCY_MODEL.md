# Nzila Internal Agency Operating Model

> "Nzila runs the same growth motion on itself that it sells to customers."

This document maps the **9 agency layers** the founder asked for to **what
already exists in this repo** plus **what GrowthOS adds**. The honest answer:
most of these layers were partially built across other systems; GrowthOS is
the connective tissue and the missing primitives.

## Layer-by-layer ownership

| # | Layer | Already exists | GrowthOS adds | Status |
|---|---|---|---|---|
| 1 | Brand & messaging | `docs/commercial/*.md` (human-readable) | `growth.brand_voices` (machine-checkable forbidden phrases + required disclosures) | **Shipped** |
| 2 | Creative production | `content/internal/`, `content/public/` | `growth.content_assets` lifecycle (draft → in_review → approved → revised) with **mandatory sources** | **Shipped** |
| 3 | Demand generation | `apps/web/`, `apps/partners/`, email tooling | `growth.audience_segments` + `growth.campaigns` state machine + `growth.campaign_runs` | **Shipped** |
| 4 | Sales enablement | `commerceQuotes` (`packages/db/src/schema/commerce.ts`), `apps/partners/playbooks` | `growth.commercial_offers` + `recommendOffer()` (filters approved + product + buyer-type) | **Shipped** |
| 5 | Lifecycle / CRM | `@nzila/crm-hubspot`, `apps/flow/lib/zoho` | NOT a CRM replacement — GrowthOS keeps `subjectId` references and lets adapters stay authoritative | **Composed** |
| 6 | Analytics / attribution | App-level dashboards | `growth.attribution_events` + 5 models (first/last/linear/time-decay/position) | **Shipped** |
| 7 | Partner GTM | `apps/partners/`, `packages/db/src/schema/partners.ts` (deals, commissions, certifications) | NBA rule: `qualified + partnerInfluenced → partner_co_sell` (links deal scoring to partner pipeline) | **Composed + small bridge** |
| 8 | Proof / case studies | Ad-hoc files | `growth.proof_requests` lifecycle with publication guards (permission + quote + KPIs observed) | **Shipped** |
| 9 | Founder brand | None | `growth.founder_topics` cadence engine + "topics due" surface | **Shipped** |

## Roles in the operating model

| Role | What they own | Where they work |
|---|---|---|
| **Brand owner** | Brand voices, content assets, founder topics | Cockpit + `upsertBrandVoice` API |
| **Demand-gen operator** | Audiences, campaigns, runs | `growthCampaigns.*` API + cockpit campaign view |
| **Sales lead** | Lead scoring inputs, offer catalogue, deal escalations | `scoring.*` API, `recommendOffer`, NBA recommendations |
| **Proof curator** | Proof requests through to publication | `proof.*` API + cockpit proof pipeline |
| **Founder / CEO** | Founder topics, escalations from churn-risk NBA | Cockpit "Founder topics due" + escalation NBA |
| **Partner manager** | Already in `apps/partners/`. GrowthOS surfaces partner pipeline alongside direct pipeline. | `apps/partners/`, partner pipeline card |

## Gates and approvals (what GrowthOS refuses to do)

Codified in the package:

| Action | Gate | Error class |
|---|---|---|
| Move a campaign between statuses | Must follow `ALLOWED_TRANSITIONS` | `IllegalCampaignTransitionError` |
| Submit content asset for review | Must have `sources.length > 0` | `UnsourcedAssetError` |
| Approve content asset | Must currently be `in_review` | `IllegalCampaignTransitionError` (state machine) |
| Start campaign run | Campaign must be `live` AND asset must be `approved` | `UnapprovedAssetDispatchError` |
| Record run result | `responded ≤ reached`, `converted ≤ responded` | `Error` (validation) |
| Move proof through lifecycle | Must follow `ALLOWED` proof transitions | `IllegalProofTransitionError` |
| Publish proof | Must have permission; testimonial/case_study/reference_call need quote; case_study needs all KPIs observed | `ProofPublicationGuardError` |

These are **enforced in the engine, not optional UI checks**. The cockpit
cannot bypass them because there is no other path to mutation.

## Audit trail

Every persisted record carries `createdAt`/`updatedAt`. Phase 2 wires
`growth.audit_entries` (already declared in `src/schema.ts`) to capture
who-did-what for sensitive transitions. Phase 1 relies on the JSON files
being committed/reviewed in the operator workflow.

## Calibration vs. learned models

GrowthOS uses **hand-calibrated** weights for the lead score because:

1. We don't have enough labelled outcome history to train responsibly.
2. Calibrated weights are **explainable per-feature** out of the box.
3. Versioned weights make "the model changed" reviewable in PR.

When training data accumulates (>1000 closed deals with outcomes), the
weights file becomes the seed for a logistic regression fit and the version
bumps from `lead-logistic-v1` → `lead-logistic-v2`. Until then, any claim of
"AI scoring" is a calibrated rules engine. We say so.

## Where this model lives in code

- Engine: `packages/platform-growth-os/`
- Operator surface: `apps/console/app/(dashboard)/growth/page.tsx`
- Composition reads: `commerceQuotes` (commerce), `deals` (partners)
- CLI report: `pnpm growthos:report`
- Tests: `packages/platform-growth-os/src/__tests__/growth-os.test.ts` (35 passing)
