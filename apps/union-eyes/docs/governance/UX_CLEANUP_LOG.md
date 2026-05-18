# UX Cleanup Log — UnionEyes Validation Findings

Generated from `PAGE_RENDER_VALIDATION.md` remediation pass.

---

## Changes Applied

| File | Issue | Fix Applied | Status |
|------|-------|-------------|--------|
| `app/[locale]/dashboard/admin/layout.tsx` | P1 — Admin shell accessible to any officer-level user; `hasMinRole("officer")` too permissive for system admin panel | Upgraded `hasMinRole("officer")` → `hasMinRole("admin")` (level 140). All `/dashboard/admin/*` routes now require Admin role or higher. | ✅ Done |
| `app/[locale]/dashboard/documents/layout.tsx` | P1 — No server-side role gate on documents page | Created new `layout.tsx` with `requireUser()` + `hasMinRole("officer")`; unauthenticated or low-privilege users are redirected to `/dashboard` | ✅ Done |
| `app/[locale]/dashboard/claims/new/page.tsx` | P2 — `alert()` used instead of toast for microphone permission error | Replaced `alert(...)` with `toast({ variant: "destructive", title: ... })` using the already-imported `useToast` hook | ✅ Done |
| `app/[locale]/(marketing)/pilot-request/page.tsx` | P2 — `alert()` used for submission failure notification | Added `import { toast } from 'sonner'`; replaced two `alert(t('alerts.submitFailed'))` calls with `toast.error(...)` | ✅ Done |
| `app/[locale]/dashboard/loading.tsx` | P2 — No `loading.tsx` at dashboard root | Created skeleton loading component matching sidebar + main content layout using `animate-pulse` | ✅ Done |
| P3 — TODO text in user-visible strings | Scanned all `.tsx` files under `app/` — no hardcoded TODO or "Click here" labels found | ✅ None found |

---

## Deferred / Documented

| File | Issue | Reason Deferred |
|------|-------|-----------------|
| `app/[locale]/dashboard/admin/dues/layout.tsx` | Admin layout upgrade from `officer` → `admin` may restrict Secretary-Treasurer (level 110) access to dues admin pages | The dues admin layout (`admin/dues/layout.tsx`) has no independent role check — it relies on the parent admin layout. Due to Next.js layout inheritance (parent runs before child), the parent's `admin` gate now also applies to `/dashboard/admin/dues/*`. If secretary_treasurer access to dues admin is required, the dues routes should be moved outside the `/admin` segment (e.g. to `/dashboard/dues-admin/`), or a route group with a separate, lower-threshold layout should be created. This is a routing refactor that requires product sign-off. |
| Other `alert()` occurrences found during scan | Additional `alert()` calls found in `voting/page.tsx`, `bargaining/new/page.tsx`, `dues/receipts/[transactionId]/page.tsx`, `elections/[id]/page.tsx`, `elections/new/page.tsx`, `admin/organizations/*.tsx`, `admin/dues/billing-cycles/page.tsx`, `calendar/page.tsx` | Out of scope for this pass (only claims/new and pilot-request were listed as P2). Recommend a follow-up sweep to replace all remaining `alert()` calls with the appropriate toast pattern. |

---

## TypeScript Validation

```
pnpm --filter union-eyes exec tsc --noEmit
```

✅ No TypeScript errors after all changes.

---

*Last updated: UX cleanup pass — PAGE_RENDER_VALIDATION remediation*
