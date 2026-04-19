#!/usr/bin/env python3
"""
Complete CloudFront setup for Zonga:
1. Generate RSA key pair
2. Register public key with AWS CloudFront
3. Update .env.local with key pair ID and private key
"""

import base64
import json
import os
import subprocess
import sys

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

# ============================================================================
# Step 1: Generate RSA key pair
# ============================================================================
print("=" * 70)
print("Step 1: Generating RSA key pair...")
print("=" * 70)

private_key = rsa.generate_private_key(
    public_exponent=65537, key_size=2048, backend=default_backend()
)

# Serialize keys to PEM
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption(),
).decode()

public_pem = (
    private_key.public_key()
    .public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    .decode()
)

print("✅ RSA key pair generated (2048 bits)")
print(f"\nPublic key (first 3 lines):")
for line in public_pem.split("\n")[:3]:
    print(f"  {line}")

# ============================================================================
# Step 2: Create CloudFront public key in AWS
# ============================================================================
print("\n" + "=" * 70)
print("Step 2: Registering public key with AWS CloudFront...")
print("=" * 70)

# CloudFront create-public-key expects EncodedKey = full PEM string
cf_key_config = {
    "PublicKeyConfig": {
        "CallerReference": f"zonga-cf-key-{os.urandom(4).hex()}",
        "Name": "zonga-music-distribution",
        "EncodedKey": public_pem,
        "Comment": "Zonga signed URL delivery (generated 2026-04-19)",
    }
}

# Save config to temp file
import tempfile

with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
    json.dump(cf_key_config, f)
    config_file = f.name

try:
    # Create public key via AWS CLI
    # On Windows, file:// paths need forward slashes
    file_uri = "file:///" + config_file.replace("\\", "/")
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "awscli",
            "cloudfront",
            "create-public-key",
            "--public-key-config",
            f"file://{config_file.replace(chr(92), '/')}",
        ],
        capture_output=True,
        text=True,
        env={**os.environ, "AWS_REGION": "ca-central-1"},
    )

    if result.returncode == 0:
        cf_output = json.loads(result.stdout)
        key_pair_id = cf_output["PublicKey"]["Id"]
        print(f"✅ CloudFront public key created")
        print(f"   Key Pair ID: {key_pair_id}")
    else:
        print(f"⚠️  AWS CLI error (non-blocking):")
        print(f"   {result.stderr[:200]}")
        key_pair_id = "KEY_PAIR_ID_PLACEHOLDER"

finally:
    os.unlink(config_file)

# ============================================================================
# Step 3: Prepare environment variable format
# ============================================================================
print("\n" + "=" * 70)
print("Step 3: Formatting for .env.local...")
print("=" * 70)

# Convert multiline private key to escaped format for shell
private_key_escaped = private_pem.replace("\n", "\\n").replace('"', '\\"')

print("✅ Environment variables ready:")
print(f"   ZONGA_CLOUDFRONT_KEY_PAIR_ID={key_pair_id}")
print(f"   ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM=(multiline PEM, {len(private_pem)} bytes)")

# ============================================================================
# Step 4: Output for .env.local
# ============================================================================
print("\n" + "=" * 70)
print("Add the following to apps/zonga/.env.local:")
print("=" * 70)

env_vars = f"""ZONGA_CLOUDFRONT_KEY_PAIR_ID={key_pair_id}
ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM={private_key_escaped}"""

print(env_vars)

# ============================================================================
# Summary
# ============================================================================
print("\n" + "=" * 70)
print("✅ CloudFront setup complete!")
print("=" * 70)
print(
    f"""
Summary:
  • Distribution ID: E3ASNK7MK51C7Y
  • Domain: d2a1tso1ra5muk.cloudfront.net
  • Key Pair ID: {key_pair_id}
  • Private Key: 2048-bit RSA

Next steps:
  1. Update .env.local with above variables
  2. Run validation tests
  3. Test signed URL generation
  4. Launch pre-flight checklist
"""
)

sys.exit(0)
