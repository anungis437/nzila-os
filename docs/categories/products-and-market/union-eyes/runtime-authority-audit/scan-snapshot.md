# Scan Snapshot

Source of truth for every count cited in this audit. Re-runnable.

## Provenance

```powershell
# from repo root
cmd /c "dir /s /b apps\union-eyes\app 2>nul" `
  | Select-String "page\.tsx$|route\.ts$|layout\.tsx$"
```

## Raw counts

| Metric | Value |
| ------ | ----- |
| Total routing files (`page.tsx` + `route.ts` + `layout.tsx`) | 1187 |
| `page.tsx` files | 306 |
| `route.ts` files (API handlers) | 867 |
| `layout.tsx` files | 14 |
| Pages under `[locale]/` | 264 |
| Pages under `(marketing)/` | 33 |
| Pages under `[locale]/dashboard/` | 187 |
| Top-level dashboard sections | 89 |
| Pages under `[locale]/portal/` | 10 (all `@deprecated`, hard-redirect) |
| Dashboard pages using `<LegacyRedirect>` | 6 |
| Files referencing `requireUser` | 124 |
| Files referencing `isEntitled` | 0 |
| Files referencing `requireRole` / `hasRole` | 0 |
| Files referencing `ModuleGate` / `commercial_reporting` / `sovereignty_layer` | 20 |

## Implications

- **Authentication is enforced** broadly (124 `requireUser` call sites).
- **Authorisation is sparse**: zero direct `requireRole` / `hasRole` /
  `isEntitled` references inside `apps/union-eyes`. Authorisation is delegated
  to `ModuleGate` (20 files) and to org / membership checks performed inside
  shared utilities — see `full-feature-gating-hardening.md`.
- The dashboard surface is **wide** (89 sections / 187 pages). The Wave 2
  stakeholder matrix must collapse this to a per-stakeholder navigation set.
