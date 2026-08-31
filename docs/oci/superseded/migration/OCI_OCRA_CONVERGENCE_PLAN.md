# OCI ↔ OCRA Convergence Plan

**Document Status:** Active planning artifact
**Doctrine Version:** 1.0.0
**Posture:** Compatibility-first migration. No mass rename.

---

## 1. Context

The institutional product line was originally introduced under the working name **ICRA** (Institutional Continuity Recognition Assessment). The doctrine name has since converged on **OCRA** (Organizational Continuity Recognition Assessment), positioned as **Product 1** inside the broader **OCI** (Organizational Continuity Intelligence) suite.

The user-facing surface has already been renamed. What remains is a long tail of **technical identifiers** — environment variables, route paths, database column names, integration keys (Stripe, HubSpot), and persisted records — that still read `icra`. These were intentionally left untouched during the doctrine rename, because rotating them blindly would break in-flight commercial contracts and live data lineage.

This document defines the **compatibility-first** path for resolving that tail. It is reviewer-led, never destructive, and never irreversible.

---

## 2. Principles

1. **Never break in-flight contracts.** Stripe prices, HubSpot field IDs, and persisted DB rows that reference `icra` must continue to function unchanged.
2. **Read both, write the canonical.** New writes use `ocra`. Reads accept either.
3. **Migrate explicitly, not in bulk.** Each surface (route, env var, table, integration key) has its own scheduled, reviewable migration step.
4. **Refusal over coercion.** When an alias is ambiguous, the compatibility layer returns the canonical value with an audit annotation — it does not guess.
5. **No mass `sed`.** Every rename is deliberate.

---

## 3. Surfaces in scope

| Surface | Legacy form | Canonical form | Migration strategy |
| --- | --- | --- | --- |
| HTTP routes | `/api/icra/*` | `/api/ocra/*` | Add `ocra` handlers; keep `icra` as alias for one full release; emit deprecation header. |
| Environment variables | `ICRA_*` | `OCRA_*` | `resolveLegacyEnv()` reads both, prefers `OCRA_` when present. Document at infra layer. |
| Stripe price keys | `stripe_price_icra_*` | `stripe_price_ocra_*` | Map at the integration adapter. Never change the upstream Stripe object. |
| HubSpot property IDs | `icra_*` properties | `ocra_*` properties | Map at the integration adapter. HubSpot field rotation requires sales-ops scheduling. |
| Database column / table names | `icra_*` | `ocra_*` | Defer until the convergence sprint; not in scope here. |
| TypeScript identifiers and folder paths | `icra/`, `ICRA*` | `ocra/`, `OCRA*` | Defer. Code-level rename is mechanical once the runtime surfaces above settle. |

---

## 4. Compatibility layer

Implemented in:

- [apps/union-eyes/lib/runtime/identity/runtimeIdentityAliasMap.ts](../../../../apps/union-eyes/lib/runtime/identity/runtimeIdentityAliasMap.ts)
- [apps/union-eyes/lib/runtime/identity/compatibilityFallbacks.ts](../../../../apps/union-eyes/lib/runtime/identity/compatibilityFallbacks.ts)

The alias map is the **single source of truth** for ICRA↔OCRA equivalence at every surface. Resolution helpers in `compatibilityFallbacks.ts` consume it.

### 4.1 Resolution rules

- `resolveLegacyEnv(name, process.env)` — accepts either `ICRA_X` or `OCRA_X`; returns the present one, prefers `OCRA_`.
- `resolveLegacyRoute(path)` — normalizes `/api/icra/*` paths to their `/api/ocra/*` canonical form. The original path is preserved on the request as a soft alias.
- `resolveLegacyStripePriceKey(key)` — maps legacy Stripe price aliases to canonical keys without rotating Stripe objects.
- `resolveLegacyHubspotProperty(name)` — same shape, for HubSpot.

### 4.2 What this layer refuses to do

- It does not invent values. If neither form is present, it returns `undefined`.
- It does not silently downgrade. If both forms are present and they disagree, the resolver returns the **OCRA** form and records a `legacy_alias_disagreement` annotation for the audit log. (The annotation channel is not implemented in this artifact; this is forward-compatible behavior.)
- It does not rewrite persisted records.

---

## 5. Phased migration

The migration is **not** part of this sprint. It is sequenced as follows; each phase is a separate, reviewable change.

1. **Phase 0 — already complete.** Doctrine rename in user-facing copy.
2. **Phase 1 — this sprint.** Compatibility layer + alias map + tests. No production behavior changes.
3. **Phase 2.** Add `ocra` route aliases alongside `icra`. Both serve identical handlers.
4. **Phase 3.** Add `OCRA_` env vars in deployed environments alongside `ICRA_`. No removal.
5. **Phase 4.** Update outbound integrations (Stripe price → product mapping, HubSpot field surfacing) to consume canonical names via adapters. No upstream rotation.
6. **Phase 5.** DB column rename behind a migration with reversible direction. Out of scope until a dedicated sprint.
7. **Phase 6.** TypeScript identifier rename. Mechanical once the runtime surfaces are stable.

Each phase requires explicit reviewer approval. No phase advances automatically.

---

## 6. What the OCI sprint does not change

- No Stripe object is rotated.
- No HubSpot property is rotated.
- No DB column is renamed.
- No environment variable is removed.
- No public route is deleted.
- No persisted record is rewritten.

Every legacy form continues to work. The compatibility layer makes it possible to begin writing `ocra` everywhere new, without breaking what already exists.
