# Platform Proof Overview — Technical Validation Guide

> This document provides a comprehensive overview of the Nzila OS Platform Proof
> Layer for technical evaluators, auditors, and compliance officers.

## Purpose

The Platform Proof Layer is a set of executable tests that demonstrate — with
machine-verifiable evidence — that every governance control in the Nzila OS
platform operates correctly under real conditions. Unlike unit tests that
validate individual functions, proof tests exercise complete governed lifecycles
and produce auditable artifacts.

## What Gets Proven

### 1. UE Governed Mutation

**Scenario:** A financial record mutation flows through the full enforcement
pipeline.

**Controls exercised:**
- `@nzila/observability` — distributed trace context generated
- `@nzila/enforcement` — `traceLayer` → `authLayer` → `rateLimitLayer` →
  `governanceLayer` → `auditLayer` → handler
- `@nzila/governance` — `canAccess()` evaluates policy set, `DecisionLogger`
  records decision
- `@nzila/audit` — `AuditEngine.record()` creates hash-chained entry,
  `verifyChain()` validates integrity

**Evidence:** 7 artifact files including governance decision JSON, audit chain
verification result, and full request/response trace.

### 2. AI-Controlled Request

**Scenario:** An AI inference request passes through policy, budget, and
classification controls.

**Controls exercised:**
- `@nzila/ai-control` — `AIPolicyRegistry` enforces data and model policies
- `@nzila/ai-control` — `checkBudget()` validates tenant spend limits
- `@nzila/ai-control` — `runAI()` invokes provider with full control chain
- `@nzila/ai-control` — `classifyOutput()` validates response safety

**Evidence:** 5 artifact files including policy evaluation, budget check, and
AI response classification.

### 3. Event Contract Flow

**Scenario:** Inter-module domain events are emitted with payload validation
against registered contracts.

**Controls exercised:**
- `@nzila/contracts` — `ContractRegistry.validate()` checks payloads against
  Zod schemas (OrderCreated_v1, PaymentProcessed_v1)
- `@nzila/events` — `EventEmitter.emitEvent()` validates before emission
- `@nzila/events` — `EventBus` delivers to registered handlers
- `@nzila/events` — `InMemoryEventStore` persists for audit trail

**Evidence:** 5 artifact files including contract validation results, emitted
events, and correlation metadata.

### 4. Compliance-Sensitive Action

**Scenario:** A strict governance policy denies an unauthorized user and allows
an authorized compliance officer, with both outcomes recorded in an auditable
chain.

**Controls exercised:**
- `@nzila/governance` — policy denies `viewer` role, allows
  `compliance-officer` role
- `@nzila/enforcement` — governance layer short-circuits on deny (403)
- `@nzila/audit` — both deny and allow outcomes recorded
- `@nzila/audit` — `verifyChain()` validates hash integrity across both entries
- `@nzila/audit` — `exportAuditLog()` produces parseable JSON export

**Evidence:** 7 artifact files including both governance decisions, complete
audit chain, and JSON export.

## Artifact Schema

Every proof scenario produces a `summary.json` with this structure:

```json
{
  "scenario": "ue-governed-mutation",
  "status": "pass",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "trace_id": "abc123...",
  "actor_id": "user_admin_001",
  "tenant_id": "tenant_ue_main",
  "governance_decision_id": "allow-admin-mutate",
  "audit_event_id": "...",
  "audit_chain_valid": true,
  "ai_control_log_id": null,
  "event_contract": null
}
```

The `latest-proof-summary.json` at the root of `proof-artifacts/` aggregates
all scenario results:

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "totalScenarios": 4,
  "allPassed": true,
  "scenarios": [
    { "scenario": "ue-governed-mutation", "status": "pass", "files": 7 },
    { "scenario": "ai-controlled-request", "status": "pass", "files": 5 },
    { "scenario": "event-contract-flow", "status": "pass", "files": 5 },
    { "scenario": "compliance-sensitive-action", "status": "pass", "files": 7 }
  ]
}
```

## Verification

### Automated

```bash
pnpm proof:verify
```

Checks:
- All expected artifact files exist
- All files are valid JSON
- Summary files contain required fields (`scenario`, `status`, `timestamp`,
  `trace_id`)

### Manual

1. Run `pnpm proof:run` to generate fresh artifacts
2. Open any `proof-artifacts/<scenario>/summary.json`
3. Verify `"status": "pass"`
4. Cross-reference `trace_id` across all artifacts in the scenario
5. For audit scenarios, verify `audit-chain.json` shows `"valid": true`

## Packages Under Proof

| Package | Version | Role |
|---|---|---|
| `@nzila/enforcement` | workspace | Request pipeline, layer composition |
| `@nzila/governance` | workspace | Policy evaluation, decision logging |
| `@nzila/audit` | workspace | Hash-chained audit, chain verification, export |
| `@nzila/ai-control` | workspace | AI policy, budget, classification |
| `@nzila/events` | workspace | Event bus, emitter, persistence |
| `@nzila/contracts` | workspace | Zod-based event contract validation |
| `@nzila/observability` | workspace | Trace ID generation, span context |
