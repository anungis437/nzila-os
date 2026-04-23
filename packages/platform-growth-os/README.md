# @nzila/platform-growth-os

> The internal-agency operating layer: campaigns, scoring, attribution, proof, founder narrative, and next-best-action — composing the existing CRM/partner/decision packages without replacing them.

This package is the **single new** primitive added by the GrowthOS initiative.
Every other "layer" (CRM, partner GTM, commercial assets, pilot metrics, AI
hooks, executive intelligence) already exists in this monorepo. This package
provides what was genuinely missing:

| Module | What it does | Why it didn't exist |
|---|---|---|
| `campaigns` | Brand voice, audiences, lifecycle-gated campaigns, content assets, runs | Marketing was scattered across docs / `apps/web` content / Zoho |
| `scoring` | Interpretable lead/deal scoring with per-feature contributions | No first-class scoring layer outside Zoho |
| `attribution` | Multi-touch (5 models): first/last/linear/time-decay/position | Pipeline existed, attribution did not |
| `proof` | Permission → quote → KPI → publish lifecycle | Proof capture was an ad-hoc Notion step |
| `founder` | Themes, cadence, due-now selector | No structured founder-narrative system |
| `recommend` | Deterministic NBA from any LeadScore | No rule layer over scores |

## Phase-1 honesty

* **Persistence is file-backed** under `ops/growth-{entity}/`. The Drizzle
  schema in [`src/schema.ts`](src/schema.ts) is *declared* for Phase-2 — no
  migration is shipped here.
* **Scoring is calibrated, not trained.** Coefficients are hand-set,
  documented in [`src/scoring/lead-score.ts`](src/scoring/lead-score.ts), and
  pinned to the version string `lead-logistic-v1`. When `@nzila/ml-core`
  promotes a trained model with the same `LeadScoreFeatures` contract, bump
  the version constant and swap the WEIGHTS table.
* **NBA is rule-based** (`nba-rules-v1`). Same swap path.
* **No external IO.** No HubSpot, no Zoho, no SMTP. Operator-facing surfaces
  in `apps/console` join growth-os state with the existing partner/commerce
  schemas at the page layer.

## Quick start

```ts
import {
  campaigns,
  scoring,
  attribution,
  proof,
  founder,
  recommendNextBestAction,
} from '@nzila/platform-growth-os'

const scope = { tenantId: '…', orgId: '…', product: 'union-eyes' }

// 1. Define a brand voice + segment.
const voice = campaigns.upsertBrandVoice({
  scope,
  label: 'Founder — evidence-first',
  tone: ['plain', 'short sentences', 'evidence-first'],
  forbiddenPhrases: ['leverage synergies', 'world-class'],
  requiredDisclosures: ['AI-generated'],
})

// 2. Create a campaign in draft, approve a sourced asset, then go live.
const campaign = campaigns.createCampaign({
  scope, name: 'Q1 Pilot Push',
  objective: 'Convert 3 pilots to paid in Q1',
  channels: ['email', 'partner_co_sell'],
  brandVoiceId: voice.id,
})
campaigns.transitionCampaign(campaign.id, 'live')

// 3. Score a deal.
const s = scoring.scoreLead({
  scope, subjectKind: 'opportunity', subjectId: 'opp-1',
  features: {
    recencyDays: 2, eventCount: 6, channelDiversity: 3,
    positiveSignal: 4, negativeSignal: 0,
    hasActivePilot: true, hasProcurementSignal: true,
    partnerInfluenced: false,
  },
})

// 4. Recommend next action.
const action = recommendNextBestAction(s) // → 'request_testimonial' for healthy pilots
```

## Lifecycle gates (fail-closed)

| Gate | Where | Throws |
|---|---|---|
| Content asset must have ≥1 source to enter `in_review` | `submitContentAssetForReview` | `UnsourcedAssetError` |
| Asset must be `approved` to dispatch a run | `startCampaignRun` | `UnapprovedAssetDispatchError` |
| Campaign must be `live` to dispatch a run | `startCampaignRun` | `Error` |
| Campaign status transitions follow a state machine | `transitionCampaign` | `IllegalCampaignTransitionError` |
| Proof status transitions follow a state machine | `transitionProofStatus` | `IllegalProofTransitionError` |
| Publishing a case_study requires permission + KPIs + quote | `publishProof` | `ProofPublicationGuardError` |
| `responded > reached` or `converted > responded` | `recordRunResult` | `Error` |

## Testing

```sh
pnpm growthos:test      # run vitest project for this package
pnpm growthos:report    # print operational summary
```

## Allowed dependents

See [`package.meta.json`](package.meta.json). Reading from this package is
restricted to operator-facing apps (`apps/console`, `apps/partners`,
`apps/web`, `apps/control-plane`) and other `platform-*` packages.

## Related

* [`STATUS.md`](STATUS.md) — what is real, what is calibrated, what is
  Phase-2 deferred.
* [`docs/commercial/GROWTHOS_OVERVIEW.md`](../../docs/commercial/GROWTHOS_OVERVIEW.md)
* [`docs/runbooks/growthos-operator-runbook.md`](../../docs/runbooks/growthos-operator-runbook.md)
