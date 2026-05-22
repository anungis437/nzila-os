# ICRA Trust Center Alignment Notes

Status: active
Applies to: deterministic adaptive report AI slot

## Trust Assertions

The ICRA report AI layer supports trust center commitments through the
following enforceable properties:

1. Deterministic generation only
2. Explainable profile-driven adaptation
3. Human review before release
4. Review and decision auditability
5. Bilingual disclosure and governance-safe copy

## Alignment Matrix

### Transparency

- Disclosure packet explicitly marks AI-generated deterministic template output.
- Confidence class is traceable, not probabilistic.
- Doctrine version is attached to packets.

### Safety

- Guardrails block unsafe reviewer summary text patterns.
- Output assembly is contract-validated and fails closed on drift.
- Only approved locales are accepted.

### Accountability

- Every review decision appends audit entries.
- Audit entries carry actor role, action, and timestamp.
- Approval and rejection paths are explicitly recorded.

### Privacy and Data Minimization

- No free-text user interpolation in generated packets.
- No PII extraction or enrichment in deterministic report layer.
- Inputs are low-cardinality institutional profile attributes.

### Governance

- Adaptive report slot requires pending checklist completion in workflow.
- Validator enforces complete packet and review metadata presence.
- Doctrine and tests must evolve together.

## Residual Risk Notes

1. Executive narrative templates are currently English-forward in source engine.
2. Translation packet currently localizes labels and disclosure framing only.
3. Human reviewers remain responsible for publication suitability.

## Next Hardening Steps

1. Add bilingual deterministic executive narrative template parity.
2. Add immutable persistence adapter for review audit events.
3. Add trust center dashboard feed for review workflow outcomes.
