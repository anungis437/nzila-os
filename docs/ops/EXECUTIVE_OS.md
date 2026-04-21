# Nzila ExecutiveOS — Architectural Contract

> **Status:** Phase 1 — Foundations (this document)
> **Owner:** Aubert Nungisa
> **Scope:** The internal operating system of Nzila Ventures.

ExecutiveOS is **not** a chatbot, **not** a dashboard layer, and **not**
promptware. It is a governed multi-agent stack that runs the company.

---

## 1. Principles (non-negotiable)

1. **Repo-native.** Reuse existing `apps/console`, `packages/db`,
   `packages/cfo-core`, `packages/intelligence`, `@nzila/platform-auth`.
2. **No duplicate systems.** No second finance engine, no shadow admin.
3. **Human-in-the-loop.** Material actions require approval.
4. **Explainability.** Every insight carries `confidence`, `evidence`,
   `consequenceIfIgnored`, `recommendedNextStep`.
5. **Actionable only.** Vanity analytics are forbidden.

---

## 2. Data substrate

Three tables in [`packages/db/src/schema/executive.ts`](../../packages/db/src/schema/executive.ts)
are the spine of ExecutiveOS:

| Table | Purpose |
| --- | --- |
| `executive_agent_runs` | Audit + telemetry for every agent invocation |
| `executive_agent_insights` | Observations (with severity, confidence, evidence) |
| `executive_agent_actions` | Insight / Recommendation / Draft Action — with approval state machine |

All three are org-scoped, indexed by `(orgId, ...)`, and registered in
[`packages/db/src/org-registry.ts`](../../packages/db/src/org-registry.ts).

---

## 3. Agent contract

Every ExecutiveOS agent (Chief of Staff, CFO, RevOps, Platform Reliability,
Legal, Knowledge Steward, …) implements `ExecutiveAgent<TInput>` from
[`@nzila/executive-os`](../../packages/executive-os/src/contract.ts):

```ts
interface ExecutiveAgent<TInput> {
  key: string                // dash-case stable id
  name: string               // human-readable
  domain: ExecutiveDomain    // executive | finance | revenue | ...
  mission: string            // one sentence
  version: string            // semver-ish
  run(req: AgentRequest<TInput>): Promise<AgentResult>
}
```

**Agents are pure.** They do not write to the database, do not call external
APIs, and do not depend on Next.js. The host (`apps/console/lib/executive-os.ts`)
fetches their inputs and persists their outputs.

This makes every agent unit-testable in isolation
(see [`chief-of-staff.test.ts`](../../packages/executive-os/src/agents/chief-of-staff.test.ts)).

---

## 4. Action classes

| Class | Requires approval? | Examples |
| --- | --- | --- |
| `insight` | No (auto-approved) | "Cash on hand is $125k" |
| `recommendation` | **Yes** | "Pause product X for 30 days" |
| `draft_action` | **Yes** | "Send collections email to client Y" |

The state machine in [`action-queue.ts`](../../packages/executive-os/src/action-queue.ts)
enforces:

```
pending ──approve──▶ approved ──execute──▶ succeeded | failed
        ├─reject──▶ rejected
        └─expire──▶ expired

insight ──autoApprove──▶ auto ──execute──▶ succeeded | failed
```

Auto-approval is **only** allowed for `insight`-class actions. Any attempt
to bypass approval for a `recommendation` or `draft_action` throws
`ApprovalTransitionError`.

---

## 5. Console surfaces (Phase 1)

| Route | Purpose |
| --- | --- |
| `/chief-of-staff` | Run + view Chief of Staff insights |
| `/actions` | Unified pending-approval queue across **all** agents |

Surfaces for finance / revenue / platform / legal / knowledge land in
Phases 2–6 and follow the same pattern (see "Adding a new agent").

---

## 6. Adding a new agent

1. Create `packages/executive-os/src/agents/<key>.ts` implementing
   `ExecutiveAgent<TInput>`. Keep it pure.
2. Add a unit test next to it (`<key>.test.ts`).
3. Export from `packages/executive-os/src/index.ts`.
4. In the host route (`apps/console/app/(dashboard)/<key>/page.tsx`),
   write the data-loading function (`loadSignal`) that hydrates `TInput`
   from real tables, then call `runAndPersist(agent, { orgId, input })`.
5. Pending actions automatically appear in `/actions` — no extra wiring.

---

## 7. Approval requirements (Phase 2+ checklist)

The following operations **must** be modelled as `recommendation` /
`draft_action` and gated through `/actions`:

- collections outreach
- customer escalations
- accounting adjustments / journal entries
- budget reallocations
- product pause / sunset decisions
- contract notices (renewal / termination)
- high-risk releases
- hiring triggers

Track on every approved action:

- recommending agent (`agentKey`)
- confidence (`confidence`)
- approver (`approverId`)
- timestamp (`approvedAt`)
- execution result (`executionResult`, `executionStatus`)

---

## 8. Rollout

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundations + schemas + action queue + Chief of Staff reference | **Done** |
| 2 | Finance family (CFO, Controller, Treasury, FP&A, Collections, Tax) | Pending |
| 3 | Revenue + CS + Grants | Pending |
| 4 | Platform / DevOps family | Pending |
| 5 | Legal + Governance + Knowledge | Pending |
| 6 | Portfolio Allocator + final executive surfaces | Pending |

---

## 9. Final standard

When Aubert logs in, NzilaOS should feel like a CFO + COO + RevOps lead
+ PMO + platform team + legal ops analyst + strategy office working in
sync. ExecutiveOS is the substrate that makes that feasible without
hiring an executive team.
