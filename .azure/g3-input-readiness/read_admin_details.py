"""Read active directory-admin candidates with explicit nondefault properties."""

import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("census", HERE.parent / "g3-live-readiness" / "read_census.py")
census = importlib.util.module_from_spec(spec)
spec.loader.exec_module(census)
census.HERE = HERE


def main():
    facts = json.loads((HERE / "DIRECTORY_ROLE_ASSIGNMENTS.json").read_text())["response"]
    if facts.get("nextLink"):
        raise RuntimeError("DIRECTORY_ROLE_ASSIGNMENTS_INCOMPLETE")
    principals = sorted({row["principalId"] for row in facts["assignments"]
                         if row["roleDefinitionId"] == "62e90394-69f5-4237-9190-012177145e10"
                         and row["directoryScopeId"] == "/"})
    if len(principals) > 8:
        raise RuntimeError("CANDIDATE_REVIEW_BOUND_EXCEEDED")
    for principal in principals:
        census.read_call("ADMIN_DETAIL_" + principal, [
            "rest", "--method", "GET", "--url", "https://graph.microsoft.com/v1.0/users/" + principal +
            "?$select=id,displayName,accountEnabled,userType,companyName,jobTitle",
        ])


if __name__ == "__main__":
    main()
