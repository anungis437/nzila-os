# FSM & Pilot Module Runtime Reconvergence

> Doctrinal authorization to finalize reconvergence of legacy pilot/runtime modules — FSM systems, pilot-era ops systems, experimental runtime surfaces, automation-era modules, AI-era modules, operational utility surfaces — and to consolidate duplicate continuity, governance, and cognition layers.

## Objective

This phase must **reduce experiential fragmentation**. Every surviving module must either be merged, retired, or converted to a substrate primitive (continuity, cadence, onboarding, governance).

## Upstream Authority

[fsm-pilot-module-reconvergence.md (architecture layer)](../institutional-operating-infrastructure/fsm-pilot-module-reconvergence.md) — this document authorizes the **runtime** execution of that architectural decision.

## Required Targets

Review every module in:

- `apps/union-eyes/` FSM-era surfaces
- pilot-era ops modules (work, rollout, operational reviews, FSM-merged)
- experimental runtime surfaces (operational-proving, rollout-readiness, etc.)
- automation-era modules (any module created during the automation push)
- AI-era modules (any module created during the AI push)
- operational utility surfaces (one-off helpers and admin tools)
- duplicate continuity layers
- duplicate governance layers
- duplicate cognition layers

## Required Outputs

For each reviewed module, declare exactly one disposition:

- **merge** — fold into a sibling operational surface
- **retire** — remove from runtime entirely
- **convert to substrate** — promote to a substrate primitive
- **convert to continuity primitive** — express as continuity infrastructure
- **convert to cadence primitive** — express as cadence infrastructure
- **convert to onboarding infrastructure** — express as onboarding scaffolding
- **hide from runtime** — keep code, remove sidebar/nav exposure
- **convert to governance infrastructure** — express as governance substrate

## Required Implementation

Actually:

- merge duplicate operational surfaces
- remove runtime fragmentation
- consolidate continuity layers into a single continuity surface per tier
- consolidate cognition layers into a single bounded-cognition surface per tier
- consolidate governance layers into a single governance-of-record surface per tier

## Anti-Patterns to Eliminate

- **two routes that do the same thing** (e.g., `/operational-proving-summary` AND `/rollout-readiness`)
- **AI-era utility surfaces** that duplicate executive cognition
- **pilot-era walkthroughs** that duplicate onboarding flows
- **experimental governance surfaces** that duplicate the governance-of-record

## Scope Discipline

This document authorizes one PR (`refactor/ue-fsm-pilot-runtime-reconvergence`). Each module disposition must be enumerated in the PR description with the chosen output and a one-sentence rationale.
