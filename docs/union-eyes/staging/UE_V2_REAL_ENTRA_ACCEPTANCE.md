# Real V2 staging Entra acceptance

The manual `ue-v2-staging-real-session.yml` workflow runs only from this
repository's main branch, behind the protected `ue-staging` environment. It
requires the exact candidate in CHG-2026-0114, verifies main ancestry, and checks
that the fixed V2 staging endpoint reports that source before authenticating.
It requests read-only repository access and no Azure workload token.

The two existing, verified synthetic staging principals authenticate through
Microsoft's real authorization-code flow and the application's AuthJS callback.
Their existing passwords are protected environment secrets. The workflow never
receives the application signing secret or manufactures a session. Cookies stay
in the disposable runner's memory. Interactive verification fails the run;
there is no authentication bypass.

The baseline records real session identity and expiry, secure cookie attributes,
API-created own cases, opposite-tenant denial, localized executive navigation,
mobile pages, canonical document intake/replay and opposite-tenant download
denial. It creates synthetic data only. An executive navigation page does not
establish an institutional mandate or prove every capability on that page.

Only redacted metadata is uploaded. A signed document lease is encrypted using
RSA-OAEP-SHA256 and AES-256-GCM to the staging operator's public evidence key;
the private key is not placed in the repository, runner or artifact. This lets
the operator measure the same issued lease through the existing private blob
endpoint, verify the actual bytes, and later prove denial after its real expiry.
The artifact contains neither plaintext signed URLs nor session cookies. Public
network denial alone does not prove private download success.

This baseline does not establish worker recovery, provider delivery, private
PostgreSQL isolation, audit/telemetry, offboarding, financial/legal boundaries,
backup/restore or STAGING_GO. Those require separate candidate-bound deployed
receipts. The workflow's main SHA identifies its own definition; it does not
replace the source or deployment workflow identities in those receipts.
