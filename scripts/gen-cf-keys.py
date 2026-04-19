#!/usr/bin/env python3
"""Generate RSA key pair for CloudFront signed URLs"""

import os

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

# Generate RSA key pair (2048 bits)
private_key = rsa.generate_private_key(
    public_exponent=65537, key_size=2048, backend=default_backend()
)

# Serialize private key to PEM
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption(),
)

# Serialize public key to PEM
public_pem = private_key.public_key().public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo,
)

# Save to temp directory
temp_dir = os.environ.get("TEMP", "/tmp")
private_path = os.path.join(temp_dir, "zonga-cf-private.pem")
public_path = os.path.join(temp_dir, "zonga-cf-public.pem")

with open(private_path, "wb") as f:
    f.write(private_pem)

with open(public_path, "wb") as f:
    f.write(public_pem)

# Output file paths
print("✅ RSA key pair generated successfully")
print(f"Private: {private_path}")
print(f"Public: {public_path}")

# Read and display for reference
with open(private_path, "r") as f:
    private_text = f.read()

print(f"\n📝 Private key (first 3 lines):")
for line in private_text.split("\n")[:3]:
    print(line)

print(f"\n✨ Saved to:")
print(f"  Private: {private_path}")
print(f"  Public: {public_path}")
