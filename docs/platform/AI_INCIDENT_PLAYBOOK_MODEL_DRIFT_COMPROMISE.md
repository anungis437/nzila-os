# AI Incident Playbook: Model Drift or Compromise

## Trigger Conditions

- Sustained output quality degradation beyond SLO.
- Sudden policy non-compliance without code changes.
- Provider/model version changes correlated with incident metrics.

## Immediate Actions (0-30 min)

1. Pin model routing to last known-good deployment.
2. Activate conservative fallback policy profile.
3. Capture failing traces and output artifacts.
4. Open incident channel with AI + Platform + Security.

## Containment

1. Disable high-risk workflows that rely on compromised behavior.
2. Increase confidence thresholds and human review requirements.
3. Block auto-execution paths until integrity is restored.

## Eradication and Recovery

1. Validate with benchmark/eval suites across critical scenarios.
2. Compare outputs across candidate model versions.
3. Promote stable model only after gate pass and sign-off.
4. Add post-incident guardrails to detect recurrence earlier.

## Evidence Requirements

- model deployment IDs and timestamps
- benchmark/eval result snapshots
- fallback activation timeline
- approval records for restore decision
