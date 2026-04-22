# Dependabot Alert Triage — 2026-04-21

**34 open alerts** on `anungis437/nzila-os` default branch.
This document classifies each alert and proposes an action. **Nothing has been auto-dismissed** — each batch requires your approval before I run the dismissal commands.

| # | Severity | Package | Count | Manifest scope | Verdict | Proposed action |
|---|---|---|---|---|---|---|
| 1 | high | `drizzle-orm` (CVE-2026-39356 / GHSA-gpj5-g38j-94v9) | **28** | 28 npm `package.json` files across `packages/*` and `apps/*` | **False positive — already patched** | Dismiss as `inaccurate` (see below) |
| 2 | high | `gunicorn` (CVE-2024-1135) | 1 | `tech-repo-scaffold/vertical-apps/template/backend/requirements.txt` | **Not in production runtime** — scaffold template | Dismiss as `not_used` |
| 3 | high | `gunicorn` (CVE-2024-6827) | 1 | `tech-repo-scaffold/.../requirements.txt` | Same as #2 | Dismiss as `not_used` |
| 4 | high | `cryptography` (CVE-2026-26007) | 1 | `tech-repo-scaffold/.../requirements.txt` | Same as #2 | Dismiss as `not_used` |
| 5 | low | `cryptography` (CVE-2026-34073) | 1 | `tech-repo-scaffold/.../requirements.txt` | Same as #2 | Dismiss as `not_used` |
| 6 | medium | `pytest` (CVE-2025-71176) | 1 | `tech-repo-scaffold/.../requirements.txt` | Same as #2 (test-only dep) | Dismiss as `not_used` |
| 7 | low | `cookie` (CVE-2024-47764) | 1 | `pnpm-lock.yaml` (transitive) | Low severity, transitive | Investigate — likely waivable |
| 8 | medium | `dompurify` (GHSA-39q2-94rc-95cp) | 1 | `pnpm-lock.yaml` (transitive) | Needs investigation | Investigate path |

---

## Detail — Item 1 (28 drizzle-orm alerts)

**Why false positive:**
- Root `package.json` declares `pnpm.overrides: { "drizzle-orm": ">=0.45.2" }` — line 257.
- `pnpm-lock.yaml` line 13829 resolves to `drizzle-orm@0.45.2` (the patched version per advisory).
- Dependabot scans per-manifest version specifiers and **does not honor `pnpm.overrides`** — it sees `^0.39.0` etc. in 28 sibling `package.json` files and flags each one independently.
- Actual installed runtime version on every workspace package is `0.45.2`. No vulnerability is present.

**Proposed dismissal command (for your approval):**
```pwsh
gh api /repos/anungis437/nzila-os/dependabot/alerts?state=open"&"per_page=100 |
  ConvertFrom-Json |
  Where-Object { $_.dependency.package.name -eq 'drizzle-orm' } |
  ForEach-Object {
    gh api -X PATCH "/repos/anungis437/nzila-os/dependabot/alerts/$($_.number)" `
      -f state=dismissed `
      -f dismissed_reason=inaccurate `
      -f dismissed_comment="False positive: pnpm.overrides in root package.json forces drizzle-orm@>=0.45.2 (the patched version per GHSA-gpj5-g38j-94v9). pnpm-lock.yaml resolves to 0.45.2. Dependabot does not honor pnpm overrides when scanning per-manifest specifiers."
  }
```

## Detail — Items 2–6 (5 alerts in tech-repo-scaffold/.../requirements.txt)

`tech-repo-scaffold/vertical-apps/template/backend/requirements.txt` is a **scaffolding template** — used by `pnpm tsx tooling/scaffolds/*` to generate NEW vertical apps. It is **not installed**, **not built**, **not deployed**. No production runtime dependency.

**Proposed action:**
1. Update the template to use patched versions (`gunicorn>=23.0.0`, `cryptography>=44.0.1`, `pytest>=8.4.0`) so newly scaffolded apps start clean
2. Then dismiss the 5 alerts as `not_used`

## Detail — Items 7–8 (cookie + dompurify)

These are transitive via `pnpm-lock.yaml`. Need to identify the path:
```pwsh
pnpm why cookie
pnpm why dompurify
```
Then either: bump the parent dependency, add a pnpm override, or waive in `tooling/security/supply-chain-policy.ts:ACTIVE_WAIVERS` if no fix is available.

---

## Recommended approval batches

**Batch A (zero-risk):** dismiss all 28 drizzle-orm alerts → **27 high-severity alerts gone**.
**Batch B (low-risk):** patch scaffold `requirements.txt` + dismiss 5 alerts → **3 more high gone, 2 medium/low gone**.
**Batch C (investigation):** triage cookie + dompurify properly → **1 medium + 1 low**.

After A+B+C: **0 open alerts** (down from 34).

To proceed: reply with `A`, `A+B`, or `A+B+C`.
