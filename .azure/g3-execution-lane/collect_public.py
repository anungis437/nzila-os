"""Bounded public documentation/CAD provenance for execution-lane comparison."""

import datetime
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request

HERE = Path(__file__).resolve().parent
DOCS = {
    "privateRegistry": "https://learn.microsoft.com/en-us/azure/container-registry/container-registry-private-endpoints",
    "registryIPRules": "https://learn.microsoft.com/en-us/azure/container-registry/container-registry-access-selected-networks",
    "registryImport": "https://learn.microsoft.com/en-us/azure/container-registry/container-registry-import-images",
    "agentPools": "https://learn.microsoft.com/en-us/azure/container-registry/tasks-agent-pools",
    "tasks": "https://learn.microsoft.com/en-us/azure/container-registry/container-registry-tasks-overview",
    "defaultOutbound": "https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/default-outbound-access",
    "nat": "https://learn.microsoft.com/en-us/azure/nat-gateway/nat-gateway-resource",
    "blobIdentity": "https://learn.microsoft.com/en-us/azure/storage/blobs/authorize-access-azure-active-directory",
    "blobPrivate": "https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints",
    "extension": "https://learn.microsoft.com/en-us/azure/virtual-machines/extensions/custom-script-linux",
    "managedRunCommand": "https://learn.microsoft.com/en-us/azure/virtual-machines/linux/run-command-managed",
    "delegation": "https://learn.microsoft.com/en-us/azure/role-based-access-control/delegate-role-assignments-examples",
    "registrySchema": "https://learn.microsoft.com/en-us/azure/templates/microsoft.containerregistry/2025-11-01/registries",
}


def request(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        raw = response.read(2_000_001)
    if len(raw) > 2_000_000:
        raise RuntimeError("PUBLIC_RESPONSE_SIZE_EXCEEDED")
    return raw


def main():
    document_dir = HERE / "public"
    document_dir.mkdir()
    documents = {}
    for name, url in DOCS.items():
        raw = request(url + "?accept=text/markdown")
        text = raw.decode("utf-8")
        if "# " not in text:
            raise RuntimeError("PUBLIC_DOCUMENT_NOT_MARKDOWN: " + name)
        filename = name + ".txt"
        with (document_dir / filename).open("xb") as file:
            file.write(raw)
        documents[name] = {"url": url, "path": "public\\" + filename,
                           "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)}
    pricing = []
    for name, expression in (
        ("registry", "serviceName eq 'Container Registry' and priceType eq 'Consumption'"),
        ("nat", "serviceName eq 'Virtual Network' and contains(meterName, 'NAT') and priceType eq 'Consumption'"),
        ("vault", "serviceName eq 'Key Vault' and priceType eq 'Consumption'"),
    ):
        url = "https://prices.azure.com/api/retail/prices?" + urllib.parse.urlencode({
            "api-version": "2023-01-01-preview", "currencyCode": "CAD", "$filter": expression,
        })
        pages = []
        for _ in range(10):
            data = json.loads(request(url))
            pages.append({"url": url, "response": data})
            url = data.get("NextPageLink")
            if not url:
                break
            parsed = urllib.parse.urlparse(url)
            if parsed.scheme != "https" or parsed.hostname != "prices.azure.com":
                raise RuntimeError("UNEXPECTED_PRICING_PAGINATION_HOST")
        else:
            raise RuntimeError("PRICING_PAGINATION_BOUND_EXCEEDED")
        pricing.append({"component": name, "filter": expression, "pages": pages})
    with (HERE / "PUBLIC_SOURCES.json").open("x", encoding="utf-8") as file:
        json.dump({"capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   "documents": documents}, file, indent=2)
        file.write("\n")
    with (HERE / "PUBLIC_CAD_PRICING.json").open("x", encoding="utf-8") as file:
        json.dump({"currency": "CAD", "observations": pricing}, file, indent=2)
        file.write("\n")
    print("PUBLIC_REFERENCE_AND_CAD_COLLECTION = PASS")


if __name__ == "__main__":
    main()
