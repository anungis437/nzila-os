# Full Monetization Runtime Alignment

Maps the four-tier UE commercial model to runtime surfaces and to the role
gates implemented in Wave 2.

## Tier model

| # | Tier | Includes | Stakeholder anchor |
| - | ---- | -------- | ------------------ |
| 1 | Foundation | Self-service membership, intake, messaging, basic dues | Member, steward |
| 2 | Governance Operations | Officer + admin workflows, bargaining, finance, dues admin, elections, committees | Officer through Admin |
| 3 | Institutional Continuity | Cross-org / cross-time intelligence, sector analytics, federation reporting, executive operating intelligence | President, federation, CLC |
| 4 | Sovereignty Layer | Cognition, longitudinal-cognition, sovereign data plane, debug, platform-admin operations | System admin, platform staff |

Every dashboard surface should map to exactly one tier; every gate should be
strict enough to keep lower tiers out.

## Surface → tier mapping

### Tier 1 — Foundation (no role gate beyond `requireUser`)

`inbox`, `work`, `priorities`, `profile`, `notifications`, `support`,
`pay`, `dues` (member view), `documents` (member view), `messages` (legacy),
`calendar`, `education/my-courses`, `rewards/{history,leaderboard,redeem}`,
`voting` (cast-vote), `member/timeline/[caseId]`.

### Tier 2 — Governance Operations (gated `officer`+ to `admin`)

`admin/*` (officer+, existing), `analytics-admin/*` (sec-treas+),
`billing-admin/*` (sec-treas+), `compliance-admin/*` (admin+),
`employer-execution/*` (admin+), `pension/admin/*` (admin+),
`pension/trustee/*` (sec-treas+), `strike-fund/*` (sec-treas+),
`bargaining`, `committees`, `elections`, `finance`, `financial`, `dues`,
`grievances` (legacy), `health-safety/*`, `agreements`, `correspondence`,
`organizing/*`, `stewards`, `members`, `members/[id]`, `dispatch`,
`integrations`, `settings/*`.

### Tier 3 — Institutional Continuity (gated `president`+ to `clc_staff`)

`executive-operating-intelligence` (president+), `intelligence` (executive tab),
`institutional-intelligence`, `institutional-operating-intelligence`,
`institutional-memory`, `continuity-intelligence`, `continuity-planning`,
`continuity-simulation`, `cross-union-analytics` (fed_staff+),
`sector-analytics` (fed_staff+), `federation/*`, `clc/*` (clc_staff+),
`movement-insights/*`, `cba-intelligence`, `precedents`, `outcomes`,
`leadership`, `governance-center`, `governance-culture`,
`governance-recommendations`.

### Tier 4 — Sovereignty Layer (gated `system_admin`+)

`debug/*` (system_admin+), `cognition`, `longitudinal-cognition`,
`knowledge-transfer/*` (sovereign data plane), `data-source`,
`security`, `customer-success` (platform), `ops/*`, `operations`.

## Tier coherence check (Wave 2 verdict)

| Tier | Required gating posture | Wave 2 status |
| ---- | ----------------------- | ------------- |
| 1 — Foundation | Authentication only | OK — universal `requireUser` |
| 2 — Governance Ops | Role-bounded by org-level role | Hardened — admin, billing, compliance, pension, strike-fund, employer-execution all guarded |
| 3 — Institutional Continuity | Federation / CLC / executive role gate | Hardened — exec-op-intel, cross-union, sector, clc all guarded |
| 4 — Sovereignty Layer | Platform-staff gate | Partially hardened — debug guarded; cognition / longitudinal-cognition / security still open (deferred to Wave 3) |

## Pricing alignment

The minimum role gates above are deliberately **stricter than** the pricing
boundary for Tier 3 and Tier 4 so that demo or pilot orgs cannot probe their
way into surfaces they haven't licensed. Pricing-tier toggles (per-org
`subscriptionTier`) remain orthogonal and are enforced separately by
`lib/services/entitlements.ts`.

## Mandatory sections checklist

- [x] Tier model
- [x] Surface → tier mapping
- [x] Tier coherence check
- [x] Pricing alignment
