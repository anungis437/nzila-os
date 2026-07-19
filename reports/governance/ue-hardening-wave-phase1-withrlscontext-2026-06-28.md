# UE Hardening & Gate Convergence Wave — Phase 1: `withRLSContext` Binary Contract

- **Date:** 2026-06-28
- **Wave:** Union Eyes Hardening & Gate Convergence (security/governance convergence — NOT product development)
- **Phase:** 1 (withRLSContext binary contract — scoped to the RLS org-boundary contract only)
- **Status:** Complete. **HARD STOP for review before Phase 2.**
- **Baseline:** `reports/governance/ue-hardening-wave-phase0-baseline-2026-06-28.md`

> Phase 1 win condition (verbatim): *"The code must no longer imply org scoping without enforcing it."* This phase did exactly that and nothing more. No pilot routes, raw-DB-guard classification, validator paths, gate taxonomy, or CI wiring were touched.

---

## 1. The defect closed

`withRLSContext` exposed a context-map overload — `withRLSContext({ organizationId }, op)` — that **advertised** explicit org scoping but **discarded the supplied context entirely**. The old reduction was:

```ts
const operation =
  typeof contextOrOperation === "function" ? contextOrOperation : maybeOperation!;
// ...the supplied { organizationId } was never read; org was always re-resolved from auth()
```

Result: every caller that passed an explicit `organizationId` (e.g. the case-assignment engine, document repository, cross-org bootstrap lookups) was silently scoped to **auth's** active org instead of the org they asked for. The type signature implied a security boundary the runtime did not enforce. This is precisely the "implies org scoping without enforcing it" condition.

---

## 2. Chosen contract — **Option A (enforce supplied org), fail closed**

The context-map overload is now **real and enforced**:

| Input | Behavior |
|-------|----------|
| `{ organizationId: "<real-id>" }` | Applies `<real-id>` directly to `app.current_org_id`. The supplied org wins over auth's active org — no silent drift. |
| `{ organizationId: "system" }` | Recognized bootstrap sentinel: applies the authenticated user context but **clears** `app.current_org_id` (`set_config('app.current_org_id', '', true)`) for cross-org resolution lookups. |
| `{ organizationId: "" }` / whitespace | **Throws** (fail closed): `context map requires a non-empty string \`organizationId\``. |
| context map without `organizationId`, or non-string value | **Throws** (fail closed): same message. |
| no authenticated user (any path) | **Throws** `Unauthorized: No authenticated user found`. |
| **no-context overload** `withRLSContext(op)` | **Unchanged** — resolves org from Clerk active org → `currentUser()` metadata chain (`publicMetadata.organizationId` → `privateMetadata.organizationId` → `pub.tenantId` → `priv.tenantId`); throws `Organization context required for scoped data access` if none. |

Every path still requires an authenticated `userId` and produces exactly two `set_config(...)` writes (user + org/clear) inside the transaction. Overload **signatures are unchanged**, so there is no caller-side type breakage.

### Why Option A (not "remove the overload" or "supplied must equal auth")

Caller analysis confirmed the context-map overload is load-bearing: `apps/union-eyes/lib/case-assignment-engine.ts` passes `organizationId` as a **function parameter** (13 sites), not from auth — so removing the overload or requiring "supplied == auth org" would break legitimate, intentional cross-context scoping. The `"system"` sentinel appears at exactly two bootstrap sites (`actions/rewards-actions.ts`, `actions/analytics-actions.ts`) and is now first-class rather than accidentally-tolerated.

---

## 3. Changed files

| File | Change |
|------|--------|
| `apps/union-eyes/lib/db/with-rls-context.ts` | Context-map overload now reads and enforces the supplied `organizationId`; added the `"system"` bootstrap sentinel (clears org context); fails closed on missing/empty/non-string org. No-context path unchanged. Overload signatures unchanged. |
| `apps/union-eyes/lib/db/__tests__/with-rls-context.test.ts` | Upgraded the `drizzle-orm` `sql` mock to capture template strings + interpolated values; added an `appliedSetting()` helper to assert the exact value written to a session setting; **removed** the weak return-value-only test; added the org-boundary enforcement matrix. |

No other files were modified. (Per scope: Phase 2 = `app/api/pilot/apply/[id]/**` + redteam fuzz; Phase 3 = raw-DB-guard classification; Phase 4 = validator path repair; Phase 5 = gate taxonomy + CI authority; Phase 6 = runtime separation plan — all out of scope here.)

---

## 4. Tests added / removed (security boundary now proven)

**Removed:** the weak `"accepts context map + operation overload"` test that passed `{ extra: "data" }` (no org) and only asserted the callback returned `42` — it proved nothing about org scoping and would mask the defect.

**Added (behavioral, mock-DB):**

1. **Enforces supplied org** — `{ organizationId: "org-A" }` with no auth org ⇒ `app.current_org_id` === `"org-A"`, `app.current_user_id` === `"user-1"`.
2. **No silent drift / cross-org pin** — auth active org is `org-B` but caller supplies `org-A` ⇒ applied org is `org-A`, and `org-B` is **never** written. (This is the direct regression proof: old code would have applied `org-B`.)
3. **Fails closed — missing org** — `{ extra: "data" }` (no `organizationId`) ⇒ throws the context-map error.
4. **Fails closed — empty/whitespace org** — `""` and `"   "` ⇒ throw.
5. **Fails closed — non-string org** — `{ organizationId: 123 }` ⇒ throws.
6. **Still requires auth** — no `userId` under the context-map overload ⇒ throws `Unauthorized`.
7. **`"system"` bootstrap sentinel** — user set, `app.current_org_id` cleared to `""`, no throw.
8. **Legacy metadata resolution still works (strengthened)** — the existing `publicMetadata.organizationId` fallback test now asserts the **applied** org value (`"org-pub"`), not just call count.

**Results:**

| Suite | Command | Result |
|-------|---------|--------|
| UE RLS unit tests | `vitest run --project=union-eyes apps/union-eyes/lib/db/__tests__/with-rls-context.test.ts` | ✅ 34 passed |
| INV-32 static contract | `vitest run --project=contract-tests tooling/contract-tests/ue-rls-org-context.test.ts` | ✅ 6 passed |
| Modified files type check | language-server `get_errors` on both files | ✅ no errors |

**Typecheck caveat (do not read as a green full typecheck):** Raw app-level `tsc` was inconclusive due to a Node/SIGABRT environment failure (out-of-memory abort), not a type error. Modified files passed language-server checks; focused RLS tests and INV-32 contract tests passed. Full authoritative typecheck remains CI-gated (`turbo typecheck`).

---

## 5. Security boundary now proven

- A caller that **declares** an org scope (`{ organizationId }`) now provably gets **that** scope written to the RLS session var — the type signature and the runtime agree.
- A caller that supplies an empty, missing, or non-string org is **rejected** (fail closed) instead of silently falling back to ambient auth context.
- The cross-org no-drift test demonstrates the supplied org overrides auth's active org, closing the silent-substitution path.
- The `"system"` bootstrap path is now explicit and tested: org context is **cleared**, not bound to a stale/ambient org.

---

## 6. Remaining risks (deferred to Phase 2+)

- **Pilot-route ownership invariant (Phase 2):** `withRLSContext` enforces *which org* the session is scoped to, but route-level ownership (same-org steward allowed / cross-org steward denied / officer-without-ownership denied / platform_admin allowed / missing-org denied) for `app/api/pilot/apply/[id]/**` is not yet enforced or fuzz-tested.
- **Raw `@/db` usage (Phase 3):** ~261 UE API files import raw `@/db`. The blocking DB-import guard still scans only a narrow allowlist; broad routes can still bypass RLS context. Classification work is deferred.
- **Caller audit (Phase 2+):** This phase fixed the primitive and proved it in isolation; it did **not** re-audit all ~14 context-map call sites to confirm each supplies the correct org. That belongs with the route-ownership work.
- **Validator path drift / certification evidence (Phase 4 / 5):** unchanged from baseline; not security-relevant to this boundary.

---

## 7. Hard stop

Phase 1 is complete and self-contained. **Do not begin Phase 2** (pilot-route ownership + redteam fuzz) until this report is reviewed and approved.
