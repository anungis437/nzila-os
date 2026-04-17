# AI/Supply-Chain Incident Playbook: Dependency Confusion

## Trigger Conditions

- Detection of suspicious package resolution from public namespace.
- Integrity/provenance verification failure in CI.
- Security advisory indicating malicious or hijacked dependency in use.

## Immediate Actions (0-30 min)

1. Halt deployments for impacted services.
2. Pin and isolate dependency graph snapshot (lockfile and SBOM).
3. Block package source and revoke build credentials if exposure is suspected.
4. Notify security incident channel and assign commander.

## Containment

1. Force install from approved private scope/registry mirrors only.
2. Remove compromised versions and rebuild with verified provenance.
3. Rotate tokens/secrets potentially exposed during build/runtime.

## Eradication and Recovery

1. Patch dependency constraints and add deny rules for malicious coordinates.
2. Regenerate SBOM and verify no tainted transitive dependencies remain.
3. Add regression checks to prevent recurrence.
4. Resume deployment after security sign-off.

## Evidence Requirements

- affected package coordinates and versions
- lockfile and SBOM diffs
- provenance and signature validation records
- secret rotation proof
- remediation PR/commit references
