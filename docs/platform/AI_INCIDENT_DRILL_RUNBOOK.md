# AI Incident Drill Runbook

## Objective

Run quarterly incident simulations for AI-specific threats and verify operational readiness.

## Drill Scenarios

1. Prompt injection on a high-value route.
2. Data poisoning detected during ingestion.
3. Model drift causing policy compliance failures.

## Cadence

- Frequency: quarterly
- Participants: AI, Platform, Security, On-call representative
- Duration: 60-90 minutes

## Drill Checklist

1. Assign incident commander and scribe.
2. Execute scenario using synthetic payloads only.
3. Measure:
   - time to detection
   - time to containment
   - time to safe restore
4. Validate evidence capture completeness.
5. Record action items with owners and due dates.

## Success Criteria

- Detection in <= 15 minutes.
- Containment in <= 30 minutes.
- Complete evidence bundle generated.
- At least one preventative improvement merged per scenario.

## Outputs

- Drill report in `ops/outputs/ai-incident-drill-<date>.json`
- Updated playbooks where gaps were observed
