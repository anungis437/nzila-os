# Workstream E — Evidence, Trust, Chronology & Continuity Semantic Convergence Audit

**App:** apps/union-eyes  
**Branch:** main  
**Strategic principle:** Institutional states are explainable, traceable, and continuity-aware.  
**Layer:** Display / copy / governance-config (additive). No runtime, schema, route, or behavioural change.

## Method

Audited every namespace in `apps/union-eyes/messages/en.json` (and `en-CA.json` mirror) for:

- **Trust posture:** is the surface presented as inspectable, explainable, accountable?
- **Evidence posture:** does language frame outputs as artifacts that can be cited and traced?
- **Chronology posture:** does language acknowledge institutional time — provenance, lineage, sequence of decisions?
- **Continuity posture:** does language frame work as continuity of representation across reviewers, terms, and events — vs. one-shot SaaS "operations"?
- **Hard exclusions:** founder-optics, surveillance-AI framing, rip-and-replace, autonomous-AI decisioning, command-and-control language.

Routes whose copy lives inline in `page.tsx` (i.e. no dedicated i18n namespace) are out of scope for this messages-layer pass and tracked separately for future workstreams.

## Classification

### Tier 1 — Fully aligned (no change)

- `trust.*` (top-level posture and labels)
- `sovereignty.*` (Workstream B locked taxonomy)
- `cognitionPage.*` (governed reasoning framing already in place)
- `continuityNotes.*`
- `reportsCenter.*`
- `workbenchPage.*`
- `outcomesPage.*`
- `intakeReview.*`
- `signalDetails.*`
- `adminGovernancePage.*`
- `memberTimelinePage.*`
- `status.*`
- `headerNav.*`, `navigation.*`, `sidebar.*` (locked navigation taxonomy)

### Tier 2 — Mostly aligned, mild residual drift (no change this pass)

- `outcomesConsole.*` — minor system-language but already member-outcomes framed.
- `leadershipPage.*`, `leadershipDashboard.*` — operational KPI surface; framing acceptable for staff-internal use.
- `federation.*` — federation dashboard; structural framing acceptable.
- `dataSourcePage.*` — StatCan/CRA benchmark surface; technically grounded.
- `compliancePage.*` — employer-facing charter/deadlines framing already aligned.

### Tier 3 — SaaS audit/operations drift → continuity reframing (this pass)

- `operationsPage.title` / `operationsPage.subtitle` — "Platform Operations / Real-time platform health" reframed as **continuity operations** with continuity-aware health and operational chronology. Per-tab technical labels (SLA, releases, capacity) preserved; only top-line headlines reframed.
- `operationsPage.activeIncidentsTitle` — reframed to acknowledge incidents as **continuity events** at the headline level; downstream incident-table technical fields untouched.
- `securityPage.subtitle` — "Monitor security events, threats, and access patterns" reframed as **safeguards posture: events, threats, and access chronology**. SecOps technical labels preserved.
- `complianceAdminPage.subtitle` — "Monitor compliance status, audit logs, and regulatory requirements" reframed as **maintain compliance posture, audit chronology, and regulatory commitments**.
- `reports.*` — light pass on top-line copy where it drifts toward generic BI; preserve report-builder primitives.

### Tier 4 — Trust-explainability uplift on thin metadata (this pass)

- `auditsPage.subtitle` / `auditsPage.metaDescription` — reframed to surface **chronological institutional oversight** vs. flat "compliance tracking".
- `governancePage.metaDescription` — already aligned; left as-is.
- `knowledgePage.metaDescription` — reframed to **institutional memory references** vs. generic "knowledge".
- `knowledgeBasePage.metaDescription` — reframed as **institutional memory of union documents** vs. "documents library".
- `intelligencePage.*` — left as-is for this pass (already framed as institutional intelligence).

### Tier 5 — Sovereignty / data-stewardship uplift opportunity (deferred)

- `dataSharingPage.*` — movement-insights surface; trust/sovereignty uplift candidate but copy is policy-sensitive and deferred to a focused dedicated pass.

### Tier 6 — Out of scope

- `platform.*` (platform-admin context, separate app surface).

## Routes without i18n namespaces (out of scope this pass)

The following routes/surfaces exist in the app tree but have no dedicated namespace in `messages/*.json`. Their copy is inline in `page.tsx` (or composed from already-aligned namespaces) and is therefore out of scope for the messages-layer reframing in Workstream E:

- `governance-center`, `governance-culture`, `governance-recommendations`
- `continuity-intelligence`, `continuity-planning`, `continuity-simulation`
- `institutional-memory`, `institutional-intelligence`, `institutional-operating-intelligence`
- `longitudinal-cognition`, `executive-operating-intelligence`
- `memory`

These routes are left for a future inline-copy convergence pass.

## Forbidden-vocabulary additions (Workstream E)

To lock in continuity/evidence framing and prevent regression toward command-and-control and autonomous-AI optics:

**Hard-fail (institutional posture):**

- "AI-led oversight"
- "predictive governance"
- "operational command center"
- "crisis command center"
- "governance optimization engine"
- "autonomous institutional reasoning"
- "automated governance interpretation"
- "AI conclusions"

**Warning (drift indicators):**

- "knowledge management"
- "document repository"
- "enterprise wiki"
- "content library"
- "compliance monitor"
- "audit engine"

These are additive and do not duplicate Workstream A–D entries.

## Acceptance gates (to be re-validated)

- `pnpm validate:docs` — documentation consistency gate (errors must remain 0).
- `pnpm governance:audit` — aggregate governance gate for docs/ownership/release/repo audits.
- Root `pnpm typecheck` — workspace typecheck must pass.
- No route, schema, runtime, or behavioural change. Display layer only.
