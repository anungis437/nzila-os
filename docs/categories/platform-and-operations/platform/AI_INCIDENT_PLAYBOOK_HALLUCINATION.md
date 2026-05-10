# AI Incident Playbook: Production Hallucination

## Trigger Conditions

- AI response contains materially false claims in regulated or operational contexts.
- User escalation reporting harmful or misleading guidance from model output.
- Automated quality scoring flags confidence-to-grounding mismatch above threshold.

## Immediate Actions (0-30 min)

1. Declare incident severity based on user impact and legal exposure.
2. Disable high-risk AI actions; enforce read-only or deterministic fallback mode.
3. Capture full prompt, retrieval context IDs, model output, and policy decision traces.
4. Activate human review gate for affected route class.

## Containment

1. Increase grounding strictness (citation required, lower confidence ceiling).
2. Block unsupported claim classes using policy lints.
3. Add route-specific response sanitizer to remove ungrounded assertions.

## Eradication and Recovery

1. Patch retrieval filters and response policy templates.
2. Add regression tests for exact hallucination pattern and variants.
3. Restore capability in phased rollout with elevated monitoring.

## Evidence Requirements

- incident timeline
- affected response IDs and hashes
- retrieval evidence set references
- model/deployment metadata
- rollback and fix commit references
- user notification record (if required)
