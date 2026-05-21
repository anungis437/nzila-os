# Union Eyes — Pilot Evidence Pack

**Version:** 2.0  
**Date:** 2026-05-14  
**Sprint:** 10/10 Pilot Readiness  
**Status:** ✅ CONTROLLED PILOT — GO

This directory contains the complete evidence package for the Union Eyes v0.1 controlled CUPE pilot.

---

## Documents

| Document | Purpose | Status |
|---|---|---|
| [BUYER_REVIEW_INDEX.md](./BUYER_REVIEW_INDEX.md) | **Start here** — guided review paths by role | ✅ Complete |
| [PILOT_READINESS_MEMO.md](./PILOT_READINESS_MEMO.md) | Executive memo — GO/NO-GO decision, conditions | ✅ Complete |
| [PILOT_SCOPE_LOCK.md](./PILOT_SCOPE_LOCK.md) | Frozen pilot scope — in-scope modules, parameters, freeze process | ✅ Complete |
| [SECURITY_BUYER_PACK.md](./SECURITY_BUYER_PACK.md) | CISO-facing security controls pack | ✅ Complete (v2.0) |
| [CI_GOVERNANCE_EVIDENCE.md](./CI_GOVERNANCE_EVIDENCE.md) | CI gate captures — typecheck 0 errors, DB guard 0 violations | ✅ Complete |
| [RUNTIME_EVIDENCE_PACK.md](./RUNTIME_EVIDENCE_PACK.md) | Runtime evidence — code-verified + live Azure VERIFIED 2026-05-21 | ✅ Section A + Section B |
| [LIVE_EVIDENCE_CAPTURE_RUNBOOK.md](./LIVE_EVIDENCE_CAPTURE_RUNBOOK.md) | Exact `az` CLI commands for Azure proof (executed 2026-05-20) | ✅ Executed |
| [ORG_ISOLATION_CONTROL_MAP.md](./ORG_ISOLATION_CONTROL_MAP.md) | 9 org-isolation controls — code locations, tests, residual risks | ✅ Complete |
| [READINESS_COMMANDS.md](./READINESS_COMMANDS.md) | Canonical readiness gate commands with expected outputs | ✅ Complete |
| [PILOT_OPERATIONS_RUNBOOK.md](./PILOT_OPERATIONS_RUNBOOK.md) | Kickoff, onboarding, support, incident, expansion gate | ✅ Complete |
| [PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md) | 90-day success criteria and expansion thresholds | ✅ Complete |
| [INVESTOR_TECHNICAL_DILIGENCE_SUMMARY.md](./INVESTOR_TECHNICAL_DILIGENCE_SUMMARY.md) | Technical moat, risk register, valuation implications | ✅ Complete |

---

## Quick Summary

| Question | Answer |
|---|---|
| Is Union Eyes pilot-safe? | **Yes** — controlled pilot, 1 org, signed DPA required |
| Any CISO-level blockers? | **No** — EXC-001 resolved, RLS fail-closed, 0 raw-db imports, strict TS, live Azure verified |
| What's pending for broad production? | DPA counter-signature + SOC 2 / pen-test scheduling (commercial/process — live Azure inventory verified 2026-05-21; **live PITR restore drill executed and verified 2026-05-21** — see `reports/runtime/live-captures/2026-05-20/restore-drill/`) |
| Data residency compliant? | **Yes** — Azure Canada Central verified live 2026-05-21 |
| Can buyers review today? | **Yes** — direct them to BUYER_REVIEW_INDEX.md |

---

## Three-Layer Runtime Status

| Layer | State | Source |
|-------|-------|--------|
| Code/config posture | ✅ HEALTHY | `reports/runtime/platform-runtime-truth-latest.json` |
| Live operational proof | ✅ VERIFIED 2026-05-21 | `reports/runtime/live-captures/2026-05-20/live-evidence-manifest.2026-05-20.json` |
| Production expansion | ✅ GO 2026-05-21 | Live PITR restore drill verified (RESTORE-DRILL-2026-05-20-001); remaining items are commercial — see `restore-drill/restore-drill-manifest.json` |

---

## Evidence Freshness

All CI evidence is from the 10/10 readiness sprint (2026-05-14).  
Runtime truth: `reports/runtime/platform-runtime-truth-latest.json` — **HEALTHY**  
Supersedes: All prior `DEGRADED` / EXC-001-open reports

---

## Quick Local Validation

```bash
pnpm readiness:union-eyes
```

Runs: TypeScript check, DB import guard, Union Eyes tests, runtime truth JSON parse.

