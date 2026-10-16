"""Public documentation/pricing only; never authenticate or call ARM/Graph/ACR."""

import urllib.parse
import urllib.request

from prepare import HERE, baseline, ensure, fresh, write

DOCS = {
    "CSE_LINUX": "https://learn.microsoft.com/en-us/azure/virtual-machines/extensions/custom-script-linux",
    "CSE_SOURCE": "https://raw.githubusercontent.com/Azure/custom-script-extension-linux/master/main/download.go",
    "ACR_ABAC": "https://learn.microsoft.com/en-us/azure/container-registry/container-registry-rbac-abac-repository-permissions",
    "ACR_SKUS": "https://learn.microsoft.com/en-us/azure/container-registry/container-registry-skus",
    "VM_SCHEMA": "https://learn.microsoft.com/en-us/azure/templates/microsoft.compute/2024-11-01/virtualmachines",
    "NETWORK_SCHEMA": "https://learn.microsoft.com/en-us/azure/templates/microsoft.network/2024-05-01/virtualnetworks",
    "NIC_SCHEMA": "https://learn.microsoft.com/en-us/azure/templates/microsoft.network/2024-05-01/networkinterfaces",
    "NSG_SCHEMA": "https://learn.microsoft.com/en-us/azure/templates/microsoft.network/2024-05-01/networksecuritygroups",
    "PE_SCHEMA": "https://learn.microsoft.com/en-us/azure/templates/microsoft.network/2024-05-01/privateendpoints",
    "ZONE_GROUP_SCHEMA": "https://learn.microsoft.com/en-us/azure/templates/microsoft.network/2024-05-01/privateendpoints/privatednszonegroups",
    "DNS_SCHEMA": "https://learn.microsoft.com/en-us/azure/templates/microsoft.network/2024-06-01/privatednszones",
    "DNS_LINK_SCHEMA": "https://learn.microsoft.com/en-us/azure/templates/microsoft.network/2024-06-01/privatednszones/virtualnetworklinks",
    "IDENTITY_SCHEMA": "https://learn.microsoft.com/en-us/azure/templates/microsoft.managedidentity/2023-01-31/userassignedidentities",
    "REGISTRY_SCHEMA": "https://learn.microsoft.com/en-us/azure/templates/microsoft.containerregistry/2025-11-01/registries",
    "ROLES_SCHEMA": "https://learn.microsoft.com/en-us/azure/templates/microsoft.authorization/2022-04-01/roleassignments",
    "CSE_SCHEMA": "https://learn.microsoft.com/en-us/azure/templates/microsoft.compute/2024-11-01/virtualmachines/extensions",
    "DISTRIBUTION": "https://raw.githubusercontent.com/opencontainers/distribution-spec/main/spec.md",
}
FILTERS = {
    "ACR": "serviceName eq 'Container Registry' and priceType eq 'Consumption'",
    "PE": "serviceName eq 'Azure Private Link' and priceType eq 'Consumption'",
    "DNS": "serviceName eq 'Azure DNS' and priceType eq 'Consumption'",
    "VM": "serviceName eq 'Virtual Machines' and armRegionName eq 'canadacentral' and armSkuName eq 'Standard_D2as_v5' and priceType eq 'Consumption'",
    "DISK": "serviceName eq 'Storage' and armRegionName eq 'canadacentral' and contains(productName, 'Managed Disks') and priceType eq 'Consumption'",
    "BANDWIDTH": "serviceName eq 'Bandwidth' and priceType eq 'Consumption'",
}


def fetch(url, maximum=5_000_000):
    with urllib.request.urlopen(url, timeout=90) as response:
        ensure(response.status == 200, "PUBLIC_FETCH_HTTP")
        raw = response.read(maximum + 1)
        ensure(len(raw) <= maximum, "PUBLIC_RESPONSE_BOUND")
        return raw, response.url


def main():
    fresh("CONCURRENCY_PUBLIC.json", baseline())
    directory = HERE / "public"
    directory.mkdir()
    ledger = []
    for name, url in DOCS.items():
        try:
            raw, final = fetch(url)
            write(directory / (name + ".txt"), raw)
            ledger.append({"name": name, "url": url, "finalUrl": final, "status": "PASS",
                           "bytes": len(raw), "kind": "PUBLIC_DOCS_NO_AUTH"})
        except (OSError, ValueError) as error:
            ledger.append({"name": name, "url": url, "status": "FAIL", "errorType": type(error).__name__})
    for name, query in FILTERS.items():
        url = "https://prices.azure.com/api/retail/prices?" + urllib.parse.urlencode({
            "api-version": "2023-01-01-preview", "currencyCode": "'CAD'", "$filter": query,
        })
        raw, final = fetch(url)
        write(directory / ("PRICE_" + name + ".json"), raw)
        ledger.append({"name": name, "url": url, "finalUrl": final, "status": "PASS",
                       "bytes": len(raw), "kind": "PUBLIC_CAD_RETAIL_NO_AUTH"})
    fresh("PUBLIC_SOURCE_LEDGER.json", {"requests": ledger, "cloudControlPlaneCalls": 0,
                                      "registryDataPlaneCalls": 0})
    print("PUBLIC_DOCUMENTATION_AND_CAD_RETAIL_CAPTURED")


if __name__ == "__main__":
    main()
