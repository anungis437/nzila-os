# UE AI Incident Playbook Addendum

Owner: UE Lead
Last updated: 2026-06-08
Scope: union-eyes-triage

## Detection Signals

1. Error rate > 2% for 5 minutes on UE AI routes.
2. P95 latency > 2500ms for 10 minutes.
3. Refusal rate spike > 15% above 7-day baseline.
4. Budget burn-rate > 2x expected daily budget.
5. Adversarial prompt or data exfiltration signal from security telemetry.

## Immediate Containment

1. Set UE_AI_TRIAGE_ENABLED=false.
2. Route to manual triage fallback workflow.
3. Rotate compromised credentials if security signal is present.
4. Freeze prompt/model rollout changes.

## Recovery

1. Restore with last-known-good prompt/model profile.
2. Replay failed requests in non-user-facing queue.
3. Re-enable UE_AI_TRIAGE_ENABLED only after error and latency SLO recovery for 30 minutes.

## Escalation

1. Notify AIGC and Security Lead within 15 minutes for severity >= high.
2. Open incident ticket with timeline and mitigation steps.
3. Publish post-incident review in governance reports.
