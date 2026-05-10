# Full Legacy Surface Elimination

Concrete retire candidates. Each entry below is a real file/folder confirmed by
repo scan to be either a `LegacyRedirect` shim or a `@deprecated` hard-redirect.

## Tier A — `@deprecated` portal/* hard-redirects (10 files)

All in `apps/union-eyes/app/[locale]/portal/`:

| File | Redirects to |
| ---- | ------------ |
| `page.tsx` | `/{locale}/dashboard/priorities` |
| `claims/page.tsx` | dashboard claims surface |
| `claims/new/page.tsx` | dashboard claims intake |
| `claims/[id]/page.tsx` | dashboard claim detail |
| `documents/page.tsx` | dashboard documents |
| `dues/page.tsx` | dashboard dues |
| `messages/page.tsx` | dashboard inbox |
| `notifications/page.tsx` | dashboard notifications |
| `profile/page.tsx` | dashboard profile |
| `settings/page.tsx` | dashboard settings |
| `layout.tsx` | (deprecated wrapper) |

**Retire policy**: Safe to delete after one release of grace. External bookmarks
to `/portal/*` are unlikely; `proxy.ts` already routes everything through
locale-aware middleware.

## Tier B — Dashboard `LegacyRedirect` shims (6 files)

In `apps/union-eyes/app/[locale]/dashboard/`:

| File | Redirects to | Rationale to keep (for now) |
| ---- | ------------ | --------------------------- |
| `claims/page.tsx` | `/dashboard/inbox?filter=intake` | Tests + nav cards still link |
| `deadlines/page.tsx` | `/dashboard/priorities` | Tests + e-mail templates link |
| `executive/page.tsx` | `/dashboard/intelligence?tab=executive` | Investor demos link |
| `grievances/page.tsx` | `/dashboard/work` | E2E tests still navigate here (CAPE) |
| `insights/page.tsx` | `/dashboard/intelligence?tab=federation` | Marketing CTAs link |
| `messages/page.tsx` | `/dashboard/inbox?filter=messages` | Notification e-mails link |

**Retire policy**: Each of these has at least one inbound link from production
copy or tests. Deletion requires:

1. Inbound link audit (Wave 3 deliverable).
2. Update of `apps/union-eyes/e2e/cape-features.spec.ts` and `dashboard.spec.ts`
   to navigate the canonical target directly.
3. Marketing copy + transactional e-mail template sweep.

## Tier C — Auth aliases (2 files)

`apps/union-eyes/app/sign-in/page.tsx`, `apps/union-eyes/app/sign-up/page.tsx`
mirror `/login` and `/signup`. Retire after analytics confirm no inbound traffic.

## Execution status

> **No deletions performed in this revision.**
>
> Deletions are **operationally safe** (all redirects are pure server-side
> `redirect()` calls) but **not reversible from a routing-contract standpoint**:
> any external link to a deleted route will 404.
>
> Per the operational-safety policy in this workspace, we therefore stage them
> as flagged retire candidates for Wave 3, where they will be paired with the
> inbound-link sweep before deletion.

## Mandatory sections checklist

- [x] Tier A list
- [x] Tier B list
- [x] Tier C list
- [x] Execution status
