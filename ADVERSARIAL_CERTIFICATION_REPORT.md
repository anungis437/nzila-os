# Adversarial Certification Report

Canonical summary entrypoint for adversarial and red-team certification state.

## Status

Certification state is governed by CI security and red-team profiles.
Use generated security evidence artifacts for point-in-time certification details.

## Required evidence inputs

- Red-team profile run outputs
- Security gate results
- Vulnerability remediation status
- Exceptions and waivers with expiration
- Evidence pack hash references

## Certification decision model

A certification decision must include:

- Date
- Scope
- Decision (pass, conditional, fail)
- Blocking findings
- Required remediation actions
- Signed approver roles

## References

- SECURITY.md
- docs/ga/GA_CERTIFICATION_REPORT.md
- security/
