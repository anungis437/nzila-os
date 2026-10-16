# G3 synthetic proof V1

Authority: `G3_SYNTHETIC_PROOF_V1`. Lineage: `PROSPECTIVE_G3R2_IMAGE_QUALIFICATION`.
This is a new prospective source, not a repair or recovery of the rejected
[synthetic-health candidate](../../../synthetic-health/). Local qualification
does not authorize Azure execution or registry upload.

## Protocol

- `GET /healthz` returns only `{"status":"ok"}`.
- `POST /proof/secret` accepts `application/json` (optionally `charset=utf-8`),
  a maximum 256-byte body, and exactly one `nonce` property.
- Generate 32 random nonce bytes outside the application and encode canonical
  unpadded base64url (43 characters). The key is the UTF-8 value injected as
  `G3_PROOF_SECRET`; the message is the UTF-8 **encoded nonce string**, not
  decoded nonce bytes.
- Response: `{"protocol":"g3-secret-proof-v1","algorithm":"HMAC-SHA256","proof":"<64 lowercase hex characters>"}`.
  Compare decoded HMAC bytes with a constant-time comparison.
- Missing secret: HTTP 503 `{"status":"unavailable"}`. Invalid requests: HTTP
  400 `{"status":"invalid_request"}`. Wrong methods: 405; unknown routes: 404.
- Responses are non-cacheable. No secret, secret length, nonce, token, source
  URI, environment dump or private error details are logged/returned. Errors
  emit only fixed sanitized event names.

Use a cryptographically random, high-entropy synthetic secret: HMAC output is
not encryption and permits offline guesses against a weak secret. A challenge
proves possession of the injected value, **not** Azure Key Vault injection,
direct managed-identity access or network/RBAC controls. Those remain separate
future proofs. Do not expose this private proof endpoint publicly.

## Reproducible local build

The Dockerfile pins the verified Linux/amd64 Go 1.26.9 builder manifest.
The runtime is `scratch`, UID/GID `65532:65532`, with one static binary and no
shell/package manager. No prebuilt host binary is required. The compiler runs
tests and vet without network, then compiles twice (`-trimpath`,
`-buildvcs=false`, empty build ID, CGO disabled) and compares binary bytes.
The build context allowlist contains only the Dockerfile, ignore file, Go
module, source and tests. Standard library only: no `go.sum` required.

```powershell
docker build --platform linux/amd64 --network none --progress plain --load --tag nzila-g3r2i-local infrastructure\landing-zone\g3-source\workload\synthetic-proof
```

The local qualifier records compiler/base/context/config/binary digests and
uses fake random proof material only. It runs the container with a read-only
root filesystem, no capabilities, no-new-privileges and `--network none`.
A non-root, read-only local test client shares that isolated network namespace;
no host port is published. The app listens only on port 3000,
makes no outbound calls, needs no local writes and shuts down on SIGTERM.
ACA HTTP probes provide health checking; no shell-based Docker health command
is added to the scratch runtime.

Retain nonce, expected/observed proof, HTTP status, timestamp, future registry
digest, revision, secret logical ID and a safely obtained secret version.
Never retain raw secret material or injected container environment inspection.
Local image/config IDs are **not** future ACR registry manifest authority.
Future deployment must use an explicitly authorized immutable registry digest.
