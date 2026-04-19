import os

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

pk = rsa.generate_private_key(65537, 2048, default_backend())
private_pem = pk.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.TraditionalOpenSSL,
    serialization.NoEncryption(),
).decode()

print("PRIVATE_KEY_START")
print(private_pem)
print("PRIVATE_KEY_END")
print("Key generated successfully")
