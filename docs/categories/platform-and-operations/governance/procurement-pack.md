# Procurement Pack

> One-click evidence bundling for enterprise procurement teams.

## Overview

The Procurement Pack is a signed, verifiable ZIP bundle that aggregates
platform proof artifacts across five domains: **Security**, **Data Lifecycle**,
**Operational**, **Governance**, and **Sovereignty**.

## Export Formats

| Format | Content-Type | Signing |
|--------|-------------|---------|
| **ZIP** (default) | `application/zip` | Ed25519 + SHA-256 |
| **JSON** (legacy) | `application/json` | SHA-256 checksums |

## ZIP Bundle Contents

```
Nzila-Procurement-Pack-YYYY-MM-DD.zip
├── MANIFEST.json          # File listing with SHA-256 hashes
├── procurement-pack.json  # Full pack payload
├── signatures.json        # Ed25519 signature + key ID
├── verification.json      # How to verify + expected hashes
└── sections/
    ├── security.json
    ├── dataLifecycle.json
    ├── operational.json
    ├── governance.json
    └── sovereignty.json
```

## Verification

### Quick Verification (5 steps)

1. Extract the zip
2. Compute SHA-256 of `MANIFEST.json`
3. Verify the Ed25519 signature in `signatures.json` against that digest
4. For each file in `MANIFEST.json.files`, verify its SHA-256 hash matches
5. Confirm `keyId` matches the expected signing key

### Retrieve the Public Key

```bash
curl https://your-instance.example.com/api/proof-center/public-key
```

Response:

```json
{
  "keyId": "<hex>",
  "algorithm": "Ed25519",
  "publicKey": "<base64-encoded Ed25519 public key>",
  "encoding": "base64"
}
```

### CLI Verification (step-by-step)

```bash
# 1. Extract the pack
unzip Nzila-Procurement-Pack-*.zip -d pack/

# 2. Verify per-file SHA-256 hashes in MANIFEST
node -e "
  const fs = require('fs');
  const crypto = require('crypto');
  const manifest = JSON.parse(fs.readFileSync('pack/MANIFEST.json','utf8'));
  for (const f of manifest.files) {
    const hash = crypto.createHash('sha256')
      .update(fs.readFileSync('pack/' + f.path))
      .digest('hex');
    const ok = hash === f.sha256;
    console.log(ok ? '✓' : '✗', f.path, ok ? '' : '(MISMATCH)');
  }
"

# 3. Verify Ed25519 signature
#    Save the base64 public key from /api/proof-center/public-key to public.pem
node -e "
  const crypto = require('crypto');
  const fs = require('fs');
  const manifest = fs.readFileSync('pack/MANIFEST.json');
  const sig = JSON.parse(fs.readFileSync('pack/signatures.json','utf8'));
  const pubKey = crypto.createPublicKey({
    key: Buffer.from('<paste-base64-public-key>', 'base64'),
    format: 'der',
    type: 'spki'
  });
  const valid = crypto.verify(
    null, manifest, pubKey,
    Buffer.from(sig.signature, 'base64')
  );
  console.log(valid ? '✓ Signature valid' : '✗ Signature INVALID');
"

# 4. Verify hash chain (compliance snapshots)
#    Walk pack/sections/governance.json → snapshotChain entries
#    Each entry's hash = SHA-256(canonical JSON of payload)
```

### Pseudo-code (any language)

```python
import hashlib, json, base64
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

# Load pack
manifest = json.load(open("pack/MANIFEST.json"))
signatures = json.load(open("pack/signatures.json"))

# Step 1: Verify file hashes
for f in manifest["files"]:
    actual = hashlib.sha256(open(f"pack/{f['path']}", "rb").read()).hexdigest()
    assert actual == f["sha256"], f"Hash mismatch: {f['path']}"

# Step 2: Verify Ed25519 signature
manifest_bytes = open("pack/MANIFEST.json", "rb").read()
pub_key = Ed25519PublicKey.from_public_bytes(base64.b64decode(public_key_b64))
pub_key.verify(base64.b64decode(signatures["signature"]), manifest_bytes)

print("All verifications passed.")
```

## API

### Export Pack

```
POST /api/proof-center/export
  Body: { "format": "zip" | "json", "includeRfp": boolean }
  → application/zip (default) or application/json
```

### Latest Pack Metadata

```
GET /api/proof-center/latest-pack
  → 200 OK
```

Response:

```json
{
  "packId": "pack-abc123",
  "orgId": "my-org",
  "generatedAt": "2026-03-04T12:00:00Z",
  "status": "signed",
  "sectionCount": 5,
  "sections": ["security", "dataLifecycle", "operational", "governance", "sovereignty"],
  "manifestHash": "sha256:...",
  "verificationStatus": "VALID",
  "downloadUrl": "/api/proof-center/export",
  "respondedAt": "2026-03-04T12:00:01Z"
}
```

### Refresh Pack

```
POST /api/proof-center/refresh
  → 200 OK  (re-collects and re-signs)
```

## Validation Script

Run automated validation against a fresh procurement pack:

```bash
pnpm validate:pack
```

This checks:

1. **Schema validation** — every section conforms to `ProcurementSectionSchema`
2. **Timestamp consistency** — all timestamps are ISO 8601 UTC (no milliseconds)
3. **Manifest integrity** — recalculates SHA-256 hashes and compares
4. **Signature verification** — verifies Ed25519 signature on manifest

## Demo

Run the golden-path demo to see end-to-end pack generation:

```bash
pnpm demo:golden
```

## Response Headers (ZIP)

| Header | Purpose |
|--------|---------|
| `Content-Type` | `application/zip` |
| `Content-Disposition` | `attachment; filename="Nzila-Procurement-Pack-YYYY-MM-DD.zip"` |
| `X-Pack-Id` | Unique pack identifier |
| `X-Signature-Key-Id` | Ed25519 key ID (first 16 hex chars of SHA-256 of public key) |
| `X-Signature-Algorithm` | `Ed25519` |

## Packages

- **`@nzila/platform-procurement-proof`** — Collector, exporter, zip-exporter
- **`@nzila/os-core/evidence/seal`** — HMAC sealing primitives

## Security Properties

- **Integrity** — SHA-256 per-file hashes in MANIFEST.json
- **Authenticity** — Ed25519 digital signature over manifest digest
- **Non-repudiation** — Signature tied to key ID; audit event emitted on export
- **Tamper evidence** — Any modification invalidates both file hashes and signature
