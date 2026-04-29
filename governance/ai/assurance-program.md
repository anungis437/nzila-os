# AI Assurance Program

**Doc ID:** AI-ASSR-2026-001
**Owner:** AI Governance Committee + Engineering
**Cadence:** continuous (telemetry); weekly (review); monthly (AIGC report)

The assurance program provides ongoing evidence that production AI surfaces
continue to meet the principles, policy, and gate requirements. It is the
"Manage" function of NIST AI RMF and the post-market monitoring requirement
of EU AI Act Art. 72.

## 1. Layered controls

| Layer | What it does | Cadence | Failure action |
|-------|-------------|:-------:|----------------|
| L1. Telemetry | Per-call signals (latency, cost, refusal, flagged) | Continuous | Alert on threshold |
| L2. Eval gates | Run regression + bias + adversarial suites | Per-PR + nightly | Block merge / page on-call |
| L3. Drift monitoring | Compare output distribution to baseline | Daily | Alert + investigation ticket |
| L4. Sampling review | Human review of N samples per surface | Weekly | Issue ticket if quality drops |
| L5. Incident response | AI-specific playbook | On signal | Containment within SLA |
| L6. Periodic re-assessment | Re-run PIA + risk classification | Annual or on change | Update inventory |
| L7. Independent review | External audit / red-team | Annual | Remediation plan to AIGC |

## 2. Eval suites

For each surface, the suite includes:

- **Regression set** — golden cases with expected behaviors
- **Hallucination detection** — facts whose ground truth is known
- **Refusal correctness** — out-of-policy prompts SHOULD be refused
- **Bias panel** — identical prompts across protected-attribute proxies
- **Prompt injection** — direct + indirect (retrieved-context) attacks
- **Latency / cost budget** — per-call ceiling

Suites live alongside the surface code (e.g., `apps/console/ai/rag/evals/`)
and are wired into the package's `vitest` (or pytest, for Python sidecars).

## 3. Drift signals

Monitor weekly:

- Refusal rate change > 20% week-over-week
- Output length distribution shift
- User-reported issue rate (thumbs-down) change > 50%
- Cost per session change > 30%
- New error class appearing in logs

Any signal opens an investigation ticket; AIGC reviews unresolved drift
monthly.

## 4. AI incident playbook (addendum to security incident management plan)

### 4.1 Trigger types

- Mass hallucination event (e.g., model returning fabricated facts at scale)
- Confirmed prompt injection succeeding in production
- Sensitive-data leakage in output
- Bias incident reported by user / detected by eval
- Vendor outage or model deprecation
- Rights complaint about an automated decision

### 4.2 Severity (extends standard scheme)

| Sev | AI-specific criteria |
|:---:|---------------------|
| SEV1 | Restricted-data leakage in output; or harm to a person from an AI decision |
| SEV2 | Confirmed prompt-injection exploitation; or systematic bias affecting outcomes |
| SEV3 | Drift breaching SLO without immediate harm; or single-user adverse experience |
| SEV4 | Cost overrun; quality degradation without user impact |

### 4.3 Containment actions

- **Kill switch** disable the surface (G15)
- **Strict mode** force conservative prompting / lower temperature
- **Downgrade** route to a cheaper / safer model
- **Re-prompt** clear cached embeddings / templates
- **Vendor escalation** if root cause is provider-side

### 4.4 Post-incident

- Update eval suite with regression case for the failure
- Update prompt or guardrails
- AIGC reviews; PIA + risk classification re-checked; inventory updated

## 5. Reporting

Monthly AI assurance report to AIGC includes per-surface:

- Volume (calls, unique users)
- Quality (eval scores trend)
- Drift signals
- Incidents and resolutions
- Cost vs budget
- Open exceptions

Annual AI Governance Report consolidates trends, regulatory updates, and
roadmap (template TODO in `governance/ai/reports/`).

## 6. External assurance

Tier-1 surfaces undergo independent annual review. Acceptable forms:

- ISO/IEC 42001 audit (when feasible)
- Specialist AI red-team engagement
- Sector-relevant certification (e.g., model risk attestation for FRFI partnerships)

## 7. Observability fields (required)

`request_id`, `org_id`, `surface`, `tier`, `model`, `model_version`,
`prompt_template_hash`, `retrieval_ids[]`, `input_tokens`, `output_tokens`,
`latency_ms`, `cost_usd`, `refusal`, `flagged_categories[]`,
`user_feedback`, `downstream_action_id?`.

These feed both telemetry (L1) and the reasoning context envelope (G5).
