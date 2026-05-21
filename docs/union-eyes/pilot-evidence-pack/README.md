# Union Eyes — Pilot Evidence Pack

**Version:** 1.0  
**Date:** 2026-05-20  
**Sprint:** Pilot Evidence Pack  
**Status:** ✅ CONTROLLED PILOT — GO

This directory contains the complete evidence package for the Union Eyes v0.1 controlled CUPE pilot.

---

## Documents

| Document | Purpose | Status |
|---|---|---|
| [PILOT_READINESS_MEMO.md](./PILOT_READINESS_MEMO.md) | Executive memo — GO/NO-GO decision, conditions, what changed | ✅ Complete |
| [PILOT_SCOPE_LOCK.md](./PILOT_SCOPE_LOCK.md) | Frozen pilot scope — in-scope modules, parameters, freeze process | ✅ Complete |
| [SECURITY_BUYER_PACK.md](./SECURITY_BUYER_PACK.md) | CISO-facing security controls pack — org isolation, residency, audit, AI boundary | ✅ Complete |
| [CI_GOVERNANCE_EVIDENCE.md](./CI_GOVERNANCE_EVIDENCE.md) | CI gate captures — typecheck 0 errors, DB guard 0 violations, test results | ✅ Complete |
| [RUNTIME_EVIDENCE_PACK.md](./RUNTIME_EVIDENCE_PACK.md) | Runtime evidence — code-verified (complete) + live env confirmation (pending) | 🟡 Partial |

---

## Quick Summary

| Question | Answer |
|---|---|
| Is Union Eyes pilot-safe? | **Yes** — controlled pilot, 1 org, signed DPA required |
| Any CISO-level blockers? | **No** — EXC-001 resolved, RLS fail-closed, zero raw-db imports, strict TS |
| What's pending for broad production? | Live smoke tests, Azure RG proof, Key Vault separation, restore drill (see RUNTIME_EVIDENCE_PACK.md §B) |
| Data residency compliant? | **Yes** — Azure Canada Central, 0 violations |
| Can buyers review today? | **Yes** — send SECURITY_BUYER_PACK.md; do not send any pre-2026-05-20 version |

---

## Evidence Freshness

All CI evidence is from commit `b08e98840` (noImplicitAny sprint — 2026-05-20).

| Runtime truth | `reports/runtime/platform-runtime-truth-latest.json` — HEALTHY |
|---|---|
| Supersedes | All prior `DEGRADED` / EXC-001-open reports |

---

## What to Do Before Expanding Pilot

1. Complete `RUNTIME_EVIDENCE_PACK.md` Section B (live env confirmation)
2. Get DPA signed by union IT contact
3. Deliver `PILOT_SCOPE_LOCK.md` to the union pilot contact for acknowledgement
4. Update `platform-runtime-truth-latest.json` with confirmed `nzila-canada-prod-rg` placement
