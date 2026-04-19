#!/usr/bin/env python3
"""Register a CloudFront RSA public key using boto3 and update .env.local"""

import os
import sys

# Generate RSA key pair
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

private_key = rsa.generate_private_key(
    public_exponent=65537, key_size=2048, backend=default_backend()
)

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

print("RSA 2048 key pair generated.")

# Register with CloudFront via boto3
import boto3

cf_client = boto3.client(
    "cloudfront",
    region_name="us-east-1",  # CloudFront is global, uses us-east-1
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
)

import binascii

caller_ref = "zonga-cf-key-" + binascii.hexlify(os.urandom(4)).decode()

try:
    response = cf_client.create_public_key(
        PublicKeyConfig={
            "CallerReference": caller_ref,
            "Name": "zonga-music-distribution",
            "EncodedKey": public_pem,
            "Comment": "Zonga signed URL delivery (generated 2026-04-19)",
        }
    )
    key_pair_id = response["PublicKey"]["Id"]
    print(f"CloudFront public key registered: {key_pair_id}")
except Exception as e:
    print(f"ERROR registering public key: {e}", file=sys.stderr)
    sys.exit(1)

# Update .env.local
env_file = os.path.join(os.path.dirname(__file__), "..", "apps", "zonga", ".env.local")
env_file = os.path.normpath(env_file)

with open(env_file, "r") as f:
    content = f.read()

# Replace placeholder key pair lines
private_key_escaped = private_pem.replace("\n", "\\n")

# Remove existing commented-out and placeholder lines, insert real values
lines = content.splitlines()
new_lines = []
skip_next = False
for line in lines:
    if line.startswith("# ZONGA_CLOUDFRONT_KEY_PAIR_ID=") or line.startswith(
        "# ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM="
    ):
        continue  # Remove old comment placeholders
    if line.startswith("ZONGA_CLOUDFRONT_KEY_PAIR_ID=") or line.startswith(
        "ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM="
    ):
        continue  # Remove existing values to replace below
    new_lines.append(line)

# Add the real values at the end (before the last empty line if any)
output = "\n".join(new_lines)
if not output.endswith("\n"):
    output += "\n"
output += f"ZONGA_CLOUDFRONT_KEY_PAIR_ID={key_pair_id}\n"
output += f"ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM={private_key_escaped}\n"

with open(env_file, "w") as f:
    f.write(output)

print(f".env.local updated with key pair ID: {key_pair_id}")
print(f"Private key length: {len(private_pem)} bytes")
