# AI Incident Playbook: Model Inversion Attack

## Trigger Conditions

- Unusual volume of high-confidence inference requests probing boundary conditions.
- Requests reconstructing training-data-shaped outputs (PII, proprietary records).
- Output similarity analysis flags reproduced training samples above threshold.
- Rate anomalies from single identities or coordinated IP clusters against inference endpoints.

## Immediate Actions (0-30 min)

1. Enable request capture / full payload logging for the affected model endpoint.
2. Throttle or temporarily suspend the endpoint if exfiltration is ongoing.
3. Preserve request logs, source IPs, session tokens, and API key identities.
4. Notify Security and AI Platform owners; escalate to Legal if PII exposure is suspected.

## Containment

1. Rotate API keys for the affected endpoint; revoke compromised credentials.
2. Apply stricter rate limits and confidence-score truncation (output softening) for inference responses.
3. Block offending IPs/accounts at the API gateway layer.
4. Enable differential privacy post-processing on model outputs where available.

## Eradication and Recovery

1. Audit inference logs for the full exposure window; document impacted records or patterns.
2. Assess whether the model needs retraining with privacy-preserving techniques (e.g., DP-SGD).
3. Implement output sanitisation: strip high-confidence verbatim reconstructions before returning responses.
4. Re-enable endpoint with hardened configuration; resume normal monitoring cadence.
5. Conduct tabletop review of data minimisation posture for all models in production.

## Evidence Requirements

- raw inference request/response logs for the attack window
- API key and session identity records
- output similarity scores vs. training corpus samples
- rate anomaly chart / alerting timeline
- remediation PRs, deployment timestamps, and rollback references
