# DEMO_PATH — Leadership Transition / Institutional Memory (~10 minutes)

> **FICTIONAL fixture only.** Not a live staging demo. Not a launch GO.  
> Staging deploy (B-005) is still required before any real-environment walkthrough.  
> Example first case label: OMHRA-style municipal HR association transition — **not** real OMHRA data.

## Prerequisites (local / in-repo)

- Repo checkout with `fixtures/leadership-transition-institutional-memory/`
- Optional: `pnpm --filter @nzila/sage-core test` green
- No Azure required for this path

## Minute 0–2 — Orient

1. Open `README.md` in this folder (product boundaries).
2. Skim `chronology-2022-2026.json` — note which evidence ids are
   `incoming_executive_default_access: false`.
3. Open `claim-register.json` — claims for «why B / what changed / what unresolved».

## Minute 2–5 — Authorized answer with provenance

Run the institutional context primitive against FICTIONAL candidates **with** a
sensitive grant (board-style principal):

```bash
cd packages/sage-core && pnpm exec vitest run src/synthesis-context.fixture.test.ts -t 'why-B only when sensitive'
```

**Expected:** claim `CLM-why-b` appears with provenance:

| Field | Example (FICTIONAL) |
| --- | --- |
| claim | Why choose B — deeper institutional memory… |
| evidenceItemId | `ev-sensitive-why-b` |
| sourceId | `src-sensitive-why-b` |
| occurredAt | `2024-09-12` |
| authorityActorId | `actor-board-chair` |
| whatChanged / whatUnresolved | present |

This is the authorized continuity answer shape SAGE + CLEAR can express
**without** a generative model.

## Minute 5–8 — Denied / restricted path (incoming executive)

Re-run / observe the same fixture test’s **incoming** principal (no sensitive grant):

**Expected:**

- Context JSON contains public/internal candidates only (e.g. `ev-public-plan-2022`)
- Does **not** contain `Why choose B`, `candidate B`, complaint narrative, or `CLM-why-b`
- `excludedCandidateCount` > 0 (opaque — does not name denied ids)

Choke points enforcing this:

- `buildAuthorizedEvidenceContextPayload` (`synthesis-context.ts`)
- `buildSageInstitutionalQaContext` (`institutional-context.ts`)
- Wired into `listSageEvidenceItems` + export package generation +  
  `POST /api/sage/workspaces/[workspaceId]/institutional-context` (requires auth + deploy)

## Minute 8–10 — Engagement pack glance

Walk `continuity-discovery.md` questions A–E and confirm the FICTIONAL chronology
can populate answers **only** for authorized classes. Note
`continuity-matrix-extension.md` does **not** replace a client succession matrix.

## Explicit non-claims

- This DEMO_PATH is **not** software launch GO.
- This DEMO_PATH is **not** proof of staging parity (B-005 open).
- G11 manual / G12 / G13 remain NOT_PROVEN until human procedures complete.
- Do not present FICTIONAL fixtures as OMHRA facts.
