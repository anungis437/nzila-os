# AI Incident Playbook: Prompt Injection

## Trigger Conditions

- Unexpected model output that violates policy constraints.
- Evidence of instructions embedded in user content attempting policy override.
- Sudden spike in blocked/unsafe AI responses.

## Immediate Actions (0-30 min)

1. Declare SEV level based on impact and exposure.
2. Freeze risky AI routes behind feature flag or strict fallback mode.
3. Capture request/response evidence with redaction intact.
4. Preserve affected traces and prompt templates for forensics.

## Containment

1. Force strict input sanitation and instruction boundary mode.
2. Temporarily disable tools/actions with write side-effects.
3. Increase moderation and anomaly alert thresholds.

## Eradication and Recovery

1. Patch prompt template defenses and parser hardening.
2. Add regression tests for the exact attack pattern.
3. Re-enable features in phased rollout after test pass.

## Evidence Requirements

- incident timeline
- offending payload hash
- model/version metadata
- policy decision logs
- rollback/patch commit references
