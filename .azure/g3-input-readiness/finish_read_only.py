"""Final read-only account/estate census; exclusive ledgered response files."""

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
    account = census.read_call("FINAL_ACCOUNT", ["account", "show", "--subscription", census.SUBSCRIPTION])
    if account["exitCode"] or account["response"]["id"] != census.SUBSCRIPTION or account["response"]["tenantId"] != census.TENANT:
        raise RuntimeError("ACCOUNT_TENANT_SUBSCRIPTION_BINDING")
    resources = census.read_call("FINAL_PROTECTED_G2_RESOURCES", [
        "resource", "list", "--subscription", census.SUBSCRIPTION,
        "--resource-group", "nzila-g2-proof-xre47vggs5uhw",
        "--query", "[].{id:id,type:type,name:name,location:location}",
    ])
    if resources["exitCode"] or len(resources["response"]) != 16:
        raise RuntimeError("PROTECTED_G2_RESOURCE_COUNT")


if __name__ == "__main__":
    main()
