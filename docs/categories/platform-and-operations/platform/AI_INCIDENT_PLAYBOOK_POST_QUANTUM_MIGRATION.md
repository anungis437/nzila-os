# AI/Security Incident Playbook: Post-Quantum Crypto Migration Risk

## Trigger Conditions

- Discovery of high-risk dependency on non-agile cryptography for long-retention sensitive data.
- External advisory indicating accelerated cryptanalytic risk horizon.
- Internal audit identifies missing crypto inventory or migration controls.

## Immediate Actions (0-30 min)

1. Classify affected data classes and retention windows.
2. Freeze new deployments introducing non-agile crypto patterns.
3. Preserve crypto inventory snapshot and key management metadata.
4. Escalate to security and platform governance owners.

## Containment

1. Enforce algorithm agility toggles for impacted services.
2. Prioritize hybrid or migration-ready key exchange paths.
3. Increase audit logging on cryptographic operations.

## Eradication and Recovery

1. Execute migration plan for high-retention data first.
2. Re-encrypt or rotate impacted material where required.
3. Validate interoperability and performance under migrated mode.
4. Reopen controlled rollout once migration checks pass.

## Evidence Requirements

- crypto inventory diff before/after
- impacted systems and data classes
- migration window and rollback plan
- verification evidence for re-encryption/rotation
- post-incident residual risk assessment
