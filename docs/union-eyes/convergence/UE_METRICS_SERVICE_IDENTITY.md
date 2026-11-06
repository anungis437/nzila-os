# Union Eyes operational metrics — scoped service credential

Status: **SOURCE IMPLEMENTATION / PRODUCTION PROVISIONING AND RUNTIME PROOF PENDING**.
Decision reference: #1116, #1118. Scoped service capability: `metrics:platform_operational:read`.

## Contract
- Union Eyes `GET /api/metrics/operational` accepts only `UE_METRICS_SERVICE_KEY` in `x-service-key`. Minimum 32 bytes; the same key must be provisioned to Control Plane via a secret reference.
- The metrics key must be distinct from `AI_SERVICE_KEY` and `QUEUE_STATUS_SERVICE_KEY`. No platform-admin title, session, union parent/child role, or AI secret bypass.
- Control Plane `/api/control-plane/modules/union-eyes/telemetry` remains separately gated by its `CONTROL_PLANE_API_KEY` and sends no key to the public `/api/health` surface, the metrics key only to operational metrics, and the queue key only to `/api/union-eyes/queue-status`.
- If either service key is not provisioned or is reused, the corresponding privileged call is omitted and reported as unavailable (`null`); no downgrade to generic or public access is allowed.
- Operational metrics reads job queue depth only. Request/error rates and tenant-derived SLA, claim transitions and message text are all **unmeasured (`null`)**. Tenant-specific analytics require a separate direct-grant-backed endpoint.

## Provisioning and rotation (release runbook)
1. Generate two separate independent high-entropy random service secrets (minimum 32 bytes; prefer 32 random bytes hex/base64-encoded) in an approved vault/Key Vault. No literal values in GitHub, CI output or PR comments.
2. Bind `UE_METRICS_SERVICE_KEY` by secret reference to both Union Eyes and Control Plane; bind `QUEUE_STATUS_SERVICE_KEY` by a **different** secret reference to both. Neither may alias `AI_SERVICE_KEY` or `CONTROL_PLANE_API_KEY`.
3. Test with a disposable authenticated Control Plane request and a locally scoped service probe. Negative cases: no secret, AI key, queue key, malformed key, regular union user and platform-only session. Verify 401/503 and **zero tenant reads**.
4. Rotate under a staged deployment/roll-forward plan. This code intentionally does **not** accept old and new secrets simultaneously; the bounded temporary 401/null interval is preferable to untracked dual-authority credentials. Confirm new secret availability on both services, update the caller then the receiver in a controlled window, revoke the old secret, and record the change and access audit receipt. For zero-downtime rotation, implement an explicitly expiring dual-key protocol and tests before attempting it.
5. Record runtime evidence, proof timestamps, exact image revisions, authorized controller identities, and rollback. Until that record is accepted, treat production metrics as not configured rather than silently authorizing platform titles.

## Threat model limits
A bearer secret is a route-specific machine credential, not a signed principal attestation. It identifies the approved Control Plane integration by possession; it is not usable to read tenant records. Deploy over TLS only, rate-limit service endpoints at the ingress/service mesh, restrict network access where supported, and audit authorized requests without logging the credential.
Queue-status and governance-telemetry routes retain separate policy review obligations under #1118; this migration does not certify those routes or the full Gate 0.
