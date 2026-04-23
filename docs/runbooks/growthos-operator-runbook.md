# GrowthOS Operator Runbook

> Audience: people who actually run the growth motion (sales lead, demand-gen
> operator, proof curator, founder).
> Cadence: daily / weekly / monthly.

## Daily (15 min)

1. **Open the Growth Cockpit**: `/growth` in the console.
2. **Read the top-10 lead scores + recommended actions** table. Each row tells
   you the subject, current stage, score, confidence, and the
   next-best-action with a one-line rationale.
3. **Act on `escalate_to_founder` rows immediately** (these are churn-risk
   subjects with a 24h SLA built into the rule).
4. **Check "Founder topics due"** at the bottom. Anything marked +Nd overdue
   should be dispatched today (post, email, call) or de-prioritised by
   marking it inactive.

## Weekly (60 min)

1. **Campaign review**:
   - In the cockpit, look at the "Campaigns" card by status.
   - For every `live` campaign, verify it has a recent `campaign_run` (use
     `pnpm growthos:report` for inventory).
   - Promote drafts to scheduled where ready.
2. **Asset review**:
   - For every `in_review` content asset, either approve or send back to
     `revised`. Remember: `submitContentAssetForReview` already enforced
     `sources.length > 0`, so the source check is done — you're reviewing
     fit-to-voice and accuracy.
3. **Proof pipeline**:
   - Move `awaiting_*` proof requests forward by collecting the gating
     artefact (permission, quote, KPI snapshot, legal review).
   - Publish only what passes `publishProof` — the engine will refuse if
     anything is missing.

## Monthly (2-3 h)

1. **Re-score every active subject** (`scoreLead` for each contact /
   opportunity / partner-deal / pilot with up-to-date features). The score
   model version is recorded on each record so historical scores stay
   attributable.
2. **Run an attribution pass** on every `deal_closed_won` of the month:
   ```ts
   import { attribution } from '@nzila/platform-growth-os'
   attribution.computeAttribution({ scope, subjectId, model: 'time_decay' })
   ```
   Save the output (it's already persisted as `attribution_results`
   conceptually — currently inferred on-demand from events).
3. **Founder narrative review**: list all topics with `listFounderTopics`,
   archive ones that are no longer strategic, add new ones aligned to
   the next quarter's positioning.

## When weights or rules change

- **Lead-score weights** live in `packages/platform-growth-os/src/scoring/lead-score.ts`
  → `WEIGHTS` constant. Bump `LEAD_SCORE_MODEL_VERSION` and PR-review the
  diff. Old scores keep their old version stamp.
- **NBA rules** live in `packages/platform-growth-os/src/recommend/next-best-action.ts`
  → `RULES` array. Bump `NBA_VERSION` if priorities, conditions, or actions
  change. Rerun `pnpm growthos:test` — the suite enforces churn-risk priority,
  pilot-testimonial path, and partner co-sell.

## When something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| `IllegalCampaignTransitionError` | UI / script tried to skip a state | Walk the campaign through legal transitions (see `ALLOWED_TRANSITIONS`) |
| `UnsourcedAssetError` | Asset has no sources but you tried to submit it | Add at least one source (URL, document ID, or pilot ID) |
| `UnapprovedAssetDispatchError` | Tried to start a run with a non-approved asset | Approve the asset first (`approveContentAsset`) |
| `ProofPublicationGuardError` | Tried to publish proof without permission / quote / KPIs | Provide the missing artefact and call `publishProof` again |
| Cockpit shows "No GrowthOS records yet" | Store empty for this scope | Seed via package APIs or check you're in the right `tenantId/orgId` scope |

## Files you'll touch most

- `apps/console/app/(dashboard)/growth/page.tsx` — operator surface
- `packages/platform-growth-os/src/scoring/lead-score.ts` — score calibration
- `packages/platform-growth-os/src/recommend/next-best-action.ts` — NBA rules
- `packages/platform-growth-os/STATUS.md` — what's shipped vs deferred

## CLI

```powershell
# Inventory + top scores + due topics, in plain text
pnpm growthos:report

# Run the full test suite (35 tests)
pnpm growthos:test

# Typecheck the package alone
pnpm --filter @nzila/platform-growth-os typecheck
```
