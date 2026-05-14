# Union Eyes Deployment Model For A CUPE Pilot

## Recommended Deployment Shape

Single tenant, single pilot local, invitation-only, steward-assisted launch.

## Why This Shape

1. Tenant and org controls are not yet consistent enough for a broad multi-local deployment.
2. The hardened case APIs can support a controlled pilot if legacy member-facing paths are disabled.
3. The platform should prove one trustworthy operating pattern before it tries to prove configurability.

## Infrastructure Assessment

1. `infra/main.bicep` provides a reasonable baseline stack: App Service, PostgreSQL Flexible Server, Redis, Key Vault, and Application Insights.
2. The current template is not production-complete. PostgreSQL `administratorPassword` is empty in the resource definition, while the output connection string interpolates it as if it were available.
3. This means deployment hardening and secret injection still need explicit work before the template can be treated as a clean pilot blueprint.

## Pilot Topology

1. One production environment for the pilot local.
2. One staging environment for scripted go-live rehearsal.
3. One curated org with manually validated memberships.
4. One pilot operations group with steward-plus roles.

## Required Guardrails

1. Do not expose the legacy member intake path in the live pilot.
2. Use Key Vault-backed secret management for all production credentials.
3. Treat Redis as optional support infrastructure, not as evidence of readiness by itself.
4. Run a pre-launch script that validates auth, DB connectivity, audit logging, and evidence export.

## Launch Position

The right CUPE deployment model is narrow, controlled, and operationally supervised. The current codebase does not justify a broad or self-serve initial rollout.
