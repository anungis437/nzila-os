"""Read-only owner eligibility evidence, not designation or owner mutation."""

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
    calls = [
        ("DIRECTORY_ROLES", "https://graph.microsoft.com/v1.0/directoryRoles",
         "{roles:value[].{id:id,displayName:displayName,roleTemplateId:roleTemplateId},nextLink:\"@odata.nextLink\"}"),
        ("DIRECTORY_ROLE_ASSIGNMENTS", "https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments",
         "{assignments:value[].{id:id,principalId:principalId,roleDefinitionId:roleDefinitionId,directoryScopeId:directoryScopeId},nextLink:\"@odata.nextLink\"}"),
    ]
    for name, url, selection in calls:
        census.read_call(name, ["rest", "--method", "GET", "--url", url, "--query", selection])
    census.read_call("AZURE_ROLE_ASSIGNMENTS", [
        "role", "assignment", "list", "--all", "--subscription", census.SUBSCRIPTION,
        "--query", "[].{principalId:principalId,principalType:principalType,roleDefinitionId:roleDefinitionId,roleDefinitionName:roleDefinitionName,scope:scope}",
    ])


if __name__ == "__main__":
    main()
