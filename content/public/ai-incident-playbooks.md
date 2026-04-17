---
title: AI Incident Playbooks
description: Public index of AI incident response playbooks for adversarial input, data poisoning, model drift, and related threats.
category: Security
order: 8
date: 2026-04-16
---

## Purpose

These playbooks define response patterns for high-risk AI incidents and emerging threat scenarios.

Each playbook standardizes three questions:

1. What failed?
2. How far did it spread?
3. What proof confirms recovery?

## Playbook Index

- Prompt Injection
- Adversarial Inputs
- Data Poisoning
- Dependency Confusion
- Hallucination Risk
- Model Drift Compromise
- Model Inversion
- Post-Quantum Migration

## Operational Model

- Detect with governance and alerting controls.
- Triage by severity and blast radius.
- Contain affected capabilities quickly.
- Recover with evidence-backed validation before restoring normal operations.

## Severity Model

| Severity | Typical signals | Required response window |
|---|---|---|
| High | Data exfiltration risk, privilege bypass, policy-unsafe generation in production | Immediate containment + escalation |
| Medium | Elevated drift, repeated guardrail bypass attempts, suspicious tool-call patterns | Same business day |
| Low | Isolated false positives, non-exploitable prompt anomalies | Next planned operations cycle |

## Incident Flow

1. Create an incident record with timestamp, affected capability, and owning team.
2. Snapshot model/configuration state and preserve logs before mitigation changes.
3. Apply containment controls (feature flags, endpoint restrictions, policy hardening).
4. Run recovery validation tests and publish evidence.
5. Close with corrective actions and updated detection rules.

## Related Runbooks

- AI Incident Drill Runbook
- Alerting Runbook
- Emerging Threat Model

## Source of Truth

Canonical versions are maintained in `docs/platform/AI_INCIDENT_PLAYBOOK_*.md` and companion runbooks under `docs/platform/`.
