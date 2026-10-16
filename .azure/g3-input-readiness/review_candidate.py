"""Specific read-only candidate corroboration and exact VM image metadata."""

import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("census", HERE.parent / "g3-live-readiness" / "read_census.py")
census = importlib.util.module_from_spec(spec)
spec.loader.exec_module(census)
census.HERE = HERE
PRINCIPAL = "fcb34d85-3e87-4213-9fc4-435656b17f44"


def main():
    census.read_call("OWNER_CANDIDATE_USER", [
        "rest", "--method", "GET", "--url", "https://graph.microsoft.com/v1.0/users/" + PRINCIPAL,
        "--query", "{id:id,displayName:displayName,accountEnabled:accountEnabled,userType:userType,companyName:companyName,jobTitle:jobTitle}",
    ])
    census.read_call("OWNER_CANDIDATE_OWNED_APPS", [
        "rest", "--method", "GET", "--url", "https://graph.microsoft.com/v1.0/users/" + PRINCIPAL + "/ownedObjects",
        "--query", "{objects:value[].{id:id,type:\"@odata.type\",displayName:displayName,appId:appId},nextLink:\"@odata.nextLink\"}",
    ])
    census.read_call("VM_IMAGE_METADATA", [
        "rest", "--method", "GET", "--url",
        "https://management.azure.com/subscriptions/" + census.SUBSCRIPTION +
        "/providers/Microsoft.Compute/locations/canadacentral/publishers/Canonical/artifacttypes/vmimage/offers/ubuntu-24_04-lts/skus/server/versions/24.04.202609040?api-version=2024-03-01",
    ])


if __name__ == "__main__":
    main()
