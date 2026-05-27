# Workstream K — Route Deviation Rationale (Step 10)

> Records the deliberate deviation between the audit's per-gap route plan
> (Parts C–G of [workstream-k-topology-ux-audit.md](./workstream-k-topology-ux-audit.md))
> and the implemented single-canonical-route shape.

---

## 1. Audit-proposed route map

The Step 1 audit suggested splitting the WS K topology surfaces across
five existing dashboard routes:

| Audit Part | Proposed route | Topology concern |
|---|---|---|
| C — Hierarchy | `dashboard/governance/` | Ancestry rail + sub-structure list |
| D — Affiliation & representation | `dashboard/governance-center/` | Cohort + representation continuity |
| E — Delegation | `dashboard/governance-center/` | Delegation pathways |
| F — Lineage | `dashboard/institutional-memory/` | Governance lineage chains |
| G — Continuity-aware topology | `dashboard/continuity-intelligence/` | Dependency closure + breakpoints |

## 2. Implemented route shape

A **single canonical route** —
[apps/union-eyes/app/[[]locale[]]/dashboard/institutional-topology/page.tsx](../../apps/union-eyes/app/[locale]/dashboard/institutional-topology/page.tsx) —
hosts all six topology panels (hierarchy · affiliation/representation ·
delegation · lineage · continuity-aware topology · substrate counts) plus
the explainability overlay and the doctrine footer.

## 3. Why a single route was chosen

1. **Single substrate adapter, single fence pass.** Every panel reads from
   one composed `InstitutionalTopologyView` produced by
   [apps/union-eyes/lib/institutional-topology/source.ts](../../apps/union-eyes/app/[locale]/dashboard/institutional-topology/page.tsx).
   `redactProtected` runs once on the raw graph; the protected-kind
   projection guard is then exercised once per render. Spreading the
   panels across five routes would require five adapter call sites and
   five independent fence invocations — five places where a future
   regression could leak a protected category, kind, or summary token.

2. **Doctrine footer must apply uniformly.** The verbatim doctrine note
   (*"This surface is governance-safe transparency over preserved
   institutional records. It does not evaluate, rank, predict, or
   recommend. Protected institutional semantics are redacted at the graph
   layer before reaching this view."*) is a property of the topology
   read-surface as a whole, not of any individual panel. A single route
   keeps the footer as a single source of truth and avoids the risk of
   five drifting copies.

3. **Mental-model coherence.** Hierarchy, affiliation, delegation,
   lineage, and continuity-aware topology are five views of the **same**
   institutional graph. Splitting them across routes that already host
   non-IGG concerns (governance middleware, continuity simulation,
   institutional memory narratives) would force the user to reconstruct
   the connection between the views from URL navigation alone. The
   single-route layout makes the substrate-shared origin visible.

4. **Explainability overlay is shared.** The "Shows / Does not show"
   overlay is one statement about the entire topology surface. Repeating
   it on five routes — or worse, allowing it to drift — would weaken the
   guardrail. One route means one overlay.

5. **Substrate counts are one block.** `view.substrate` (`nodes`, `edges`,
   `decisions`) is a single integer triple over the same projection;
   it does not factor cleanly into the audit's per-gap routes.

## 4. What the deviation does NOT change

- The audit's substrate map (Part A) and forbidden / rewarded vocabulary
  (Parts I & J) are honoured verbatim — see Step 2 commits to
  [apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts](../../apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts)
  and [apps/union-eyes/tooling/marketing/config/required-vocabulary.ts](../../apps/union-eyes/tooling/marketing/config/required-vocabulary.ts).
- The reference UX template (Part B) — server component, `requireUser()`,
  Tailwind primitives, integers only, `—` for empties, doctrine footer —
  is inherited unchanged.
- The protected-fence enforcement contract (Part A.3) is strengthened,
  not weakened: the new guard test
  [apps/union-eyes/lib/institutional-topology/**tests**/source.test.ts](../../apps/union-eyes/app/[locale]/dashboard/institutional-topology/page.tsx)
  exercises `assertNoProtectedKindsInProjections` against every projected
  view shape on every test run.

## 5. Future-route policy

If a future workstream needs a topology panel on one of the audit's
originally-proposed routes (e.g. a hierarchy crumb on
`dashboard/governance/`), the panel MUST consume the same
`getInstitutionalTopologyView()` adapter — never re-derive a parallel
adapter. The single-canonical-route property is preserved by adapter
identity, not by URL identity.
