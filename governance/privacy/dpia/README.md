# Data Protection Impact Assessment (DPIA) — Process

**Doc ID:** DPIA-PROC-2026-001
**Version:** 1.0
**Owner:** Privacy Lead

This is the GENERAL DPIA process for any new or changed processing of
personal data. For AI-specific assessments, use [`../ai-pia/`](../ai-pia/)
which extends this with model-specific risk dimensions.

## 1. When a DPIA is required (GDPR Art. 35 triggers)

A DPIA is MANDATORY when processing is likely to result in a high risk to
data subjects. In Nzila OS this includes:

- Any new app or surface that processes Confidential or Restricted data
- Systematic and extensive profiling with significant effects (e.g., automated case prioritization)
- Large-scale processing of special-category data (health, biometrics — e.g., voice)
- Public-area monitoring (none currently)
- Use of new technology touching personal data (e.g., new AI provider, new region)
- Cross-border transfer of Confidential+ data to a new jurisdiction
- Any change that materially expands the categories or volume of personal data

When unsure, default to running one — they are cheap, gaps are not.

## 2. Process

| Step | Owner | Output |
|------|-------|--------|
| 1. Trigger identified | Surface Owner | Issue created with `privacy-dpia` label |
| 2. Scoping | Surface Owner + Privacy Lead | Decide DPIA vs PIA (AI) vs lightweight memo |
| 3. Draft using [template](template.md) | Surface Owner | DPIA doc in `governance/privacy/dpia/instances/<slug>.md` |
| 4. Risk analysis | Surface Owner + Security Lead | Risk register in §5 |
| 5. Mitigation design | Surface Owner | Updates to risk register |
| 6. Consultation | Privacy Lead | Optionally consult supervisory authority for residual high risk |
| 7. Approval | Privacy Lead + Security Lead + Surface Owner | Signed §8 |
| 8. Publish to inventory | Privacy Lead | Linked from `governance/privacy/README.md` |
| 9. Re-review | Privacy Lead | Annual or on material change |

## 3. Acceptance criteria

- All 12 Info-Tech privacy domains addressed
- No HIGH residual risk at sign-off
- DSR support documented (§7 of template)
- Lawful basis documented and aligns with notice
- Cross-border flows documented with safeguards

## 4. Records of Processing Activities (RoPA)

The set of approved DPIAs forms the Nzila RoPA per GDPR Art. 30. Privacy Lead
maintains the master index in [`../README.md`](../README.md).

## 5. Reference

- [DPIA template](template.md)
- AI-specific PIA: [`../ai-pia/template.md`](../ai-pia/template.md)
- Info-Tech DPIA Process Template (in `infotech/`, gitignored)
