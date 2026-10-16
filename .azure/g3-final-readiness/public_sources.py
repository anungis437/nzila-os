"""Public reference provenance and exact sections; no Azure account access."""

import datetime
import hashlib
import json
from pathlib import Path
import re
import urllib.request

HERE = Path(__file__).resolve().parent
SOURCES = {
    "environmentUsage": (
        "https://learn.microsoft.com/en-us/rest/api/resource-manager/containerapps/managed-environment-usages/list?view=rest-resource-manager-containerapps-2025-07-01&accept=text/markdown",
        ["ManagedEnvironmentConsumptionCores", "currentValue", "nextLink", "GET https://management.azure.com"],
    ),
    "extensionDelivery": (
        "https://learn.microsoft.com/en-us/azure/virtual-machines/extensions/custom-script-linux?accept=text/markdown",
        ["256 KB", "managedIdentity", "fileUris", "private"],
    ),
    "identity": (
        "https://learn.microsoft.com/en-us/azure/container-apps/managed-identity?accept=text/markdown",
        ["IDENTITY_ENDPOINT", "2019-08-01", "lifecycle", "`None`"],
    ),
    "applicationSchema": (
        "https://learn.microsoft.com/en-us/azure/templates/microsoft.app/2025-07-01/containerapps?accept=text/markdown",
        ["identitySettings", "lifecycle:", "timeoutSeconds:", "maxReplicas:", "env:"],
    ),
    "environmentSchema": (
        "https://learn.microsoft.com/en-us/azure/templates/microsoft.app/2025-07-01/managedenvironments?accept=text/markdown",
        ["infrastructureResourceGroup", "publicNetworkAccess:", "internal:", "workloadProfiles:"],
    ),
}


def main():
    output = {"capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "sources": {}}
    for name, (url, patterns) in SOURCES.items():
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read(2_000_001)
        if len(data) > 2_000_000:
            raise RuntimeError("PUBLIC_SOURCE_SIZE_EXCEEDED")
        text = data.decode("utf-8")
        excerpts = {}
        for pattern in patterns:
            matches = list(re.finditer(re.escape(pattern), text))
            if not matches:
                raise RuntimeError("PUBLIC_REFERENCE_TERM_MISSING: " + name + ":" + pattern)
            excerpts[pattern] = [text[max(0, match.start()-150):match.end()+500] for match in matches[:3]]
        output["sources"][name] = {"url": url, "contentSha256": hashlib.sha256(data).hexdigest(),
                                  "excerpts": excerpts}
    with (HERE / "PUBLIC_REFERENCE_PROVENANCE.json").open("x", encoding="utf-8") as file:
        json.dump(output, file, indent=2)
        file.write("\n")
    print("PUBLIC_REFERENCE_PROVENANCE = PASS")


if __name__ == "__main__":
    main()
