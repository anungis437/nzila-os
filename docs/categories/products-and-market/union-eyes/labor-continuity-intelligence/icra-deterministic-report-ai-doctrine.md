# ICRA Deterministic Report AI Doctrine

Status: active
Version: 1.0.0
Scope: Union Eyes ICRA adaptive reporting layer

## Purpose

This doctrine defines the report AI layer as deterministic, replayable, and
human-governed. It exists to transform already-scored institutional continuity
signals into structured executive and facilitator packets without free-form
generation.

## Mandatory Constraints

1. No generative text synthesis from open prompts.
2. No free-text interpolation from respondent input.
3. No PII enrichment or profile inference.
4. All output packets must be reproducible from versioned inputs.
5. Human review is required before external distribution.

## Contract Surface

The deterministic layer is implemented through fixed contracts:

- Deterministic report context
- Narrative synthesis packet
- Executive summary packet
- Facilitator packet
- Translation packet
- Disclosure packet
- Review workflow state and audit entries
- Adaptive report AI integration slot

These contracts are defined in:

- apps/union-eyes/lib/icra/adaptation/deterministicReportContracts.ts

## Guardrail Model

Guardrails are fail-closed:

1. Locale whitelist: en-CA and fr-CA only.
2. Text safety checks reject email-like and URL-like tokens in review and
   disclosure copy.
3. Stable deterministic identifiers are derived from fixed context parts.

Guardrails are implemented in:

- apps/union-eyes/lib/icra/adaptation/deterministicReportGuardrails.ts

## Narrative and Context Construction

The report AI layer does not replace scoring.
It composes existing deterministic engines:

1. Adaptive scoring output from contextual normalizer and weighting model.
2. Adaptive narrative bundle from passage library.
3. Facilitator guide from routing and adaptation rationale.
4. Executive summary from deterministic report narrative engine.

Composition is implemented in:

- apps/union-eyes/lib/icra/adaptation/deterministicReportEngine.ts

## Review and Audit Discipline

Review workflow is mandatory and auditable:

1. Workflow starts in pending_review.
2. Checklist enforces doctrine, safety, and rationale verification.
3. Approval and rejection decisions append immutable audit entries.
4. Final slot assembly is blocked if validator detects contract drift.

## Release Governance

Before merging report AI changes, the following must pass:

1. Deterministic report governance tests
2. Existing adaptive and routed submission tests
3. Financial-service health gate (repository governance requirement)
4. Repository audit and lint/typecheck gates

## Change Rules

Any change to deterministic contracts, disclosure semantics, or review workflow
must:

1. Update doctrine version if externally visible behavior changes.
2. Include at least one test that fails before and passes after the change.
3. Preserve deterministic replay for unchanged inputs.
