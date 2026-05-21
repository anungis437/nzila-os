# Buyer Review Index — Union Eyes Controlled Pilot

**Status:** CURRENT  
**Last updated:** 2026-05-14  
**Source of truth:** This document + individual evidence pack files  
**Supersedes:** N/A (new — authoritative index)  
**Live-evidence dependencies:** Section C (runtime evidence) pending Azure access

---

This index guides reviewers to the right documents based on their role and time available.
All materials are in `docs/union-eyes/pilot-evidence-pack/`.

---

## 5-Minute Review Path (Executive Sponsor / Initial Screen)

**Goal:** Decide if Union Eyes deserves deeper review.

| Step | Document | Key claim to verify |
|------|----------|---------------------|
| 1 | `PILOT_READINESS_MEMO.md` | Executive GO memo — controlled pilot approved |
| 2 | `README.md` (this folder) | What exists, what's pending |
| 3 | `PILOT_SCOPE_LOCK.md` — Summary section | Exactly what is in scope |

**Conclusion:** If the memo says GO (controlled, with documented conditions), proceed to 30-minute path.

---

## 30-Minute Review Path (Procurement / Buyer Security)

**Goal:** Determine if Union Eyes can handle your union's data under your security requirements.

| Step | Document | What to read |
|------|----------|-------------|
| 1 | `SECURITY_BUYER_PACK.md` | Full document — org isolation, RLS, DB guard, data residency, AI boundary, production/staging separation |
| 2 | `PILOT_SCOPE_LOCK.md` | Module scope freeze — what is in/out of pilot |
| 3 | `CI_GOVERNANCE_EVIDENCE.md` | CI gate captures — automated enforcement evidence |
| 4 | `RUNTIME_EVIDENCE_PACK.md` — Section A | Code/config posture (HEALTHY) |
| 5 | `RUNTIME_EVIDENCE_PACK.md` — Section B summary | What is pending live proof vs. what is already code-verified |

**Key questions answered:**
- Is org isolation enforced? → Yes, fail-closed (Section 2 of Security Buyer Pack)
- Is data in Canada? → Yes, Azure Canada Central (Section 3)
- Is AI training blocked? → Yes, contractual + code boundary (Section 6)
- What is not yet live-proven? → Section B of Runtime Evidence Pack

---

## Technical Reviewer Path (CISO / Security Architect)

**Goal:** Assess actual security implementation, not just claims.

| Step | Document | What to examine |
|------|----------|----------------|
| 1 | `ORG_ISOLATION_CONTROL_MAP.md` | All 9 controls with code locations, test coverage, residual risks |
| 2 | `SECURITY_BUYER_PACK.md` | End-to-end security posture narrative |
| 3 | `CI_GOVERNANCE_EVIDENCE.md` | Raw CI output — typecheck 0 errors, DB import 0 violations |
| 4 | Code: `apps/union-eyes/lib/db/with-rls-context.ts` | Core RLS wrapper implementation |
| 5 | Code: `scripts/check-ue-db-import-guard.ts` | Zero-tolerance DB import enforcement |
| 6 | Code: `apps/union-eyes/__tests__/cross-org-isolation.test.ts` | Regression tests |
| 7 | `LIVE_EVIDENCE_CAPTURE_RUNBOOK.md` | What still needs live Azure verification |

**Key code probes:**
```bash
# Prove zero DB import violations
pnpm governance:check-db-imports

# Prove TypeScript is clean under noImplicitAny
pnpm typecheck --filter "@nzila/union-eyes"

# Run org isolation tests
pnpm test:fast --filter "@nzila/union-eyes"
```

---

## Legal / Compliance Path

**Goal:** Assess contractual commitments, data residency, and privacy framework.

| Step | Document | What to review |
|------|----------|---------------|
| 1 | `PILOT_READINESS_MEMO.md` — Section 4 (Conditions) | Pre-conditions before real member data |
| 2 | `SECURITY_BUYER_PACK.md` — Data Residency, AI Boundary | Contractual claims and their code backing |
| 3 | `PILOT_SCOPE_LOCK.md` — Data Classification | What data is in scope |
| 4 | `docs/compliance/soc2/gap-log.md` | SOC 2 readiness status and gap closure |
| 5 | `docs/compliance/` — DPA template | Data Processing Agreement terms |
| 6 | `RUNTIME_EVIDENCE_PACK.md` — Section B | What is pending live proof (relevant to DPA obligations) |

**DPA requirement:** DPA must be signed before any real member data enters the system.
This is encoded in `PILOT_SCOPE_LOCK.md` as Launch Condition L-001.

---

## Technical Due Diligence Path (Investor / Board)

**Goal:** Assess defensibility of the technical moat and platform maturity.

| Step | Document | Signal |
|------|----------|--------|
| 1 | `INVESTOR_TECHNICAL_DILIGENCE_SUMMARY.md` | Architecture, moat, risk register |
| 2 | `PILOT_READINESS_MEMO.md` | Controlled pilot GO narrative |
| 3 | `ORG_ISOLATION_CONTROL_MAP.md` | Evidence of engineering discipline |
| 4 | `CI_GOVERNANCE_EVIDENCE.md` | CI enforcement evidence |
| 5 | Git history | Commit density, scope discipline, evidence-first culture |

---

## SRE / Operations Path

**Goal:** Confirm the platform is operable during and after the pilot.

| Step | Document | What to confirm |
|------|----------|----------------|
| 1 | `PILOT_OPERATIONS_RUNBOOK.md` | Kickoff, onboarding, support, incident, expansion criteria |
| 2 | `LIVE_EVIDENCE_CAPTURE_RUNBOOK.md` | Azure verification commands (run before launch) |
| 3 | `RUNTIME_EVIDENCE_PACK.md` | Runtime posture — what's verified vs. pending |
| 4 | `reports/runtime/platform-runtime-truth-latest.json` | Authoritative runtime truth |

---

## Evidence Appendix

All evidence files in this pack:

| File | Type | Status |
|------|------|--------|
| `README.md` | Index | ✅ Current |
| `PILOT_READINESS_MEMO.md` | Executive memo | ✅ Current |
| `SECURITY_BUYER_PACK.md` | CISO/buyer | ✅ Current (v2.0) |
| `CI_GOVERNANCE_EVIDENCE.md` | CI captures | ✅ Current |
| `PILOT_SCOPE_LOCK.md` | Scope freeze | ✅ Current |
| `RUNTIME_EVIDENCE_PACK.md` | Runtime posture | ✅ Section A / ⏳ Section B PENDING |
| `LIVE_EVIDENCE_CAPTURE_RUNBOOK.md` | Azure runbook | ✅ Template ready |
| `ORG_ISOLATION_CONTROL_MAP.md` | Security controls | ✅ Current |
| `READINESS_COMMANDS.md` | Gate commands | ✅ Current |
| `BUYER_REVIEW_INDEX.md` | This file | ✅ Current |
| `PILOT_OPERATIONS_RUNBOOK.md` | Ops playbook | ✅ Current |
| `PILOT_SUCCESS_METRICS.md` | Success criteria | ✅ Current |
| `INVESTOR_TECHNICAL_DILIGENCE_SUMMARY.md` | Investor diligence | ✅ Current |

**External dependencies (not in this repo):**
- Live Azure environment captures (`LIVE_EVIDENCE_CAPTURE_RUNBOOK.md` → `reports/runtime/live-captures/`)
- Signed DPA
- Pilot participant consent
- SOC 2 Type II (planned post-pilot)

---

*Start here. Every review path eventually converges on `ORG_ISOLATION_CONTROL_MAP.md` and
`RUNTIME_EVIDENCE_PACK.md` — those are the two documents that most directly represent
the gap between "code says" and "deployment proves."*
