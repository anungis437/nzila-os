# Full Symbol & Package Semantic Convergence

> Doctrinal authorization to finalize remaining substrate semantic drift — package names, exports, symbols, internal docs, runtime references — without destabilizing CI, imports, or deployments.

## Objective

This is **substrate semantic hardening**, not cosmetic renaming. Every package name and exported symbol must read as institutionally inevitable.

## Required Targets

Refactor remaining symbol families:

| From | Toward |
|---|---|
| `ai-*` | cognition |
| `assistant-*` | reviewer-of-record |
| `insight-*` | evidence-anchored interpretation |
| `intelligence-*` | cognition / synthesis |
| `recommendation-*` | operational interpretation |
| `autopilot-*` | bounded synthesis with reviewer-of-record |
| `agent-*` | continuity / governance / cadence (depending on role) |

## Canonical Substrate Vocabulary

- **cognition** — bounded interpretation surface
- **continuity** — succession, handoff, transition
- **governance** — reviewer-of-record, evidence-of-record, audit-of-record
- **synthesis** — bounded composition of evidence into interpretation
- **interpretation** — reviewer-resolved reading of evidence
- **operational-memory** — institutional memory substrate
- **cadence** — institutional pulse substrate
- **reviewer-of-record** — the human accountable for an interpretation

## Required Implementation

Safely refactor:

- package names (with workspace-aware migration; never break a published name without a deprecation alias)
- exports (re-export from old names with `@deprecated` for one minor cycle)
- symbols (use codemods; verify with typecheck + contract tests)
- internal docs (READMEs, CHANGELOGs, ARCHITECTURE)
- runtime references (imports, JSDoc, error messages)

Without:

- destabilizing CI (each rename PR must be green before merge)
- destabilizing imports (deprecation aliases must exist for one cycle)
- destabilizing deployments (no breaking changes to runtime config keys)

## Anti-Patterns to Eliminate

- **mass-rename PRs** that touch hundreds of files in one commit (split per package family)
- **rename without alias** (always provide a deprecation alias for one cycle)
- **symbol drift** between marketing copy, runtime copy, package names, and code symbols

## Scope Discipline

This document authorizes a **series** of PRs — one per symbol family — under the prefix `refactor/ue-substrate-rename-{family}`. Mass-rename PRs are forbidden by this doctrine.
