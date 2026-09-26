# CIVIC × SAGE × OMHRA — Readiness Package (Phase 3)

**Date:** 2026-09-23 (America/Toronto)  
**PR (draft):** https://github.com/anungis437/nzila-os/pull/798  
**Branch:** `civic/omhra-pilot-readiness`  
**Main baseline:** `ff98963758de37255ae20cd13433c4c3b8a384b7`  
**Launch decision:** **NO_GO** (unchanged)

**Product boundaries:** CIVIC = engagement methodology; CLEAR = evidence discipline; SAGE = governed runtime. **OMHRA** is the example first case of the reusable Leadership Transition / Institutional Memory pattern — **not** a product fork.

---

## 1. Code-ready vs deployed/proven

| Layer | Status |
| --- | --- |
| **Code-ready** | SAGE core + platform-admin surfaces + **synthesis-safety choke wired into all evidence-bearing retrieval entry points** + claim-chain register + LT/IM pack + DEMO_PATH |
| **Deployed/proven** | **Not proven** — B-005 open; staging-admin Unavailable; Azure auth external |
| **External production authorized** | **false** |

---

## 2. Gate table (in-repo vs pending deploy)

| Gate | In-repo | Deployed/proven |
| --- | --- | --- |
| G1–G5, G8 (architecture, authz, evidence, human review, export immutability, retention) | PASS (historical proof-run 004/005 + code present) | Requires staging |
| G6/G7/G9/G10/G14/G15 | PASS_WITH_CONDITIONS | Needs B-005 + follow-on |
| G11 Accessibility | Automated axe PASS in-repo; **manual NOT_PROVEN** | Needs B-005 + named human (`G11_MANUAL_A11Y_CHECKLIST.md`) |
| G12 Observability | **NOT_PROVEN** | External (B-001/B-002) |
| G13 Backup/restore | **NOT_PROVEN** | External (B-003) |

---

## 3. Synthesis-safety (architectural fact)

**Canonical marker:** `applyAuthorizedEvidenceContextChoke`  
**Inventory:** `docs/public-service/operations/sage-acceptance/SYNTHESIS_CHOKE_ENTRY_POINTS.md`  
**Regression:** `packages/sage-core/src/synthesis-choke-architecture.test.ts`

Wired entry points include: evidence list/get (sources+items), boundary flags, review notes, decision list/get (+ reference redaction), institutional QA context, export package generation. Platform-admin `POST …/institutional-context` and evidence services call through core.

---

## 4. PR #798 contents (Phase 2 + 3)

- `synthesis-context` + DO_NOT_REGRESS tests  
- `claim-chain` + `institutional-context` + wiring into services  
- Architectural choke inventory + regression test  
- LT/IM reference-config pack + DEMO_PATH + FICTIONAL fixtures (incl. claim-register)  
- B-005 procedure, G11 manual checklist, gap analysis, authz inventory  

---

## 5. Exact human actions still required

### B-005 (staging deploy) — external
See `docs/public-service/operations/sage-acceptance/B005_STAGING_DEPLOY_PROCEDURE.md`:
1. `az login` (staging-scoped)  
2. Record before image + `/api/health`  
3. Apply migrations `0032`–`0044` on isolated DB  
4. Deploy `platform-admin` with SAGE env via gitops/staging workflow  
5. Verify `buildInfo.commit` + `sage_%` tables + `/sage` routes  

### G11 manual — external after B-005
`G11_MANUAL_A11Y_CHECKLIST.md` — named human, keyboard + screen reader on **deployed** UI.

### G12 — external
Telemetry round-trip + alert receivers + incident drill (B-001/B-002).

### G13 — external
Isolated restore round-trip (B-003).

---

## 6. OMHRA pilot go-criteria (engagement) vs software launch

**Discovery / engagement (CIVIC) may proceed when:**
- Continuity discovery authorized by prospect  
- Approved FICTIONAL-or-authorized corpus only (no confidential scrape)  
- Roles/grants mapped from `institution-workspace.yaml`  
- Restricted-path demo understood (incoming executive default deny)

**Software launch remains NO_GO until** B-005 + G12 + G13 + G11 manual close and a new proof-run evidence-manifest records GO/CONDITIONAL_GO.

---

## 7. Blocker classification

| Blocker | Class |
| --- | --- |
| B-005 staging deploy | **External** (Azure) |
| B-001/B-002 G12 | **External** (ops/telemetry) |
| B-003 G13 | **External** (restore drill) |
| B-004 G11 manual | **External** (named human post-deploy) |
| Synthesis choke unwired | **Engineering — closed in this PR** |
| Claim→source→date→authority | **Engineering — closed via migration-free claim-register** |
| Member365/LRIS | Out of scope (adapter sketch only) |
