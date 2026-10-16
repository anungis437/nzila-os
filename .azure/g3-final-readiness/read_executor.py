"""Read-only lifecycle review, writing only into this unsealed readiness lane."""

import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("preserved_census", HERE.parent / "g3-live-readiness" / "read_census.py")
census = importlib.util.module_from_spec(spec)
spec.loader.exec_module(census)
census.HERE = HERE


def main():
    if sys.argv[1:] == ["protected-estate"]:
        census.read_call("PROTECTED_G2_RESOURCES", [
            "resource", "list", "--subscription", census.SUBSCRIPTION,
            "--resource-group", "nzila-g2-proof-xre47vggs5uhw",
            "--query", "[].{id:id,name:name,type:type,location:location}",
        ])
        return
    if sys.argv[1:]:
        raise RuntimeError("unapproved review stage")
    queries = [
        ("EXECUTOR_SP_OWNERS", "https://graph.microsoft.com/v1.0/servicePrincipals/66ec0cdf-ff35-42bd-9104-f424f7c8a455/owners",
         "{owners:value[].id,nextLink:\"@odata.nextLink\"}"),
        ("EXECUTOR_APP_OWNERS", "https://graph.microsoft.com/v1.0/applications/b0d785d9-2916-4301-b567-d45cef727e77/owners",
         "{owners:value[].id,nextLink:\"@odata.nextLink\"}"),
        ("DIRECTORY_CAPACITY", "https://graph.microsoft.com/v1.0/organization",
         "{organizations:value[].{id:id,directorySizeQuota:directorySizeQuota},nextLink:\"@odata.nextLink\"}"),
    ]
    for name, url, selection in queries:
        census.read_call(name, ["rest", "--method", "GET", "--url", url, "--query", selection])


if __name__ == "__main__":
    main()
