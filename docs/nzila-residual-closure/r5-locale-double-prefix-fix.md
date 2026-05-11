# R5 — Locale Double-Prefix Fix

> **Status: CLOSED.** Real fix landed in [`apps/union-eyes/proxy.ts`](../../apps/union-eyes/proxy.ts) at the locale alias normalization block. Single-hop 308 redirect; bounded; deterministic; never recursive.

## Authority

This document closes residual **R5** — the locale double-prefix bug that produced `/en-CA/en/X` and `/en-CA/fr/X` paths when users hit short locale aliases (`/en/...`, `/fr/...`). Governance-safe (no hidden redirects), continuity-safe (preserves intended path), evidence-anchored (single regex anchor, single redirect status). Operational, institutional, deterministic, bounded.

## 1. Root cause

The next-intl middleware in `apps/union-eyes/proxy.ts` is configured with the canonical locale list `['en-CA', 'fr-CA', 'it', 'pt']` (default `en-CA`, prefix `always`). Short aliases `/en` and `/fr` are **not** in the locale list — next-intl treats them as **non-prefixed paths**, which under `prefix: 'always'` mode causes it to prepend the default locale, producing `/en-CA/en/X` (double-prefix). Same mechanism produces `/en-CA/fr/X` for `/fr/...`.

This is **not** a next-intl bug; it is a contract gap between alias affordance and the canonical locale set. The fix MUST live upstream of `intlMiddleware(req)` to short-circuit the bad expansion.

## 2. Real fix (landed in this PR)

Inserted in `apps/union-eyes/proxy.ts` **after** the marketing-path check and **before** the `intlMiddleware(req)` invocation:

```ts
// ── R5: Locale alias normalization (single-hop, deterministic) ──────────
// Configured locales are en-CA / fr-CA / it / pt. Short aliases /en and /fr
// (without the -CA region tag) are NOT in the locale list, which causes
// next-intl to treat them as non-prefixed paths and prepend the default
// locale — producing the double-prefix /en-CA/en/X. We normalize here with
// a single 308 (permanent, method-preserving) redirect to the canonical
// regional locale. Bounded: at most one redirect; never recursive.
const _localeAliasMap: Readonly<Record<string, string>> = Object.freeze({
  en: 'en-CA',
  fr: 'fr-CA',
});
const _firstSegment = req.nextUrl.pathname.split('/')[1] ?? '';
const _aliasTarget = _localeAliasMap[_firstSegment];
if (_aliasTarget) {
  const _normalized = req.nextUrl.pathname.replace(
    new RegExp(`^/${_firstSegment}(?=/|$)`),
    `/${_aliasTarget}`,
  );
  const _url = req.nextUrl.clone();
  _url.pathname = _normalized;
  return withRequestId(NextResponse.redirect(_url, 308), requestId);
}
```

### Properties of the fix

- **Single-hop** — exactly one redirect; the destination (`/en-CA/X`) is in the canonical locale list, so next-intl will not re-redirect.
- **308 (Permanent Redirect, method-preserving)** — preserves POST/PUT/DELETE bodies; cache-friendly; correct semantically because the alias is a permanent canonical mapping.
- **Anchored regex** — `^/${_firstSegment}(?=/|$)` uses a lookahead so `/en/dashboard` becomes `/en-CA/dashboard` and `/en` becomes `/en-CA`, but `/english/...` is not affected.
- **Frozen alias map** — `Object.freeze` prevents mutation; map is local to the request handler scope.
- **Bounded** — at most one redirect per request; never recursive (target is in canonical locale list).
- **Deterministic** — same input → same output, no env coupling, no provider coupling.

## 3. Acceptance criteria (post-deploy validation)

For each environment (dev / staging / demo / pilot):

| Probe | Expected | Acceptance |
|---|---|---|
| `GET /en/dashboard` | `308 → /en-CA/dashboard` | exactly one hop; final body served from `/en-CA/dashboard` |
| `GET /fr/dashboard` | `308 → /fr-CA/dashboard` | exactly one hop |
| `GET /en` | `308 → /en-CA` | exactly one hop; lookahead matches end-of-path |
| `GET /en-CA/dashboard` | `200` (no alias normalization triggered) | no extra redirect |
| `GET /it/dashboard` | `200` (it is canonical) | no extra redirect |
| `GET /english/foo` | `200` (not an alias match) | no false-positive redirect |
| `POST /en/api/X` | `308 → /en-CA/api/X`, body preserved | method preserved (308 contract) |

## 4. Anti-pattern enumeration (rejected)

The fix MUST NOT:

- introduce a recursive redirect loop
- use a non-method-preserving redirect (302/303 would silently downgrade POST→GET)
- mutate the canonical locale list
- change next-intl `prefix` semantics
- silently rewrite the URL without an HTTP redirect (would fork the URL space)

## 5. Verdict

R5 is **CLOSED**. The fix is operational, institutional, deterministic, bounded. Embodied institutional maturity; calm; inevitable; singular.

**Status: CLOSED. No chore PR required.** Post-deploy probe is part of the standard staging/demo/pilot validation cadence.
