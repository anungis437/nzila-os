# AI Platform Contract — Nzila OS

> Anti-entropy guardrail: all AI outputs in Nzila OS must follow a canonical
> contract. App-local AI that bypasses platform-ai-* packages is prohibited
> for business-critical logic.

## Canonical AI Output Contract

Every AI-generated output in Nzila OS — whether an insight, anomaly detection,
decision recommendation, or natural language answer — must include:

```typescript
interface AIOutputBase {
  /** 0.0 – 1.0 confidence in the output */
  confidence_score: number

  /** References to evidence / source data that informed the output */
  evidence_refs: string[]

  /** Versioned identifier for the model or engine that produced the output */
  engine_version: string

  /** Whether human review is required before the output can be acted upon */
  review_required: boolean

  /** Org scope for multi-tenant isolation */
  org_id: string

  /** ISO 8601 timestamp of output generation */
  generated_at: string
}
```

### Mandatory Behaviours

| Requirement | Description |
|-------------|-------------|
| Audit event emission | Every AI output must emit a platform event via `@nzila/platform-events` |
| Confidence semantics | 0.0 = no confidence, 1.0 = full confidence; thresholds defined per use case |
| Safe fallback | If the AI engine is unavailable or errors, the system must degrade gracefully — never block business operations |
| Evidence citation | Sensitive workflows must cite the data that informed the output |
| Review gate | Outputs with `review_required: true` must not auto-execute without human approval |

## Canonical Output Schemas

Defined in `packages/platform-ai-contract/src/schemas.ts`:

### InsightOutput

For cross-app intelligence, trend detection, and operational signals.

```typescript
interface InsightOutput extends AIOutputBase {
  type: 'insight'
  category: 'trend' | 'correlation' | 'anomaly_summary' | 'operational'
  title: string
  description: string
  affected_entities: string[]
  recommended_action?: string
}
```

### AnomalyOutput

For anomaly detection in grievances, financials, pricing, and patterns.

```typescript
interface AnomalyOutput extends AIOutputBase {
  type: 'anomaly'
  severity: 'low' | 'medium' | 'high' | 'critical'
  anomaly_type: string
  metric_name: string
  expected_value: number
  actual_value: number
  deviation_pct: number
}
```

### DecisionOutput

For policy-engine decisions, approval recommendations, and risk assessments.

```typescript
interface DecisionOutput extends AIOutputBase {
  type: 'decision'
  decision: 'approve' | 'reject' | 'escalate' | 'defer'
  rationale: string
  policy_refs: string[]
  risk_level: 'low' | 'medium' | 'high'
  alternatives?: string[]
}
```

### RecommendationOutput

For agent-driven recommendations and next-best-action suggestions.

```typescript
interface RecommendationOutput extends AIOutputBase {
  type: 'recommendation'
  action: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  expected_impact: string
  prerequisites: string[]
  auto_executable: boolean
}
```

## Package Architecture

```
@nzila/platform-ai-contract     ← Canonical schemas (this contract)
@nzila/ai-core                  ← Core AI primitives
@nzila/ai-sdk                   ← SDK for app consumption
@nzila/platform-intelligence    ← Cross-app insights + signals
@nzila/platform-ai-query        ← NL queries with evidence
@nzila/platform-anomaly-engine  ← Anomaly detection
@nzila/platform-agent-workflows ← Event-driven recommendations
@nzila/platform-ai-governance   ← Model registry + prompt governance
@nzila/platform-governed-ai     ← Governed AI wrapper
```

All `platform-ai-*` packages must import output schemas from `@nzila/platform-ai-contract`.

## Prohibited Patterns

| Pattern | Why | Enforcement |
|---------|-----|-------------|
| App-local `lib/ai-helper.ts` with business-critical AI logic | Fragments AI governance; bypasses platform contracts | `scripts/ai-contract-check.ts` |
| Inline model/prompt logic in app routes or services | Ungoverned AI outputs; no audit trail | `scripts/ai-contract-check.ts` |
| Direct AI provider calls (OpenAI, Anthropic, etc.) from apps | Bypasses model registry and governance | `scripts/ai-contract-check.ts` |
| Hidden autonomous actions | AI decisions executed without human-in-the-loop | Code review + contract tests |
| Inconsistent confidence semantics | Different apps interpreting 0.8 differently | Schema validation |
| Uncited AI outputs in sensitive workflows | No evidence trail for compliance | Contract tests |

## Allowed App-Local AI

Apps may contain local AI code only if it is:

1. **Thin adapters** — wrappers that call shared platform packages
2. **Presentation helpers** — formatting AI outputs for UI display
3. **Non-core UI helpers** — e.g., search suggestions, autocomplete (documented)

## Enforcement

- Check script: `pnpm ai:contract:check` (`scripts/ai-contract-check.ts`)
- Contract tests: `pnpm contract-tests`
- CI: Runs on every PR

## Adding New AI Capabilities

1. Define output schema in `@nzila/platform-ai-contract`
2. Implement engine in the appropriate `platform-ai-*` package
3. Register model in `@nzila/ai-registry`
4. Wire audit event emission via `@nzila/platform-events`
5. Document confidence thresholds and review gates
6. Add governance entry in `@nzila/platform-ai-governance`
