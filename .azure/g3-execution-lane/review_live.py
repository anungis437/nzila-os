"""Reuse the sealed read-only allowlist without appending to its ledger."""

import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("census", HERE.parent / "g3-live-readiness" / "read_census.py")
census = importlib.util.module_from_spec(spec)
spec.loader.exec_module(census)
census.HERE = HERE


def main():
    account = census.read_call("ACCOUNT", ["account", "show", "--subscription", census.SUBSCRIPTION])
    if account["exitCode"] != 0:
        raise RuntimeError("ACCOUNT_REVIEW_FAILED")
    response = account["response"]
    if response["id"] != census.SUBSCRIPTION or response["tenantId"] != census.TENANT:
        raise RuntimeError("ACCOUNT_BINDING_MISMATCH")
    census.read_call("PROTECTED_G2_RESOURCES", [
        "resource", "list", "--subscription", census.SUBSCRIPTION,
        "--resource-group", "nzila-g2-proof-xre47vggs5uhw",
        "--query", "[].{id:id,name:name,type:type,location:location}",
    ])


if __name__ == "__main__":
    main()
