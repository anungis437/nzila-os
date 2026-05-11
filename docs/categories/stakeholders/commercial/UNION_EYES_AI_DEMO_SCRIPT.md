# Union Eyes Cognition — Live Demo Script

> 30-minute walkthrough for buyer demos. Each module gets ~5 minutes. Every screen is real product, no mocks. The narrator is the **VP of Sales** or a **Customer Success Engineer** with a representative-org dataset loaded.

## Prep (before call)

- Sign in as a **chief steward** of the demo org.
- Open `/[locale]/dashboard/cognition` in one tab and a sample grievance detail page in another.
- Have the API responses for `/api/cognition/kpis?windowDays=30` ready in a third tab to show the JSON contract.

## Minute 0–2 — Frame the conversation

> "Most union software treats grievances like helpdesk tickets and stewards like inboxes. Union Eyes treats your local like an **operating system** — with measurable KPIs, predictive scoring, and an audit trail every executive can defend. I'm going to show you 5 modules, 10 KPIs, in 30 minutes."

## Minute 2–7 — Module 1: Grievance Trajectory Intelligence

1. Open a real high-risk grievance.
2. Hit `GET /api/cognition/cases/[id]/risk`.
3. Show the response live: `riskTier`, `confidence`, `topFactors[3]`, `recommendedAction`, `modelVersion`.
4. **Talking point:** "Notice three things — the score has a *confidence*, the *top three drivers* are named in plain English, and the *recommended action* is one of six categorical labels. There is no chatbot, no hallucination surface."
5. Show how the action `request_documentation` is triggered when documentation completeness < 50% and case age ≥ 5 days.

## Minute 7–12 — Module 2: Steward Workload Balancer

1. Navigate to the cognition dashboard's Steward Workload table.
2. Point at the fairness score (top of the table) and the per-steward utilisation %.
3. Hit `GET /api/cognition/workload`.
4. **Talking point:** "Fairness is `1 − coefficient_of_variation(utilisation)`. A 0.92 fairness score means your team is balanced. A 0.45 means three of fifteen stewards are doing all the work. We surface reassignment *recommendations* — never automated writes — when a steward is overloaded **and** is holding a high-risk case."
5. Show the `recommendedReassignments[]` list on an overloaded steward.

## Minute 12–17 — Module 3: Member Disengagement Risk

1. Open the Member Engagement Queue on the dashboard.
2. Show the top 10 disengaged members, sorted by probability descending.
3. **Talking point:** "These are the members the local will lose at the next ratification vote unless someone reaches out. The recommended channel honours member-stated preference first; only when there's no preference do we infer from behaviour (phone if disengaged, SMS if they ignore email, email otherwise)."
4. Note the `recommendedTimingHours` — 24h for `lost`, 168h for `engaged`.

## Minute 17–22 — Module 4: Precedent Memory Engine

1. From a new grievance detail page, call `POST /api/cognition/precedents`.
2. Show the ranked matches with `similarity` scores broken down by `tagOverlap`, `typeMatch`, `successfulOutcomeBonus`.
3. **Talking point:** "Every precedent is org-scoped — by design. The engine throws a `CrossOrgPrecedentLeakError` if a candidate sneaks in from another local. This is a hard contract, not a config flag."
4. Demonstrate how a similar past case that resolved in 14 days lifts a current case's recommended next action toward `prepare_arbitration`.

## Minute 22–27 — Module 5: Executive Health Summary

1. Open the dashboard's Executive Interventions section.
2. Hit `GET /api/cognition/executive-summary`.
3. **Talking point:** "This is the screen your President opens before the executive meeting. Backlog by tier, fairness score, disengaged count, prioritised interventions. No interactive widgets, no dashboards-of-dashboards — just the operating picture."

## Minute 27–30 — KPI snapshot + close

1. Hit `GET /api/cognition/kpis?windowDays=30`.
2. Walk through all 10 KPIs in the JSON, pointing at any that are `null`. **Say it out loud:** "These are null because we don't have baseline data yet — and we will not invent it. The first 30 days of the pilot establishes baseline; the next 60 days measure the delta."
3. Show the `assumptions[]` block. **Talking point:** "Every assumption — `loadedHourlyRateCad: 65`, `hoursSavedPerPrecedentRetrieval: 1.5` — is exposed in the API response. If you disagree with a number, we can change it in front of you and re-run."
4. **Close:** "What I just showed you is shipping in production today. Nothing in the demo was mocked. Want to do a 30-day pilot on your real data?"

## Q&A defensives

| Question | Answer |
|---|---|
| "Is this AI?" | "It's predictive math — trajectory scoring, jaccard similarity, coefficient-of-variation. No language model in the inference path. The recommendations are advisory and every action requires a human override." |
| "What about privacy?" | "All compute is org-scoped. Precedent retrieval refuses cross-org candidates at the type system level. Every read and compute writes a `cognition_audit` row." |
| "What if the model is wrong?" | "Then the operator overrides it — and we record the override. After 90 days of overrides we re-tune the thresholds. The model version is on every snapshot, so you can audit changes." |
| "How fast can we start?" | "Read-only dashboard in 1 day. KPI snapshots in 2 weeks (after baseline). Phase-2 (write-back recommendations into your workflow) in 60 days." |
