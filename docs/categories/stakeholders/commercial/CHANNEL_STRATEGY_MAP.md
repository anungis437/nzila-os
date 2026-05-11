# Channel Strategy Map

> Aligned to the `CampaignChannel` enum in
> `packages/platform-growth-os/src/types.ts`. Every channel below maps to a
> real `Campaign.channel` value the engine accepts.

## The seven channels GrowthOS treats as first-class

| Channel | Best for | Brand voice gate | Attribution kind |
|---|---|---|---|
| `email` | Existing contacts, lifecycle, renewals | Required disclosures (e.g. PIPEDA opt-out) | `email` |
| `linkedin` | Founder narrative, B2B prospecting | Forbidden-phrase filter (no hyped claims) | `linkedin` |
| `event` | Conferences, webinars, in-person sales | Manual brand-voice review | `event` |
| `referral` | Customer-introduced opportunities | Light-touch (peer-to-peer) | `referral` |
| `partner` | Co-sell with `apps/partners/` deals | Joint brand voice (partner + Nzila) | `partner` |
| `paid` | Paid search / paid social | Hard-cap by ad-policy disclosures | `paid` |
| `organic` | SEO, content, founder posts | Source citations required (asset gate) | `organic` |

## How a campaign is supposed to flow

```
draft  ──[finalise audience + asset]──►  scheduled
scheduled  ──[time triggers]──►  live
live  ──[startCampaignRun for each batch]──►  campaign_run created
live  ──[recordRunResult]──►  results stored
live  ──[budget exhausted / time up]──►  completed
any   ──[stop button]──►  paused / archived
```

The state machine is enforced in `src/campaigns/campaign.ts`
(`ALLOWED_TRANSITIONS`). There is no "edit live campaign settings" because
that would invalidate run results.

## Channel × buyer-type matrix

`CommercialOffer.buyerType` is one of:
`smb | mid_market | enterprise | government | union | partner_referral`.

| Channel | smb | mid_market | enterprise | government | union | partner_referral |
|---|---|---|---|---|---|---|
| email | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| linkedin | ✓ | ✓ | ✓ | — | — | — |
| event | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| referral | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| partner | — | ✓ | ✓ | ✓ | — | ✓ |
| paid | ✓ | ✓ | — | — | — | — |
| organic | ✓ | ✓ | ✓ | ✓ | ✓ | — |

This is **strategic intent**, not engine enforcement — operators are
expected to honour it in audience segmentation. The engine guards only what's
machine-checkable (state, sources, permissions, KPIs).

## Channel × NBA mapping

The NBA rules engine (`src/recommend/next-best-action.ts`) emits actions
that imply a channel. Mapping:

| NBA action | Implied channel | Engine SLA (hours) |
|---|---|---|
| `escalate_to_founder` | event / linkedin / direct | 24 |
| `request_testimonial` | email | 168 |
| `partner_co_sell` | partner | 48 |
| `send_proof_packet` | email | 48 |
| `schedule_demo` | email / event | 72 |
| `send_followup` | email | 48 (engaged), 120 (warming) |
| `pause_outreach` | (suppress) | 720 |
| `upsell_pitch` | email / linkedin | 336 |

Operators see these in the cockpit's "Recommended action" column.

## What we explicitly do NOT do

- We do **not** auto-dispatch on any channel. Every NBA suggests; an operator
  acts.
- We do **not** unify CRM data into GrowthOS. HubSpot/Zoho remain
  authoritative for contact records; GrowthOS stores `subjectId` references.
- We do **not** invent open-rates / CTRs. `recordRunResult` requires the
  numbers come from the dispatch system, not be guessed.

## See also

- [GROWTHOS_OVERVIEW.md](./GROWTHOS_OVERVIEW.md)
- [NZILA_INTERNAL_AGENCY_MODEL.md](./NZILA_INTERNAL_AGENCY_MODEL.md)
- [packages/platform-growth-os/src/types.ts](../../packages/platform-growth-os/src/types.ts) — canonical channel + status enums
