# Repo Cleanup & Documentation Hardening — Change Summary

> Generated during the comprehensive information architecture pass.

---

## 1. Root-Level File Cleanup

**Problem:** 24+ debug/log files and 7 audit reports committed directly to the repository root.

**Actions:**
- Moved 7 audit report MDs → `docs/archive/audit-reports/`
- Moved 23 debug/log files (ue-*.txt, pytest-*.txt, vitest-output.txt, etc.) → `docs/archive/debug-logs/`
- Moved `DEFERRED_ITEMS.md`, `TENANT_INVENTORY.md` → `docs/reference/`
- Updated `.gitignore` with 8 new patterns to prevent future root accumulation

**Files affected:** ~32 files relocated

---

## 2. Auth Documentation Correction

**Problem:** All docs referenced "Clerk" as the auth provider. Auth was migrated to `@nzila/platform-auth` with email/password (Argon2id + PG sessions) as DEFAULT and Microsoft Entra External ID SSO as OPTIONAL.

**Actions — CRITICAL (public-facing or user-facing):**
- `content/public/platform-architecture.md` — Auth section rewritten
- `content/internal/rbac-permissions.md` — Full auth section rewritten (dual role resolution)
- `content/internal/console-quickstart.md` — Prerequisites updated
- `README.md` — 6 Clerk references corrected
- `README.business.md` — Auth line updated

**Actions — HIGH (developer docs):**
- Created `docs/architecture/AUTH_ARCHITECTURE.md` — NEW canonical auth reference
- `docs/deploy/data-residency-audit.md` — Clerk data processor section replaced
- `apps/union-eyes/docs/cba-intelligence-openapi.yaml` — Security scheme renamed from clerk → platformAuth
- `apps/web/docs/pilot-playbook.md` — 2 Clerk references corrected
- `tooling/staging-certification/CERTIFICATION_REPORT.md` — 3 Clerk references corrected
- 8 app pilot/demo docs (cfo, partners, flow, zonga) — Auth references corrected

**Actions — MEDIUM (internal tooling/scaffold):**
- `packages/scripts-book/README.md` — Added LEGACY label, profiles table updated with status column

**Files affected:** ~20 documents corrected

---

## 3. App READMEs

**Problem:** 15 of 17 apps had no README or only a Next.js boilerplate README.

**Actions:**
- Created READMEs for: abr, agrimo, cfo, console, control-plane, cora, flow, mobility, mobility-client-portal, nacp-exams, orchestrator-api, partners, platform-admin, trade, zonga
- Rewrote web's boilerplate README to proper format
- union-eyes already had a quality README (no changes)

**Each README includes:** purpose, stack, ports, key routes, domain model summary, dev commands.

**Files affected:** 16 README.md files created/rewritten

---

## 4. Flow Docs Reorganization

**Problem:** `apps/flow/docs/` had 38 files dumped flat in the root with no organization.

**Actions:**
- Created subdirectories: `architecture/`, `runbooks/`, `reference/`, `pilots/`, `archive/transcripts/`, `archive/assets/`
- Moved 9 files → architecture/
- Moved 6 files → runbooks/
- Moved 7 files → reference/
- Moved 5 files → pilots/
- Moved 10 WhatsApp transcripts → archive/transcripts/
- Moved 1 PDF → archive/assets/
- Created `apps/flow/docs/INDEX.md` — navigation hub

**Files affected:** 38 files reorganized + 1 INDEX created

---

## 5. Union-Eyes Docs Cleanup

**Problem:** WhatsApp PTT transcript and stale historical docs mixed with active docs.

**Actions:**
- WhatsApp PTT transcript → `archive/`
- `TS_ERROR_INVENTORY.md` (historical) → `archive/`
- `WORLD_CLASS_PLAN.md` (superseded) → `archive/`
- Updated `apps/union-eyes/docs/INDEX.md` with archive section

**Files affected:** 3 files archived, 1 INDEX updated

---

## 6. Scripts / Tooling / Reports READMEs

**Problem:** `scripts/` (100+ files), `tooling/` (20+ subdirs), `reports/` (25 files) had no README or index.

**Actions:**
- Created `scripts/README.md` — categorized by: Build/CI, Database, Auth Provisioning, Analysis, Deployment, Utilities, Proof
- Created `tooling/README.md` — categorized by: CI/Automation, Security, Analysis, Governance, Utility
- Created `reports/README.md` — categorized by: Audit Reports, Scorecards, Analysis

**Files affected:** 3 READMEs created

---

## 7. Scripts-Book Legacy Labeling

**Problem:** `packages/scripts-book` profiles, modules, and docs all reference Clerk auth.

**Actions:**
- Added LEGACY banner and auth migration note to `README.md`
- Added Status column to Stack Profiles table marking Clerk profiles as **LEGACY**
- `django-aca-azurepg` profile marked as **Current**

**Files affected:** 1 README updated

---

## 8. Documentation Map Refresh

**Problem:** `docs/index/doc-map.md` only listed ~44 of ~200 documents. Major sections completely missing.

**Actions:**
- Expanded from 8 sections → 25 sections
- Added: Architecture (39 files), Governance (24 files), Hardening (17 files), Platform (15 files), Agri (12 files), Commerce, Decision Layer, Deploy, Migration, Risk, GA, Stress Test, Plans, Explanation, Repo Contract, Reference, Archive, App-Level Docs
- Added Auth Architecture to docs/README.md platform section
- Created `docs/archive/README.md` with contents table

**Files affected:** 3 files updated/created

---

## 9. Root README Corrections

**Problem:** Root README said "13 apps, 58+ packages" — actual count is 17 apps, 152 packages. Business domains table was missing 8 apps.

**Actions:**
- Updated counts: 13 → 17 apps, 58+ → 150+ packages
- Updated ASCII diagram: "13 APPS" → "17 APPS"
- Added missing apps to business domains table: ABR, Flow, Mobility, Mobility Client Portal, Zonga, Control Plane, Platform Admin, Orchestrator API

**Files affected:** 1 file (README.md)

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Files relocated | ~70 |
| READMEs created | 22 |
| Documents corrected (auth) | ~20 |
| New canonical docs | 2 (AUTH_ARCHITECTURE.md, flow INDEX.md) |
| .gitignore patterns added | 8 |
| Stale Clerk references fixed | ~30 |
| Doc-map coverage | 44 → 200+ docs |
| Apps in README table | 9 → 12 domains (17 apps) |

---

## Remaining Items (Not In Scope)

- **Clerk CSP headers**: 11 apps have stale Clerk domains in `next.config.ts` CSP headers — code change, not docs
- **Clerk-named profile/module renames** in scripts-book (`auth-clerk/` module, `*-clerk.json` profiles) — requires generator code changes
- **Binary assets in docs/plans/go-to-market/**: Excel and PowerPoint files — left in place (business strategy docs)
- **docs/commerce/_extracted/pricing-engine/node_modules/**: Accidentally committed node_modules — should be gitignored
