# Nzila's Growth Moat

> Why a Nzila customer cannot replicate this growth motion by buying tools.

## The five compounding assets

### 1. Campaign memory

Every campaign, every asset, every run, every result is stored with the
brand voice it was checked against and the version of the lead-score model
that scored its targets. **In 18 months we will know which messaging
variants moved which buyer types** — not because we instrumented analytics,
but because the engine refused to dispatch anything it couldn't trace.

Competitors using off-the-shelf marketing automation lose this because their
state lives in vendor SaaS. Ours lives in our repo.

### 2. Trust-aware messaging

`brand_voice.forbiddenPhrases` and `brand_voice.requiredDisclosures` are
machine-enforced before any asset can ship. **It is impossible for an
operator to publish a piece that violates a brand commitment** because
`checkCopyAgainstVoice` returns the violations and `submitContentAssetForReview`
gates on them.

This compounds because every disclosure we add (PIPEDA, accessibility, AI
provenance, sector-specific) becomes a permanent floor. We never regress.

### 3. Partner GTM intelligence

The lead-score model has `partnerInfluenced` as a feature. The NBA rules
have a dedicated `partner_co_sell` action with a 48h SLA when a qualified
deal is partner-influenced. The cockpit surfaces partner pipeline alongside
direct pipeline.

This is structural alignment with the existing `apps/partners/` system
(deals, commissions, certifications). Vendors selling generic CRM cannot
replicate it without rebuilding our partner program from scratch.

### 4. Proof-capture lifecycle

Most B2B SaaS publishes case studies that are 60% true. GrowthOS makes
fabricating one hard:

- `proof_request.permissionGrantedAt` is required.
- `proof_request.quoteApprovedBy` is required for testimonials, case
  studies, reference calls.
- `proof_request.kpiSnapshots` for case studies must have `observedAt` set
  on every metric — no "expected" KPIs.

`publishProof` enforces all three. Over time this produces a library of
**defensible** proof — every claim has an audit trail.

### 5. Founder narrative as governed cadence

`founder_topics` makes the founder's strategic narrative a tracked,
overdue-aware queue rather than a vague intent. The cockpit will tell the
founder which themes are +Nd overdue, ranked.

This matters because founder-led content drives the strongest signal in
B2B (via the `linkedin` and `event` channels) and is the easiest thing to
let slip. We don't let it slip.

## What this means commercially

- **For prospects who ask "what makes Nzila different"**: we run our own
  growth on the same governed primitives we sell. The internal cockpit is
  not a marketing slide; it's a working operator surface (`/growth`).
- **For partners**: deal protection, commissions, and co-sell NBAs are
  unified — not three disconnected workflows.
- **For pilots**: every claim we make about pilot impact must pass the
  proof gate. When we say "ML model reduced X by Y%", there's a
  `kpiSnapshot.observedAt` to back it up.

## What this is NOT

- It is not "AI marketing automation". The lead score is a calibrated
  logistic with hand-tuned weights. The NBA is a deterministic rules engine.
  Versioned, explainable, auditable — but not learned.
- It is not a CRM. HubSpot / Zoho stay authoritative for contact data.
- It is not a campaign-dispatch system. We do not send emails or post to
  LinkedIn from GrowthOS — we orchestrate state and recommend actions.
  Operators dispatch through the existing tools.

## The deferred multipliers (Phase 2+)

When the Drizzle schema migrates from `ops/growth-{entity}/` to Postgres:

- `attribution_events` becomes queryable across thousands of subjects.
- `lead_scores` history enables trend lines and alerts ("X's score dropped
  3 points this week").
- `audit_entries` (already in schema) provides immutable change logs for
  every sensitive transition.

Until then, the file-backed core is honest, fast, and deployable today.

## See also

- [GROWTHOS_OVERVIEW.md](./GROWTHOS_OVERVIEW.md)
- [NZILA_INTERNAL_AGENCY_MODEL.md](./NZILA_INTERNAL_AGENCY_MODEL.md)
- [CHANNEL_STRATEGY_MAP.md](./CHANNEL_STRATEGY_MAP.md)
- [docs/runbooks/growthos-operator-runbook.md](../runbooks/growthos-operator-runbook.md)
