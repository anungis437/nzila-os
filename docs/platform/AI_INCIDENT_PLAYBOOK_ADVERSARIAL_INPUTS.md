# AI Incident Playbook: Adversarial Inputs

## Trigger Conditions

- Model producing anomalous or nonsensical outputs for structurally valid inputs.
- Systematic misclassification or bypass of content-safety / moderation filters.
- Reports of crafted inputs eliciting privileged, restricted, or harmful outputs.
- Evaluation regression on adversarial robustness benchmarks after model or config change.

## Immediate Actions (0-30 min)

1. Collect samples of the adversarial inputs and corresponding model outputs; hash and timestamp each.
2. Determine whether the attack is targeting a specific endpoint, model version, or prompt template.
3. Freeze the affected model configuration / prompt template to prevent further exploitation.
4. Notify Security, AI Platform, and (if content-safety bypass) Trust & Safety owners.

## Containment

1. Deploy an input validation / normalisation layer for the affected endpoint if not already present.
2. Add adversarial samples to the moderation deny-list or trigger word filter.
3. Temporarily roll back to the previous model version or prompt template if the regression is tied to a recent change.
4. Rate-limit or challenge users submitting structurally unusual inputs.

## Eradication and Recovery

1. Perform adversarial robustness evaluation across all production-facing model endpoints using the confirmed attack pattern.
2. Retrain or fine-tune the model with augmented adversarial training data where feasible.
3. Harden prompt templates: add explicit refusal instructions and output schema enforcement.
4. Re-enable the endpoint with enhanced input filtering; raise monitoring sensitivity for 72 h.
5. Document the attack pattern, model behaviour, and mitigations in the adversarial examples registry.

## Evidence Requirements

- adversarial input samples (hashed, timestamped) and verbatim model outputs
- model version, prompt template hash, and deployment ID at time of incident
- content-safety filter logs and bypass evidence
- robustness evaluation results before and after remediation
- remediation PRs, config diffs, and deployment references
