"""
tooling/ml/lib/io_blob.py

Azure Blob Storage helpers for ML artifacts.
Downloads datasets and uploads model artifacts using the Azure SDK.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

from azure.storage.blob import BlobServiceClient


def _client() -> BlobServiceClient:
    account = os.environ["AZURE_STORAGE_ACCOUNT_NAME"]
    key = os.environ["AZURE_STORAGE_ACCOUNT_KEY"]
    return BlobServiceClient(
        account_url=f"https://{account}.blob.core.windows.net",
        credential=key,
    )


def download_blob(container: str, blob_path: str, local_path: Path) -> str:
    """Download a blob to a local file. Returns sha256 of downloaded content."""
    local_path.parent.mkdir(parents=True, exist_ok=True)
    client = _client()
    blob_client = client.get_blob_client(container=container, blob=blob_path)
    data = blob_client.download_blob().readall()
    local_path.write_bytes(data)
    sha = hashlib.sha256(data).hexdigest()
    print(f"  ↓ {container}/{blob_path} → {local_path} (sha256: {sha[:12]}...)")
    return sha


def upload_blob(container: str, blob_path: str, local_path: Path) -> tuple[str, int]:
    """Upload a local file to Blob. Returns (sha256, size_bytes)."""
    data = local_path.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    client = _client()
    blob_client = client.get_blob_client(container=container, blob=blob_path)
    blob_client.upload_blob(data, overwrite=True)
    print(f"  ↑ {local_path} → {container}/{blob_path} (sha256: {sha[:12]}..., {len(data)} bytes)")
    return sha, len(data)


def upload_bytes(container: str, blob_path: str, data: bytes, content_type: str = "application/octet-stream") -> tuple[str, int]:
    """Upload raw bytes to Blob. Returns (sha256, size_bytes)."""
    sha = hashlib.sha256(data).hexdigest()
    client = _client()
    blob_client = client.get_blob_client(container=container, blob=blob_path)
    blob_client.upload_blob(
        data,
        overwrite=True,
        content_settings={"content_type": content_type},
    )
    print(f"  ↑ [bytes] → {container}/{blob_path} (sha256: {sha[:12]}..., {len(data)} bytes)")
    return sha, len(data)
